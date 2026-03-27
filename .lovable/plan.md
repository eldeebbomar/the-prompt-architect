

## Goal
Fix all build errors preventing the app from loading, while keeping all features intact.

## Root Cause Analysis
The codebase references database columns, tables, and functions that don't exist yet. The auto-generated `types.ts` correctly reflects the current DB schema, but the code was written ahead of the schema. Additionally, 6 edge functions use a pinned `npm:` import that fails in the Deno build environment.

## Problem Inventory

**Missing DB columns:**
- `projects.is_public` (boolean, default false) — used by sharing feature
- `profiles.is_admin` (boolean, default false) — used by admin route guard
- `profiles.referral_code` (text, nullable) — used by referral system
- `profiles.referral_count` (integer, default 0) — used by referral system

**Missing DB tables:**
- `api_keys` — used by Settings page and public-api/manage-api-key edge functions

**Missing DB functions:**
- `get_admin_stats` — used by Admin dashboard
- `apply_referral` — used by apply-referral edge function
- `enqueue_email` — used by auth-email-hook (email queue)

**Missing DB table (email):**
- `email_send_log` — used by auth-email-hook

**Edge function import errors:**
- 6 functions use `npm:@supabase/supabase-js@2.57.2` which fails Deno resolution

**TypeScript type mismatches:**
- AuthContext casts profile data to an interface with `payment_failed` and `is_admin`, but types.ts doesn't include them
- Multiple files query non-existent columns/tables, causing SelectQueryError types

## Implementation Plan

### Step 1: Database Migrations
Run a single migration that adds all missing schema:

- `ALTER TABLE projects ADD COLUMN is_public boolean NOT NULL DEFAULT false;`
- `ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;`
- `ALTER TABLE profiles ADD COLUMN referral_code text;`
- `ALTER TABLE profiles ADD COLUMN referral_count integer NOT NULL DEFAULT 0;`
- Create `api_keys` table (id, user_id, key_hash, key_prefix, name, created_at, last_used_at, revoked_at) with RLS policies
- Create `email_send_log` table (id, message_id, template_name, recipient_email, status, error_message, created_at)
- Create `get_admin_stats` function (aggregates users, projects, prompts, purchases, daily metrics)
- Create `apply_referral` function (validates code, awards credits to both parties)
- Create `enqueue_email` RPC wrapper for pgmq queue
- Add RLS policy for `projects` to allow public SELECT when `is_public = true`
- Generate unique referral codes for existing users via trigger on profiles

### Step 2: Fix Edge Function Imports (6 files)
Change `npm:@supabase/supabase-js@2.57.2` to `https://esm.sh/@supabase/supabase-js@2` in:
- `generate-link-code/index.ts`
- `extension-api/index.ts`
- `verify-link-code/index.ts`
- `stripe-webhook/index.ts`
- `create-checkout-session/index.ts`
- `customer-portal/index.ts`

### Step 3: Fix TypeScript Type Assertions (7 files)
Until types.ts auto-regenerates, add `as unknown as Type` casts:
- `AuthContext.tsx` — cast profile select result
- `use-extension-sessions.ts` — cast all extension_sessions queries with `as any`
- `Admin.tsx` — cast `get_admin_stats` rpc call with `as any`
- `Dashboard.tsx` — cast credit stats response
- `Settings.tsx` — cast referral and api_keys queries with `as any`
- `SharedProject.tsx` — cast projects query with `as any`
- `PromptViewer.tsx` — cast is_public queries with `as any`

### Step 4: Delete stale deno.lock
Remove `supabase/functions/auth-email-hook/deno.lock` to prevent deploy failures from stale lockfile.

## Files Changed
- 1 new migration file
- 6 edge function files (import fix)
- 7 frontend files (type assertion fixes)
- 1 file deletion (deno.lock)

## Verification
- Preview loads without build errors
- All pages render (Dashboard, Settings, Admin, SharedProject, ChromeExtension)
- Published site continues to work after republish

