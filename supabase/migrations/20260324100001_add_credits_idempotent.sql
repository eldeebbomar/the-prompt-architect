-- Make add_credits idempotent: skip if stripe_payment_id already exists
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_amount integer, p_stripe_id text, p_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _already_processed boolean;
BEGIN
  -- Idempotency check: skip if this Stripe payment was already processed
  IF p_stripe_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.credit_transactions WHERE stripe_payment_id = p_stripe_id
    ) INTO _already_processed;

    IF _already_processed THEN
      RAISE NOTICE 'Stripe payment % already processed, skipping', p_stripe_id;
      RETURN;
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    credits = credits + p_amount,
    total_credits_purchased = total_credits_purchased + p_amount,
    plan = p_plan,
    stripe_customer_id = COALESCE(p_stripe_id, stripe_customer_id)
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, description, stripe_payment_id)
  VALUES (p_user_id, p_amount, 'purchase', 'Purchased ' || p_plan || ' plan', p_stripe_id);
END;
$$;
