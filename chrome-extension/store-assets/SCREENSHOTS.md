# Screenshot Plan

Chrome Web Store allows up to 5 screenshots at **1280×800** (preferred) or
640×400. "Full bleed, square corners, no padding." Use saturated colors;
avoid a lot of white.

Each screenshot should tell a chapter of the flow. Suggested order:

## 1. `01-link-screen.png` — Link Your Account
**What:** The extension popup in the not-linked state, with the 6-digit
code input receiving focus and "Link Account" primary button visible.
**Caption idea (overlaid or in description):** _"Link once with a 6-digit code from your LovPlan dashboard."_
**Setup:** fresh profile, click the extension icon, screenshot the popup.
Use a full-browser frame so the 1280×800 canvas doesn't look empty —
include the lovplan.com dashboard tab in the background.

## 2. `02-projects.png` — Pick a Project
**What:** Popup showing the projects list — 3–5 test projects with varied
names and statuses (Ready, Completed). Show the email & plan badge at the
top.
**Caption:** _"Your LovPlan projects appear instantly."_

## 3. `03-deploy-progress.png` — Deploy to Lovable
**What:** Popup in the deploy-progress state — progress bar at ~60%,
"Queuing prompt 30/50: {Prompt Title}" text, Pause / Cancel buttons
visible. Background: lovable.dev with several prompts already sent in the
chat.
**Caption:** _"Prompts auto-queue to Lovable while you watch."_

## 4. `04-pause-resume.png` — Pause and Resume Anytime
**What:** Either a paused state (Heading changes to "Paused", pause button
shows "Resume") OR the resume banner on return to a paused project.
**Caption:** _"Pause for coffee. Resume on your schedule."_

## 5. `05-complete.png` — Done.
**What:** Completion screen: green check, "Deployment Complete!",
summary line "50 prompts deployed to My SaaS Dashboard", "Done" button.
Background: the finished Lovable project with all prompts processed.
**Caption:** _"A full prompt blueprint, delivered."_

---

## Small promo tile (440×280)

Required by the store. A single visual that conveys the extension at a
glance. Design notes:

- Left half: the popup silhouette with a "50/50 prompts" progress bar.
- Right half: "Auto-deploy LovPlan to Lovable.dev" headline + LovPlan
  mark, amber/gold primary color from the web app.
- No competitor logos.
- No text smaller than ~18px at 440×280.

Save as `promo-small-440x280.png`.

## Marquee tile (1400×560) — optional but unlocks feature row

Bigger version of the promo tile. Same composition, more breathing room.
Save as `promo-marquee-1400x560.png`.

---

## Capturing screenshots cleanly

1. Use a clean Chrome profile with no other extensions installed (or
   temporarily disable them).
2. Resize the browser window to exactly 1280×800 — use a devtools
   device-emulation override or a tool like Responsively App.
3. Open the popup, screenshot.
4. For popup-only screenshots, the popup is 360px wide — center it in
   the 1280×800 canvas on a gradient background that matches the LovPlan
   palette. Don't leave white gaps.
5. Export PNG. Verify dimensions.

Save all final PNGs directly in this folder (`store-assets/`).
