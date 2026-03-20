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
  isGenerating?: boolean;
}

const ProjectInfoSidebar = ({
  project,
  currentPhase,
  loading,
  onEndDiscovery,
  onGeneratePrompts,
  isGenerating,
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

  const isDiscoveryComplete =
    project.status === "generating" || project.status === "ready" || project.status === "completed";

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
                      {(value as string[]).map((item, i) => (
                        <li key={i} className="font-body text-sm text-foreground">
                          {String(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-0.5 font-body text-sm text-foreground">
                      {String(value)}
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
        ) : (
          <span className="inline-block rounded-button border border-primary/50 px-2.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-primary">
            In Discovery
          </span>
        )}
      </div>

      {/* Phase progress — only show during discovery */}
      {!isDiscoveryComplete && (
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

      {/* Completed phase dots — all filled when complete */}
      {isDiscoveryComplete && (
        <div className="mt-8">
          <p className="mb-3 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Discovery Complete
          </p>
          <div className="flex items-center gap-2">
            {phases.map((phase) => (
              <div key={phase.key} className="flex flex-col items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[hsl(var(--sage))]" />
                <span className="font-body text-[9px] text-[hsl(var(--sage))]">
                  {phase.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spec review */}
      {isDiscoveryComplete ? renderSpecReview() : (
        specEntries.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Spec Preview
            </p>
            <div className="space-y-2.5">
              {specEntries.map(([key, value]) => (
                <div key={key}>
                  <p className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 font-body text-sm text-foreground">
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Action buttons */}
      <div className="mt-auto space-y-3 pt-6">
        {isDiscoveryComplete && project.status !== "ready" && project.status !== "completed" && onGeneratePrompts && (
          <>
            <Button
              variant="amber"
              className="w-full gap-2"
              size="lg"
              onClick={onGeneratePrompts}
              disabled={isGenerating}
            >
              <Sparkles className="h-4 w-4" />
              Generate My Prompts
            </Button>
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-button px-4 py-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground active:scale-[0.97]"
              onClick={() => {
                // Scroll chat input into view — the parent handles keeping the input visible
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Continue chatting
            </button>
          </>
        )}

        {project.status === "discovery" && onEndDiscovery && (
          <button
            onClick={onEndDiscovery}
            className="w-full rounded-button border border-muted-foreground/30 px-4 py-2.5 font-body text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground active:scale-[0.97]"
          >
            End Discovery Early
          </button>
        )}
      </div>
    </div>
  );
};

export default ProjectInfoSidebar;
