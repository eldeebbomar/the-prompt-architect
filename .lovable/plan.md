## Goal

Get signups working again with branded LovPlan emails sent from `mail.lovplan.com` via Resend, and remove all the half-finished email scaffolding that's been causing confusion.

## Why signup is currently broken

Every signup triggers Supabase's "Send Email Hook" → our `auth-email-hook` edge function. That function tries to send via Resend from `notify.lovplan.com`, which is unverified (its DNS is delegated to Lovable's nameservers and can't hold Resend's records). Resend rejects with 403, the hook returns 500, and Supabase Auth aborts the signup.

## The fix

### 1. Point the sender at the verified domain
- Update `FROM_ADDRESS` in `supabase/functions/auth-email-hook/index.ts` from `noreply@notify.lovplan.com` → `noreply@mail.lovplan.com`.
- Update `siteUrl` / link generation to keep using `https://lovplan.com` (unchanged — only the sender domain moves).

### 2. Make the hook fail-soft so a Resend hiccup never blocks signup again
Currently the hook returns 500 on any Resend error, which tells Supabase to abort the signup. Change it so:
- If signature verification fails → still return 401 (correct behavior).
- If Resend fails to send → log the failure to `email_send_log` as `failed`, but return **200** so Supabase Auth completes the signup. The user account is created; we just lost an email (which we can see in logs and re-send manually if needed).
- This is the standard pattern for non-critical send hooks.

### 3. Deploy and test on the backend
- Deploy `auth-email-hook`.
- Curl the function with a synthetic Supabase webhook payload to confirm it returns 200 and Resend accepts the send.
- Check `email_send_log` for a `sent` row.
- Report the result back before you spend your last test trial.

### 4. Clean up the scaffolding rubbish
Delete what's no longer needed so the repo stops looking like a graveyard:
- `supabase/templates-dashboard/` — leftover HTML templates from a previous setup attempt; not referenced anywhere.
- `.lovable/plan.md` — stale plan from a previous session that references missing tables (`enqueue_email`, `email_send_state`, etc.) we never actually want.
- Leave the 6 React Email templates in `supabase/functions/_shared/email-templates/` — those are what the hook actually uses.
- Leave `email_send_log` table — useful for debugging.
- Leave `SEND_EMAIL_HOOK_SECRET` — required for webhook signature verification.

### 5. Things you need to do manually (one-time, in dashboards)
- **Resend dashboard**: nothing — `mail.lovplan.com` is already verified.
- **Supabase dashboard → Authentication → Hooks → Send Email Hook**: confirm the hook is enabled and pointed at the `auth-email-hook` URL with the `SEND_EMAIL_HOOK_SECRET` value. (It already is — just verifying.)
- **Optional cleanup**: at your DNS provider you can later remove the `notify.lovplan.com` NS records pointing to `ns3/ns4.lovable.cloud` since we're no longer using that subdomain. Not urgent.

## What "working normally" looks like after this

- User signs up → Supabase creates the account → fires webhook → our hook renders the branded LovPlan template → Resend sends from `LovPlan <noreply@mail.lovplan.com>` → user gets the confirmation email → clicks link → lands on `https://lovplan.com/auth/callback` → logged in.
- Same path for password reset, magic link, email change, reauthentication.
- If Resend ever has an outage, signup still succeeds; we just see a `failed` row in `email_send_log` and can resend manually.

## Files touched

- `supabase/functions/auth-email-hook/index.ts` — change `FROM_ADDRESS`, make Resend errors non-fatal.
- Delete: `supabase/templates-dashboard/`, `.lovable/plan.md`.

No DB migrations needed. No new secrets needed (`RESEND_API_KEY` and `SEND_EMAIL_HOOK_SECRET` are already set).
