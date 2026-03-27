-- Add payment_failed flag to profiles for failed invoice notifications
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payment_failed boolean NOT NULL DEFAULT false;
