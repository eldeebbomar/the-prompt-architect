import { CheckCircle2 } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const chatMessages = [
  {
    role: "assistant",
    text: "What are you building? Give me the elevator pitch.",
  },
  {
    role: "user",
    text: "A marketplace for freelance AI consultants",
  },
  {
    role: "assistant",
    text: "Interesting! Who's the target buyer — startups, enterprises, or both? And will consultants set their own rates or will you have fixed pricing?",
  },
  {
    role: "user",
    text: "SMBs mainly. Consultants set rates but we take a 15% cut",
  },
  {
    role: "assistant",
    text: "Got it. Let me ask about key features — do you need: 1) Real-time messaging between client and consultant? 2) A review/rating system? 3) Dispute resolution? Which are must-haves for V1?",
  },
];

const bullets = [
  "5-phase structured interview covers every angle",
  "Asks smart follow-ups, not just yes/no questions",
  "Knows which technical decisions matter for Lovable",
  "Builds a complete spec before generating a single prompt",
];

const phases = [1, 2, 3, 4, 5];

const FeatureChatSection = () => {
  return (
    <section className="container py-24">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
        {/* Left — Chat preview */}
        <ScrollReveal className="lg:w-[55%]" delay={0}>
          <div
            className="overflow-hidden rounded-card border border-border bg-card"
            style={{ boxShadow: "0 8px 40px rgba(15, 14, 12, 0.5)" }}
          >
            {/* Chat header */}
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-body text-xs font-medium text-muted-foreground">
                LovPlan Architect
              </span>
              <span className="ml-auto font-body text-[10px] text-muted-foreground/50">
                Phase 3 of 5
              </span>
            </div>

            {/* Messages */}
            <div className="space-y-3 p-5">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-card px-4 py-2.5 font-body text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-[hsl(var(--surface-elevated))] text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Phase progress */}
            <div className="flex items-center justify-center gap-2 border-t border-border px-5 py-3">
              {phases.map((p) => (
                <div
                  key={p}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    p < 3
                      ? "bg-primary"
                      : p === 3
                      ? "bg-primary animate-pulse"
                      : "bg-muted-foreground/20"
                  }`}
                />
              ))}
              <span className="ml-2 font-body text-[10px] text-muted-foreground">
                Discovery
              </span>
            </div>
          </div>
        </ScrollReveal>

        {/* Right — Text */}
        <ScrollReveal className="lg:w-[45%]" delay={150}>
          <p className="mb-3 font-body text-xs font-medium uppercase tracking-[0.15em] text-primary">
            Feature
          </p>
          <h2 className="mb-4 font-heading text-3xl leading-[1.15] text-foreground md:text-4xl">
            An AI that actually listens
          </h2>
          <p
            className="mb-8 max-w-md font-body text-base font-light leading-relaxed text-muted-foreground"
            style={{ textWrap: "pretty" }}
          >
            No generic questionnaires. LovPlan's AI architect conducts a real conversation —
            asking follow-up questions, challenging vague answers, and digging into edge cases
            your users will hit.
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

export default FeatureChatSection;
