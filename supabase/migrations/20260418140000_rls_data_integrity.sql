-- Tighten RLS + data integrity. Without these, an authenticated user could
-- spoof assistant/system messages in their own project (poisoning discovery
-- context that n8n then operates on) and insert prompts with bogus
-- depends_on arrays.

-- 1. Role check on conversations. n8n writes via service_role so this doesn't
-- affect AI replies, but browsers can only insert as 'user'.
-- NOT VALID so existing unusual values (if any) don't block the migration;
-- it still enforces on all new inserts/updates.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'conversations_role_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_role_check
      CHECK (role IN ('user', 'assistant', 'system')) NOT VALID;
  END IF;
END $$;

-- Replace permissive INSERT policy with a role-gated one.
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
CREATE POLICY "Users can insert own user conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'user'
    AND project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- Let users delete messages in their own projects (audit lets edit/delete in UI).
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations"
  ON public.conversations
  FOR DELETE
  TO authenticated
  USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- 2. generated_prompts: add CHECK constraints for sequence_order sanity and
-- depends_on array values. We do not enforce "must reference existing order"
-- (would require a trigger) — but non-negative ints is the obvious guard.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'generated_prompts_sequence_order_positive'
  ) THEN
    ALTER TABLE public.generated_prompts
      ADD CONSTRAINT generated_prompts_sequence_order_positive
      CHECK (sequence_order > 0) NOT VALID;
  END IF;
END $$;

-- All elements strictly positive. `0 < ALL (array)` is a valid
-- CHECK-constraint expression (subqueries aren't, but ALL over an array is).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'generated_prompts_depends_on_positive'
  ) THEN
    ALTER TABLE public.generated_prompts
      ADD CONSTRAINT generated_prompts_depends_on_positive
      CHECK (depends_on IS NULL OR 0 < ALL(depends_on)) NOT VALID;
  END IF;
END $$;

-- repeat_count sanity (avoid the "10 million paste loop" in the extension).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'generated_prompts'
      AND column_name = 'repeat_count'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'generated_prompts_repeat_count_bounded'
  ) THEN
    ALTER TABLE public.generated_prompts
      ADD CONSTRAINT generated_prompts_repeat_count_bounded
      CHECK (repeat_count IS NULL OR (repeat_count >= 1 AND repeat_count <= 50)) NOT VALID;
  END IF;
END $$;

-- 3. Project status allowlist — prevents a stray client from setting
-- arbitrary status strings that break the UI router.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'projects_status_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('discovery', 'generating', 'ready', 'completed', 'revising')) NOT VALID;
  END IF;
END $$;

-- 4. credit_transactions.type allowlist.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'credit_transactions_type_check'
  ) THEN
    ALTER TABLE public.credit_transactions
      ADD CONSTRAINT credit_transactions_type_check
      CHECK (type IN ('usage', 'purchase', 'referral', 'bonus', 'subscription_cancelled', 'refund')) NOT VALID;
  END IF;
END $$;
