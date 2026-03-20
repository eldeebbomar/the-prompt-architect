import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, PlayCircle, CheckCircle2 } from "lucide-react";
import PromptCardStack from "@/components/PromptCardStack";
import ProblemSection from "@/components/ProblemSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import FeatureChatSection from "@/components/FeatureChatSection";

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
      <section className="container relative flex min-h-[calc(100vh-64px)] flex-col gap-12 py-16 lg:flex-row lg:items-center lg:gap-8 lg:py-0">
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
            className="font-heading text-4xl leading-[1.08] text-foreground opacity-0 animate-fade-up md:text-[56px]"
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


      {/* How it Works */}
      <HowItWorksSection />

      <div className="amber-rule" />

      {/* Feature — AI Chat */}
      <FeatureChatSection />

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
