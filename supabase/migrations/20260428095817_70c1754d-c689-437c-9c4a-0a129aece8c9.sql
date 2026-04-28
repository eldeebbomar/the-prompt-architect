
CREATE TABLE IF NOT EXISTS public.project_idempotency (
  idempotency_key uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_idempotency ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_project_atomic(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Credit check
  v_credits := public.check_credits(p_user_id);
  IF v_credits IS NULL OR v_credits < 1 THEN
    RETURN jsonb_build_object('error', 'insufficient_credits');
  END IF;

  -- Insert project
  INSERT INTO public.projects (user_id, name, description, status)
  VALUES (p_user_id, p_name, NULLIF(p_description, ''), 'discovery')
  RETURNING * INTO v_project;

  -- Deduct credit (existing function signature: user_id, project_id, description)
  PERFORM public.deduct_credit(p_user_id, v_project.id, 'Project created: ' || p_name);

  -- Record idempotency
  INSERT INTO public.project_idempotency (idempotency_key, user_id, project_id)
  VALUES (p_idempotency_key, p_user_id, v_project.id);

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_atomic(uuid, text, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_atomic(uuid, text, text, uuid) TO service_role;
