import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/ScrollReveal";
import lovplanWordmark from "@/assets/lovplan-wordmark.png";

const footerLinks = {
  Product: [
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Examples", href: "/examples" },
  ],
  Resources: [
    { label: "Help Center", href: "/help" },
    { label: "Contact", href: "mailto:support@lovplan.com" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

const CtaFooter = () => {
  return (
    <>
      {/* Final CTA */}
      <section
        className="relative"
        style={{
          background: "linear-gradient(180deg, hsl(38 76% 56% / 0.06) 0%, hsl(33 10% 9%) 12%, hsl(33 10% 9%) 100%)",
        }}
      >
        <div className="container py-20 md:py-[80px]">
          <ScrollReveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl leading-[1.12] text-foreground md:text-[44px]">
              Your next app deserves a plan.
            </h2>
            <p className="mt-4 font-body text-base font-light text-muted-foreground">
              Start with a free project. No credit card required.
            </p>
            <Link to="/signup" className="mt-10 inline-block">
              <Button
                variant="amber"
                className="h-auto px-12 py-4 text-lg font-semibold"
              >
                Start Building for Free
              </Button>
            </Link>
            <p className="mt-4 font-body text-xs text-muted-foreground">
              1 free project included with every account
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(30_10%_15%)] bg-background pt-[60px] pb-10">
        <div className="container">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand column */}
            <div>
              <img
                src={lovplanWordmark}
                alt="Lovplan"
                width={180}
                height={45}
                loading="lazy"
                className="h-9 w-auto"
              />
              <p className="mt-3 max-w-[220px] font-body text-sm font-light leading-relaxed text-muted-foreground">
                AI-powered prompt blueprints for Lovable builders.
              </p>
              <p className="mt-4 font-body text-xs text-muted-foreground">
                © 2025 Lovplan. All rights reserved.
              </p>
            </div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="mb-4 font-body text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                  {title}
                </h4>
                <ul className="space-y-2.5">
                  {links.map((link) => {
                    const isExternal = link.href.startsWith("mailto:") || link.href.startsWith("http");
                    const cls = "font-body text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground";
                    return (
                      <li key={link.label}>
                        {isExternal ? (
                          <a href={link.href} className={cls}>{link.label}</a>
                        ) : (
                          <Link to={link.href} className={cls}>{link.label}</Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Amber flourish */}
          <div className="mt-12 flex justify-center">
            <div className="h-px w-1/5 bg-primary/30" />
          </div>
        </div>
      </footer>
    </>
  );
};

export default CtaFooter;
