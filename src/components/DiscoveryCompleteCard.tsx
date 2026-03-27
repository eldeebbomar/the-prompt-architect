import { Sparkles, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiscoveryCompleteCardProps {
  specData: Record<string, unknown>;
  onGeneratePrompts: () => void;
  onKeepRefining: () => void;
  isGenerating: boolean;
  accepted: boolean; // user already clicked generate
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(formatValue).join(", ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${val}`)
      .join(", ");
  }
  return String(v);
};

const DiscoveryCompleteCard = ({
  specData,
  onGeneratePrompts,
  onKeepRefining,
  isGenerating,
  accepted,
}: DiscoveryCompleteCardProps) => {
  const entries = Object.entries(specData).filter(
    ([key, v]) => key !== "is_complete" && v !== null && v !== undefined && v !== ""
  );

  // Show a condensed spec preview — pick the most important fields
  const highlightKeys = [
    "name", "description", "elevator_pitch", "target_users", "app_type",
    "core_features", "features", "auth_method", "tech_stack", "mvp_scope",
  ];
  const highlights = entries.filter(([key]) =>
    highlightKeys.some((hk) => key.toLowerCase().includes(hk))
  );
  const shown = highlights.length > 0 ? highlights.slice(0, 6) : entries.slice(0, 6);

  return (
    <div className="flex justify-start animate-[msg-in_300ms_ease-out_both]">
      <div className="w-full max-w-[85%]">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-body text-[10px] font-medium text-muted-foreground">
            LovPlan Architect
          </span>
        </div>

        <div className="rounded-card border-2 border-primary/40 bg-[hsl(var(--surface-elevated))] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 bg-primary/10 px-5 py-3.5 border-b border-primary/20">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-heading text-base text-foreground">
                Discovery looks complete
              </p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Here's what I've gathered. Ready to generate your prompt blueprint?
              </p>
            </div>
          </div>

          {/* Spec summary */}
          {shown.length > 0 && (
            <div className="px-5 py-4 space-y-3">
              {shown.map(([key, value]) => (
                <div key={key}>
                  <p className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 font-body text-sm text-foreground leading-relaxed line-clamp-2">
                    {formatValue(value)}
                  </p>
                </div>
              ))}
              {entries.length > shown.length && (
                <p className="font-body text-[10px] text-muted-foreground">
                  +{entries.length - shown.length} more fields in the sidebar →
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {!accepted ? (
            <div className="flex items-center gap-3 border-t border-primary/20 px-5 py-4 bg-card/50">
              <Button
                variant="amber"
                className="gap-2 flex-1 h-11 font-semibold shadow-warm"
                onClick={onGeneratePrompts}
                disabled={isGenerating}
              >
                <Sparkles className="h-4 w-4" />
                Generate My Prompts
              </Button>
              <Button
                variant="outline"
                className="gap-2 flex-1 h-11 border-primary/20 text-primary hover:bg-primary/5 font-medium"
                onClick={onKeepRefining}
              >
                <MessageSquare className="h-4 w-4" />
                Keep Discussing
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-t border-primary/20 px-5 py-3 bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <p className="font-body text-sm text-primary font-medium">
                Generating your prompt blueprint…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoveryCompleteCard;
