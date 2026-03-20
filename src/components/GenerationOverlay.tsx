import { useEffect, useState } from "react";
import { Sparkles, Check } from "lucide-react";

const steps = [
  { label: "Analyzing your spec...", duration: 3000 },
  { label: "Building infrastructure prompts...", duration: 3000 },
  { label: "Creating feature prompts...", duration: 5000 },
  { label: "Generating backend prompts...", duration: 5000 },
  { label: "Adding polish & loop prompts...", duration: 3000 },
];

interface GenerationOverlayProps {
  visible: boolean;
  done: boolean;
  promptCount?: number;
}

const GenerationOverlay = ({ visible, done, promptCount }: GenerationOverlayProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!visible || done) return;

    let stepIndex = 0;
    const advance = () => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setCurrentStep(stepIndex);
        setTimeout(advance, steps[stepIndex].duration);
      }
    };
    setCurrentStep(0);
    const timer = setTimeout(advance, steps[0].duration);

    return () => clearTimeout(timer);
  }, [visible, done]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10">
          {done ? (
            <Check className="h-10 w-10 text-[hsl(var(--sage))]" />
          ) : (
            <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          )}
        </div>

        {/* Title */}
        <h2 className="font-heading text-2xl text-foreground">
          {done ? "Done! ✓" : "Generating your prompt blueprint..."}
        </h2>

        {done && promptCount && (
          <p className="mt-2 font-body text-lg text-primary">
            {promptCount} prompts ready
          </p>
        )}

        {/* Steps */}
        <div className="mt-10 space-y-3 text-left">
          {steps.map((step, i) => {
            const isActive = !done && i === currentStep;
            const isComplete = done || i < currentStep;

            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-300 ${
                  isActive
                    ? "bg-primary/10 border border-primary/20"
                    : isComplete
                    ? "opacity-60"
                    : "opacity-20"
                }`}
              >
                {/* Indicator */}
                <div className="shrink-0">
                  {isComplete ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--sage))]">
                      <Check className="h-3 w-3 text-background" />
                    </div>
                  ) : isActive ? (
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-muted-foreground/30" />
                  )}
                </div>

                <span
                  className={`font-body text-sm ${
                    isActive ? "text-primary font-medium" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Done step */}
        {done && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-[hsl(var(--sage))]/30 bg-[hsl(var(--sage))]/10 px-4 py-2.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--sage))]">
              <Check className="h-3 w-3 text-background" />
            </div>
            <span className="font-body text-sm font-medium text-[hsl(var(--sage))]">
              Done! ✓
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerationOverlay;
