-- ============================================================
-- RATE LIMITING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access (which is what we want)

CREATE OR REPLACE FUNCTION public.rate_limit_check(
  p_user_id uuid,
  p_bucket text,
  p_max_hits int,
  p_window_seconds int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_hits int;
  v_now timestamptz := now();
  v_reset_at timestamptz;
BEGIN
  INSERT INTO public.rate_limit_buckets (user_id, bucket, window_start, hits)
  VALUES (p_user_id, p_bucket, v_now, 1)
  ON CONFLICT (user_id, bucket) DO UPDATE
    SET hits = CASE
          WHEN public.rate_limit_buckets.window_start + (p_window_seconds || ' seconds')::interval < v_now
            THEN 1
          ELSE public.rate_limit_buckets.hits + 1
        END,
        window_start = CASE
          WHEN public.rate_limit_buckets.window_start + (p_window_seconds || ' seconds')::interval < v_now
            THEN v_now
          ELSE public.rate_limit_buckets.window_start
        END
  RETURNING hits, window_start INTO v_hits, v_window_start;

  v_reset_at := v_window_start + (p_window_seconds || ' seconds')::interval;

  IF v_hits > p_max_hits THEN
    RETURN jsonb_build_object(
      'throttled', true,
      'retry_after', GREATEST(1, EXTRACT(EPOCH FROM (v_reset_at - v_now))::int)
    );
  END IF;

  RETURN jsonb_build_object('throttled', false, 'hits', v_hits);
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_check(uuid, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(uuid, text, int, int) TO service_role;

-- ============================================================
-- PROJECT TEAM (invites + members)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);

CREATE TABLE IF NOT EXISTS public.project_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_project_invites_token ON public.project_invites(token);
CREATE INDEX IF NOT EXISTS idx_project_invites_email ON public.project_invites(invited_email);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

-- project_members policies
CREATE POLICY "members_select_owner_or_self"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.owns_project(project_id) OR user_id = auth.uid());

CREATE POLICY "members_delete_owner_or_self"
  ON public.project_members FOR DELETE TO authenticated
  USING (public.owns_project(project_id) OR user_id = auth.uid());

-- project_invites policies
CREATE POLICY "invites_select_owner"
  ON public.project_invites FOR SELECT TO authenticated
  USING (public.owns_project(project_id));

-- Allow looking up invite by token (needed for accept flow)
CREATE POLICY "invites_select_by_token"
  ON public.project_invites FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "invites_insert_owner"
  ON public.project_invites FOR INSERT TO authenticated
  WITH CHECK (public.owns_project(project_id) AND invited_by = auth.uid());

CREATE POLICY "invites_delete_owner"
  ON public.project_invites FOR DELETE TO authenticated
  USING (public.owns_project(project_id));

-- accept_project_invite RPC
CREATE OR REPLACE FUNCTION public.accept_project_invite(
  p_user_id uuid,
  p_token uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.project_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.project_invites
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (v_invite.project_id, p_user_id, v_invite.role)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.project_invites SET accepted_at = now() WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'project_id', v_invite.project_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_project_invite(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_project_invite(uuid, uuid) TO authenticated, service_role;