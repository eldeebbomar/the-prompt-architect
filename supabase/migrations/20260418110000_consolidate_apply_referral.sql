-- Two apply_referral overloads coexist in prod: (uuid,text) from the
-- referral-system migration and (text,uuid) from the 20260327 migration.
-- They have incompatible return shapes and different guarantees — the new
-- one skips the "already referred" check entirely, so a user could refer
-- multiple times. Drop both and ship one canonical function using the
-- (p_user_id uuid, p_referral_code text) signature the edge function
-- already calls.

DROP FUNCTION IF EXISTS public.apply_referral(uuid, text);
DROP FUNCTION IF EXISTS public.apply_referral(text, uuid);

CREATE FUNCTION public.apply_referral(
  p_user_id uuid,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer_id uuid;
  _already_referred boolean;
  _rows_updated integer;
  _normalized_code text;
BEGIN
  IF p_referral_code IS NULL OR length(trim(p_referral_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  _normalized_code := lower(trim(p_referral_code));

  -- Lock the caller row so concurrent applications serialise.
  SELECT (referred_by IS NOT NULL) INTO _already_referred
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF _already_referred THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  SELECT id INTO _referrer_id
  FROM public.profiles
  WHERE lower(referral_code) = _normalized_code
    AND id != p_user_id;

  IF _referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  UPDATE public.profiles
  SET referred_by = _referrer_id
  WHERE id = p_user_id AND referred_by IS NULL;
  GET DIAGNOSTICS _rows_updated = ROW_COUNT;

  IF _rows_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, 1, 'referral', 'Referral bonus: welcome credit');

  UPDATE public.profiles
  SET credits = credits + 1,
      total_credits_purchased = total_credits_purchased + 1
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (_referrer_id, 1, 'referral', 'Referral reward: friend signed up');

  UPDATE public.profiles
  SET credits = credits + 1,
      total_credits_purchased = total_credits_purchased + 1,
      referral_count = referral_count + 1
  WHERE id = _referrer_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Service role only. The edge function `apply-referral` uses the service
-- role client; authenticated users must not call the RPC directly because
-- the first arg is `p_user_id` and a malicious caller could mark another
-- user as "referred by me" and siphon credits.
REVOKE EXECUTE ON FUNCTION public.apply_referral(uuid, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral(uuid, text) TO service_role;

-- Make referral-code lookups case-insensitive and indexed.
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code_lower
  ON public.profiles (lower(referral_code));
