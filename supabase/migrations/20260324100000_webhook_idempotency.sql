-- Add unique constraint on stripe_payment_id to prevent duplicate credit additions
-- from Stripe webhook retries. The add_credits RPC uses this column, so a retry
-- with the same session/payment ID will be caught.

-- First, add a unique index (allows NULLs, only enforces uniqueness on non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_stripe_unique
ON public.credit_transactions (stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL;
