
-- check_credits: returns credit count (9999 for unlimited)
CREATE OR REPLACE FUNCTION public.check_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits integer;
  _plan text;
BEGIN
  SELECT credits, plan INTO _credits, _plan FROM public.profiles WHERE id = p_user_id;
  IF _plan = 'unlimited' THEN
    RETURN 9999;
  END IF;
  RETURN COALESCE(_credits, 0);
END;
$$;

-- deduct_credit: atomic credit deduction
CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id uuid, p_project_id uuid, p_description text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _updated boolean;
BEGIN
  SELECT plan INTO _plan FROM public.profiles WHERE id = p_user_id;

  IF _plan = 'unlimited' THEN
    INSERT INTO public.credit_transactions (user_id, amount, type, description, project_id)
    VALUES (p_user_id, -1, 'usage', p_description, p_project_id);
    RETURN true;
  END IF;

  UPDATE public.profiles SET credits = credits - 1 WHERE id = p_user_id AND credits > 0;
  _updated := FOUND;

  IF _updated THEN
    INSERT INTO public.credit_transactions (user_id, amount, type, description, project_id)
    VALUES (p_user_id, -1, 'usage', p_description, p_project_id);
  END IF;

  RETURN _updated;
END;
$$;

-- add_credits: purchase credits and update plan
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_amount integer, p_stripe_id text, p_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- get_credit_stats: returns full stats as jsonb
CREATE OR REPLACE FUNCTION public.get_credit_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits integer;
  _total_purchased integer;
  _plan text;
  _total_used integer;
BEGIN
  SELECT credits, total_credits_purchased, plan
  INTO _credits, _total_purchased, _plan
  FROM public.profiles WHERE id = p_user_id;

  SELECT COALESCE(ABS(SUM(amount)), 0)
  INTO _total_used
  FROM public.credit_transactions
  WHERE user_id = p_user_id AND amount < 0;

  RETURN jsonb_build_object(
    'credits_remaining', CASE WHEN _plan = 'unlimited' THEN 9999 ELSE COALESCE(_credits, 0) END,
    'total_purchased', COALESCE(_total_purchased, 0),
    'total_used', _total_used,
    'plan', COALESCE(_plan, 'free')
  );
END;
$$;
