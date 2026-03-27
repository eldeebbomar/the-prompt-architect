

## Goal
Activate branded auth emails so all authentication emails (signup confirmation, password reset, magic link, etc.) are sent from `notify.lovplan.com` with LovPlan branding instead of the default Supabase templates.

## What's Wrong
- The `auth-email-hook` Edge Function exists in the codebase with branded templates
- But it was manually created — it was never scaffolded through the managed email system, so the hook is not activated
- Result: Supabase falls back to its built-in default templates (the plain HTML you see in the dashboard)

## Fix

### Step 1: Scaffold auth email templates via the managed system
Use the managed scaffolding tool to properly create and register the auth-email-hook. This overwrites the existing manually-created hook with one that's properly integrated into the email pipeline.

### Step 2: Apply LovPlan brand styling to scaffolded templates
After scaffolding, update all 6 templates to match LovPlan's visual identity:
- Primary color: `#D4952A` (amber/gold)
- Fonts: DM Serif Display for headings, Outfit for body text
- Copy style: warm, professional tone matching the app
- Email body background: white (#ffffff)

### Step 3: Deploy the auth-email-hook Edge Function
Redeploy to activate the hook in the managed email pipeline.

### Step 4: Verify activation
Confirm the hook is active and emails will route through it instead of the default Supabase templates.

## Technical Details
- The Supabase dashboard templates (Authentication → Emails) are DEFAULT fallback templates — they are NOT the same as the Edge Function hook
- The managed scaffolding tool registers the hook with the email system so it intercepts auth emails
- Domain `notify.lovplan.com` is already verified, so emails will send immediately after activation
- Files affected: `supabase/functions/auth-email-hook/index.ts` and all templates in `supabase/functions/_shared/email-templates/`

