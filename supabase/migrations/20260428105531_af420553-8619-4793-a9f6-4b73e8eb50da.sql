-- Stop deducting a credit at project creation. n8n is the credit authority
-- and charges when prompts are actually generated. Project creation only
-- needs to verify the user has at least 1 credit available.
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
BEGIN
  -- Idempotency replay
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

  -- Credit check only (no deduction). n8n deducts when prompts generate.
  v_credits := public.check_credits(p_user_id);
  IF v_credits IS NULL OR v_credits < 1 THEN
    RETURN jsonb_build_object('error', 'insufficient_credits');
  END IF;

  -- Insert project
  INSERT INTO public.projects (user_id, name, description, status)
  VALUES (p_user_id, p_name, NULLIF(p_description, ''), 'discovery')
  RETURNING * INTO v_project;

  -- Record idempotency
  INSERT INTO public.project_idempotency (idempotency_key, user_id, project_id)
  VALUES (p_idempotency_key, p_user_id, v_project.id);

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'idempotent_replay', false
  );
END;
$function$;

-- Refund the affected user (test account) charged earlier today by the old logic.
-- Restore their credit and reset the stuck project so they can retry generation.
UPDATE public.profiles
SET credits = credits + 1
WHERE id = 'c5a1e739-0b52-4da1-910c-2b8253eaa028' AND credits = 0;

INSERT INTO public.credit_transactions (user_id, amount, type, description, project_id)
VALUES (
  'c5a1e739-0b52-4da1-910c-2b8253eaa028',
  1,
  'bonus',
  'Refund: project-creation charge removed',
  'be9aa658-203a-4d2e-92a1-cfefa08a2f9f'
);

UPDATE public.projects
SET status = 'discovery'
WHERE id = 'be9aa658-203a-4d2e-92a1-cfefa08a2f9f' AND status = 'generating';