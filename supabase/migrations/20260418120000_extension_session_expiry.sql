-- Extension sessions had no expiry. A token created once worked forever,
-- even after plan cancellation. Add expires_at (default +30 days), backfill
-- existing rows, and create a cleanup helper.

ALTER TABLE public.extension_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill existing rows (created_at + 30d) so they all have an expiry.
UPDATE public.extension_sessions
  SET expires_at = created_at + interval '30 days'
  WHERE expires_at IS NULL;

ALTER TABLE public.extension_sessions
  ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE public.extension_sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

CREATE INDEX IF NOT EXISTS idx_ext_sessions_expires_at
  ON public.extension_sessions (expires_at);

-- Helper function: delete expired sessions. Call from a cron or on demand.
CREATE OR REPLACE FUNCTION public.cleanup_expired_extension_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer;
BEGIN
  DELETE FROM public.extension_sessions WHERE expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_extension_sessions()
  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_extension_sessions() TO service_role;
