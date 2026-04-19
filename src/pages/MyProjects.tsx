import { useState, useMemo } from "react";
import SEO from "@/components/SEO";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Compass, MoreVertical, Trash2, Copy, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/use-projects";
import { handleWebhookError } from "@/lib/webhook-error-handler";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const statusFilters = [
  { value: "all", label: "All" },
  { value: "discovery", label: "Discovery" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  discovery: { label: "In Discovery", className: "border-primary/50 text-primary" },
  generating: { label: "Generating...", className: "border-primary/50 text-primary animate-pulse" },
  ready: { label: "Ready", className: "border-secondary/50 text-secondary" },
  revising: { label: "Revising", className: "border-primary/50 text-primary" },
  completed: { label: "Completed", className: "border-muted-foreground/30 text-muted-foreground" },
};

const PAGE_SIZE = 12;

const MyProjects = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useProjects();

  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!projects) return [];
    let list = [...projects];
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "newest" ? db - da : da - db;
    });
    return list;
  }, [projects, statusFilter, sort]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("projects").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (error) {
      toast.error("Failed to delete project.");
    } else {
      toast.success("Project deleted.");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-count"] });
    }
  };

  const handleDuplicate = async (projectId: string) => {
    if (duplicating) return; // Prevent concurrent duplications
    setDuplicating(projectId);
    try {
      const { data, error } = await supabase.functions.invoke("duplicate-project", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Project duplicated! 1 credit used.");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-count"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["credit-stats"] });

      if (data?.project?.id) {
        navigate(`/project/${data.project.id}`);
      }
    } catch (err) {
      if (!handleWebhookError(err as any, navigate)) {
        toast.error("Failed to duplicate project.");
      }
    } finally {
      setDuplicating(null);
    }
  };

  return (
    <div className="space-y-6">
      <SEO title="My Projects" description="View, manage, and organize all of your LovPlan prompt blueprints." noindex />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-[28px] text-foreground">My Projects</h1>
        <Button variant="amber" className="gap-2" onClick={() => navigate("/dashboard/new")}>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Filter / sort bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setVisibleCount(PAGE_SIZE); }}
              className={`rounded-button px-3.5 py-1.5 font-body text-xs font-medium transition-all duration-200 active:scale-[0.97] ${
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px] h-9 rounded-button border-border bg-card text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-card bg-muted" />
          ))}
        </div>
      ) : !filtered.length ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card px-8 py-20 text-center">
          <Compass className="mb-4 h-14 w-14 text-primary/30" />
          <h2 className="font-heading text-xl text-foreground">No projects yet</h2>
          <p className="mt-2 max-w-sm font-body text-sm text-muted-foreground">
            Start by describing your app idea to our AI architect.
          </p>
          <Button
            variant="amber"
            className="mt-6 gap-2"
            onClick={() => navigate("/dashboard/new")}
          >
            <Plus className="h-4 w-4" /> Create Your First Project
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((project) => {
              const status = statusConfig[project.status] ?? statusConfig.discovery;
              return (
                <div
                  key={project.id}
                  className="group relative flex flex-col rounded-card border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[hsl(33_12%_25%)] hover:shadow-warm"
                >
                  {/* Status badge + menu */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span
                      className={`shrink-0 rounded-button border px-2.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider ${status.className}`}
                    >
                      {status.label}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-7 w-7 items-center justify-center rounded-button text-muted-foreground/50 transition-colors hover:text-muted-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem
                          className="gap-2"
                          disabled={duplicating === project.id}
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(project.id); }}
                        >
                          {duplicating === project.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(project.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Clickable area */}
                  <Link to={`/project/${project.id}`} className="flex flex-1 flex-col">
                    <h3 className="mb-1.5 font-heading text-lg text-foreground transition-colors group-hover:text-primary">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="mb-4 font-body text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {project.description.slice(0, 100)}
                        {project.description.length > 100 ? "…" : ""}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
                      <span className="font-body text-[11px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                      </span>
                      {(project.status === "ready" || project.status === "completed") && (
                        <span className="rounded-sm bg-secondary/10 px-2 py-0.5 font-mono text-[10px] text-secondary">
                          prompts ready
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-foreground">Delete project?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-muted-foreground">
              Delete this project and all its prompts? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyProjects;
