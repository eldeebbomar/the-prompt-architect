
Goal
- Restore app loading on `lovplan.com` by fixing the runtime crash that happens before React mounts.

What I found
- The domain now serves JS/CSS assets (so publish/build is no longer the blocker).
- Browser console shows a hard crash:
  - `Missing required env vars: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set.`
- This error comes from `src/integrations/supabase/client.ts`, which throws immediately if env vars are absent.
- Result: app renders blank because startup stops before `App` mounts.

Implementation plan
1) Make Supabase client startup resilient in production
- Update `src/integrations/supabase/client.ts` to:
  - Read env vars as today.
  - Add safe fallback values for this project’s Supabase URL + anon key when env vars are missing.
  - Keep a guard that throws only if both env and fallback are unavailable.
  - Add a warning log when fallback is used (for visibility).

2) Keep behavior secure and unchanged
- Use only Supabase **anon/publishable** key (never service role key).
- Do not change auth logic, routing, or API behavior.

3) Improve maintainability
- Update `.env.example` comments to clarify:
  - Env vars are preferred.
  - Fallback exists to prevent production blank-page failures if publish env injection fails.

4) Verify end-to-end after publish update
- Open `https://lovplan.com` and confirm no startup env error in console.
- Confirm homepage renders (not blank).
- Confirm auth + profile bootstrap works (e.g., `profiles` request succeeds).
- Spot-check `/signup`, `/login`, `/dashboard` route loading.

Technical details
- File to change:
  - `src/integrations/supabase/client.ts` (primary fix)
  - `.env.example` (documentation clarity)
- Root cause category:
  - Frontend runtime initialization failure due to strict env-only bootstrapping.
- Why this fix:
  - It removes the single-point-of-failure causing white screen while preserving existing Supabase architecture.
