import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useGeneratedPrompts } from "@/hooks/use-generated-prompts";
import { usePromptExport, type PromptData } from "@/hooks/use-prompt-export";
import ExportModal from "@/components/ExportModal";
import PromptDetailPanel from "@/components/PromptDetailPanel";
import CopyConfetti from "@/components/CopyConfetti";
import LoopPromptHeader from "@/components/LoopPromptHeader";
import GenerateLoopPromptsCard from "@/components/GenerateLoopPromptsCard";
import { getRepeatCount, getAuditTag } from "@/lib/loop-prompt-utils";
import { toast } from "sonner";

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
}

const PromptViewer = ({ projectId, projectName }: PromptViewerProps) => {
  const navigate = useNavigate();
  const { data: prompts, isLoading } = useGeneratedPrompts(projectId);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const promptData: PromptData[] = useMemo(
    () =>
      (prompts ?? []).map((p) => ({
        id: p.id,
        category: p.category,
        sequence_order: p.sequence_order,
        title: p.title,
        purpose: p.purpose,
        prompt_text: p.prompt_text,
        is_loop: p.is_loop,
        depends_on: p.depends_on,
      })),
    [prompts]
  );

  const {
    copiedSet,
    copiedCount,
    totalCount,
    allCopied,
    markCopied,
    copyAll,
    downloadMarkdown,
  } = usePromptExport(projectId, promptData);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: promptData.length };
    promptData.forEach((p) => {
      const cat = p.category.toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [promptData]);

  const filteredPrompts = useMemo(() => {
    if (activeCategory === "ALL") return promptData;
    return promptData.filter(
      (p) => p.category.toUpperCase() === activeCategory
    );
  }, [promptData, activeCategory]);

  const selectedPrompt = useMemo(() => {
    if (!selectedPromptId) return filteredPrompts[0] ?? null;
    return promptData.find((p) => p.id === selectedPromptId) ?? null;
  }, [selectedPromptId, promptData, filteredPrompts]);

  const handleCopyPrompt = useCallback(
    async (prompt: PromptData) => {
      await navigator.clipboard.writeText(prompt.prompt_text);
      markCopied(prompt.id);
      toast.success("Prompt copied! Paste it into Lovable.");
    },
    [markCopied]
  );

  const handleSelectPrompt = useCallback((id: string) => {
    setSelectedPromptId(id);
    // On mobile, open the sheet
    if (window.innerWidth < 1024) {
      setMobileDetailOpen(true);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] gap-0">
        <div className="w-[220px] shrink-0 border-r border-border bg-card p-4 space-y-3">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full bg-muted" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-muted" />
          ))}
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
                <Check className="h-3 w-3" />
                {totalCount} Prompts Ready
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => navigate(`/project/${projectId}/revise`)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Revise Prompts</span>
              </Button>
              <Button
                variant="amber"
                size="sm"
                className="gap-1.5"
                onClick={() => setExportOpen(true)}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export All</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Three-panel layout */}
        <div className="flex flex-1 min-h-0">
          {/* Category sidebar */}
          <div className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-card md:flex overflow-y-auto">
            <div className="p-4 space-y-1">
              {CATEGORY_ORDER.map((cat) => {
                const count = categoryCounts[cat] || 0;
                if (cat !== "ALL" && count === 0) return null;
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
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
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
                  All prompts copied! 🎉
                </p>
              )}
            </div>
          </div>

          {/* Prompt list (center) */}
          <div className="flex-1 min-w-0 overflow-y-auto border-r border-border lg:flex-[1_1_0]">
            {/* Mobile category pills */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-3 md:hidden">
              {CATEGORY_ORDER.map((cat) => {
                const count = categoryCounts[cat] || 0;
                if (cat !== "ALL" && count === 0) return null;
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

            <div className="divide-y divide-border">
              {filteredPrompts.map((prompt) => {
                const isCopied = copiedSet.has(prompt.id);
                const isSelected = selectedPrompt?.id === prompt.id;
                const isLoop = prompt.is_loop;
                const dotClass =
                  CATEGORY_COLORS[prompt.category.toUpperCase()] ||
                  "bg-muted-foreground";

                if (isLoop) {
                  const repeatCount = getRepeatCount(prompt.title, prompt.purpose);
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
                          <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 font-body text-[10px] font-semibold text-primary">
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
                        <Check className="h-4 w-4 shrink-0 text-[hsl(var(--sage))] mt-1" />
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
                      <Check className="h-4 w-4 shrink-0 text-[hsl(var(--sage))]" />
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
