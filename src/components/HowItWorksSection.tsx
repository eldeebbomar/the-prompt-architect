import { MessageSquare, Layers, Rocket } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const chatMessages = [
  { role: "assistant", text: "What type of app are you building?" },
  { role: "user", text: "A project management tool for freelancers" },
  { role: "assistant", text: "Great — will it need invoicing or time tracking?" },
];

const promptList = [
  { cat: "INFRA", color: "hsl(var(--amber))", title: "Design system tokens" },
  { cat: "BACKEND", color: "hsl(var(--sage))", title: "Database schema & RLS" },
  { cat: "FRONTEND", color: "hsl(var(--blue-steel))", title: "Dashboard layout" },
];

const queueItems = [
  { status: "done", title: "Design system & layout" },
  { status: "active", title: "Supabase auth setup" },
  { status: "pending", title: "Dashboard components" },
];

const steps = [
  {
    num: "1",
    icon: MessageSquare,
    title: "Describe Your Vision",
    description:
      "Our AI architect asks you smart questions about your app — target users, features, tech preferences, design style. It digs deep until it truly understands what you're building.",
    decorative: (
      <div className="mt-5 space-y-2 rounded-card border border-border bg-[hsl(var(--prompt-card))] p-4">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-button px-3 py-1.5 font-body text-[11px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary/15 text-foreground"
                  : "bg-accent text-muted-foreground"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "2",
    icon: Layers,
    title: "Get Your Prompt Blueprint",
    description:
      "In seconds, LovPlan generates 50+ correlated prompts ordered by dependency — design system, then backend schema, then features, then polish. Each prompt is a complete instruction.",
    decorative: (
      <div className="mt-5 space-y-2 rounded-card border border-border bg-[hsl(var(--prompt-card))] p-4">
        {promptList.map((p, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className="rounded-sm px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: p.color, border: `1px solid ${p.color}` }}
            >
              {p.cat}
            </span>
            <span className="font-body text-[11px] text-muted-foreground">{p.title}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "3",
    icon: Rocket,
    title: "Queue & Build",
    description:
      "Copy your prompts into Lovable's queue one by one. Everything connects because everything was planned together. Use the loop prompts to self-heal any gaps.",
    decorative: (
      <div className="mt-5 space-y-2 rounded-card border border-border bg-[hsl(var(--prompt-card))] p-4">
        {queueItems.map((q, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                q.status === "done"
                  ? "bg-secondary"
                  : q.status === "active"
                  ? "bg-primary animate-pulse"
                  : "bg-muted-foreground/30"
              }`}
            />
            <span
              className={`font-body text-[11px] ${
                q.status === "done"
                  ? "text-muted-foreground line-through"
                  : q.status === "active"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {q.title}
            </span>
          </div>
        ))}
      </div>
    ),
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="container py-24">
      {/* Header */}
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="mb-4 font-body text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          How It Works
        </p>
        <h2 className="font-heading text-3xl leading-[1.15] text-foreground md:text-[40px]">
          From idea to 50+ prompts in minutes
        </h2>
      </ScrollReveal>

      {/* Steps */}
      <div className="relative mt-20 grid gap-12 md:grid-cols-3 md:gap-8">
        {/* Connecting line — desktop horizontal */}
        <div className="absolute left-[16.67%] right-[16.67%] top-7 hidden h-px border-t border-dashed border-primary/30 md:block" />

        {/* Connecting line — mobile vertical */}
        <div className="absolute bottom-0 left-7 top-14 w-px border-l border-dashed border-primary/30 md:hidden" />

        {steps.map((step, i) => (
          <ScrollReveal key={step.num} delay={i * 120 + 60}>
            <div className="relative pl-16 md:pl-0">
              {/* Number circle */}
              <div className="absolute left-0 top-0 flex h-14 w-14 items-center justify-center rounded-full border border-primary/50 font-heading text-2xl text-primary md:relative md:mx-auto md:mb-5">
                {step.num}
              </div>

              {/* Icon */}
              <div className="mb-3 flex md:justify-center">
                <step.icon className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Text */}
              <h3 className="mb-2 font-heading text-[22px] text-foreground md:text-center">
                {step.title}
              </h3>
              <p className="font-body text-sm font-light leading-relaxed text-muted-foreground md:text-center">
                {step.description}
              </p>

              {/* Decorative mini card */}
              {step.decorative}
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Time pill */}
      <ScrollReveal delay={400} className="mt-16 flex justify-center">
        <span className="inline-block rounded-button border border-primary/40 px-5 py-2 font-body text-sm text-primary">
          Average time from idea to full prompt blueprint: <span className="font-medium">8 minutes</span>
        </span>
      </ScrollReveal>
    </section>
  );
};

export default HowItWorksSection;
