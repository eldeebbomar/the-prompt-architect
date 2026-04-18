-- Atomic, idempotent project creation.
-- Solves: double-submit race (two requests both deduct credits); refund bug
-- (create-project.ts called add_credits with wrong arg shape); partial failure
-- leaving credit_transactions out of sync with projects.

-- 1. Idempotency ledger for project creation attempts.
CREATE TABLE IF NOT EXISTS public.project_creation_attempts (
  idempotency_key uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_creation_attempts_user_id_idx
  ON public.project_creation_attempts(user_id);

ALTER TABLE public.project_creation_attempts ENABLE ROW LEVEL SECURITY;

-- Service-role only; edge function is the sole writer.
DROP POLICY IF EXISTS "service_role_all_project_creation_attempts"
  ON public.project_creation_attempts;
CREATE POLICY "service_role_all_project_creation_attempts"
  ON public.project_creation_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Atomic RPC: does credit check, deduction, project insert, ledger, all
-- in one transaction. Returns the created project as jsonb. Returns
-- { error: 'insufficient_credits' } (402 surface) if the user has none.
-- On duplicate idempotency_key the original project is returned — caller
-- safe to retry.
CREATE OR REPLACE FUNCTION public.create_project_atomic(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_project_id uuid;
  _plan text;
  _project public.projects%ROWTYPE;
BEGIN
  -- Serialize concurrent requests with the same idempotency key. Without
  -- this, two racing calls both pass the idempotency check below and both
  -- deduct credits before the unique constraint on the ledger resolves.
  -- Advisory xact lock is released at commit/rollback automatically.
  PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text)::bigint);

  -- Idempotency: return existing project if key seen before (and the other
  -- txn that wrote it has already committed).
  SELECT project_id INTO _existing_project_id
  FROM public.project_creation_attempts
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND AND _existing_project_id IS NOT NULL THEN
    SELECT * INTO _project FROM public.projects WHERE id = _existing_project_id;
    IF FOUND THEN
      RETURN jsonb_build_object('project', to_jsonb(_project), 'idempotent_replay', true);
    END IF;
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE id = p_user_id;

  -- Deduct credit (unlimited plan: just log, no decrement).
  IF _plan != 'unlimited' THEN
    UPDATE public.profiles
    SET credits = credits - 1
    WHERE id = p_user_id AND credits > 0;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'insufficient_credits');
    END IF;
  END IF;

  INSERT INTO public.projects (name, description, user_id, status)
  VALUES (p_name, p_description, p_user_id, 'discovery')
  RETURNING * INTO _project;

  INSERT INTO public.credit_transactions (user_id, amount, type, description, project_id)
  VALUES (p_user_id, -1, 'usage', 'Project: ' || p_name, _project.id);

  INSERT INTO public.project_creation_attempts (idempotency_key, user_id, project_id)
  VALUES (p_idempotency_key, p_user_id, _project.id);

  RETURN jsonb_build_object('project', to_jsonb(_project), 'idempotent_replay', false);
END;
$$;

-- 3. Guard add_credits against negative amounts. The RPC is SECURITY
-- DEFINER, so any caller flaw cannot be used to drain credits.
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id uuid,
  p_amount integer,
  p_stripe_id text,
  p_plan text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _already_processed boolean;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'add_credits: p_amount must be positive (got %)', p_amount;
  END IF;

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

-- 4. Unique index on stripe_payment_id for webhook idempotency at DB level.
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_payment_id_key
  ON public.credit_transactions(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

-- Service role only. The RPC accepts p_user_id, so a direct client call
-- could spoof identity — lock it down.
REVOKE EXECUTE ON FUNCTION public.create_project_atomic(uuid, text, text, uuid)
  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_project_atomic(uuid, text, text, uuid) TO service_role;
