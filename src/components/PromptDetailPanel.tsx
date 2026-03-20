import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Save,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { PromptData } from "@/hooks/use-prompt-export";
import { getRepeatCount, getAuditTag } from "@/lib/loop-prompt-utils";

const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  INFRASTRUCTURE: "bg-primary/15 text-primary",
  FRONTEND: "bg-[#6B8EBF]/15 text-[#6B8EBF]",
  BACKEND: "bg-[hsl(var(--sage))]/15 text-[hsl(var(--sage))]",
  INTEGRATION: "bg-[#9B8EC4]/15 text-[#9B8EC4]",
  POLISH: "bg-muted-foreground/15 text-muted-foreground",
  LOOP: "border border-primary/40 text-primary",
};

interface PromptDetailPanelProps {
  prompt: PromptData | null;
  allPrompts: PromptData[];
  copiedSet: Set<string>;
  onCopy: (prompt: PromptData) => void;
  onSelectPrompt: (id: string) => void;
  projectId: string;
}

const PromptDetailPanel = ({
  prompt,
  allPrompts,
  copiedSet,
  onCopy,
  onSelectPrompt,
  projectId,
}: PromptDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  // Reset edit state when prompt changes
  useEffect(() => {
    setIsEditing(false);
    setEditText("");
  }, [prompt?.id]);

  // Navigation
  const currentIndex = prompt
    ? allPrompts.findIndex((p) => p.id === prompt.id)
    : -1;
  const prevPrompt = currentIndex > 0 ? allPrompts[currentIndex - 1] : null;
  const nextPrompt =
    currentIndex >= 0 && currentIndex < allPrompts.length - 1
      ? allPrompts[currentIndex + 1]
      : null;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isEditing) return;
      if (e.key === "ArrowLeft" && prevPrompt) {
        onSelectPrompt(prevPrompt.id);
      } else if (e.key === "ArrowRight" && nextPrompt) {
        onSelectPrompt(nextPrompt.id);
      }
    },
    [prevPrompt, nextPrompt, onSelectPrompt, isEditing]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!prompt) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-body text-sm text-muted-foreground">
          Select a prompt to preview
        </p>
      </div>
    );
  }

  const isCopied = copiedSet.has(prompt.id);
  const catUpper = prompt.category.toUpperCase();
  const badgeClass =
    CATEGORY_BADGE_CLASSES[catUpper] || "bg-muted-foreground/15 text-muted-foreground";

  // Resolve dependency titles
  const dependencyPrompts = (prompt as PromptData & { depends_on?: number[] }).depends_on
    ? allPrompts.filter((p) =>
        ((prompt as PromptData & { depends_on?: number[] }).depends_on ?? []).includes(
          p.sequence_order
        )
      )
    : [];

  const handleCopyWithContext = async () => {
    const prevInOrder = allPrompts.find(
      (p) => p.sequence_order === prompt.sequence_order - 1
    );
    const contextNote = prevInOrder
      ? `// This prompt follows Prompt ${prevInOrder.sequence_order}: "${prevInOrder.title}". The design system and architecture are already set up.\n\n`
      : "";
    await navigator.clipboard.writeText(contextNote + prompt.prompt_text);
    onCopy(prompt);
    toast.success("Prompt copied with context!");
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditText(prompt.prompt_text);
  };

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase
        .from("generated_prompts")
        .update({ prompt_text: editText })
        .eq("id", prompt.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["prompts", projectId] });
      setIsEditing(false);
      toast.success("Prompt updated.");
    } catch {
      toast.error("Failed to save changes.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Category badge + sequence */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span
            className={`inline-flex items-center gap-1 rounded-button px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-wider ${badgeClass}`}
          >
            {prompt.category}
          </span>
          {prompt.is_loop && (
            <span className="inline-flex items-center gap-1 rounded-button border border-primary/30 px-2 py-0.5 font-body text-[10px] text-primary">
              <Sparkles className="h-3 w-3" />
              Loop
            </span>
          )}
          <span className="font-body text-[10px] text-muted-foreground">
            #{prompt.sequence_order}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-heading text-xl text-foreground mb-2">
          {prompt.title}
        </h2>

        {/* Purpose */}
        <p className="font-body text-sm italic text-muted-foreground mb-4">
          {prompt.purpose}
        </p>

        {/* Dependencies */}
        {dependencyPrompts.length > 0 && (
          <div className="mb-5 rounded-lg border border-border bg-muted/10 px-4 py-2.5">
            <span className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Requires:{" "}
            </span>
            {dependencyPrompts.map((dep, i) => (
              <span key={dep.id}>
                {i > 0 && ", "}
                <button
                  onClick={() => onSelectPrompt(dep.id)}
                  className="font-body text-xs text-primary hover:underline"
                >
                  Prompt {dep.sequence_order}: {dep.title}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Prompt text block */}
        <div className="rounded-lg border border-[#3D3830] bg-[#1E1C17] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#3D3830] px-4 py-2">
            <span className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Prompt
            </span>
            {!isEditing && (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1 font-body text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            {isEditing && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1 font-body text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1 font-body text-[10px] text-primary transition-colors hover:text-primary/80"
                >
                  <Save className="h-3 w-3" />
                  Save
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[300px] resize-y bg-transparent p-6 font-mono text-[13px] leading-[1.6] text-[#F5F0E8] outline-none"
            />
          ) : (
            <div className="max-h-[50vh] overflow-y-auto p-6">
              <div className="prose prose-sm prose-invert max-w-none font-mono text-[13px] leading-[1.6] text-[#F5F0E8] [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:text-[#F5F0E8] [&_strong]:text-[#F5F0E8] [&_code]:rounded [&_code]:bg-[#2A2620] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-primary [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1]:text-[#F5F0E8] [&_h2]:text-[#F5F0E8] [&_h3]:text-[#F5F0E8]">
                <ReactMarkdown>{prompt.prompt_text}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-5 space-y-2">
          <Button
            variant="amber"
            className="w-full gap-2"
            onClick={() => onCopy(prompt)}
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Prompt
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2 border-border text-muted-foreground hover:text-foreground"
            onClick={handleCopyWithContext}
          >
            <Copy className="h-4 w-4" />
            Copy with Context
          </Button>
        </div>
      </div>

      {/* Navigation footer */}
      <div className="shrink-0 border-t border-border px-6 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={!prevPrompt}
          onClick={() => prevPrompt && onSelectPrompt(prevPrompt.id)}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <span className="font-body text-[10px] text-muted-foreground">
          {currentIndex + 1} / {allPrompts.length}
        </span>

        <Button
          variant="ghost"
          size="sm"
          disabled={!nextPrompt}
          onClick={() => nextPrompt && onSelectPrompt(nextPrompt.id)}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default PromptDetailPanel;
