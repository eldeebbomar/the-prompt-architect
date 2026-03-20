import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Coins, FolderOpen, FileText, ArrowRight, Compass } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreditStats } from "@/hooks/use-credits";
import { useRecentProjects, useProjectCount, usePromptCount } from "@/hooks/use-projects";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const statusConfig: Record<string, { label: string; className: string }> = {
  discovery: { label: "Discovery", className: "border-primary/50 text-primary" },
  generating: { label: "Generating", className: "border-primary/50 text-primary animate-pulse" },
  ready: { label: "Ready", className: "border-secondary/50 text-secondary" },
  revising: { label: "Revising", className: "border-primary/50 text-primary" },
  completed: { label: "Completed", className: "border-muted-foreground/30 text-muted-foreground" },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = useCreditStats();
  const { data: projectCount, isLoading: projectsLoading } = useProjectCount();
  const { data: projects, isLoading: recentLoading } = useRecentProjects(4);
  const { data: promptCount, isLoading: promptsLoading } = usePromptCount();

  // Handle payment success
  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      const plan = searchParams.get("plan") || "";
      const planLabels: Record<string, string> = {
        single: "1 credit",
        pack: "5 credits",
        unlimited: "Unlimited plan",
      };
      toast.success(`${planLabels[plan] || "Credits"} added to your account! 🎉`);
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["credit-stats"] });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="font-heading text-[28px] text-foreground">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1.5 font-body text-sm text-muted-foreground">
          Here's your building overview
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Credits */}
        <div className="rounded-card border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="font-body text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Credits Remaining
            </span>
          </div>
          {statsLoading ? (
            <Skeleton className="h-10 w-20 bg-muted" />
          ) : (
            <>
              <p
                className={`font-heading text-4xl tabular-nums ${
                  stats?.credits_remaining === 0 ? "text-destructive" : "text-primary"
                }`}
              >
                {stats?.plan === "unlimited" ? "∞" : stats?.credits_remaining ?? 0}
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {stats?.credits_remaining === 0 ? (
                  <Link to="/dashboard/billing" className="text-primary hover:underline">
                    Buy more →
                  </Link>
                ) : (
                  "credits available"
                )}
              </p>
            </>
          )}
        </div>

        {/* Total projects */}
        <div className="rounded-card border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-body text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Total Projects
            </span>
          </div>
          {projectsLoading ? (
            <Skeleton className="h-10 w-16 bg-muted" />
          ) : (
            <>
              <p className="font-heading text-4xl tabular-nums text-foreground">
                {projectCount ?? 0}
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">projects created</p>
            </>
          )}
        </div>

        {/* Prompts generated */}
        <div className="rounded-card border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-body text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Prompts Generated
            </span>
          </div>
          {promptsLoading ? (
            <Skeleton className="h-10 w-16 bg-muted" />
          ) : (
            <>
              <p className="font-heading text-4xl tabular-nums text-foreground">
                {promptCount ?? 0}
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">total prompts</p>
            </>
          )}
        </div>
      </div>

      {/* New project CTA */}
      <button
        onClick={() => navigate("/dashboard/new")}
        className="group flex w-full flex-col items-center gap-3 rounded-card border-2 border-dashed border-primary/40 bg-card p-10 transition-all duration-300 hover:border-primary hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
          <Plus className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-heading text-xl text-foreground">Start a new project</h3>
        <p className="max-w-md font-body text-sm text-muted-foreground">
          Describe your app idea and get 50+ ready-to-use Lovable prompts
        </p>
      </button>

      {/* Recent projects */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-[22px] text-foreground">Recent Projects</h2>
          {(projects?.length ?? 0) > 0 && (
            <Link
              to="/dashboard/projects"
              className="flex items-center gap-1 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recentLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-card bg-muted" />
            ))}
          </div>
        ) : !projects?.length ? (
          <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card px-8 py-14 text-center">
            <Compass className="mb-4 h-12 w-12 text-primary/50" />
            <h3 className="font-heading text-xl text-foreground">Your workshop is empty</h3>
            <p className="mt-2 max-w-sm font-body text-sm text-muted-foreground">
              Start by creating your first project.
            </p>
            <button
              onClick={() => navigate("/dashboard/new")}
              className="mt-5 inline-flex items-center gap-2 rounded-button bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" /> Create a Project
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => {
              const status = statusConfig[project.status] ?? statusConfig.discovery;
              return (
                <Link
                  key={project.id}
                  to={`/project/${project.id}`}
                  className="group rounded-card border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-warm"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-heading text-base text-foreground group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <span
                      className={`shrink-0 rounded-button border px-2 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {project.description && (
                    <p className="mb-3 font-body text-xs text-muted-foreground line-clamp-2">
                      {project.description.slice(0, 80)}
                      {project.description.length > 80 ? "…" : ""}
                    </p>
                  )}
                  <p className="font-body text-[11px] text-muted-foreground/60">
                    {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
