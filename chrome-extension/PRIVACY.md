# LovPlan Deployer — Privacy Policy

**Effective:** 2026-04-18
**Extension:** LovPlan Deployer (Chrome Web Store)
**Publisher:** LovPlan (https://lovplan.com)
**Contact:** support@lovplan.com

---

## What this extension does

LovPlan Deployer automates the delivery of AI-generated prompts to your
Lovable.dev project. You link it once with a 6-digit code from your LovPlan
account, select a project, click Deploy, and the extension types each
prompt into Lovable's chat on your behalf.

## What information the extension handles

| Data | Where | Why |
|------|-------|-----|
| LovPlan session token (64-char random string) | `chrome.storage.local` | Authenticates API calls on your behalf. Never sent to anyone except LovPlan's servers. |
| Your email address | `chrome.storage.local` (for display) + memory during use | Shown in the popup so you know which account is linked. |
| Your plan tier (e.g. "unlimited", "pack") | `chrome.storage.local` | Shown in the popup. |
| Project metadata: name, status, prompt count | Fetched on demand, held in memory while the popup is open | Lets you choose which project to deploy. |
| Prompt text (your project's AI-generated prompts) | Held in memory during a deploy; typed into Lovable's chat input. | Required to perform the deploy you requested. |
| Deploy progress (last completed prompt index, timestamp) | `chrome.storage.local` under a per-project key | Lets you pause and resume a deployment. |

The extension does **not** collect browsing history, form data, credit
card information, location, or any data from pages other than `lovable.dev`
while actively deploying.

## Where data goes

- **LovPlan's own servers** (Supabase, hosted at `gnovkpjawtodjcgizxsh.supabase.co`)
  — only for the API calls the extension makes on your behalf:
  verifying the pairing code, fetching your projects and prompts, reporting
  when a deployment completes. These calls require your session token.
- **Lovable.dev** — only the prompt text is typed into Lovable's chat
  input (the same as if you typed it yourself). The extension does not
  send your session token to lovable.dev.
- **Nowhere else.** No analytics, no ad networks, no third-party trackers,
  no data sold or rented.

## Your controls

- **Unlink:** The popup has an "Unlink" button that clears the session token
  and all stored user data from your browser.
- **Uninstall:** Removing the extension from Chrome deletes all of its
  `chrome.storage.local` entries. You can additionally revoke server-side
  sessions from your LovPlan account dashboard.
- **Session expiry:** Sessions auto-expire 30 days after creation.

## Retention

Local data is retained as long as the extension is installed and you remain
linked. Server-side session records are kept until the session expires or
you revoke it.

## Children

LovPlan is not directed to children under 13. The extension is not
designed for use by children.

## Changes

Material changes will be noted by bumping the extension's version and
updating this document. Check
[lovplan.com/privacy](https://lovplan.com/privacy) for the canonical
version.

## Questions

Email **support@lovplan.com**.
