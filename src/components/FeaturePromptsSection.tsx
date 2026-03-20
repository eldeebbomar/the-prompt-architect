import { CheckCircle2, Copy, MoreHorizontal } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const bullets = [
  "Prompts are correlated — each builds on the previous",
  "Backend and frontend are properly interleaved",
  "Categorized: Infrastructure, Frontend, Backend, Integration, Polish",
  "Includes loop prompts for self-healing and gap detection",
];

const categories = [
  {
    label: "INFRASTRUCTURE",
    color: "hsl(var(--amber))",
    prompts: [
      { num: 1, title: "Design System & Premium Layout" },
      { num: 2, title: "Supabase Schema: Core Tables" },
    ],
  },
  {
    label: "BACKEND",
    color: "hsl(var(--sage))",
    prompts: [
      { num: 3, title: "RLS Policies & Auth Triggers" },
      { num: 4, title: "Credit Management Functions" },
    ],
  },
  {
    label: "FRONTEND",
    color: "hsl(var(--blue-steel))",
    prompts: [
      { num: 5, title: "Dashboard Layout & Navigation" },
      { num: 6, title: "User Profile & Settings" },
    ],
  },
];

const FeaturePromptsSection = () => {
  return (
    <section className="container py-24">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
        {/* Left — Text */}
        <ScrollReveal className="lg:w-[45%]" delay={0}>
          <p className="mb-3 font-body text-xs font-medium uppercase tracking-[0.15em] text-primary">
            Feature
          </p>
          <h2 className="mb-4 font-heading text-3xl leading-[1.15] text-foreground md:text-4xl">
            50+ prompts. One click.
          </h2>
          <p
            className="mb-8 max-w-md font-body text-base font-light leading-relaxed text-muted-foreground"
            style={{ textWrap: "pretty" }}
          >
            Your discovery conversation becomes a complete, dependency-ordered prompt blueprint.
            Infrastructure first, features second, polish last — exactly how a senior developer
            would plan a build.
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

        {/* Right — Prompt list preview */}
        <ScrollReveal className="lg:w-[55%]" delay={150}>
          <div
            className="overflow-hidden rounded-card border border-border bg-card"
            style={{ boxShadow: "0 8px 40px rgba(15, 14, 12, 0.5)" }}
          >
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="font-body text-xs font-medium text-muted-foreground">
                Prompt Blueprint
              </span>
              <span className="rounded-sm bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
                52 prompts ready
              </span>
            </div>

            {/* Categories & prompts */}
            <div className="p-5 space-y-5">
              {categories.map((cat, ci) => (
                <div key={cat.label}>
                  {/* Category header with underline */}
                  <div className="mb-3">
                    <span
                      className="inline-block pb-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        color: cat.color,
                        borderBottom: `2px solid ${cat.color}`,
                      }}
                    >
                      {cat.label}
                    </span>
                  </div>

                  {/* Prompt rows */}
                  <div className="space-y-1.5">
                    {cat.prompts.map((p) => (
                      <div
                        key={p.num}
                        className="group flex items-center gap-3 rounded-button px-3 py-2 transition-colors hover:bg-accent"
                      >
                        {/* Number badge */}
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted font-mono text-[10px] font-medium text-muted-foreground">
                          {p.num}
                        </span>
                        {/* Title */}
                        <span className="flex-1 font-body text-[13px] text-foreground">
                          {p.title}
                        </span>
                        {/* Copy icon on hover */}
                        <Copy className="h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* More indicator */}
              <div className="flex items-center justify-center gap-1 py-1 text-muted-foreground/40">
                <MoreHorizontal className="h-4 w-4" />
                <span className="font-body text-[11px]">46 more prompts</span>
              </div>
            </div>

            {/* Dependency visualization */}
            <div className="border-t border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="font-body text-[10px] text-muted-foreground">Dependencies:</span>
                <svg
                  width="180"
                  height="24"
                  viewBox="0 0 180 24"
                  fill="none"
                  className="text-primary/40"
                >
                  {/* Nodes */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <circle
                      key={i}
                      cx={15 + i * 30}
                      cy={12}
                      r={4}
                      fill={i < 2 ? "hsl(38 76% 56%)" : i < 4 ? "hsl(140 16% 55%)" : "#6B8EBF"}
                      opacity={0.7}
                    />
                  ))}
                  {/* Connecting arrows */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line
                      key={`l${i}`}
                      x1={19 + i * 30}
                      y1={12}
                      x2={41 + i * 30}
                      y2={12}
                      stroke="currentColor"
                      strokeWidth={1}
                      strokeDasharray="3 2"
                    />
                  ))}
                </svg>
                <span className="font-mono text-[9px] text-muted-foreground/50">1→2→3→4→5→6</span>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default FeaturePromptsSection;
