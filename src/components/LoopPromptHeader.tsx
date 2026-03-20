import { RefreshCw, Lightbulb } from "lucide-react";

const LoopPromptHeader = () => (
  <div className="border-b border-border px-4 py-4 space-y-3">
    <div className="flex items-center gap-2">
      <RefreshCw className="h-5 w-5 text-primary" />
      <h2 className="font-heading text-xl text-foreground">
        Loop Prompts — Self-Healing Audit
      </h2>
    </div>
    <p className="font-body text-xs text-muted-foreground">
      Run these AFTER you've queued all main prompts. Each one tells Lovable to
      audit and fix its own code.
    </p>
    <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
      <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
      <p className="font-body text-[11px] text-primary/90">
        <span className="font-semibold">Tip:</span> Each loop prompt has a
        recommended repeat count — run it that many times for best results.
      </p>
    </div>
  </div>
);

export default LoopPromptHeader;
