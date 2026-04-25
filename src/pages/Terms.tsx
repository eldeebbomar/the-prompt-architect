import SEO from "@/components/SEO";

const Terms = () => {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <SEO
        title="Terms of Service"
        description="The agreement between you and Lovplan."
      />

      <header className="mb-10">
        <h1 className="font-heading text-3xl text-foreground sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 font-body text-sm text-muted-foreground">Last updated: April 2026</p>
      </header>

      <div className="space-y-8 font-body text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">1. Acceptance</h2>
          <p>
            By creating an account, signing in, or using Lovplan you agree to these Terms and to
            our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. If
            you don't agree, don't use the service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">2. The service</h2>
          <p>
            Lovplan is a software-as-a-service product that helps you turn an app idea into a
            structured set of prompts you can use with Lovable.dev. We provide a discovery chat,
            a prompt blueprint, and a Chrome extension for automated deployment. Lovplan is not
            affiliated with Lovable.dev.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">3. Your account</h2>
          <ul className="list-inside list-disc space-y-1.5">
            <li>You're responsible for keeping your credentials secure and for all activity under your account.</li>
            <li>You must be 16 or older to create an account.</li>
            <li>One account per person. Don't share or resell access.</li>
            <li>Tell us promptly if you suspect unauthorized use.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">4. Plans, credits, and payment</h2>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Each new project consumes 1 credit. Some plans include a fixed credit allowance; the Unlimited plan removes the cap.</li>
            <li>Subscription plans renew automatically at the end of each billing period until cancelled. Cancel any time from Settings → Billing; you keep access until the period ends.</li>
            <li>Prices may change. We'll give at least 30 days' notice before a price change affects an active subscription.</li>
            <li>Taxes (e.g., VAT) are added at checkout where required by law.</li>
            <li>Payment is processed by Stripe. We don't see or store your card details.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">5. Refunds</h2>
          <p>
            If our system fails to generate prompts after charging a credit, the credit is
            automatically refunded to your account. We do not refund used credits or completed
            subscription periods. For billing disputes, contact{" "}
            <a href="mailto:support@lovplan.com" className="text-primary hover:underline">
              support@lovplan.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">6. Acceptable use</h2>
          <p className="mb-2">You agree not to:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Use Lovplan to plan, build, or assist with anything illegal, defamatory, harassing, or designed to cause real-world harm.</li>
            <li>Reverse-engineer, scrape, or attempt to extract our prompts, models, or workflow internals.</li>
            <li>Bypass rate limits, abuse credits, fabricate referrals, or interfere with other users.</li>
            <li>Use the service to generate spam, phishing infrastructure, or material that infringes someone else's rights.</li>
          </ul>
          <p className="mt-3">
            We may suspend or terminate accounts that breach these rules, with or without
            notice when the breach is serious or ongoing.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">7. Your content, our service</h2>
          <p>
            You own the projects, descriptions, and discovery answers you create on Lovplan. We
            need a limited license to operate the service: to store your content, process it
            through our AI workflows, and display it back to you. The prompts the service
            generates from your inputs are yours to use however you like, including
            commercially.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">8. Third-party services</h2>
          <p>
            Lovplan integrates with Stripe (payments), Resend (email), Anthropic and OpenAI
            (LLMs), and Lovable.dev (the deploy target). Your use of those products is subject
            to their own terms. Outages or policy changes by them may affect Lovplan, and we
            can't guarantee uptime of services we don't operate.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">9. Warranties &amp; liability</h2>
          <p>
            Lovplan is provided "as is" without warranties of any kind, express or implied. To
            the maximum extent permitted by law, our total liability for any claim related to
            the service is limited to the amount you paid us in the 12 months before the
            claim. We are not liable for indirect, incidental, or consequential damages
            (including lost profits or lost data). Some jurisdictions don't allow these
            limitations, in which case they apply only to the extent permitted.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">10. Termination</h2>
          <p>
            You can delete your account any time from Settings → Danger Zone. We may suspend
            or terminate accounts that breach these Terms. On termination, your access ends and
            we delete your data per the Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">11. Changes</h2>
          <p>
            We may update these Terms. If a change is material, we'll email you and post a
            notice in the app at least 14 days before it takes effect. Continued use after the
            effective date means you accept the new Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-xl text-foreground">12. Contact</h2>
          <p>
            Questions or notices:{" "}
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

export default Terms;
