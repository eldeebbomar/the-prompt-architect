# LovPlan — Supabase Dashboard Email Templates

Six branded HTML templates to paste into **Supabase Dashboard → Authentication → Email Templates**, plus the Auth URL Configuration you'll need alongside them.

All templates use Supabase's native template variables (Go template syntax). Supabase substitutes them server-side before the email is sent — in these files they appear literally as `{{ .ConfirmationURL }}` etc., which is correct.

---

## 1. Template files

| File | Dashboard template | Subject line |
|------|--------------------|--------------|
| `confirm-signup.html` | **Confirm signup** | Confirm your email to start building with LovPlan |
| `magic-link.html` | **Magic Link** | Your LovPlan sign-in link |
| `reset-password.html` | **Reset Password** | Reset your LovPlan password |
| `change-email.html` | **Change Email Address** | Confirm your new LovPlan email |
| `invite-user.html` | **Invite user** | You're invited to collaborate on LovPlan |
| `reauthentication.html` | **Reauthentication** | Your LovPlan verification code |

### Copy/paste flow

1. Open the Supabase project → **Authentication** → **Email Templates**.
2. Pick a template from the dropdown (e.g. *Confirm signup*).
3. Open the matching `.html` file in this folder, copy the entire file contents, paste into the dashboard's **Message body** field. The template language toggle should be **HTML** (the default).
4. Set the **Subject** field to the value from the table above.
5. Click **Save**.
6. Repeat for all six templates.

### Variables each template uses

Supabase silently renders an unknown `{{ .X }}` as an empty string — if you edit the HTML, make sure you only use variables Supabase actually provides:

| Template | Variables available |
|----------|---------------------|
| Confirm signup | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}` |
| Magic Link | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}` |
| Reset Password | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}` |
| Change Email Address | `{{ .ConfirmationURL }}`, `{{ .Email }}` (old), `{{ .NewEmail }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}` |
| Invite user | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Data }}` (custom metadata object) |
| Reauthentication | `{{ .Token }}` (6-digit code) |

---

## 2. Auth URL Configuration

Set these in **Supabase Dashboard → Authentication → URL Configuration**.

### Site URL

```
https://lovplan.com
```

This is the canonical URL. When a redirect target is missing or not on the allowlist, Supabase sends the user here.

### Additional Redirect URLs (one per line in the dashboard textarea)

```
https://lovplan.com
https://lovplan.com/dashboard
https://lovplan.com/auth/callback
https://lovplan.com/auth/reset
https://lovplan.com/accept-invite
http://localhost:8080
http://localhost:8080/auth/callback
http://localhost:8080/auth/reset
```

**Why each is needed:**

| URL | Used by |
|-----|---------|
| `https://lovplan.com` | Post-signup landing ([src/pages/Signup.tsx:27](../../src/pages/Signup.tsx#L27)) |
| `https://lovplan.com/dashboard` | OAuth success redirect ([src/pages/Signup.tsx:61](../../src/pages/Signup.tsx#L61), [src/pages/Login.tsx:31](../../src/pages/Login.tsx#L31)) |
| `https://lovplan.com/auth/callback` | Email-confirm + magic-link landing (generic OAuth/OTP callback) |
| `https://lovplan.com/auth/reset` | Password reset landing |
| `https://lovplan.com/accept-invite` | Team invite accept flow |
| `http://localhost:8080/*` | Dev server — Vite runs on port 8080 per the project CLAUDE.md |

> **Wildcards.** Supabase supports `**` wildcards (e.g. `https://lovplan.com/**`). If you prefer to simplify the list, replace the explicit paths with `https://lovplan.com/**` + `http://localhost:8080/**`. Explicit paths are safer (any rogue/preview URL won't redirect), but wildcards are less maintenance.

---

## 3. SMTP / sender settings

In **Supabase Dashboard → Authentication → SMTP Settings** (or *Custom SMTP*):

| Field | Value |
|-------|-------|
| Sender name | `LovPlan` |
| Sender email | `noreply@notify.lovplan.com` |
| Host / Port / Credentials | Your Resend (or other) SMTP credentials |

The sending domain `notify.lovplan.com` **must** have valid **SPF**, **DKIM**, and **DMARC** DNS records, or inbox providers will spam-filter the email. If you're using Resend, they give you the exact DNS records to add; verify they're all green in the Resend dashboard before going live.

The existing `auth-email-hook` edge function (see `supabase/functions/auth-email-hook/index.ts`) also sends from this address, so the DNS is likely already set up — the dashboard templates simply reuse the same domain.

---

## 4. Enabling/disabling the webhook

Supabase can deliver auth emails through **either** the dashboard templates **or** the [Auth Hook webhook](https://supabase.com/docs/guides/auth/auth-hooks) — not both at once.

- If the **Send Email Hook** is **enabled** in *Authentication → Hooks*, all six emails go through `auth-email-hook/index.ts` (React Email templates), and the dashboard templates are **not used**. The webhook is the primary delivery surface.
- If the webhook is **disabled** (or the edge function is unreachable), Supabase falls back to its built-in sender using the dashboard templates.

Keeping both in sync gives you branded output either way. If you want to switch primary delivery to the dashboard, disable the hook; if you want the more flexible React Email templates to drive, leave the hook on.

---

## 5. Testing each flow

| Flow | How to trigger |
|------|----------------|
| Confirm signup | Sign up a new account with a throwaway email |
| Magic Link | Call `supabase.auth.signInWithOtp({ email })` in a scratch script (no UI for this yet in LovPlan) |
| Reset Password | Call `supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE + '/auth/reset' })` (wait for the Forgot Password UI to ship, or trigger from a scratch script) |
| Change Email Address | In an authenticated session: `supabase.auth.updateUser({ email: 'new@x.com' })` |
| Invite user | Use the existing invite flow in the app (team collaboration), or call `supabase.auth.admin.inviteUserByEmail(email)` from the service role |
| Reauthentication | Call `supabase.auth.reauthenticate()` while signed in |

For each one, open the inbox and check:
- Subject line matches the spec above
- Branding renders (amber header, serif headline, working CTA button)
- The "copy/paste this link" fallback link below the button actually resolves
- Footer shows the recipient email and `lovplan.com` link
- No `{{ .Something }}` placeholders are visible (that means a variable name was mistyped)

---

## 6. Preview in a browser

Open any `.html` file directly in a browser to preview layout + typography. The `{{ .X }}` placeholders will render as literal text — that's expected. Supabase replaces them at send time.

For a more accurate inbox preview, paste the rendered HTML (with placeholders swapped manually) into a tool like [Litmus](https://www.litmus.com/) or [Email on Acid](https://www.emailonacid.com/) to see how Gmail, Outlook, Apple Mail, and others render it.
