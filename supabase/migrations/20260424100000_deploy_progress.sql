-- Partial-deploy state lives in `projects.metadata` (jsonb). The Chrome
-- extension reports per-prompt progress via two new endpoints in the
-- `extension-api` edge function (`POST /projects/:id/deploy-progress`,
-- `POST /projects/:id/deploy-error`). The app reads the result via the
-- existing project record + the new `GET /projects/:id` endpoint that
-- promotes the deploy fields out of metadata for convenience.
--
-- Canonical metadata keys (all optional, all live under `projects.metadata`):
--   last_deployed_index    integer   zero-indexed, monotonic
--   total_prompts          integer   denominator the extension reported
--   last_progress_at       timestamp ISO; >5min stale ⇒ treat as inactive
--   paused                 boolean   user pressed pause
--   deploy_error           text      visible to user on the project page
--   deploy_error_at        timestamp ISO
--   deploy_error_code      text      machine-readable category
--   deployed_at            timestamp ISO; presence ⇒ project is complete
--   deployed_via           text      'chrome_extension' currently
--   deployed_prompt_count  integer
--
-- This migration:
-- 1. Adds a partial GIN index for fast lookups of "active deploys"
--    (rows where progress is being tracked but the project isn't yet done).
-- 2. Documents the schema in COMMENT form so future devs see it via \d+.

CREATE INDEX IF NOT EXISTS projects_metadata_active_deploy_idx
  ON public.projects USING gin (metadata jsonb_path_ops)
  WHERE metadata ? 'last_deployed_index'
    AND NOT (metadata ? 'deployed_at');

COMMENT ON COLUMN public.projects.metadata IS
  'Free-form jsonb. Canonical deploy keys: last_deployed_index, total_prompts, '
  'last_progress_at, paused, deploy_error, deploy_error_at, deploy_error_code, '
  'deployed_at, deployed_via, deployed_prompt_count. See migration '
  '20260424100000_deploy_progress.sql for the full schema description.';
