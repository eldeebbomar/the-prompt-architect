-- Add revision_limit column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS revision_limit INTEGER DEFAULT 2;

-- Update existing "pack" users to have 5 revisions
UPDATE public.profiles 
SET revision_limit = 5 
WHERE plan IN ('pack', '5-pack');

-- Ensure new "unlimited" plans (if any) have a high limit
UPDATE public.profiles 
SET revision_limit = 100
WHERE plan = 'unlimited';
