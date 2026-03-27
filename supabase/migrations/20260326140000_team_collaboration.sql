-- Project members table for team collaboration
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  invited_email TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- Pending invites (before user accepts)
CREATE TABLE IF NOT EXISTS project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, invited_email)
);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;

-- RLS: project owner can manage members
CREATE POLICY "Project owners can manage members"
  ON project_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid())
  );

-- RLS: members can view their own membership
CREATE POLICY "Members can view own membership"
  ON project_members FOR SELECT
  USING (user_id = auth.uid());

-- RLS: project owners can manage invites
CREATE POLICY "Project owners can manage invites"
  ON project_invites FOR ALL
  USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid())
  );

-- Allow members to view projects they're invited to
CREATE POLICY "Members can view shared projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
    )
  );

-- Allow members to view prompts of shared projects
CREATE POLICY "Members can view prompts of shared projects"
  ON generated_prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = generated_prompts.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- Allow members to view conversations of shared projects
CREATE POLICY "Members can view conversations of shared projects"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = conversations.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- RPC to accept an invite
CREATE OR REPLACE FUNCTION accept_project_invite(p_user_id UUID, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Lock the invite row to prevent concurrent acceptance
  SELECT * INTO v_invite FROM project_invites
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now()
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  END IF;

  -- Mark invite as accepted
  UPDATE project_invites SET accepted_at = now() WHERE id = v_invite.id;

  -- Add to project_members
  INSERT INTO project_members (project_id, user_id, role, invited_by, invited_email, accepted_at)
  VALUES (v_invite.project_id, p_user_id, v_invite.role, v_invite.invited_by, v_invite.invited_email, now())
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'project_id', v_invite.project_id);
END;
$$;
