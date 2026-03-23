
Goal: restore the published site so it serves a real built app (not the empty fallback shell).

What I found (root cause direction):
- The published URL is currently returning an HTML shell with only `<div id="root"></div>` (and sometimes only the Lovable badge), with no app bundle script tags.
- Your repo `index.html` is valid and includes `<script type="module" src="/src/main.tsx"></script>`.
- This points to a publish artifact issue (fallback shell being served) rather than a normal in-app runtime crash.

Implementation plan:

1) Harden `index.html` to a minimal, publish-safe template
- Reduce `index.html` to the standard Vite skeleton only (charset, viewport, title, root div, script).
- Remove non-essential OG/Twitter tags from `index.html` (they are already handled in `SEO.tsx`), so publish parsing is as simple as possible.
- Keep all metadata logic in React Helmet (`SEO.tsx`) to avoid static-head parsing edge cases.

2) Keep app behavior unchanged
- No route, auth, webhook, or UI logic changes.
- No visual/design changes.
- This is only a deployment-shell stability fix.

3) Republish and verify the actual artifact
- Re-publish after the `index.html` simplification.
- Verify published HTML now includes built asset tags (`/assets/...js` and CSS), not just a bare root div.
- Confirm `/` renders content (Navbar + hero), not a blank black page.

4) If publish still serves fallback shell, execute controlled rollback
- Roll back to last known-good History version.
- Publish that baseline first to re-establish a healthy artifact.
- Re-apply recent changes in small batches, publishing between batches to identify the exact breaking change set.

5) Final fallback if still unresolved (platform-level)
- If even a minimal index + rollback still serves fallback shell, collect evidence (published URL + returned HTML snippet + timestamp) and escalate as a platform publish incident.

Technical details:
- Why this approach: a runtime React error would still have script tags in served HTML; your published HTML is missing bundle tags entirely, so we should fix publish artifact generation/delivery first.
- Files involved:
  - `index.html` (simplify)
  - `src/components/SEO.tsx` (remains source of OG/Twitter tags)
- Validation checklist:
  - Published HTML contains bundle script/link tags
  - Homepage renders on desktop and mobile
  - No blank page on fresh incognito load
