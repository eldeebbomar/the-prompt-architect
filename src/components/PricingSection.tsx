import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/ScrollReveal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const plans = [
  {
    name: "Single",
    subtitle: "Perfect for trying it out",
    price: "$12.99",
    priceLabel: "one project",
    oldPrice: null,
    badge: null,
    highlighted: false,
    features: [
      "Full AI discovery conversation",
      "50+ structured prompts",
      "Up to 2 revisions",
      "Custom loop prompts",
      "Export & copy all",
    ],
    cta: "Get Started",
    ctaVariant: "outline" as const,
    ctaClass: "border-primary text-primary hover:bg-primary/10",
  },
  {
    name: "5-Pack",
    subtitle: "For serious builders",
    price: "$44.99",
    priceLabel: "$9 per project",
    oldPrice: "$64.95",
    badge: { text: "POPULAR", color: "bg-primary text-primary-foreground" },
    highlighted: true,
    features: [
      "Full AI discovery conversation",
      "50+ structured prompts",
      "Up to 2 revisions",
      "Custom loop prompts",
      "Export & copy all",
      "Priority generation speed",
      "Save projects for re-use",
    ],
    cta: "Get 5 Projects",
    ctaVariant: "amber" as const,
    ctaClass: "",
  },
  {
    name: "Unlimited",
    subtitle: "Build as many apps as you want",
    price: "$99",
    priceLabel: "/month",
    oldPrice: null,
    badge: { text: "PRO", color: "bg-secondary/15 text-secondary" },
    highlighted: false,
    features: [
      "Full AI discovery conversation",
      "50+ structured prompts",
      "Up to 2 revisions",
      "Custom loop prompts",
      "Export & copy all",
      "Unlimited projects",
      "Unlimited revisions",
      "Early access to new features",
      "API access (coming soon)",
    ],
    cta: "Go Unlimited",
    ctaVariant: "outline" as const,
    ctaClass: "border-secondary text-secondary hover:bg-secondary/10",
  },
];

const PricingSection = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const priceTypeMap: Record<string, string> = {
    "Single": "single",
    "5-Pack": "pack",
    "Unlimited": "unlimited",
  };

  const handleCheckout = async (planName: string) => {
    if (!user) {
      window.location.href = "/signup";
      return;
    }

    const priceType = priceTypeMap[planName];
    if (!priceType) return;

    setLoading(priceType);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { price_type: priceType },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };
  return (
    <section id="pricing" className="container py-24">
      {/* Header */}
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="mb-4 font-body text-xs font-medium uppercase tracking-[0.15em] text-primary">
          Pricing
        </p>
        <h2 className="font-heading text-3xl leading-[1.15] text-foreground md:text-[40px]">
          Simple, honest pricing
        </h2>
        <p className="mx-auto mt-4 max-w-lg font-body text-sm font-light text-muted-foreground">
          Every plan includes full AI discovery + 50+ prompts + loop prompts per project.
        </p>
      </ScrollReveal>

      {/* Cards */}
      <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-3 md:items-center">
        {plans.map((plan, i) => (
          <ScrollReveal key={plan.name} delay={i * 100 + 80}>
            <div
              className={`relative rounded-card border p-8 transition-all duration-300 hover:-translate-y-0.5 ${
                plan.highlighted
                  ? "border-primary bg-[hsl(var(--surface-elevated))] shadow-warm-lg md:-my-4 md:py-10"
                  : "border-border bg-card hover:shadow-warm"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <span
                  className={`absolute right-5 top-5 rounded-button px-2.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider ${plan.badge.color}`}
                >
                  {plan.badge.text}
                </span>
              )}

              {/* Title */}
              <h3 className="font-heading text-2xl text-foreground">{plan.name}</h3>
              <p className="mt-1 font-body text-xs text-muted-foreground">{plan.subtitle}</p>

              {/* Price */}
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-heading text-4xl text-foreground">{plan.price}</span>
                <span className="font-body text-sm text-muted-foreground">{plan.priceLabel}</span>
              </div>
              {plan.oldPrice && (
                <p className="mt-1 font-body text-xs text-muted-foreground line-through">
                  {plan.oldPrice}
                </p>
              )}

              {/* Features */}
              <ul className="mt-7 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                    <span className="font-body text-[13px] text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link to="/signup" className="mt-8 block">
                <Button
                  variant={plan.ctaVariant}
                  className={`h-11 w-full text-sm font-medium ${plan.ctaClass}`}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Guarantee */}
      <ScrollReveal delay={300} className="mt-12 text-center">
        <p className="font-body text-sm text-muted-foreground">
          All plans include a 7-day money-back guarantee
        </p>
      </ScrollReveal>
    </section>
  );
};

export default PricingSection;
