const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="max-w-[80%]">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="font-body text-[10px] font-medium text-muted-foreground">
          LovPlan Architect
        </span>
      </div>
      <div className="rounded-[12px_12px_12px_4px] bg-[hsl(var(--surface-elevated))] px-5 py-4">
        <div className="flex items-center gap-1.5">
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
      </div>
    </div>
  </div>
);

export default TypingIndicator;
