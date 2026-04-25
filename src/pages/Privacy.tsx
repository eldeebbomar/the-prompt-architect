import SEO from "@/components/SEO";

const Privacy = () => {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <SEO
        title="Privacy Policy"
        description="How Lovplan collects, uses, and protects your data."
      />

      <header className="mb-10">
        <h1 className="font-heading text-3xl text-foreground sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 font-body text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <div className="space-y-8 font-body text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">Summary</h2>
          <p>
            Lovplan helps you turn an app idea into a sequence of Lovable-ready prompts. To do
            that, we collect the minimum information we need to run your account, generate
            prompts, deliver email, and process payments. We do not sell your data and we do
            not show advertising. This page explains what we collect, how we use it, who we
            share it with, and how to control it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">What we collect</h2>
          <ul className="list-inside list-disc space-y-1.5">
            <li><strong className="text-foreground">Account data:</strong> email, name, password hash (or OAuth identifier), referral code, plan and credit balance.</li>
            <li><strong className="text-foreground">Project data:</strong> the discovery chat content, generated prompts, project descriptions, and deploy progress you create through the app.</li>
            <li><strong className="text-foreground">Billing data:</strong> Stripe customer ID and invoice history. Card details are held by Stripe — we never see them.</li>
            <li><strong className="text-foreground">Operational logs:</strong> error and audit logs (request IDs, timestamps, action types). We aim to keep these free of sensitive content.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">How we use it</h2>
          <ul className="list-inside list-disc space-y-1.5">
            <li>To run the discovery chat and generate prompts for your projects.</li>
            <li>To deliver transactional emails (account confirmation, password reset, deploy completion). You can opt out of marketing emails at any time in Settings.</li>
            <li>To process subscriptions and one-off purchases through Stripe.</li>
            <li>To detect abuse (rate limits, anti-fraud), and to debug failures using error logs.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">Who we share it with</h2>
          <p className="mb-2">
            Lovplan uses a small number of trusted infrastructure providers. We share only the
            data each provider needs to do its job:
          </p>
          <ul className="list-inside list-disc space-y-1.5">
            <li><strong className="text-foreground">Supabase</strong> — database, authentication, file storage, edge functions.</li>
            <li><strong className="text-foreground">Resend</strong> — outbound email delivery.</li>
            <li><strong className="text-foreground">Stripe</strong> — payment processing and subscription management.</li>
            <li><strong className="text-foreground">n8n (self-hosted)</strong> — runs the AI workflows that interview you and produce prompts.</li>
            <li><strong className="text-foreground">Anthropic / OpenAI</strong> — the LLMs that generate text inside our n8n workflows. We send the discovery chat content but no billing or contact data.</li>
          </ul>
          <p className="mt-3">
            We do not sell, rent, or trade your data. We do not share data with advertisers.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">Where we store it</h2>
          <p>
            All Lovplan data is stored in Supabase (Postgres) and Stripe. Backups are kept by
            those providers per their standard policies. We retain your account data for as
            long as your account is active. If you delete your account, we delete your
            projects, prompts, transactions, and personal information from our database within
            30 days. Stripe retains payment records for the period required by law.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">Cookies and tracking</h2>
          <p>
            We use cookies (and the equivalent local storage) only for authentication and
            for remembering UI preferences such as which prompts you've copied. We do not use
            third-party advertising or analytics trackers.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">Your controls</h2>
          <ul className="list-inside list-disc space-y-1.5">
            <li><strong className="text-foreground">Access &amp; correction:</strong> view and edit profile data in Settings.</li>
            <li><strong className="text-foreground">Export:</strong> download generated prompts from the prompt viewer (Markdown, JSON, CSV, plain text).</li>
            <li><strong className="text-foreground">Email opt-out:</strong> toggle marketing emails in Settings → Notifications. Transactional emails (security, billing) are required for the service.</li>
            <li><strong className="text-foreground">Deletion:</strong> Settings → Danger Zone → Delete account. This removes your data within 30 days.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">Children</h2>
          <p>
            Lovplan is not intended for children under 16. We do not knowingly collect
            data from anyone under 16. If you believe a child has used Lovplan, contact us and
            we'll remove the account.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">Changes</h2>
          <p>
            We will update this page when our practices change. If a change is material, we
            will email you and give you a chance to review it before it takes effect.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">Contact</h2>
          <p>
            Questions about this policy or your data? Email{" "}
            <a href="mailto:support@lovplan.com" className="text-primary hover:underline">
              support@lovplan.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
