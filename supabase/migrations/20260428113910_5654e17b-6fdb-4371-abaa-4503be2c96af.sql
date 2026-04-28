-- Trigger: deduct 1 credit when a project transitions to status='ready'
-- Idempotent: only charges once per project (checks credit_transactions for existing usage row)

CREATE OR REPLACE FUNCTION public.charge_on_project_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _already_charged boolean;
  _plan text;
BEGIN
  -- Only act when status transitions INTO 'ready' from something else
  IF NEW.status <> 'ready' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'ready' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: skip if a usage transaction already exists for this project
  SELECT EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE project_id = NEW.id AND type = 'usage'
  ) INTO _already_charged;

  IF _already_charged THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE id = NEW.user_id;

  IF _plan = 'unlimited' THEN
    INSERT INTO public.credit_transactions (user_id, amount, type, description, project_id)
    VALUES (NEW.user_id, -1, 'usage', 'Prompt generation completed', NEW.id);
  ELSE
    UPDATE public.profiles
    SET credits = credits - 1
    WHERE id = NEW.user_id AND credits > 0;

    IF FOUND THEN
      INSERT INTO public.credit_transactions (user_id, amount, type, description, project_id)
      VALUES (NEW.user_id, -1, 'usage', 'Prompt generation completed', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_charge_on_project_ready ON public.projects;

CREATE TRIGGER trg_charge_on_project_ready
AFTER INSERT OR UPDATE OF status ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.charge_on_project_ready();