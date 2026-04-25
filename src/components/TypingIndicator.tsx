import { useEffect, useState } from "react";

// Latency-aware typing indicator. Animates dots immediately so the user sees
// the AI is "thinking", then upgrades the announcement at 20s and 40s so
// long generations don't feel abandoned. role+aria-live give screen readers
// a polite announcement on each transition.
const TypingIndicator = () => {
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 20_000);
    const t2 = setTimeout(() => setStage(2), 40_000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const sr =
    stage === 0
      ? "LovPlan Architect is responding"
      : stage === 1
        ? "LovPlan Architect is still working"
        : "LovPlan Architect is taking longer than usual to respond";

  const visibleHint =
    stage === 1
      ? "Still working…"
      : stage === 2
        ? "Taking longer than usual — you can keep waiting."
        : null;

  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <span className="sr-only">{sr}</span>
      <div className="max-w-[80%]">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-body text-[10px] font-medium text-muted-foreground">
            LovPlan Architect
          </span>
        </div>
        <div className="rounded-[12px_12px_12px_4px] bg-[hsl(var(--surface-elevated))] px-5 py-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-primary"
                style={{
                  animation: "typing-bounce 1.4s ease-in-out infinite",
                  animationDelay: `${i * 150}ms`,
                }}
              />
            ))}
          </div>
          {visibleHint && (
            <p className="mt-2 font-body text-[11px] text-muted-foreground">{visibleHint}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
