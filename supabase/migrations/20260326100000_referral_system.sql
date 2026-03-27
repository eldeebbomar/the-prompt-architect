-- Add referral columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Generate referral codes for existing users
UPDATE profiles
SET referral_code = substr(md5(random()::text || id::text), 1, 8)
WHERE referral_code IS NULL;

-- Make referral_code NOT NULL with a default for new users
ALTER TABLE profiles
  ALTER COLUMN referral_code SET NOT NULL,
  ALTER COLUMN referral_code SET DEFAULT substr(md5(random()::text || gen_random_uuid()::text), 1, 8);

-- Index for quick code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- RPC to apply a referral and grant credits to both parties
CREATE OR REPLACE FUNCTION apply_referral(
  p_user_id UUID,
  p_referral_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id UUID;
  v_already_referred BOOLEAN;
  v_rows_updated INTEGER;
BEGIN
  -- Lock the user row to prevent concurrent referral applications
  SELECT (referred_by IS NOT NULL) INTO v_already_referred
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_already_referred THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  -- Find the referrer by code
  SELECT id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = p_referral_code AND id != p_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- Atomically set referred_by only if still null (double-check)
  UPDATE profiles
  SET referred_by = v_referrer_id
  WHERE id = p_user_id AND referred_by IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  -- Grant 1 bonus credit to the referred user
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, 1, 'bonus', 'Referral bonus: welcome credit');

  UPDATE profiles
  SET credits = credits + 1,
      total_credits_purchased = total_credits_purchased + 1
  WHERE id = p_user_id;

  -- Grant 1 credit to the referrer
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_referrer_id, 1, 'bonus', 'Referral reward: friend signed up');

  UPDATE profiles
  SET credits = credits + 1,
      total_credits_purchased = total_credits_purchased + 1,
      referral_count = referral_count + 1
  WHERE id = v_referrer_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
