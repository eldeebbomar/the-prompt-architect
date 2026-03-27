import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, MessageSquare } from "lucide-react";

const phases = [
  { key: "idea", label: "Idea" },
  { key: "users", label: "Users" },
  { key: "features", label: "Features" },
  { key: "tech", label: "Tech" },
  { key: "scope", label: "Scope" },
];

// Spec sections mapping from raw keys to display groups
const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && !Array.isArray(v)) {
    return Object.entries(v)
      .map(([key, val]) => `${key}: ${val}`)
      .join(", ");
  }
  if (Array.isArray(v)) {
    return v.map(formatValue).join(", ");
  }
  return String(v);
};

const specSections = [
  {
    title: "App Overview",
    keys: ["name", "description", "elevator_pitch", "target_users", "app_type"],
  },
  {
    title: "Core Features",
    keys: ["core_features", "features", "user_flows", "must_haves", "v1_features"],
  },
  {
    title: "Tech Preferences",
    keys: ["auth_method", "design_style", "payment", "dark_mode", "tech_stack", "database"],
  },
  {
    title: "MVP Scope",
    keys: ["mvp_scope", "v1_scope", "future_features", "nice_to_haves", "priority"],
  },
];

interface ProjectInfoSidebarProps {
  project: {
    name: string;
    status: string;
    spec_data: Record<string, unknown> | unknown;
  } | null;
  currentPhase: number;
  loading?: boolean;
  onEndDiscovery?: () => void;
  onGeneratePrompts?: () => void;
  onKeepRefining?: () => void;
  isGenerating?: boolean;
  pendingComplete?: boolean;
}

const ProjectInfoSidebar = ({
  project,
  currentPhase,
  loading,
  onEndDiscovery,
  onGeneratePrompts,
  onKeepRefining,
  isGenerating,
  pendingComplete,
}: ProjectInfoSidebarProps) => {
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-3/4 bg-muted" />
        <Skeleton className="h-6 w-1/2 bg-muted" />
        <Skeleton className="h-4 w-full bg-muted" />
        <Skeleton className="h-4 w-full bg-muted" />
        <Skeleton className="h-4 w-2/3 bg-muted" />
      </div>
    );
  }

  if (!project) return null;

  const specData = (typeof project.spec_data === "object" && project.spec_data !== null
    ? project.spec_data
    : {}) as Record<string, unknown>;
  const specEntries = Object.entries(specData).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  // Only treat as "fully complete" when user has moved past discovery (generating/ready/completed)
  // pendingComplete means AI thinks it's done but user hasn't confirmed yet
  const isDiscoveryComplete =
    project.status === "generating" ||
    project.status === "ready" ||
    project.status === "completed";

  // Render spec in grouped sections if complete
  const renderSpecReview = () => {
    if (specEntries.length === 0) return null;

    const usedKeys = new Set<string>();
    const sections: { title: string; entries: [string, unknown][] }[] = [];

    specSections.forEach((section) => {
      const entries = specEntries.filter(([key]) => {
        const match = section.keys.some(
          (k) => key.toLowerCase().includes(k) || k.includes(key.toLowerCase())
        );
        if (match) usedKeys.add(key);
        return match;
      });
      if (entries.length > 0) {
        sections.push({ title: section.title, entries });
      }
    });

    // Remaining entries not matched to any section
    const remaining = specEntries.filter(([key]) => !usedKeys.has(key));
    if (remaining.length > 0) {
      sections.push({ title: "Additional Details", entries: remaining });
    }

    // If no sections matched, just show flat
    if (sections.length === 0) {
      sections.push({ title: "Project Spec", entries: specEntries });
    }

    return (
      <div className="mt-6 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="font-heading text-base text-foreground mb-2">
              {section.title}
            </h3>
            <div className="space-y-2">
              {section.entries.map(([key, value]) => (
                <div key={key}>
                  <p className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </p>
                  {Array.isArray(value) ? (
                    <ul className="mt-0.5 list-disc pl-4 space-y-0.5">
                      {(value as unknown[]).map((item, i) => (
                        <li key={i} className="font-body text-sm text-foreground">
                          {formatValue(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-0.5 font-body text-sm text-foreground">
                      {formatValue(value)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Project name */}
      <h2 className="font-heading text-xl text-foreground">{project.name}</h2>

      {/* Status badge */}
      <div className="mt-3">
        {isDiscoveryComplete ? (
          <span className="inline-flex items-center gap-1.5 rounded-button border border-[hsl(var(--sage))]/50 px-2.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--sage))]">
            <CheckCircle2 className="h-3 w-3" />
            Spec Ready
          </span>
        ) : pendingComplete ? (
          <span className="inline-flex items-center gap-1.5 rounded-button border border-primary/50 bg-primary/10 px-2.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            Review Ready
          </span>
        ) : (
          <span className="inline-block rounded-button border border-primary/50 px-2.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-primary">
            In Discovery
          </span>
        )}
      </div>

      {/* Phase progress — show during discovery (not pending) */}
      {!isDiscoveryComplete && !pendingComplete && (
        <div className="mt-8">
          <p className="mb-3 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Discovery Phase
          </p>
          <div className="flex items-center gap-2">
            {phases.map((phase, i) => (
              <div key={phase.key} className="flex flex-col items-center gap-1.5">
                <div
                  className={`h-3 w-3 rounded-full transition-all duration-300 ${
                    i < currentPhase
                      ? "bg-primary"
                      : i === currentPhase
                      ? "bg-primary phase-dot-active"
                      : "border border-muted-foreground/30 bg-transparent"
                  }`}
                />
                <span
                  className={`font-body text-[9px] ${
                    i <= currentPhase ? "text-primary" : "text-muted-foreground/50"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed phase dots — all filled when complete or pending */}
      {(isDiscoveryComplete || pendingComplete) && (
        <div className="mt-8">
          <p className="mb-3 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {pendingComplete && !isDiscoveryComplete ? "Ready for Review" : "Discovery Complete"}
          </p>
          <div className="flex items-center gap-2">
            {phases.map((phase) => (
              <div key={phase.key} className="flex flex-col items-center gap-1.5">
                <div className={`h-3 w-3 rounded-full ${pendingComplete && !isDiscoveryComplete ? "bg-primary" : "bg-[hsl(var(--sage))]"}`} />
                <span className={`font-body text-[9px] ${pendingComplete && !isDiscoveryComplete ? "text-primary" : "text-[hsl(var(--sage))]"}`}>
                  {phase.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spec review */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        {(isDiscoveryComplete || pendingComplete) ? renderSpecReview() : (
          specEntries.length > 0 && (
            <div className="mt-8">
              <p className="mb-4 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Spec Preview
              </p>
              <div className="space-y-4">
                {specEntries.map(([key, value]) => {
                  if (key === 'is_complete') return null;
                  const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <div key={key} className="group">
                      <p className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors group-hover:text-primary/70">
                        {label}
                      </p>
                      <p className="mt-1 font-body text-sm text-foreground leading-relaxed">
                        {formatValue(value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-auto space-y-3 pt-6 border-t border-primary/10">
        {/* Post-discovery: user confirmed or status moved past discovery */}
        {isDiscoveryComplete && project.status !== "ready" && project.status !== "completed" && onGeneratePrompts && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Button
              variant="amber"
              className="w-full h-12 gap-2 text-sm font-semibold shadow-warm hover:scale-[1.01] active:scale-[0.98] transition-all"
              onClick={onGeneratePrompts}
              disabled={isGenerating}
            >
              <Sparkles className="h-4 w-4" />
              Generate My Prompts
            </Button>
          </div>
        )}

        {/* Pending complete: AI thinks done, user decides */}
        {pendingComplete && project.status === "discovery" && onGeneratePrompts && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Button
              variant="amber"
              className="w-full h-12 gap-2 text-sm font-semibold shadow-warm hover:scale-[1.01] active:scale-[0.98] transition-all"
              onClick={onGeneratePrompts}
              disabled={isGenerating}
            >
              <Sparkles className="h-4 w-4" />
              Generate My Prompts
            </Button>

            <Button
              variant="outline"
              className="w-full h-11 gap-2 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary font-medium"
              onClick={onKeepRefining}
            >
              <MessageSquare className="h-4 w-4" />
              Keep Discussing
            </Button>
          </div>
        )}

        {/* Still in discovery, not pending */}
        {project.status === "discovery" && !pendingComplete && !isDiscoveryComplete && onEndDiscovery && (
          <div className="space-y-3">
             <Button
              variant="outline"
              className="w-full h-11 gap-2 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary font-medium"
              onClick={() => {
                const input = document.querySelector('textarea');
                if (input) input.focus();
              }}
            >
              <MessageSquare className="h-4 w-4" />
              Continue Discovery
            </Button>

            <button
              onClick={onEndDiscovery}
              className="w-full py-2 font-body text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50 transition-colors hover:text-destructive/70"
            >
              End Discovery Early
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectInfoSidebar;
