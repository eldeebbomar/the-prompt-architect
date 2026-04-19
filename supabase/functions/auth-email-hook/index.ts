import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
}

const SITE_NAME = 'LovPlan'
const ROOT_DOMAIN = 'lovplan.com'
const FROM_ADDRESS = `LovPlan <noreply@notify.lovplan.com>`

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email to start building with LovPlan',
  invite: "You're invited to collaborate on LovPlan",
  magiclink: 'Your LovPlan sign-in link',
  recovery: 'Reset your LovPlan password',
  email_change: 'Confirm your new LovPlan email',
  reauthentication: 'Your LovPlan verification code',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Sample data for the /preview endpoint only
const SAMPLE_PROJECT_URL = 'https://lovplan.com'
const SAMPLE_EMAIL = 'user@example.test'
const SAMPLE_DATA: Record<string, object> = {
  signup: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, recipient: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  magiclink: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  recovery: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  invite: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, confirmationUrl: SAMPLE_PROJECT_URL },
  email_change: { siteName: SITE_NAME, email: SAMPLE_EMAIL, newEmail: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  reauthentication: { token: '123456' },
}

// ---------- preview ----------
async function handlePreview(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const { type } = await req.json()
    const Tpl = EMAIL_TEMPLATES[type]
    if (!Tpl) {
      return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const html = await renderAsync(React.createElement(Tpl, SAMPLE_DATA[type] || {}))
    return new Response(html, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

// ---------- Resend send ----------
async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html, text }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body?.message || `Resend HTTP ${res.status}` }
  return { ok: true, id: body?.id }
}

// ---------- webhook ----------
async function handleWebhook(req: Request): Promise<Response> {
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!hookSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET not configured')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const payloadRaw = await req.text()
  const headers = Object.fromEntries(req.headers)

  // Verify Standard Webhooks signature (Supabase strips "v1,whsec_" — accept either form).
  let payload: any
  try {
    const normalizedSecret = hookSecret.startsWith('v1,whsec_') ? hookSecret.slice(9) : hookSecret.replace(/^whsec_/, '')
    const wh = new Webhook(normalizedSecret)
    payload = wh.verify(payloadRaw, headers)
  } catch (err) {
    console.error('Webhook verification failed', { error: (err as Error).message })
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Supabase send-email-hook payload shape:
  // { user: { email, ... }, email_data: { token, token_hash, redirect_to, email_action_type, site_url, ... } }
  const user = payload.user
  const emailData = payload.email_data
  if (!user?.email || !emailData?.email_action_type) {
    return new Response(JSON.stringify({ error: 'Invalid payload shape' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const emailType: string = emailData.email_action_type
  const Tpl = EMAIL_TEMPLATES[emailType]
  if (!Tpl) {
    console.error('Unknown email type', { emailType })
    return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Force redirects to the canonical site URL (strip any preview / localhost host Supabase may have baked in).
  const siteUrl = `https://${ROOT_DOMAIN}`
  const tokenHash: string = emailData.token_hash || ''
  const redirectTo: string = emailData.redirect_to || siteUrl
  // Standard Supabase verify URL — works for all action types.
  const confirmationUrl = `${siteUrl}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(emailType)}&redirect_to=${encodeURIComponent(redirectTo)}`

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl,
    recipient: user.email,
    confirmationUrl,
    token: emailData.token,
    email: user.email,
    newEmail: emailData.new_email,
  }

  const html = await renderAsync(React.createElement(Tpl, templateProps))
  const text = await renderAsync(React.createElement(Tpl, templateProps), { plainText: true })

  const messageId = crypto.randomUUID()

  // Pre-log so we always have a row even if Resend crashes.
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: user.email,
    status: 'pending',
  })

  const subject = EMAIL_SUBJECTS[emailType] || 'Notification from LovPlan'
  const sendResult = await sendViaResend(user.email, subject, html, text)

  if (!sendResult.ok) {
    console.error('Resend send failed', { emailType, email: user.email, error: sendResult.error })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: user.email,
      status: 'failed',
      error_message: sendResult.error?.slice(0, 500),
    })
    // Return 500 so Supabase can retry.
    return new Response(JSON.stringify({ error: sendResult.error }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: user.email,
    status: 'sent',
  })

  console.log('Auth email sent via Resend', { emailType, email: user.email, resendId: sendResult.id })
  return new Response(JSON.stringify({ success: true, id: sendResult.id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const url = new URL(req.url)
  if (url.pathname.endsWith('/preview')) return handlePreview(req)
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
