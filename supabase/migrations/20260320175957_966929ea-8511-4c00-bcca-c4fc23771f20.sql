
-- Drop existing policies to recreate them correctly
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own prompts" ON public.generated_prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON public.generated_prompts;
DROP POLICY IF EXISTS "Users can update own prompts" ON public.generated_prompts;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;

-- Helper: check if user owns a project (avoids recursive RLS on subqueries)
CREATE OR REPLACE FUNCTION public.owns_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = auth.uid()
  );
$$;

-- PROFILES policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- PROJECTS policies
CREATE POLICY "projects_select_own" ON public.projects FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE TO authenticated USING (user_id = auth.uid());

-- CONVERSATIONS policies (use helper to avoid recursion)
CREATE POLICY "conversations_select_own" ON public.conversations FOR SELECT TO authenticated USING (public.owns_project(project_id));
CREATE POLICY "conversations_insert_own" ON public.conversations FOR INSERT TO authenticated WITH CHECK (public.owns_project(project_id));

-- GENERATED_PROMPTS policies (INSERT is service_role only — no authenticated INSERT policy)
CREATE POLICY "prompts_select_own" ON public.generated_prompts FOR SELECT TO authenticated USING (public.owns_project(project_id));
CREATE POLICY "prompts_update_own" ON public.generated_prompts FOR UPDATE TO authenticated USING (public.owns_project(project_id));
CREATE POLICY "prompts_delete_own" ON public.generated_prompts FOR DELETE TO authenticated USING (public.owns_project(project_id));

-- CREDIT_TRANSACTIONS policies (INSERT is service_role only — no authenticated INSERT policy)
CREATE POLICY "transactions_select_own" ON public.credit_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Replace handle_new_user: credits=1, plus welcome credit_transaction
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, credits, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    1,
    'free'
  );

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 1, 'bonus', 'Welcome credit');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Replace updated_at function (already has search_path set)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop old triggers and recreate with new function name
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at ON public.projects;
DROP TRIGGER IF EXISTS set_updated_at ON public.generated_prompts;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.generated_prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
