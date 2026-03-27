import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Layers, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

const CATEGORY_COLORS: Record<string, string> = {
  INFRASTRUCTURE: "bg-primary",
  FRONTEND: "bg-[#6B8EBF]",
  BACKEND: "bg-[hsl(var(--sage))]",
  INTEGRATION: "bg-[#9B8EC4]",
  POLISH: "bg-muted-foreground",
  LOOP: "border-2 border-primary bg-transparent",
};

const SharedProject = () => {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["shared-project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, status, created_at, is_public")
        .eq("id", id!)
        .eq("is_public", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: prompts, isLoading: promptsLoading } = useQuery({
    queryKey: ["shared-prompts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_prompts")
        .select("id, category, title, purpose, sequence_order")
        .eq("project_id", id!)
        .order("sequence_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!project,
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (prompts ?? []).forEach((p) => {
      const cat = p.category.toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [prompts]);

  const isLoading = projectLoading || promptsLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-5 w-full max-w-md mb-8" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h1 className="font-heading text-2xl text-foreground">Project not found</h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            This project doesn't exist or isn't publicly shared.
          </p>
          <Link to="/">
            <Button variant="amber" className="mt-6">
              Go to LovPlan
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalPrompts = prompts?.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <SEO
        title={`${project.name} — Shared Project`}
        description={project.description || `${project.name} — a LovPlan project with ${totalPrompts} prompts.`}
      />

      {/* Project header */}
      <div className="mb-8">
        <p className="mb-2 font-body text-xs font-medium uppercase tracking-widest text-primary">
          Shared Project
        </p>
        <h1 className="font-heading text-3xl text-foreground">{project.name}</h1>
        {project.description && (
          <p className="mt-2 font-body text-sm text-muted-foreground max-w-lg">
            {project.description}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mb-8 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-body text-sm text-foreground">{totalPrompts} prompts</span>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="font-body text-sm text-foreground">
            {Object.keys(categoryCounts).length} categories
          </span>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="mb-8">
        <h2 className="mb-4 font-heading text-lg text-foreground">Prompt Categories</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(categoryCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <div
                key={cat}
                className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3"
              >
                <div
                  className={`h-3 w-3 shrink-0 rounded-full ${
                    CATEGORY_COLORS[cat] ?? "bg-muted-foreground"
                  }`}
                />
                <span className="flex-1 font-body text-sm text-foreground">
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Prompt titles preview (no full text) */}
      <div className="mb-10">
        <h2 className="mb-4 font-heading text-lg text-foreground">Prompt Titles</h2>
        <div className="space-y-2">
          {(prompts ?? []).slice(0, 10).map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 rounded-lg border border-border/50 bg-card px-4 py-3"
            >
              <span className="mt-0.5 font-mono text-xs text-muted-foreground/60">
                #{p.sequence_order}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm text-foreground">{p.title}</p>
                <p className="mt-0.5 font-body text-xs text-muted-foreground line-clamp-1">
                  {p.purpose}
                </p>
              </div>
              <div
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  CATEGORY_COLORS[p.category.toUpperCase()] ?? "bg-muted-foreground"
                }`}
              />
            </div>
          ))}
          {totalPrompts > 10 && (
            <p className="pt-2 text-center font-body text-xs text-muted-foreground">
              + {totalPrompts - 10} more prompts
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-card border border-primary/30 bg-primary/5 p-8 text-center">
        <h3 className="font-heading text-xl text-foreground">Build your own prompt blueprint</h3>
        <p className="mt-2 font-body text-sm text-muted-foreground max-w-md mx-auto">
          Describe your app idea and get 50+ sequenced, ready-to-use prompts for Lovable.
        </p>
        <Link to="/signup">
          <Button variant="amber" className="mt-5 gap-1.5">
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default SharedProject;
