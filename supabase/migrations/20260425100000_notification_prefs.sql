-- Per-user marketing opt-out flags. Default true (opted in) for compatibility
-- with users created before this migration; new signups inherit the default
-- but should see the toggle in Settings → Notifications and can opt out at
-- any time. Transactional emails (auth, billing, deploy completion) are
-- always sent regardless of these flags.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_email_optin boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS product_update_optin boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.marketing_email_optin IS
  'User opt-in for marketing emails (newsletters, promotions). Honored by the email-sending pipeline before any non-transactional send.';
COMMENT ON COLUMN public.profiles.product_update_optin IS
  'User opt-in for product update emails (new features, changelog). Default true; user-controlled in Settings → Notifications.';
