# Chrome Web Store Listing — LovPlan Deployer

Copy these fields into the Chrome Web Store Developer Dashboard when you
submit. Character limits noted in brackets.

---

## Item name [45 chars]

LovPlan Deployer

## Short description [132 chars, shown under the icon in search]

Auto-deploy your LovPlan AI prompt blueprint to Lovable.dev. Link your account, pick a project, click Deploy. Pause and resume anytime.

## Detailed description (Store Listing tab)

**Turn your LovPlan blueprint into a working Lovable.dev app — without the copy-paste marathon.**

LovPlan Deployer is the companion extension to [LovPlan](https://lovplan.com), the AI prompt architect for Lovable.dev. After LovPlan generates your 50+ sequenced prompts, this extension types them into Lovable's chat for you, in order, pausing when Lovable is still thinking. You can pause and resume at any point.

**How it works**

1. Generate your prompt blueprint on [lovplan.com](https://lovplan.com).
2. Click "Chrome Extension" in the dashboard to get a 6-digit pairing code.
3. Paste the code into the extension popup. Done — you're linked.
4. Open your Lovable project, click the extension icon, pick your LovPlan project, hit **Deploy**.
5. Watch your app get built while you grab a coffee.

**Why people use it**

- Skip 50+ rounds of copy → paste → wait → copy → paste.
- Resume a paused deploy right where you left off.
- Progress is tracked locally — your laptop can sleep mid-deploy.
- Nothing is sent to third-party services. Everything talks to LovPlan's own backend.

**What you need**

- A LovPlan account on a paid plan (Single / 5-Pack / Unlimited).
- A generated prompt blueprint (the main LovPlan web app does this for you).
- A Lovable.dev project open in the current tab.

**Privacy**

The extension only runs on `lovable.dev` and only stores what it needs locally in your browser (session token, linked account email, last-deploy position). No trackers, no analytics, no third parties.

Full privacy policy: [lovplan.com/privacy](https://lovplan.com/privacy)
Support: support@lovplan.com

---

## Category

Productivity

## Language

English

---

## Privacy tab — Single purpose

This extension has a single purpose: to deliver an ordered list of AI-generated text prompts from the user's LovPlan account into the chat input of their active Lovable.dev project.

## Privacy tab — Permission justifications

Fill these in the Dashboard's "Permission justification" fields:

**`storage`** — Stores the user's session token, linked account info, and
per-project deploy progress so pausing and resuming a deploy works across
popup open/close cycles. No third-party data is stored.

**`tabs`** — Used only to locate the user's open Lovable.dev tab so the
extension knows where to send prompts. We query tabs by URL pattern
(lovable.dev) and never read content from other tabs.

**`scripting`** — Used only to re-inject our content script into the user's
Lovable.dev tab if the extension was just installed or the content script
hasn't loaded yet. Injection is gated on the lovable.dev host permission.

**Host permission `https://lovable.dev/*`** — The extension's entire
purpose is to automate Lovable.dev's chat input. This permission is
required to run the content script on Lovable project pages.

**Host permission `https://gnovkpjawtodjcgizxsh.supabase.co/*`** — LovPlan's
backend runs on Supabase; the extension calls LovPlan's REST API via
fetch() to retrieve the user's projects and prompts after the user explicitly
links their account.

## Privacy tab — User data disclosure (required checkboxes)

- [x] Personally identifiable information — **email address** (shown to
      the user in the popup; not sold, not shared).
- [x] Authentication information — **session token** (stored locally,
      used only to authenticate with LovPlan).
- [ ] Financial info — not collected.
- [ ] Health info — not collected.
- [ ] Personal communications — not collected.
- [ ] Location — not collected.
- [ ] Web history — not collected.
- [ ] User activity — not collected.
- [ ] Website content — not collected (prompt text is authored by the user
      inside the LovPlan app and is not extracted from third-party sites).

Also affirm (required):

- [x] I do not sell or transfer user data to third parties outside of the
      approved use cases.
- [x] I do not use or transfer user data for purposes unrelated to the
      item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or
      for lending purposes.

## Privacy policy URL

https://lovplan.com/privacy

---

## Distribution

- **Visibility**: Public
- **Regions**: All regions
- **Pricing**: Free

---

## Test instructions for the reviewer

> I need to check these carefully before submitting. The reviewer will
> use these to test the extension.

1. Visit https://lovplan.com and sign up using the test account:
   `test-reviewer@lovplan.com` / temporary password on file (or: I can
   grant reviewer credits via the admin dashboard — email support@lovplan.com
   and we will create a test account with credits).
2. From the Dashboard, create a project from a template (takes 30–60s to
   generate prompts).
3. Once status is "Ready," visit Dashboard → Chrome Extension and click
   "Generate Code." Copy the 6-digit code.
4. Open the extension popup in Chrome. Paste the code. The popup should
   show the linked account and list the project.
5. In a separate tab, open any Lovable.dev project (or sign up at
   lovable.dev first).
6. Return to the extension popup, pick the LovPlan project, click Deploy.
7. The extension will begin typing prompts into the Lovable chat input,
   one at a time with ~1.5s gaps. Clicking Pause halts; clicking Resume
   continues.

If you need pre-generated test data, email support@lovplan.com and we
will provision a reviewer account with prompts already available.

---

## Assets required before submission

Upload these on the Store Listing tab:

| Asset | Dimensions | Format | Status |
|-------|-----------|--------|--------|
| Extension icon | 128×128 | PNG | ✅ ships in package at `icons/icon128.png` |
| Small promotional tile | 440×280 | PNG or JPG | **TODO — produce and drop in `store-assets/promo-small-440x280.png`** |
| Marquee promotional tile | 1400×560 | PNG or JPG | Optional — adds feature-row eligibility |
| Screenshot 1 | 1280×800 | PNG or JPG | **TODO — popup with code entry** |
| Screenshot 2 | 1280×800 | PNG or JPG | **TODO — project list after linking** |
| Screenshot 3 | 1280×800 | PNG or JPG | **TODO — deploy in progress with progress bar** |
| Screenshot 4 | 1280×800 | PNG or JPG | **TODO — completion screen** |
| Screenshot 5 | 1280×800 | PNG or JPG | Optional — second Lovable screenshot |

See `SCREENSHOTS.md` in this folder for screenshot direction & copy.
