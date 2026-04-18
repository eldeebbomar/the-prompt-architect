# LovPlan Deployer — Chrome Web Store Publish Checklist

Work through this in order. Everything above "Submit for review" must be
done; items under "Post-launch" are follow-ups.

---

## One-time setup

- [ ] Register a Chrome Web Store developer account at
      [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
      ($5 one-time fee, per Google account).
- [ ] Verify publisher identity with the phone-number flow if prompted
      (required before publish).
- [ ] Register a group publisher if this will be co-maintained — personal
      publishers can't hand the extension off later without the transfer
      form.

## Host the privacy policy publicly

- [ ] Publish the contents of [PRIVACY.md](./PRIVACY.md) (or an adapted
      version) at **https://lovplan.com/privacy**.
- [ ] Confirm the URL returns 200 and the text is readable without login.

## Code + package

- [ ] `chrome-extension/manifest.json` version set for this release
      (`1.0.0` for the initial submission, bump for every update).
- [ ] `manifest.json` permissions list contains only: `storage`, `tabs`,
      `scripting`. No `activeTab`, no `<all_urls>`.
- [ ] `manifest.json` host_permissions contains only:
      `https://lovable.dev/*` and
      `https://gnovkpjawtodjcgizxsh.supabase.co/*`.
- [ ] Icons at `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`.
      Each verified as a real PNG at the exact dimensions.
- [ ] No `eval`, `new Function`, no loading JS from remote URLs. Grep the
      folder to confirm.
- [ ] No `innerHTML` with any dynamic data that isn't first run through
      `escapeHtml`. Verified in `popup.js`.
- [ ] DEBUG constant in `content.js` set to `false` for the release build.
- [ ] No leftover `console.log` of sensitive data (project names, prompt
      bodies, tokens).
- [ ] Extension loads as an unpacked extension in `chrome://extensions`
      with no errors or warnings in the Chrome console.
- [ ] Manual smoke test: link → list projects → deploy a small project on
      lovable.dev → verify completion → unlink. All work end-to-end.

## Build the .zip

From the repo root:

```bash
cd chrome-extension
npm run package   # see the package script below, if added
# or:
zip -r ../lovplan-deployer-v1.0.0.zip . -x "*.md" "store-assets/*" "*.DS_Store"
```

- [ ] Zip is under 10 MB (max is 2 GB, but smaller is faster to upload).
- [ ] Zip does NOT contain: `.git`, `node_modules`, `store-assets/`,
      markdown docs, mac `.DS_Store`, or editor swap files.
- [ ] Unzip into a temp folder and load as an unpacked extension to
      confirm nothing's missing.

## Store listing assets

See [store-assets/STORE_LISTING.md](./store-assets/STORE_LISTING.md) for
exact copy and field contents. Before clicking Submit:

- [ ] **Small promo tile** (440×280 PNG) produced. Required.
- [ ] **Screenshots** (1280×800 PNG, minimum 1, up to 5) produced. See
      [store-assets/SCREENSHOTS.md](./store-assets/SCREENSHOTS.md).
- [ ] Marquee tile (1400×560) optional but recommended.
- [ ] All assets dropped into `store-assets/`.

## Dashboard fields

In [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole):

- [ ] **Package:** upload the .zip built above.
- [ ] **Store Listing:** name, short description, detailed description
      (all from STORE_LISTING.md).
- [ ] **Store Listing:** upload icon, screenshots, promo tile.
- [ ] **Store Listing:** category = Productivity. Language = English.
- [ ] **Privacy:** single-purpose description pasted.
- [ ] **Privacy:** permission justifications pasted (one per permission).
- [ ] **Privacy:** data-collection disclosures checked (see STORE_LISTING).
- [ ] **Privacy:** privacy policy URL set to https://lovplan.com/privacy.
- [ ] **Privacy:** affirm limited-use, no-selling, no-unrelated-transfer.
- [ ] **Distribution:** visibility = Public, regions = All, pricing =
      Free.
- [ ] **Testing instructions:** paste the "Test instructions for the
      reviewer" block from STORE_LISTING.md. Provision a reviewer test
      account with credits if needed.

## Submit

- [ ] Click **Submit for review**. First-submission reviews commonly
      take 1–7 days. If the review asks for clarifications, respond via
      the dashboard — revisions don't start the clock over.

## Post-launch

- [ ] Monitor the dashboard for policy warnings.
- [ ] Respond to store reviews within 48h.
- [ ] Set a monthly reminder to check for broken selectors on lovable.dev
      (the `[LovPlan Deployer] fallback selector used` warning in
      content.js is the canary).
- [ ] Bump `version` in `manifest.json` for every update; the store
      rejects uploads that don't increment the version.

## If the review rejects

Common reasons and fixes:

- **Permissions too broad** → already minimized; justify each in the
  Privacy tab.
- **Single purpose unclear** → our purpose statement is already focused;
  resubmit with a tighter first sentence if needed.
- **Privacy policy missing/incomplete** → confirm the URL is live and
  readable; add any missing disclosure.
- **Deceptive/uncertain functionality** → add clearer test instructions;
  include a demo video link in the description.
