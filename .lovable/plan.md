
## Goal
Stop fallback Supabase emails and ensure all auth emails are LovPlan-branded, sent from your configured domain, with auth redirects consistently pointing to `https://lovplan.com`.

## What I found (current state)
- You are on the correct Supabase project (`gnovkpjawtodjcgizxsh`) — this is not a wrong-project issue.
- Auth logs still show `mail_from: noreply@mail.app.supabase.io`, which confirms fallback/default auth email path is still active.
- `auth-email-hook` code is branded correctly in repo, but there are no runtime logs from it, so it’s not active in the live auth pipeline.
- Queue infrastructure required by that hook is incomplete in DB right now:
  - Missing function: `enqueue_email`
  - Missing tables: `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`
  - Only `email_send_log` exists
- Frontend redirect code is already hardcoded to `https://lovplan.com` in login/signup; I’ll still run a full redirect audit.

## Implementation plan
1. Re-activate managed email pipeline on the existing verified domain  
   - Re-run managed email infrastructure setup for `notify.lovplan.com`/`lovplan.com` so the queue + dispatcher stack is fully provisioned in this project.

2. Re-scaffold auth email hook through managed setup (overwrite existing)  
   - Replace the manually drifted hook wiring with managed hook registration so Supabase Auth actually routes events to it.

3. Re-apply LovPlan branding after scaffold  
   - Ensure all 6 auth templates use LovPlan styling/copy and sender identity:
     - Brand name: `LovPlan`
     - Visible sender: `LovPlan <noreply@lovplan.com>`
     - Sending domain: `notify.lovplan.com`
     - Links/site references: `https://lovplan.com`

4. Deploy updated auth email hook  
   - Publish the hook so the live auth flow uses branded templates instead of fallback defaults.

5. Redirect hardening audit (all auth flows)  
   - Confirm every auth redirect path stays on `https://lovplan.com`:
     - Signup confirmation redirect
     - Google OAuth redirect
     - Any additional auth redirects in code and auth settings

6. End-to-end verification in production  
   - Trigger signup + password reset
   - Confirm:
     - Sender is LovPlan/domain-based (not `mail.app.supabase.io`)
     - Email content is branded
     - Links land on `lovplan.com`
     - Hook logs and send-log entries appear for each auth event

## Technical details
- Files to verify/update:
  - `supabase/functions/auth-email-hook/index.ts`
  - `supabase/functions/_shared/email-templates/{signup,magic-link,recovery,invite,email-change,reauthentication}.tsx`
  - `src/pages/Signup.tsx`
  - `src/pages/Login.tsx`
- DB/runtime artifacts expected after repair:
  - Function: `enqueue_email`
  - Tables: `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens` (+ existing `email_send_log`)
  - Active queue dispatcher for email processing
- Success criteria:
  - New auth logs no longer show `noreply@mail.app.supabase.io`
  - Branded auth emails are received with LovPlan identity
  - Redirects consistently resolve to `https://lovplan.com`
