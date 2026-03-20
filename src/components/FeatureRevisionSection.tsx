import { CheckCircle2, RefreshCw } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const bullets = [
  "Smart revision: only affected prompts regenerate",
  "Infrastructure stays stable when features change",
  "3-5 custom loop prompts for self-healing",
  "Audit prompts cover UI, auth, data integrity, and performance",
];

const FeatureRevisionSection = () => {
  return (
    <section className="container py-24">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
        {/* Left — Visual panels */}
        <ScrollReveal className="space-y-5 lg:w-[55%]" delay={0}>
          {/* Panel A — Pivot Support */}
          <div
            className="overflow-hidden rounded-card border border-border bg-card"
            style={{ boxShadow: "0 8px 40px rgba(15, 14, 12, 0.5)" }}
          >
            <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-body text-[10px] font-medium text-muted-foreground">
                Pivot Support
              </span>
            </div>
            <div className="space-y-2.5 p-4">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-card bg-primary px-3.5 py-2 font-body text-[12px] leading-relaxed text-primary-foreground">
                  Actually, I want to add a subscription model instead of one-time payments
                </div>
              </div>
              {/* Assistant message */}
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-card bg-[hsl(var(--surface-elevated))] px-3.5 py-2 font-body text-[12px] leading-relaxed text-foreground">
                  Got it. I'll regenerate the affected prompts: Stripe integration, pricing page, and credit system. Your design system and auth prompts stay unchanged.
                </div>
              </div>
            </div>
            {/* Diff bar */}
            <div className="flex items-center gap-3 border-t border-border px-5 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-mono text-[10px] text-primary">3 prompts updated</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <span className="font-mono text-[10px] text-muted-foreground">49 unchanged</span>
            </div>
          </div>

          {/* Panel B — Loop Prompts */}
          <div
            className="overflow-hidden rounded-card border border-border bg-card"
            style={{ boxShadow: "0 4px 24px rgba(15, 14, 12, 0.4)" }}
          >
            <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
              <RefreshCw className="h-3 w-3 text-primary" />
              <span className="font-body text-[10px] font-medium text-muted-foreground">
                Loop Prompt
              </span>
              <span className="ml-auto rounded-sm bg-primary/10 px-1.5 py-0.5 font-body text-[9px] font-medium text-primary">
                reusable
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <RefreshCw className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="font-heading text-sm text-foreground">
                    Self-Heal Audit #1: UI & Empty States
                  </h4>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                    Run a comprehensive audit on all dashboard views. Check every list and grid for proper empty state components...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Right — Text */}
        <ScrollReveal className="lg:w-[45%]" delay={150}>
          <p className="mb-3 font-body text-xs font-medium uppercase tracking-[0.15em] text-primary">
            Feature
          </p>
          <h2 className="mb-4 font-heading text-3xl leading-[1.15] text-foreground md:text-4xl">
            Change direction without starting over
          </h2>
          <p
            className="mb-8 max-w-md font-body text-base font-light leading-relaxed text-muted-foreground"
            style={{ textWrap: "pretty" }}
          >
            Ideas evolve. When your vision changes, LovPlan regenerates only the affected prompts
            while keeping your infrastructure intact. Plus, loop prompts fix what Lovable misses.
          </p>
          <ul className="space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                <span className="font-body text-sm text-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default FeatureRevisionSection;
