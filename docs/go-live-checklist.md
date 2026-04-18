# LovPlan Go-Live Checklist

End-to-end verification to gate production deploys. Run through everything
below on staging before merging a hardening phase to main. Every item must
pass — a red check blocks the release.

Audit reference: the background for each check is in the `we-need-to-make-fizzy-eclipse.md` plan and the `hardening/*` branch commits.

---

## 0. Pre-flight

- [ ] `npm run lint` — no new errors since last baseline
- [ ] `npm run test` — all Vitest tests pass
- [ ] `npm run build` — production build succeeds
- [ ] All Supabase migrations applied on staging (`supabase db push`)
- [ ] Edge functions deployed (`supabase functions deploy ...`)
- [ ] Stripe webhook secret, `N8N_WEBHOOK_BASE`, `ALLOWED_ORIGINS`, `LOVABLE_API_KEY` set in Supabase secrets
- [ ] n8n workflows reachable from Supabase edge runtime

---

## 1. Signup, referral, first-time credits

1. Open a new incognito browser and visit `/signup?ref=<code>` using a known test user's referral code.
2. Sign up with a fresh email.
3. Complete magic-link or password flow.
4. Expect toast "Referral bonus applied! You got 1 free credit."
5. Verify in DB: both the new user and the referrer have +1 credit; `credit_transactions` shows two `referral` rows; `profiles.referred_by` is populated; `referral_count` incremented for referrer.
6. Submit the same referral code again (via localStorage hack or direct invoke) — RPC returns `already_referred`, no extra credits.

- [ ] Referral bonus applied to both sides
- [ ] No duplicate credit grants on replay
- [ ] Self-referral via own code is rejected

## 2. Project creation — idempotent + atomic

1. From dashboard, click "New Project", fill name ("Test Project") + pitch.
2. Double-click Submit as fast as possible.
3. Expect one project created, one credit deducted, single toast "1 credit used…".
4. Refresh and click Submit again from the same form (new key generated) — second project created, second credit deducted.
5. Simulate retry by replaying the same request with the same `Idempotency-Key` header (use `curl`): expect 200 with `idempotent_replay: true` and the original project.
6. Drain credits to 0, try again — expect 402 "Insufficient credits" modal, no project created.

- [ ] Double-click doesn't double-charge
- [ ] Replay with same idempotency key returns original
- [ ] 402 shown when credits exhausted

## 3. Discovery chat

1. Open the new project — first message (the pitch) auto-sends within 1s.
2. Reply 5+ times in a normal conversation.
3. Hammer the Send button to test rate limiting: expect 429 with countdown after ~2 spams/sec.
4. Verify the AI cannot respond with an empty message (inject via n8n test harness if possible) — client shows error toast, no empty assistant bubble.
5. When `is_complete: true`, `DiscoveryCompleteCard` appears with a spec summary.
6. Click "Keep Discussing" → card dismissed, send still works.
7. Click "Generate My Prompts" → status flips to `generating`.

- [ ] Rate limit fires at expected rate
- [ ] Empty reply handled gracefully
- [ ] Discovery complete gate works both ways

## 4. Prompt generation

1. After clicking "Generate My Prompts", wait up to 60s.
2. Verify the status progresses to `ready` and 20+ prompts appear.
3. If status is stuck at 60s, verify the "Retry Generation" button appears, and that clicking it re-triggers generation.
4. Check rate limit: trigger generation 6 times rapidly from different projects — 6th attempt should return 429.

- [ ] Prompts load within 30-60s
- [ ] Retry after stuck works
- [ ] Rate limit blocks excess runs

## 5. Chrome extension linking

1. Open `/dashboard/extension`, click "Generate Code".
2. Expect a 6-digit code and a countdown.
3. Open the extension popup; paste the code.
4. Expect status = "ON" and the user's projects list.
5. Paste an invalid/expired code — expect "Code invalid or expired" in the popup.
6. Free plan user attempts to link — expect 403 "Subscription required".

- [ ] Code verification works for valid codes
- [ ] Invalid/expired codes show dedicated error
- [ ] Free plan blocked at the backend

## 6. Extension deploy to lovable.dev

1. Open a new lovable.dev project in a tab.
2. Click the extension action; select a `ready` project.
3. Click Deploy.
   - If content script hasn't loaded yet, popup should auto-inject it (watch console).
4. Progress bar advances; first prompt fires after ~3s, then ~1.5s per prompt.
5. Pause mid-deploy → resume → continue from same index.
6. Close the tab mid-deploy → reopen popup on the same project → resume-banner offers correct index.
7. On completion, popup shows summary; backend status flips to `completed`.
8. Send a second `deploy-complete` POST for the same project → returns 200 with `already_completed: true`, no state change.

- [ ] Deploy runs with no manual intervention
- [ ] Pause / resume work
- [ ] Mid-deploy recovery works
- [ ] Deploy-complete is idempotent

## 7. Extension edge cases

1. Open two lovable.dev tabs. Click deploy with the target tab hidden. Deploy should go to the visible/active one (or the picker appears if both match).
2. Introduce a malformed prompt (e.g. `repeat_count: 99999`) via SQL — deploy clamps to 50 and warns in console.
3. Simulate token expiry by setting `extension_sessions.expires_at` to the past; deploy should return 401 and popup shows "session expired" on next open.
4. Cancel the user's Stripe subscription; next `/me` should return 403 with `subscription_required`; popup shows the upgrade prompt.

- [ ] Multi-tab disambiguation works
- [ ] Repeat count clamped
- [ ] Expired tokens forcibly re-link
- [ ] Cancelled plan revokes extension access

## 8. Stripe / billing

Using Stripe CLI:

```bash
stripe trigger checkout.session.completed \
  --override checkout_session:metadata.user_id=<uid> \
  --override checkout_session:metadata.price_type=single \
  --override checkout_session:metadata.credits_to_add=1
```

1. Trigger twice with the same session ID (`stripe trigger --idempotency-key <id> ...`) — credits granted exactly once.
2. Trigger `invoice.payment_failed` for a test customer — `profiles.payment_failed` flips to true, extension access 403s.
3. Trigger `customer.subscription.deleted` — unlimited user downgrades to free, `revision_limit` becomes 2, `subscription_cancelled` log row inserted (only once on duplicate event).
4. Submit a checkout with an invalid `price_type` metadata — webhook logs the error, user not credited, no crash.
5. Force Stripe to retry (e.g., temporarily return 500 from the handler via a feature flag) — verify that subsequent retry doesn't duplicate credits or transactions.

- [ ] Double webhook delivery doesn't double credits
- [ ] `payment_failed` and cancellation flags update correctly
- [ ] Bad price_type rejected cleanly

## 9. Delete account

1. From Settings, type "DELETE" and confirm.
2. Verify `auth.users` row is gone, cascading through `profiles`, `projects`, `conversations`, `generated_prompts`, `credit_transactions`, `extension_sessions`, `api_keys`.
3. Attempt to log in with the same email → fresh signup flow.

- [ ] All user data purged
- [ ] No orphaned rows remain

## 10. RLS probes (manual SQL)

As an authenticated end-user via `supabase.rpc` (or direct PostgREST):

1. Insert into `conversations` with `role='assistant'` on an owned project — expect 403 (INSERT policy forbids non-user roles).
2. Insert into `conversations` with `role='user'` on another user's project — expect 403.
3. Update `credit_transactions.amount` on own row — expect 403 (no UPDATE policy).
4. Insert `generated_prompts` with `sequence_order=0` — expect CHECK violation.
5. Insert `projects` with `status='bogus'` — expect CHECK violation.

- [ ] User cannot spoof assistant/system messages
- [ ] User cannot write to other projects
- [ ] Data-integrity CHECKs fire as expected

## 11. Auth / email

1. Request password reset — email arrives within 30s.
2. Cut power to the email queue (simulate by pausing `process-email-queue`) — observe `auth-email-hook` retries 3× and eventually returns 500 so Supabase retries the hook.
3. Expired magic-link → user lands on `/login` with a clear message.

- [ ] Email retry succeeds under transient failure
- [ ] 500 returned only after retries
- [ ] Expired magic links show informative error

## 12. Frontend resilience

1. Clear browser cache, visit `/project/<id>` — Suspense fallback shows briefly, full page loads.
2. Force a chunk-load failure (throttle network, delete a dynamic chunk from dist) — `RouteErrorBoundary` shows "Couldn't load this page" with a refresh CTA.
3. Copy a prompt on a browser with `navigator.clipboard` disabled — execCommand fallback copies successfully.
4. Open dashboard with 50+ stale `lovplan_copied_prompts_*` keys in localStorage — after one load, unused keys pruned.

- [ ] Lazy-route failures don't brick the app
- [ ] Clipboard works in degraded browsers
- [ ] Storage pruning runs on dashboard mount

## 13. Performance / smoke

1. Lighthouse run on `/dashboard` — no regressions from last baseline.
2. 5-minute continuous discovery chat with 1 message per 4 seconds — no memory growth, no leaked listeners (DevTools heap snapshot).
3. Deploy 60-prompt project via extension — no progress updates missed, no content script termination.

---

## Rollback plan

If anything fails in production:

1. **Migrations**: every added migration is additive. To roll back:
   - `20260418140000_rls_data_integrity.sql` — drop the added constraints:
     ```sql
     ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_role_check;
     DROP POLICY IF EXISTS "Users can insert own user conversations" ON conversations;
     CREATE POLICY "Users can insert own conversations" ON conversations FOR INSERT TO authenticated
       WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
     -- repeat for generated_prompts/projects/credit_transactions
     ```
   - `20260418130000_rate_limit_table.sql` — `DROP TABLE rate_limit_hits CASCADE;` + `DROP FUNCTION rate_limit_check, cleanup_rate_limit_hits;`
   - `20260418120000_extension_session_expiry.sql` — `ALTER TABLE extension_sessions DROP COLUMN expires_at;`
   - `20260418110000_consolidate_apply_referral.sql` — recreate the old `apply_referral` (two overloads) from the prior migration files
   - `20260418100000_atomic_create_project.sql` — `DROP FUNCTION create_project_atomic; DROP TABLE project_creation_attempts;` + revert `add_credits` to the version in `20260324100001_add_credits_idempotent.sql`
2. **Edge functions**: redeploy the previous git tag via `supabase functions deploy <fn> --project-ref <ref>` from that tag.
3. **Frontend**: revert the most recent deploy in Vercel/Railway/wherever.
4. **Chrome extension**: publish the prior `.zip` to the Chrome Web Store. Users on the old version are unaffected because token format is backwards compatible.
