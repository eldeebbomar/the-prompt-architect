import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check, RefreshCw, Download, List, GitBranch, FileText, BookOpen, Chrome, Search, SkipForward, ArrowUpRight, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useGeneratedPrompts } from "@/hooks/use-generated-prompts";
import { usePromptExport, type PromptData } from "@/hooks/use-prompt-export";
import { useDeployProgress } from "@/hooks/use-deploy-progress";
import ExportModal from "@/components/ExportModal";
import KnowledgeBaseModal from "@/components/KnowledgeBaseModal";
import PromptDetailPanel from "@/components/PromptDetailPanel";
import CopyConfetti from "@/components/CopyConfetti";
import LoopPromptHeader from "@/components/LoopPromptHeader";
import GenerateLoopPromptsCard from "@/components/GenerateLoopPromptsCard";
import DependencyGraph from "@/components/DependencyGraph";
import { getRepeatCount, getAuditTag } from "@/lib/loop-prompt-utils";
import TeamManager from "@/components/TeamManager";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { copyToClipboard } from "@/lib/clipboard";

const CATEGORY_COLORS: Record<string, string> = {
  INFRASTRUCTURE: "bg-primary",
  FRONTEND: "bg-[#6B8EBF]",
  BACKEND: "bg-[hsl(var(--sage))]",
  INTEGRATION: "bg-[#9B8EC4]",
  POLISH: "bg-muted-foreground",
  LOOP: "border-2 border-primary bg-transparent",
};

const CATEGORY_ORDER = [
  "ALL",
  "INFRASTRUCTURE",
  "FRONTEND",
  "BACKEND",
  "INTEGRATION",
  "POLISH",
  "LOOP",
];

interface PromptViewerProps {
  projectId: string;
  projectName: string;
  metadata: Json;
}

const PromptViewer = ({ projectId, projectName, metadata }: PromptViewerProps) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: prompts, isLoading } = useGeneratedPrompts(projectId);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [localMetadata, setLocalMetadata] = useState<Json>(metadata);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);

  const promptData: PromptData[] = useMemo(
    () =>
      (prompts ?? []).map((p) => {
        let cat = p.category.toUpperCase();
        if (cat.includes("FINAL LOOP")) cat = "POLISH";
        else if (cat.includes("CHECKPOINT LOOP")) cat = "CHECKPOINT";
        
        return {
          id: p.id,
          category: cat,
          sequence_order: p.sequence_order,
          title: p.title,
          purpose: p.purpose,
          prompt_text: p.prompt_text,
          is_loop: p.is_loop,
          depends_on: p.depends_on,
          repeat_count: (p as Record<string, unknown>).repeat_count as number | null | undefined,
        };
      }),
    [prompts]
  );

  const {
    copiedSet,
    copiedCount,
    totalCount,
    allCopied,
    markCopied,
    markAllCopied,
    copyAll,
    downloadMarkdown,
  } = usePromptExport(projectId, promptData, localMetadata);

  // Live deploy progress — polls the project metadata while the extension is
  // actively deploying so the UI ticks along with the user's account state.
  const { progress: deployProgress, query: deployProgressQuery } = useDeployProgress(
    projectId,
    promptData.length,
  );

  // Keep `localMetadata` in sync with the polled data so other consumers
  // (KnowledgeBaseModal, the deployedViaExtension flag below) see fresh state.
  useEffect(() => {
    const fresh = deployProgressQuery.data?.metadata;
    if (fresh) setLocalMetadata(fresh);
  }, [deployProgressQuery.data?.metadata]);

  // The polling hook stops once a deploy goes stale (>5 min since last
  // progress). For the user-pauses-walks-away-comes-back case we still want
  // a fresh state on visibility change — refetch once when the tab regains
  // focus. Cheap (single-row query) and only fires on visibility transitions.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        deployProgressQuery.refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [deployProgressQuery]);

  // Detect extension deployment — mark all prompts as copied
  const metaObj = useMemo(() => {
    return typeof localMetadata === "object" && localMetadata && !Array.isArray(localMetadata)
      ? (localMetadata as Record<string, unknown>)
      : {};
  }, [localMetadata]);
  const deployedViaExtension = !!(metaObj.deployed_via === "chrome_extension" && metaObj.deployed_at);

  const deployChecked = useRef(false);
  useEffect(() => {
    if (deployChecked.current || promptData.length === 0) return;
    if (deployedViaExtension) {
      markAllCopied();
      deployChecked.current = true;
    }
  }, [deployedViaExtension, promptData.length, markAllCopied]);

  // Reflect partial extension deploys into the local "copied" state. If the
  // extension reports `last_deployed_index = 39`, prompts 1–40 (sequence_order)
  // should render as copied so the user sees an honest "stopped at 40 of 50"
  // view in the account, not the stale pre-deploy state.
  const lastMarkedDeployIndexRef = useRef<number>(-1);
  useEffect(() => {
    if (deployedViaExtension) return; // full-completion path already marks all
    if (typeof deployProgress.lastDeployedIndex !== "number") return;
    if (deployProgress.lastDeployedIndex <= lastMarkedDeployIndexRef.current) return;

    const sorted = promptData
      .slice()
      .sort((a, b) => a.sequence_order - b.sequence_order);
    const upTo = Math.min(deployProgress.lastDeployedIndex, sorted.length - 1);
    // Only mark prompts newer than the last index we already processed —
    // avoids redundant setState calls on every poll.
    const startFrom = Math.max(0, lastMarkedDeployIndexRef.current + 1);
    for (let i = startFrom; i <= upTo; i++) {
      markCopied(sorted[i].id);
    }
    lastMarkedDeployIndexRef.current = deployProgress.lastDeployedIndex;
  }, [deployProgress.lastDeployedIndex, deployedViaExtension, promptData, markCopied]);

  // Fetch current sharing state
  useEffect(() => {
    (supabase as any)
      .from("projects")
      .select("is_public")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setIsPublic(!!data.is_public);
      });
  }, [projectId]);

  const handleToggleShare = useCallback(async () => {
    setSharingLoading(true);
    const newVal = !isPublic;
    const { error } = await (supabase as any)
      .from("projects")
      .update({ is_public: newVal })
      .eq("id", projectId);
    setSharingLoading(false);
    if (error) {
      toast.error("Failed to update sharing settings.");
      return;
    }
    setIsPublic(newVal);
    if (newVal) {
      const url = `${window.location.origin}/share/${projectId}`;
      const ok = await copyToClipboard(url);
      toast.success(
        ok
          ? "Project is now public! Share link copied."
          : `Project is now public! Share link: ${url}`,
      );
    } else {
      toast.success("Project is now private.");
    }
  }, [isPublic, projectId]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: promptData.length };
    promptData.forEach((p) => {
      const cat = p.category.toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [promptData]);

  const displayCategories = useMemo(() => {
    const base = CATEGORY_ORDER.filter(c => c !== "LOOP");
    const otherCats: string[] = [];
    Object.keys(categoryCounts).forEach((cat) => {
      if (!base.includes(cat) && cat !== "ALL" && cat !== "LOOP") {
        otherCats.push(cat);
      }
    });
    // Final order: [ALL, ...base, ...others, LOOP]
    return [...base, ...otherCats, "LOOP"];
  }, [categoryCounts]);

  const filteredPrompts = useMemo(() => {
    let result = activeCategory === "ALL" ? promptData : promptData.filter(
      (p) => p.category.toUpperCase() === activeCategory
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.purpose.toLowerCase().includes(q) ||
          p.prompt_text.toLowerCase().includes(q)
      );
    }
    return result;
  }, [promptData, activeCategory, searchQuery]);

  // Next uncompleted prompt (sorted by sequence_order)
  const nextUncompleted = useMemo(() => {
    return promptData
      .slice()
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .find((p) => !copiedSet.has(p.id)) ?? null;
  }, [promptData, copiedSet]);

  const selectedPrompt = useMemo(() => {
    if (!selectedPromptId) return filteredPrompts[0] ?? null;
    return promptData.find((p) => p.id === selectedPromptId) ?? null;
  }, [selectedPromptId, promptData, filteredPrompts]);

  const handleCopyPrompt = useCallback(
    async (prompt: PromptData) => {
      const ok = await copyToClipboard(prompt.prompt_text);
      if (ok) {
        markCopied(prompt.id);
        toast.success("Prompt copied! Paste it into Lovable.");
      } else {
        toast.error("Couldn't copy to clipboard. Try selecting the text manually.");
      }
    },
    [markCopied]
  );

  const handleCopyNext = useCallback(async () => {
    if (!nextUncompleted) return;
    await handleCopyPrompt(nextUncompleted);
    setSelectedPromptId(nextUncompleted.id);
    if (window.innerWidth < 1024) setMobileDetailOpen(true);
  }, [nextUncompleted, handleCopyPrompt]);

  const handleSelectPrompt = useCallback((id: string) => {
    setSelectedPromptId(id);
    // On mobile, open the sheet
    if (window.innerWidth < 1024) {
      setMobileDetailOpen(true);
    }
  }, []);

  // Keyboard shortcuts for prompt viewer. The listener is registered once on
  // mount; the handler reads live state from a ref so it never needs to be
  // re-added when prompts/selection change. (Old code re-added on every
  // filteredPrompts change — in a busy session that piled up listeners.)
  const kbStateRef = useRef({ filteredPrompts, selectedPromptId, selectedPrompt, handleCopyPrompt });
  useEffect(() => {
    kbStateRef.current = { filteredPrompts, selectedPromptId, selectedPrompt, handleCopyPrompt };
  }, [filteredPrompts, selectedPromptId, selectedPrompt, handleCopyPrompt]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const { filteredPrompts: fp, selectedPromptId: spid, selectedPrompt: sp, handleCopyPrompt: cp } =
        kbStateRef.current;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = fp.findIndex((p) => p.id === (spid ?? fp[0]?.id));
        const nextIdx = e.key === "ArrowDown"
          ? Math.min(currentIdx + 1, fp.length - 1)
          : Math.max(currentIdx - 1, 0);
        if (fp[nextIdx]) {
          setSelectedPromptId(fp[nextIdx].id);
        }
      }

      if (e.key === "Enter" && spid) {
        if (window.innerWidth < 1024) setMobileDetailOpen(true);
      }

      if (e.key === "c" && !e.metaKey && !e.ctrlKey && sp) {
        cp(sp);
      }

      if (e.key === "Escape") {
        setMobileDetailOpen(false);
        setSelectedPromptId(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] gap-0">
        {/* Category sidebar skeleton */}
        <div className="hidden lg:block w-[220px] shrink-0 border-r border-border bg-card p-4 space-y-4">
          <Skeleton className="h-5 w-24 mb-6" />
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3.5 w-8" />
            </div>
          ))}
          <div className="mt-8 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
        {/* Prompt list skeleton */}
        <div className="flex-1 p-6 space-y-3">
          <Skeleton className="h-6 w-48 mb-4" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-card border border-border p-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-7 w-7 shrink-0 rounded-button" />
            </div>
          ))}
        </div>
        {/* Detail panel skeleton */}
        <div className="hidden lg:block w-[40%] shrink-0 border-l border-border p-6 space-y-5">
          <div className="space-y-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-11 w-full rounded-button" />
          <Skeleton className="h-9 w-full rounded-button" />
        </div>
      </div>
    );
  }

  if (!promptData.length) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="w-full max-w-[400px] text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-primary/50" />
          <h2 className="font-heading text-xl text-foreground">No prompts generated yet</h2>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Complete the discovery phase first to generate your prompt blueprint.
          </p>
          <Button
            variant="amber"
            className="mt-5"
            onClick={() => navigate(`/project/${projectId}`)}
          >
            Go to Discovery
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        promptCount={totalCount}
        onCopyAll={copyAll}
        onDownloadMd={downloadMarkdown}
        onGoToViewer={() => setExportOpen(false)}
      />

      <KnowledgeBaseModal
        open={kbOpen}
        onOpenChange={setKbOpen}
        projectId={projectId}
        metadata={localMetadata}
        onMetadataUpdate={setLocalMetadata}
      />

      {allCopied && <CopyConfetti active={allCopied} />}

      {/* Mobile detail sheet */}
      <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] rounded-t-2xl border-t-border bg-background p-0 lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Prompt Detail</SheetTitle>
          </SheetHeader>
          <PromptDetailPanel
            prompt={selectedPrompt}
            allPrompts={promptData}
            copiedSet={copiedSet}
            onCopy={handleCopyPrompt}
            onSelectPrompt={handleSelectPrompt}
            projectId={projectId}
          />
        </SheetContent>
      </Sheet>

      <div className="flex h-[calc(100vh-64px)] flex-col">
        {/* Top header */}
        <div className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="font-heading text-lg md:text-2xl text-foreground truncate">
                {projectName}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded-button border border-[hsl(var(--sage))]/50 bg-[hsl(var(--sage))]/10 px-3 py-1 font-body text-xs font-medium text-[hsl(var(--sage))]">
                {deployedViaExtension ? (
                  <><Chrome className="h-3 w-3" /> {totalCount} Prompts Deployed</>
                ) : (
                  <><Check className="h-3 w-3" /> {totalCount} Prompts Ready</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* View toggle */}
              <div className="hidden sm:flex items-center rounded-full border border-border p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-[10px] font-medium uppercase tracking-wider transition-colors ${
                    viewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="h-3 w-3" />
                  List
                </button>
                <button
                  onClick={() => setViewMode("graph")}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-[10px] font-medium uppercase tracking-wider transition-colors ${
                    viewMode === "graph"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <GitBranch className="h-3 w-3" />
                  Graph
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex gap-1.5 border-primary/30 text-primary hover:bg-primary/20 hover:text-white"
                onClick={() => setKbOpen(true)}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Knowledge Base</span>
              </Button>
              <TeamManager projectId={projectId} isOwner={true} />
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex gap-1.5 border-primary/30 text-primary hover:bg-primary/20 hover:text-white"
                onClick={() => navigate(`/project/${projectId}/revise`)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Revise Prompts</span>
              </Button>
              {nextUncompleted ? (
                <Button
                  variant="amber"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCopyNext}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy Next: #{nextUncompleted.sequence_order}</span>
                  <span className="sm:hidden">Next</span>
                </Button>
              ) : allCopied ? (
                <Button variant="amber" size="sm" className="gap-1.5" disabled>
                  <Check className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">All Done</span>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className={`hidden sm:inline-flex gap-1.5 border-primary/30 hover:bg-primary/20 hover:text-white ${
                  isPublic ? "text-[hsl(var(--sage))]" : "text-primary"
                }`}
                onClick={handleToggleShare}
                disabled={sharingLoading}
              >
                {sharingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{isPublic ? "Shared" : "Share"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/20 hover:text-white"
                onClick={() => setExportOpen(true)}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export All</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Deploy progress banner — only when a deploy is in flight, paused, or
            errored. The "fully completed" case is already conveyed by the
            "X Prompts Deployed" pill in the header. */}
        {(deployProgress.hasProgress || deployProgress.isErrored) && !deployProgress.isCompleted && (
          <div
            className={`shrink-0 border-b px-4 py-3 md:px-6 ${
              deployProgress.isErrored
                ? "border-destructive/40 bg-destructive/10"
                : deployProgress.isPaused
                  ? "border-muted-foreground/30 bg-muted/40"
                  : "border-primary/40 bg-primary/10"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Chrome
                  className={`h-4 w-4 ${
                    deployProgress.isErrored
                      ? "text-destructive"
                      : deployProgress.isPaused
                        ? "text-muted-foreground"
                        : "text-primary"
                  }`}
                />
                <span className="font-body text-sm">
                  {deployProgress.isErrored ? (
                    <>
                      <strong>Deploy stopped</strong> at prompt {deployProgress.deployedCount} of{" "}
                      {deployProgress.totalCount}
                      {deployProgress.errorMessage ? `: ${deployProgress.errorMessage}` : "."}
                    </>
                  ) : deployProgress.isPaused ? (
                    <>
                      <strong>Paused</strong> at prompt {deployProgress.deployedCount} of{" "}
                      {deployProgress.totalCount}. Resume from your Chrome extension to continue.
                    </>
                  ) : deployProgress.isActive ? (
                    <>
                      <strong>Deploying</strong> {deployProgress.deployedCount} of{" "}
                      {deployProgress.totalCount} prompts via the Chrome extension…
                    </>
                  ) : (
                    <>
                      <strong>Last seen</strong> at prompt {deployProgress.deployedCount} of{" "}
                      {deployProgress.totalCount}. Open the extension to continue.
                    </>
                  )}
                </span>
              </div>
              <span className="font-body text-xs text-muted-foreground">{deployProgress.percent}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full transition-all duration-500 ${
                  deployProgress.isErrored
                    ? "bg-destructive"
                    : deployProgress.isPaused
                      ? "bg-muted-foreground"
                      : "bg-primary"
                }`}
                style={{ width: `${deployProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Three-panel layout */}
        <div className="flex flex-1 min-h-0">
          {/* Category sidebar */}
          <div className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-card md:flex overflow-y-auto">
            <div className="p-4 space-y-1">
              {displayCategories.map((cat) => {
                const count = categoryCounts[cat] || 0;
                if (cat !== "ALL" && cat !== "LOOP" && count === 0) return null;
                const isActive = activeCategory === cat;
                const dotClass =
                  cat === "ALL" ? "" : CATEGORY_COLORS[cat] || "bg-muted-foreground";

                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setSelectedPromptId(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "border-l-[3px] border-l-primary bg-primary/5 text-primary"
                        : "border-l-[3px] border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    {cat !== "ALL" && (
                      <div
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass} ${
                          cat === "LOOP" && count === 0 ? "phase-dot-active shadow-[0_0_10px_hsl(var(--primary))]" : ""
                        }`}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-body text-xs font-medium uppercase tracking-wider">
                        {cat}
                      </span>
                      {cat === "LOOP" && (
                        <p className="font-body text-[9px] text-muted-foreground/60 mt-0.5">
                          Run these after building
                        </p>
                      )}
                    </div>
                    <span className="font-body text-[10px] text-muted-foreground">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Progress tracker */}
            <div className="mt-auto border-t border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Progress
                </span>
                <span className="font-body text-xs text-primary font-medium">
                  {copiedCount}/{totalCount} copied
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${totalCount > 0 ? (copiedCount / totalCount) * 100 : 0}%`,
                  }}
                />
              </div>
              {allCopied && (
                <p className="mt-2 text-center font-body text-xs text-[hsl(var(--sage))]">
                  {deployedViaExtension ? "Deployed via Extension" : "All prompts copied!"} 🎉
                </p>
              )}
              {allCopied && profile?.plan && profile.plan !== "unlimited" && (
                <button
                  onClick={() => navigate("/pricing")}
                  className="mt-3 flex w-full items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs font-medium text-foreground">Build your next app</p>
                    <p className="font-body text-[10px] text-muted-foreground">
                      {profile.plan === "single" || profile.plan === "free"
                        ? "5-Pack: $9/project instead of $12.99"
                        : "Upgrade for unlimited projects"}
                    </p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                </button>
              )}
            </div>
          </div>

          {/* Center panel: List or Graph */}
          {viewMode === "graph" ? (
            <DependencyGraph
              prompts={promptData}
              selectedPromptId={selectedPromptId}
              onSelectPrompt={handleSelectPrompt}
            />
          ) : (
            <div className="flex-1 min-w-0 overflow-y-auto border-r border-border lg:flex-[1_1_0]">
              {/* Mobile category pills */}
              <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-3 md:hidden">
                {displayCategories.map((cat) => {
                  const count = categoryCounts[cat] || 0;
                  if (cat !== "ALL" && cat !== "LOOP" && count === 0) return null;
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategory(cat);
                        setSelectedPromptId(null);
                      }}
                      className={`shrink-0 rounded-full px-3 py-1 font-body text-[10px] font-medium uppercase tracking-wider transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Loop prompts header */}
              {activeCategory === "LOOP" && (categoryCounts["LOOP"] || 0) > 0 && (
                <LoopPromptHeader />
              )}

              {/* Generate loop prompts CTA if none exist */}
              {activeCategory === "LOOP" && (categoryCounts["LOOP"] || 0) === 0 && (
                <GenerateLoopPromptsCard projectId={projectId} />
              )}

              {/* Search bar */}
              <div className="border-b border-border px-4 py-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search prompts..."
                    className="w-full rounded-input border border-border bg-transparent py-1.5 pl-8 pr-3 font-body text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="divide-y divide-border">
                {filteredPrompts.map((prompt) => {
                  const isCopied = copiedSet.has(prompt.id);
                  const isSelected = selectedPrompt?.id === prompt.id;
                  const isLoop = prompt.is_loop;
                  const dotClass =
                    CATEGORY_COLORS[prompt.category.toUpperCase()] ||
                    "bg-muted-foreground";

                  if (isLoop) {
                    const repeatCount = prompt.repeat_count ?? getRepeatCount(prompt.title, prompt.purpose);
                    const auditTag = getAuditTag(prompt.title);
                    return (
                      <button
                        key={prompt.id}
                        onClick={() => handleSelectPrompt(prompt.id)}
                        className={`flex w-full items-start gap-3 border-l-4 border-l-primary px-4 py-4 text-left transition-colors group ${
                          isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                          <RefreshCw className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-heading text-sm text-foreground truncate">
                              {prompt.title}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-primary px-2 py-0.5 font-body text-[10px] font-semibold text-primary">
                              Repeat {repeatCount}x
                            </span>
                            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 font-body text-[10px] text-muted-foreground">
                              {auditTag}
                            </span>
                          </div>
                          <p className="mt-1 font-body text-xs text-muted-foreground line-clamp-2">
                            {prompt.purpose}
                          </p>
                        </div>
                      {isCopied ? (
                          <Check className="h-4 w-4 shrink-0 text-[hsl(var(--sage))] copy-pop mt-1" />
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPrompt(prompt);
                            }}
                            className="shrink-0 rounded-button p-1.5 text-muted-foreground opacity-0 transition-all hover:text-primary group-hover:opacity-100 active:scale-[0.95] mt-1"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={prompt.id}
                      onClick={() => handleSelectPrompt(prompt.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors group ${
                        isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/40 font-body text-xs text-muted-foreground">
                        {prompt.sequence_order}
                      </div>
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
                      />
                      <span className="flex-1 min-w-0 truncate font-body text-sm font-medium text-foreground">
                        {prompt.title}
                      </span>
                      {isCopied ? (
                        <Check className="h-4 w-4 shrink-0 text-[hsl(var(--sage))] copy-pop" />
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPrompt(prompt);
                          }}
                          className="shrink-0 rounded-button p-1.5 text-muted-foreground opacity-0 transition-all hover:text-primary group-hover:opacity-100 active:scale-[0.95]"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Mobile progress bar */}
              <div className="border-t border-border p-4 md:hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-body text-[10px] text-muted-foreground">
                    {copiedCount}/{totalCount} copied
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{
                      width: `${totalCount > 0 ? (copiedCount / totalCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Desktop detail panel */}
          <div className="hidden w-[40%] shrink-0 bg-background lg:block">
            <PromptDetailPanel
              prompt={selectedPrompt}
              allPrompts={promptData}
              copiedSet={copiedSet}
              onCopy={handleCopyPrompt}
              onSelectPrompt={handleSelectPrompt}
              projectId={projectId}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default PromptViewer;
