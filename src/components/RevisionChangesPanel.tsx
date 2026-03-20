import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChangedPrompt {
  id: string;
  sequence_order: number;
  title: string;
  old_title?: string;
  prompt_text: string;
  old_prompt_text?: string;
  purpose: string;
  category: string;
  changes_summary?: string;
}

interface NewPrompt {
  category: string;
  sequence_order: number;
  title: string;
  purpose: string;
  prompt_text: string;
}

interface DeletedPrompt {
  id: string;
  title: string;
}

export interface RevisionResult {
  reply: string;
  changedPrompts: ChangedPrompt[];
  newPrompts: NewPrompt[];
  deletedPrompts: DeletedPrompt[];
  unchangedCount: number;
}

interface RevisionChangesPanelProps {
  result: RevisionResult;
  onAccept: () => void;
  onUndo: () => void;
  undoing: boolean;
}

const ExpandableCard = ({
  children,
  expandContent,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  expandContent: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">{children}</div>
        <button
          onClick={() => setOpen(!open)}
          className="shrink-0 rounded-button p-1.5 text-muted-foreground transition-colors hover:text-foreground active:scale-[0.95]"
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
      {open && (
        <div className="mt-3 animate-fade-in">{expandContent}</div>
      )}
    </div>
  );
};

/** Simple inline diff: shows removed lines in terracotta, added in sage */
const SimpleDiff = ({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) => {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Very simple line-level diff: find removed & added lines
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const removed = oldLines.filter((l) => !newSet.has(l));
  const added = newLines.filter((l) => !oldSet.has(l));

  if (removed.length === 0 && added.length === 0) {
    return (
      <p className="font-body text-xs text-muted-foreground italic">
        Content changed but individual lines are similar. View the full prompt
        for details.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-[hsl(var(--surface-elevated))] p-3 font-mono text-[11px] leading-relaxed max-h-[240px] overflow-y-auto">
      {removed.slice(0, 15).map((line, i) => (
        <div
          key={`r-${i}`}
          className="rounded px-2 py-0.5 bg-destructive/10 text-destructive line-through"
        >
          - {line || " "}
        </div>
      ))}
      {removed.length > 15 && (
        <p className="text-muted-foreground/60 px-2">
          ...{removed.length - 15} more removed lines
        </p>
      )}
      {added.slice(0, 15).map((line, i) => (
        <div
          key={`a-${i}`}
          className="rounded px-2 py-0.5 bg-[hsl(var(--sage))]/10 text-[hsl(var(--sage))]"
        >
          + {line || " "}
        </div>
      ))}
      {added.length > 15 && (
        <p className="text-muted-foreground/60 px-2">
          ...{added.length - 15} more added lines
        </p>
      )}
    </div>
  );
};

const RevisionChangesPanel = ({
  result,
  onAccept,
  onUndo,
  undoing,
}: RevisionChangesPanelProps) => {
  const { reply, changedPrompts, newPrompts, deletedPrompts, unchangedCount } =
    result;

  return (
    <div className="flex h-full flex-col animate-slide-in-right">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--sage))]/15">
            <Check className="h-3.5 w-3.5 text-[hsl(var(--sage))]" />
          </div>
          <h2 className="font-heading text-base text-foreground">
            Revision Complete
          </h2>
        </div>
        <p className="font-body text-xs text-muted-foreground">{reply}</p>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap gap-2">
          {changedPrompts.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-body text-[10px] font-medium text-primary">
              <Pencil className="h-2.5 w-2.5" />
              {changedPrompts.length} updated
            </span>
          )}
          {newPrompts.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--sage))]/10 px-2.5 py-1 font-body text-[10px] font-medium text-[hsl(var(--sage))]">
              <Plus className="h-2.5 w-2.5" />
              {newPrompts.length} new
            </span>
          )}
          {deletedPrompts.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 font-body text-[10px] font-medium text-destructive">
              <Trash2 className="h-2.5 w-2.5" />
              {deletedPrompts.length} removed
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-muted/30 px-2.5 py-1 font-body text-[10px] text-muted-foreground">
            {unchangedCount} unchanged
          </span>
        </div>
      </div>

      {/* Scrollable changes list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {/* Changed prompts */}
        {changedPrompts.map((cp) => (
          <div
            key={cp.id}
            className="rounded-xl border border-border bg-[hsl(var(--surface-elevated))] overflow-hidden border-l-4 border-l-primary"
          >
            <div className="px-4 py-3">
              <ExpandableCard
                expandContent={
                  cp.old_prompt_text ? (
                    <SimpleDiff
                      oldText={cp.old_prompt_text}
                      newText={cp.prompt_text}
                    />
                  ) : (
                    <div className="rounded-lg border border-border bg-[hsl(var(--obsidian))] p-3 font-mono text-[11px] leading-relaxed text-foreground/80 max-h-[200px] overflow-y-auto">
                      {cp.prompt_text.slice(0, 500)}
                      {cp.prompt_text.length > 500 && "…"}
                    </div>
                  )
                }
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider text-primary">
                    Updated
                  </span>
                  <span className="font-body text-[10px] text-muted-foreground">
                    #{cp.sequence_order}
                  </span>
                </div>
                <h4 className="mt-1.5 font-body text-sm font-medium text-foreground">
                  {cp.title}
                </h4>
                {cp.changes_summary && (
                  <p className="mt-1 font-body text-[11px] text-muted-foreground">
                    {cp.changes_summary}
                  </p>
                )}
              </ExpandableCard>
            </div>
          </div>
        ))}

        {/* New prompts */}
        {newPrompts.map((np, i) => (
          <div
            key={`new-${i}`}
            className="rounded-xl border border-border bg-[hsl(var(--surface-elevated))] overflow-hidden border-l-4 border-l-[hsl(var(--sage))]"
          >
            <div className="px-4 py-3">
              <ExpandableCard
                expandContent={
                  <div className="rounded-lg border border-border bg-[hsl(var(--obsidian))] p-3 font-mono text-[11px] leading-relaxed text-foreground/80 max-h-[200px] overflow-y-auto">
                    {np.prompt_text.slice(0, 500)}
                    {np.prompt_text.length > 500 && "…"}
                  </div>
                }
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--sage))]/15 px-2 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--sage))]">
                    New
                  </span>
                  <span className="font-body text-[10px] text-muted-foreground">
                    #{np.sequence_order}
                  </span>
                </div>
                <h4 className="mt-1.5 font-body text-sm font-medium text-foreground">
                  {np.title}
                </h4>
                <p className="mt-1 font-body text-[11px] text-muted-foreground">
                  {np.purpose}
                </p>
              </ExpandableCard>
            </div>
          </div>
        ))}

        {/* Deleted prompts */}
        {deletedPrompts.map((dp) => (
          <div
            key={dp.id}
            className="rounded-xl border border-border bg-[hsl(var(--surface-elevated))] overflow-hidden border-l-4 border-l-destructive opacity-60"
          >
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider text-destructive">
                  Removed
                </span>
              </div>
              <h4 className="mt-1.5 font-body text-sm font-medium text-foreground line-through">
                {dp.title}
              </h4>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="shrink-0 border-t border-border p-5 space-y-2">
        <Button variant="amber" className="w-full gap-2" onClick={onAccept}>
          <Check className="h-4 w-4" />
          Accept Changes
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={onUndo}
          disabled={undoing}
        >
          <Undo2 className="h-4 w-4" />
          {undoing ? "Reverting…" : "Undo Revision"}
        </Button>
      </div>
    </div>
  );
};

export default RevisionChangesPanel;
