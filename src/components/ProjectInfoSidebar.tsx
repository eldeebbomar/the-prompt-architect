import { Skeleton } from "@/components/ui/skeleton";

const phases = [
  { key: "idea", label: "Idea" },
  { key: "users", label: "Users" },
  { key: "features", label: "Features" },
  { key: "tech", label: "Tech" },
  { key: "scope", label: "Scope" },
];

interface ProjectInfoSidebarProps {
  project: {
    name: string;
    status: string;
    spec_data: Record<string, unknown> | unknown;
  } | null;
  currentPhase: number; // 0-4
  loading?: boolean;
  onEndDiscovery?: () => void;
}

const ProjectInfoSidebar = ({
  project,
  currentPhase,
  loading,
  onEndDiscovery,
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
    : {}) as Record<string, string>;
  const specEntries = Object.entries(specData).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  return (
    <div className="flex h-full flex-col p-6">
      {/* Project name */}
      <h2 className="font-heading text-xl text-foreground">{project.name}</h2>

      {/* Status badge */}
      <div className="mt-3">
        <span className="inline-block rounded-button border border-primary/50 px-2.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-primary">
          In Discovery
        </span>
      </div>

      {/* Phase progress */}
      <div className="mt-8">
        <p className="mb-3 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Discovery Phase
        </p>
        <div className="flex items-center gap-2">
          {phases.map((phase, i) => (
            <div key={phase.key} className="flex flex-col items-center gap-1.5">
              <div
                className={`h-3 w-3 rounded-full transition-colors ${
                  i < currentPhase
                    ? "bg-primary"
                    : i === currentPhase
                    ? "bg-primary animate-pulse"
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

      {/* Spec preview */}
      {specEntries.length > 0 && (
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
      )}

      {/* End discovery */}
      {project.status === "discovery" && onEndDiscovery && (
        <button
          onClick={onEndDiscovery}
          className="mt-auto rounded-button border border-muted-foreground/30 px-4 py-2.5 font-body text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground active:scale-[0.97]"
        >
          End Discovery Early
        </button>
      )}
    </div>
  );
};

export default ProjectInfoSidebar;
