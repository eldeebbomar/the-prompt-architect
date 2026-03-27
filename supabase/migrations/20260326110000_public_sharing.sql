-- Add is_public column to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Allow anonymous read access to public projects
CREATE POLICY "Anyone can view public projects"
  ON projects FOR SELECT
  USING (is_public = true);

-- Allow anonymous read access to prompts of public projects
CREATE POLICY "Anyone can view prompts of public projects"
  ON generated_prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = generated_prompts.project_id
        AND projects.is_public = true
    )
  );
