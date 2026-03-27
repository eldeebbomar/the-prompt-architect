# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Vite dev server on port 8080
npm run build        # Production build (npx vite build)
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest in watch mode
```

Test setup uses jsdom via `src/test/setup.ts`.

## What This Project Is

**LovPlan** — an AI-powered prompt architect for Lovable.dev. Users describe an app idea through a guided discovery chat, the system generates 50+ sequenced prompts, and a Chrome extension auto-deploys them to Lovable.

The product flow: **New Project → Discovery Chat (AI) → Prompt Generation (n8n) → Prompt Viewer → Deploy via Extension or Copy/Paste**

## Architecture Overview

### Frontend (React + Vite + TypeScript)

- **Routing**: React Router v6 with lazy-loaded routes. Public pages at root, authenticated pages under `/dashboard/*` and `/project/:id`. Protected by `ProtectedRoute`/`PublicOnlyRoute` wrappers in `App.tsx`.
- **State**: Auth via React Context (`AuthContext`). All server state via TanStack React Query with query keys like `["projects"]`, `["conversations", projectId]`, `["credit-stats"]`.
- **UI**: shadcn/ui (Radix primitives) in `src/components/ui/`. Custom theme with amber/gold primary, sage green accents, dark mode. Fonts: DM Serif Display (headings), Outfit (body).
- **Import alias**: `@/*` → `./src/*`

### Backend (Supabase)

- **Database**: Postgres with RLS. Core tables: `profiles`, `projects`, `conversations`, `generated_prompts`, `credit_transactions`, `extension_sessions`.
- **Edge Functions** (Deno, in `supabase/functions/`): 15 functions. Most proxy to n8n webhooks for AI processing. Key ones:
  - `discovery-webhook` — forwards chat messages to n8n, returns AI reply + spec_data
  - `generate-prompts` — triggers async n8n prompt generation
  - `extension-api` — REST API for Chrome extension (token-based auth via `X-Extension-Token` header)
  - `create-checkout-session` / `stripe-webhook` / `customer-portal` — Stripe billing
- **Auth**: Supabase Auth with email/magic links. Extension uses separate link-code flow (`generate-link-code` → `verify-link-code`).
- Functions with `verify_jwt = false` in `supabase/config.toml`: `auth-email-hook`, `stripe-webhook`, `generate-link-code`, `verify-link-code`, `extension-api`.

### Chrome Extension (`chrome-extension/`)

Manifest V3. Deploys prompts to lovable.dev by injecting text via `document.execCommand('insertText')` in a content script. Background service worker handles API calls to `extension-api`. Popup manages the link/deploy flow. Uses `chrome.storage.local` for token persistence.

### n8n (External)

All AI logic (Claude API calls, spec extraction, prompt generation) runs in n8n workflows, not in this codebase. Edge functions forward requests to `N8N_WEBHOOK_BASE` endpoints. The n8n workflows save results directly to Supabase (conversations, generated_prompts, project spec_data).

## Key Patterns

- **Error handling**: `src/lib/webhook-error-handler.ts` — all `supabase.functions.invoke` call sites should use `handleWebhookError(err, navigate)` for consistent 401/402/429/500 handling.
- **Optimistic updates**: Discovery chat shows messages optimistically, then deduplicates when DB results arrive via query invalidation.
- **Project status machine**: `discovery` → `generating` → `ready` → `completed` (or `revising`). The UI renders different views per status in `ProjectDetail.tsx`.
- **Credit system**: 1 credit per project. Deducted atomically via `deduct_credit` RPC in `create-project` edge function. Tracked in `credit_transactions`.
- **Prompt progress**: Tracked in localStorage (`lovplan_copied_prompts_{projectId}`). Extension deployment reports completion via `POST /extension-api/projects/:id/deploy-complete`.
- **Discovery completion**: When the AI marks `is_complete=true`, a `pendingComplete` gate requires user confirmation before proceeding to generation. User sees a `DiscoveryCompleteCard` in the chat.

## Environment Variables

Frontend (in `.env`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Edge functions (Supabase secrets):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_WEBHOOK_BASE`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`

## TypeScript Config

Strict mode is off (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`). Generated Supabase types are in `src/integrations/supabase/types.ts`.
