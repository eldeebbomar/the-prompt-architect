

## Goal
Fix the auth-email-hook configuration so all automated emails are properly branded as "LovPlan" and reference the correct domain.

## What's Wrong
The `auth-email-hook/index.ts` has two incorrect constants:
- `SITE_NAME = "blueprint-prompt-builder"` — this appears in the email From address (`blueprint-prompt-builder <noreply@notify.lovplan.com>`) and in template props. Should be `"LovPlan"`.
- `SAMPLE_PROJECT_URL = "https://blueprint-prompt-builder.lovable.app"` — used in email previews. Should be `"https://lovplan.com"`.

The 6 email templates themselves are already well-branded (amber colors, correct fonts, LovPlan copy). No changes needed there.

No transactional/app emails are currently used in the codebase, so nothing else to set up there.

## Changes

### File: `supabase/functions/auth-email-hook/index.ts`
- Change `SITE_NAME` from `"blueprint-prompt-builder"` to `"LovPlan"`
- Change `SAMPLE_PROJECT_URL` from `"https://blueprint-prompt-builder.lovable.app"` to `"https://lovplan.com"`

### Deploy
- Redeploy the `auth-email-hook` Edge Function so changes take effect

## Result
- From address becomes: `LovPlan <noreply@notify.lovplan.com>`
- Email previews reference the correct `lovplan.com` domain
- All 6 auth templates (signup, recovery, magic link, invite, email change, reauthentication) continue working with proper branding

