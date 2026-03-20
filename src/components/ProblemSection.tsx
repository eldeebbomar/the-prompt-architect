import { Undo2, RefreshCw, Unplug, CheckCircle2 } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const painCards = [
  {
    icon: Undo2,
    title: "Vague prompts, vague results",
    text: "Without structure, Lovable builds disconnected pieces that don't fit together.",
  },
  {
    icon: RefreshCw,
    title: "The infinite fix loop",
    text: "You spend more time fixing AI mistakes than building. Each fix creates two new bugs.",
  },
  {
    icon: Unplug,
    title: "No dependency order",
    text: "Building the hero before the design system. Adding payments before auth. It all breaks.",
  },
];

const ProblemSection = () => {
  return (
    <>
      {/* Amber divider */}
      <div className="flex justify-center py-20">
        <div className="h-px w-2/5 bg-primary/40" />
      </div>

      {/* Problem header */}
      <section className="container pb-20">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="mb-4 font-body text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            The Problem
          </p>
          <h2 className="font-heading text-3xl leading-[1.15] text-foreground md:text-[40px]">
            Lovable is powerful.
            <br />
            But prompting it is an art.
          </h2>
          <p className="mx-auto mt-5 max-w-[600px] font-body text-base font-light leading-relaxed text-muted-foreground" style={{ textWrap: "pretty" }}>
            Most builders waste hours on vague prompts, getting broken outputs, then trying to fix things in circles. Your idea deserves better than trial and error.
          </p>
        </ScrollReveal>

        {/* Pain cards */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {painCards.map((card, i) => (
            <ScrollReveal key={card.title} delay={i * 100 + 80}>
              <div className="rounded-card border border-border bg-card p-7 transition-shadow duration-300 hover:shadow-warm">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-button bg-destructive/10">
                  <card.icon className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="mb-2 font-heading text-xl text-foreground">{card.title}</h3>
                <p className="font-body text-sm font-light leading-relaxed text-muted-foreground">
                  {card.text}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Subtle divider */}
      <div className="flex justify-center py-8">
        <div className="h-px w-1/4 bg-border" />
      </div>

      {/* Solution */}
      <section className="container pb-20">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="mb-4 font-body text-xs font-medium uppercase tracking-[0.15em] text-primary">
            The Solution
          </p>
          <h2 className="font-heading text-3xl leading-[1.15] text-foreground md:text-[40px]">
            An AI architect that plans before it builds.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={120} className="mx-auto mt-12 max-w-3xl">
          <div className="flex items-start gap-5 rounded-card border border-border bg-card p-7" style={{ borderLeft: "4px solid hsl(var(--amber))" }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/15">
              <CheckCircle2 className="h-5 w-5 text-secondary" />
            </div>
            <p className="font-body text-sm font-light leading-relaxed text-muted-foreground" style={{ textWrap: "pretty" }}>
              <span className="font-normal text-foreground">LovPlan interviews you about your idea</span>, understands your stack, then generates 50+ prompts in the exact right order — infrastructure first, features second, polish last. Like having a senior developer plan your entire build.
            </p>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
};

export default ProblemSection;
