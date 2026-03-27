-- Extension linking: short-lived pairing codes + persistent session tokens

-- extension_link_codes: 6-digit codes that expire in 5 minutes
CREATE TABLE IF NOT EXISTS public.extension_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only 1 unused code per user (expiry checked at query time, not in index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_link_codes_active
  ON public.extension_link_codes (user_id)
  WHERE used = false;

CREATE INDEX IF NOT EXISTS idx_ext_link_codes_lookup
  ON public.extension_link_codes (code)
  WHERE used = false;

-- extension_sessions: long-lived tokens for Chrome extension auth
CREATE TABLE IF NOT EXISTS public.extension_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_name text NOT NULL DEFAULT 'Chrome Extension',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ext_sessions_token ON public.extension_sessions (token);
CREATE INDEX IF NOT EXISTS idx_ext_sessions_user ON public.extension_sessions (user_id);

-- RLS
ALTER TABLE public.extension_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'extension_link_codes' AND policyname = 'Users can view own link codes') THEN
    CREATE POLICY "Users can view own link codes"
      ON public.extension_link_codes FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'extension_sessions' AND policyname = 'Users can view own extension sessions') THEN
    CREATE POLICY "Users can view own extension sessions"
      ON public.extension_sessions FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'extension_sessions' AND policyname = 'Users can delete own extension sessions') THEN
    CREATE POLICY "Users can delete own extension sessions"
      ON public.extension_sessions FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
