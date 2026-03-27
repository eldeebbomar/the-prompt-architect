
Goal
- Make all auth emails (signup, password reset, magic link, invite, email change) send as LovPlan-branded emails from your domain instead of default Supabase emails.

What I found
- Your sending domain is verified.
- Your email templates are branded correctly in code (LovPlan styling/copy is present).
- Auth logs show emails are still being sent from `noreply@mail.app.supabase.io` (default provider path), which means the custom auth email pipeline is not currently active.
- The queue infrastructure expected by `auth-email-hook` is incomplete in the DB right now (`enqueue_email` function and related queue tables are missing), so even if the hook is called, delivery won’t complete.
- `emailRedirectTo`/OAuth redirects still use `window.location.origin`, which can produce non-primary-domain links in auth flows.

Implementation plan
1) Repair the email backend pipeline (in Cloud → Emails)
- Re-run email infrastructure setup so queue + dispatcher pieces are fully provisioned.
- Ensure custom project emails are enabled (not falling back to default templates).

2) Align sender/domain config in the auth hook
- Keep sender transport domain on `notify.lovplan.com`.
- Set visible “From” domain to `lovplan.com` so inbox sender identity matches your main brand domain.
- Keep site branding constants as `LovPlan` and `https://lovplan.com`.

3) Redeploy auth email function
- Deploy the updated auth email hook so production uses the current branded templates + sender config.

4) Fix auth redirect consistency to main domain
- Update signup confirmation redirect and Google OAuth redirect URLs to hardcoded `https://lovplan.com` (and dashboard path where needed), replacing origin-derived values.

5) End-to-end verification on production
- Trigger signup and password reset from production.
- Confirm received email shows LovPlan branding and sender from your domain (not `mail.app.supabase.io`).
- Confirm confirmation/reset links resolve to `lovplan.com`.
- Confirm delivery/logging path is active (auth hook executes and send-log records are created).

Technical details
- Files to update:
  - `supabase/functions/auth-email-hook/index.ts` (From domain alignment, preserve branded template mapping)
  - `src/pages/Signup.tsx` (email confirmation redirect)
  - `src/pages/Login.tsx` and `src/pages/Signup.tsx` (Google OAuth redirect target)
- Infra/runtime checks:
  - Email queue/RPC provisioning must exist before auth hook can deliver.
  - If custom emails are disabled at project level, re-enable so auth stops using default Supabase sender.
- Success criteria:
  - No new auth logs showing `mail_from: noreply@mail.app.supabase.io`
  - Real inbox emails are branded and sent from LovPlan domain identity
  - Auth links consistently point to `https://lovplan.com`
