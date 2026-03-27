import ScrollReveal from "@/components/ScrollReveal";

const testimonials = [
  {
    name: "Sarah K.",
    handle: "@sarahbuilds",
    initials: "SK",
    quote:
      "I used to spend 3 hours writing prompts for a Lovable project. LovPlan generated better prompts in 8 minutes. My last app had zero broken components on first build.",
  },
  {
    name: "Marcus T.",
    handle: "@marcusmakes",
    initials: "MT",
    quote:
      "The dependency ordering is what sold me. Every prompt references what came before it. Lovable actually understands the full picture instead of building in isolation.",
  },
  {
    name: "Emma L.",
    handle: "@emmaships",
    initials: "EL",
    quote:
      "The loop prompts are genius. I queue them after the main build and Lovable fixes its own bugs. Saved me an entire day of debugging last week.",
  },
];

const stats = [
  { value: "500+", label: "projects planned" },
  { value: "50+", label: "prompts per project" },
  { value: "8 min", label: "average" },
];

const TestimonialsSection = () => {
  return (
    <section className="container py-24">
      {/* Header */}
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="mb-4 font-body text-xs font-medium uppercase tracking-[0.15em] text-primary">
          Testimonials
        </p>
        <h2 className="font-heading text-3xl leading-[1.15] text-foreground md:text-[40px]">
          Builders who stopped guessing
        </h2>
      </ScrollReveal>

      {/* Cards */}
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <ScrollReveal key={t.name} delay={i * 100 + 80}>
            <div className="relative rounded-card border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-warm-lg">
              {/* Quote mark */}
              <span className="absolute left-6 top-5 font-heading text-5xl leading-none text-primary/30 select-none">
                "
              </span>

              {/* Avatar + info */}
              <div className="mb-5 flex items-center gap-3 pt-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
                  <span className="font-heading text-sm font-bold text-primary">{t.initials}</span>
                </div>
                <div>
                  <p className="font-body text-sm font-medium text-foreground">{t.name}</p>
                  <p className="font-body text-xs text-muted-foreground">{t.handle}</p>
                </div>
              </div>

              {/* Quote */}
              <p className="font-body text-sm font-light leading-relaxed text-muted-foreground">
                {t.quote}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Stats row */}
      <ScrollReveal delay={200} className="mt-16">
        <div className="border-t border-primary/20 pt-12">
          <div className="flex flex-col items-center justify-center gap-10 sm:flex-row sm:gap-16">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-heading text-3xl text-primary md:text-4xl">{s.value}</p>
                <p className="mt-1 font-body text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default TestimonialsSection;
