import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, PlayCircle, CheckCircle2 } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import PromptCardStack from "@/components/PromptCardStack";
import ProblemSection from "@/components/ProblemSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import FeatureChatSection from "@/components/FeatureChatSection";
import FeaturePromptsSection from "@/components/FeaturePromptsSection";
import FeatureRevisionSection from "@/components/FeatureRevisionSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import PricingSection from "@/components/PricingSection";
import FaqSection from "@/components/FaqSection";
import CtaFooter from "@/components/CtaFooter";

const examplePrompts = [
  "Set up Supabase auth with email/password and Google OAuth, including protected route wrappers",
  "Create a responsive dashboard layout with sidebar navigation and breadcrumb header",
  "Build a data table component with sorting, filtering, pagination, and bulk actions",
];

const avatars = [
  "https://i.pravatar.cc/80?img=12",
  "https://i.pravatar.cc/80?img=32",
  "https://i.pravatar.cc/80?img=45",
  "https://i.pravatar.cc/80?img=68",
];

const Index = () => {
  return (
    <div className="blueprint-grid">
      {/* Hero — Asymmetric editorial */}
      <section className="container relative flex min-h-[calc(100vh-64px)] flex-col gap-12 pt-20 pb-16 lg:flex-row lg:items-center lg:gap-8 lg:pt-0 lg:pb-0">
        {/* Left column — 55% */}
        <div className="flex flex-col justify-center lg:w-[55%]">
          {/* Pill badge */}
          <div
            className="mb-6 opacity-0 animate-fade-up"
            style={{ animationDelay: "0ms" }}
          >
            <span className="inline-block rounded-button border border-primary/50 px-3 py-1 font-body text-[12px] font-medium uppercase tracking-[0.1em] text-primary">
              For Lovable Builders
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-heading text-[36px] leading-[1.08] text-foreground opacity-0 animate-fade-up md:text-[56px]"
            style={{ animationDelay: "100ms" }}
          >
            Stop prompting blindly.
            <br />
            Build with a <span className="text-primary">plan</span>.
          </h1>

          {/* Subtitle */}
          <p
            className="mt-6 max-w-[480px] font-body text-lg font-light leading-relaxed text-muted-foreground opacity-0 animate-fade-up"
            style={{ animationDelay: "200ms", textWrap: "pretty" }}
          >
            LovPlan's AI architect interviews you about your idea, then generates 50+ structured, dependency-ordered prompts — so your Lovable app is built right the first time.
          </p>

          {/* Buttons */}
          <div
            className="mt-10 flex flex-col gap-3 opacity-0 animate-fade-up sm:flex-row sm:gap-4"
            style={{ animationDelay: "300ms" }}
          >
            <Link to="/signup">
              <Button variant="amber" size="lg" className="gap-2">
                Start Your First Project <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/#how-it-works">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 border-muted-foreground/30 text-foreground"
              >
                <PlayCircle className="h-4 w-4" />
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div
            className="mt-10 flex items-center gap-3 opacity-0 animate-fade-up"
            style={{ animationDelay: "400ms" }}
          >
            <div className="flex -space-x-2">
              {avatars.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-8 w-8 rounded-full border-2 border-background object-cover"
                />
              ))}
            </div>
            <p className="font-body text-sm text-muted-foreground">
              Trusted by <span className="font-medium text-foreground">200+</span> Lovable builders
            </p>
          </div>
        </div>

        {/* Right column — 45% */}
        <div
          className="flex items-center justify-center lg:w-[45%]"
        >
          <PromptCardStack />
        </div>
      </section>

      {/* Problem / Solution */}
      <ProblemSection />

      <div className="amber-rule" />

      {/* How it Works */}
      <HowItWorksSection />

      <div className="amber-rule" />

      {/* Feature — AI Chat */}
      <FeatureChatSection />

      <div className="amber-rule" />

      {/* Feature — Prompt Blueprint */}
      <FeaturePromptsSection />

      <div className="amber-rule" />

      {/* Feature — Revision & Loop */}
      <FeatureRevisionSection />

      <div className="amber-rule" />

      {/* Testimonials */}
      <TestimonialsSection />

      <div className="amber-rule" />

      {/* Pricing */}
      <PricingSection />

      <div className="amber-rule" />

      {/* Example Prompts */}
      <section id="examples" className="container py-24">
        <ScrollReveal className="text-center">
          <h2 className="mb-4 font-heading text-3xl text-foreground md:text-4xl">
            Sample prompt output
          </h2>
          <p className="mx-auto mb-16 max-w-lg font-body text-sm text-muted-foreground">
            Each prompt is production-ready, specific, and designed to build on the last.
          </p>
        </ScrollReveal>
        <div className="mx-auto max-w-2xl space-y-4">
          {examplePrompts.map((prompt, i) => (
            <ScrollReveal key={i} delay={i * 80 + 60}>
              <div className="prompt-card flex items-start gap-4 rounded-card border border-border p-5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                <p className="font-mono text-sm leading-relaxed text-foreground">{prompt}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <div className="amber-rule" />

      {/* FAQ */}
      <FaqSection />

      <div className="amber-rule" />

      {/* CTA + Footer */}
      <CtaFooter />
    </div>
  );
};

export default Index;
