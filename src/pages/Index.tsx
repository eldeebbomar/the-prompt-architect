import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Sparkles, Zap, CheckCircle2 } from "lucide-react";

const steps = [
  {
    icon: Sparkles,
    title: "Describe Your App",
    description: "Tell us what you're building — SaaS, marketplace, dashboard, or anything else.",
  },
  {
    icon: Layers,
    title: "Get 50+ Structured Prompts",
    description: "Receive a complete prompt sequence covering auth, database, UI, API, and deployment.",
  },
  {
    icon: Zap,
    title: "Build in Lovable",
    description: "Paste prompts sequentially into Lovable and watch your production app come to life.",
  },
];

const examplePrompts = [
  "Set up Supabase auth with email/password and Google OAuth, including protected route wrappers",
  "Create a responsive dashboard layout with sidebar navigation and breadcrumb header",
  "Build a data table component with sorting, filtering, pagination, and bulk actions",
];

const Index = () => {
  return (
    <div className="blueprint-grid">
      {/* Hero */}
      <section className="container relative py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="mb-4 font-body text-sm font-medium uppercase tracking-widest text-primary opacity-0 animate-fade-up"
            style={{ animationDelay: "0ms" }}
          >
            The Architect's Prompt Engine
          </p>
          <h1
            className="font-heading text-4xl leading-[1.1] text-foreground opacity-0 animate-fade-up md:text-6xl"
            style={{ animationDelay: "100ms", textWrap: "balance" }}
          >
            Build production apps with structured AI prompts
          </h1>
          <p
            className="mx-auto mt-6 max-w-xl font-body text-lg font-light leading-relaxed text-muted-foreground opacity-0 animate-fade-up"
            style={{ animationDelay: "200ms", textWrap: "pretty" }}
          >
            LovPlan generates 50+ carefully sequenced prompts that guide Lovable to build complete, well-architected applications — not just prototypes.
          </p>
          <div
            className="mt-10 flex flex-col items-center gap-4 opacity-0 animate-fade-up sm:flex-row sm:justify-center"
            style={{ animationDelay: "300ms" }}
          >
            <Link to="/signup">
              <Button variant="amber" size="lg" className="gap-2">
                Start Building <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/#how-it-works">
              <Button variant="outline" size="lg">
                See How It Works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="amber-rule" />

      {/* How it Works */}
      <section id="how-it-works" className="container py-24">
        <h2
          className="mb-16 text-center font-heading text-3xl text-foreground opacity-0 animate-fade-up md:text-4xl"
          style={{ animationDelay: "0ms" }}
        >
          Three steps to a finished app
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="rounded-card border border-border bg-card p-8 opacity-0 animate-fade-up transition-shadow duration-300 hover:shadow-warm"
              style={{ animationDelay: `${i * 100 + 100}ms` }}
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-button bg-primary/10">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-heading text-xl text-foreground">{step.title}</h3>
              <p className="font-body text-sm font-light leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="amber-rule" />

      {/* Example Prompts */}
      <section id="examples" className="container py-24">
        <h2
          className="mb-4 text-center font-heading text-3xl text-foreground opacity-0 animate-fade-up md:text-4xl"
        >
          Sample prompt output
        </h2>
        <p className="mx-auto mb-16 max-w-lg text-center font-body text-sm text-muted-foreground opacity-0 animate-fade-up" style={{ animationDelay: "80ms" }}>
          Each prompt is production-ready, specific, and designed to build on the last.
        </p>
        <div className="mx-auto max-w-2xl space-y-4">
          {examplePrompts.map((prompt, i) => (
            <div
              key={i}
              className="prompt-card flex items-start gap-4 rounded-card border border-border p-5 opacity-0 animate-fade-up"
              style={{ animationDelay: `${i * 100 + 100}ms` }}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
              <p className="font-mono text-sm leading-relaxed text-foreground">{prompt}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="amber-rule" />

      {/* CTA */}
      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center opacity-0 animate-fade-up">
          <h2 className="font-heading text-3xl text-foreground md:text-4xl">
            Ready to architect your next app?
          </h2>
          <p className="mt-4 font-body text-base font-light text-muted-foreground">
            Stop guessing prompts. Get a structured blueprint that builds real products.
          </p>
          <Link to="/signup" className="mt-8 inline-block">
            <Button variant="amber" size="lg" className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-heading text-sm tracking-[0.05em] text-primary">LovPlan</span>
          <p className="font-body text-xs text-muted-foreground">
            © 2026 LovPlan. Crafted for builders.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
