
-- Add missing columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Add missing columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count integer NOT NULL DEFAULT 0;

-- Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL DEFAULT 'Default',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_select_own" ON public.api_keys FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "api_keys_insert_own" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "api_keys_update_own" ON public.api_keys FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "api_keys_delete_own" ON public.api_keys FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Create email_send_log table
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  template_name text,
  recipient_email text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

-- Allow public SELECT on projects when is_public = true
CREATE POLICY "projects_select_public" ON public.projects FOR SELECT USING (is_public = true);

-- Generate referral codes for existing users
UPDATE public.profiles SET referral_code = substr(md5(id::text || now()::text), 1, 8) WHERE referral_code IS NULL;

-- Trigger to auto-generate referral code on new profiles
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := substr(md5(NEW.id::text || now()::text), 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- get_admin_stats function
CREATE OR REPLACE FUNCTION public.get_admin_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
  _result jsonb;
BEGIN
  SELECT is_admin INTO _is_admin FROM public.profiles WHERE id = p_user_id;
  IF NOT COALESCE(_is_admin, false) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'total_projects', (SELECT count(*) FROM public.projects),
    'total_prompts', (SELECT count(*) FROM public.generated_prompts),
    'completed_projects', (SELECT count(*) FROM public.projects WHERE status IN ('ready', 'completed')),
    'generating_projects', (SELECT count(*) FROM public.projects WHERE status = 'generating'),
    'discovery_projects', (SELECT count(*) FROM public.projects WHERE status = 'discovery'),
    'total_purchases', (SELECT count(*) FROM public.credit_transactions WHERE type = 'purchase'),
    'total_referrals', (SELECT COALESCE(sum(referral_count), 0) FROM public.profiles),
    'daily_signups', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS count
        FROM public.profiles
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1 ORDER BY 1
      ) t
    ),
    'daily_projects', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS count
        FROM public.projects
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1 ORDER BY 1
      ) t
    ),
    'daily_revenue', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS count, COALESCE(sum(amount), 0) AS credits
        FROM public.credit_transactions
        WHERE type = 'purchase' AND created_at >= now() - interval '30 days'
        GROUP BY 1 ORDER BY 1
      ) t
    ),
    'plan_distribution', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT plan, count(*) AS count FROM public.profiles GROUP BY plan ORDER BY count DESC
      ) t
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- apply_referral function
CREATE OR REPLACE FUNCTION public.apply_referral(p_referral_code text, p_new_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referrer_id uuid;
BEGIN
  SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = p_referral_code AND id != p_new_user_id;
  IF _referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
  END IF;

  -- Award 1 credit to referrer
  UPDATE public.profiles SET credits = credits + 1, referral_count = referral_count + 1 WHERE id = _referrer_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (_referrer_id, 1, 'referral', 'Referral bonus');

  -- Award 1 credit to new user
  UPDATE public.profiles SET credits = credits + 1 WHERE id = p_new_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (p_new_user_id, 1, 'referral', 'Referral welcome bonus');

  RETURN jsonb_build_object('success', true);
END;
$$;
