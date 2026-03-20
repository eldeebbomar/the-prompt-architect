import { useState, useEffect, useCallback } from "react";
import { Rocket, Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "lovplan_tutorial_dismissed";

interface TutorialStep {
  target: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: string;
}

const steps: TutorialStep[] = [
  {
    target: "[data-tutorial='new-project-nav']",
    icon: <Rocket className="h-5 w-5 text-primary" />,
    title: "Start here!",
    body: "Create your first project to begin the AI discovery conversation.",
  },
  {
    target: "[data-tutorial='credit-balance']",
    icon: <Coins className="h-5 w-5 text-primary" />,
    title: "You have 1 free credit!",
    body: "Each credit covers a full project: AI interview, 50+ prompts, revisions, and loop prompts.",
  },
  {
    target: "[data-tutorial='new-project-cta']",
    icon: <Plus className="h-5 w-5 text-primary" />,
    title: "Ready to build?",
    body: "Click here when you're ready. You'll chat with our AI architect about your app idea.",
    cta: "Got it! Let's build.",
  },
];

interface OnboardingTutorialProps {
  projectCount: number | undefined;
  isLoading: boolean;
}

const OnboardingTutorial = ({ projectCount, isLoading }: OnboardingTutorialProps) => {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if ((projectCount ?? 0) > 0) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {}
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, [projectCount, isLoading]);

  const updatePos = useCallback(() => {
    if (!visible) return;
    const step = steps[current];
    const el = document.querySelector(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setPos(null);
    }
  }, [current, visible]);

  useEffect(() => {
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [updatePos]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
  };

  const next = () => {
    if (current < steps.length - 1) setCurrent((c) => c + 1);
    else dismiss();
  };

  if (!visible) return null;

  const step = steps[current];

  // Position tooltip near the highlighted element
  const tooltipStyle: React.CSSProperties = pos
    ? {
        position: "fixed",
        top: Math.min(pos.top + pos.height + 12, window.innerHeight - 220),
        left: Math.max(16, Math.min(pos.left, window.innerWidth - 340)),
        zIndex: 10002,
      }
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10002 };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[10000] transition-opacity duration-300"
        style={{ backgroundColor: "rgba(15, 14, 12, 0.8)" }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight cutout */}
      {pos && (
        <div
          className="fixed z-[10001] rounded-card"
          style={{
            top: pos.top - 6,
            left: pos.left - 6,
            width: pos.width + 12,
            height: pos.height + 12,
            boxShadow: "0 0 0 9999px rgba(15, 14, 12, 0.8), 0 0 24px 4px hsl(38 76% 56% / 0.3)",
            pointerEvents: "none",
          }}
        >
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-card border-2 border-primary animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
        </div>
      )}

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        className="w-[320px] animate-scale-in rounded-card border border-primary/50 bg-card p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <div className="mb-3 flex items-center gap-2.5">
          {step.icon}
          <h3 className="font-heading text-base text-foreground">{step.title}</h3>
        </div>
        <p className="mb-4 font-body text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        {/* Step dots */}
        <div className="mb-4 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            className="font-body text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip Tutorial
          </button>
          {step.cta ? (
            <Button variant="amber" size="sm" onClick={dismiss}>
              {step.cta}
            </Button>
          ) : (
            <Button variant="amber" size="sm" onClick={next}>
              Next
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default OnboardingTutorial;
