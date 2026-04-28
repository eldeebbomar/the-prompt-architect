-- Race-safe credit check at project creation.
--
-- Why: the previous create_project_atomic only checked `credits >= 1`
-- without locking, so two concurrent project-create calls by the same user
-- with `credits = 1` could both pass the check and create projects. The
-- charge happens later (DB trigger on status='ready'), and the second
-- charge silently fails because credits are already 0 — user gets a free
-- generation.
--
-- Fix: lock the user's profile row, then check `credits - in_flight >= 1`
-- where `in_flight` is the count of the user's projects currently in
-- 'discovery' or 'generating' (not yet charged). Each pending project is
-- treated as already consuming a credit slot. Concurrent creates serialize
-- on the FOR UPDATE lock and see each other's in-flight projects.
--
-- This does NOT change:
--   * The deferred-deduction model (credit only decrements when status
--     flips to 'ready', via the trg_charge_on_project_ready trigger).
--   * The idempotent replay path (still returns the existing project for
--     a known idempotency_key without touching credits).
--   * The trigger logic itself.
--   * n8n workflows.
--   * Unlimited-plan behavior (skipped via the plan check).
--
-- Side effect (intentional): if a user has projects stuck in 'discovery'
-- or 'generating' (never reached 'ready'), those projects continue to
-- occupy a credit slot until the user either retries generation
-- successfully or deletes the stuck project. This matches the user's
-- mental model — "I started a project, it's mine until I finish or
-- abandon it".

CREATE OR REPLACE FUNCTION public.create_project_atomic(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_project_id uuid;
  v_project public.projects%ROWTYPE;
  v_credits int;
  v_plan text;
  v_in_flight int;
BEGIN
  -- Idempotent replay: if this idempotency key has been seen before for
  -- this user, return the original project regardless of current credit
  -- state. Retries from a flaky network must always be a no-op.
  SELECT project_id INTO v_existing_project_id
  FROM public.project_idempotency
  WHERE idempotency_key = p_idempotency_key AND user_id = p_user_id;

  IF v_existing_project_id IS NOT NULL THEN
    SELECT * INTO v_project FROM public.projects WHERE id = v_existing_project_id;
    RETURN jsonb_build_object(
      'project', to_jsonb(v_project),
      'idempotent_replay', true
    );
  END IF;

  -- Serialize concurrent creates by the same user. The lock is released
  -- when this transaction commits or rolls back. Cross-user creates are
  -- not blocked because each user has a distinct profile row.
  SELECT credits, plan
    INTO v_credits, v_plan
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

  -- Unlimited users skip the credit accounting entirely.
  IF v_plan IS DISTINCT FROM 'unlimited' THEN
    -- Count this user's projects that have not yet been charged. The
    -- charge fires on transition to 'ready' (via trg_charge_on_project_ready),
    -- so any project still in 'discovery' or 'generating' is consuming a
    -- yet-to-be-deducted credit slot.
    SELECT count(*)::int
      INTO v_in_flight
      FROM public.projects
      WHERE user_id = p_user_id
        AND status IN ('discovery', 'generating');

    IF (COALESCE(v_credits, 0) - v_in_flight) < 1 THEN
      RETURN jsonb_build_object('error', 'insufficient_credits');
    END IF;
  END IF;

  -- All checks passed — insert the project and record idempotency.
  INSERT INTO public.projects (user_id, name, description, status)
  VALUES (p_user_id, p_name, NULLIF(p_description, ''), 'discovery')
  RETURNING * INTO v_project;

  INSERT INTO public.project_idempotency (idempotency_key, user_id, project_id)
  VALUES (p_idempotency_key, p_user_id, v_project.id);

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'idempotent_replay', false
  );
END;
$function$;
