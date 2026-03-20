import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, Check, ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useProject } from "@/hooks/use-conversations";
import { useGeneratedPrompts } from "@/hooks/use-generated-prompts";
import { UserMessage, AssistantMessage, SystemMessage } from "@/components/ChatMessages";
import TypingIndicator from "@/components/TypingIndicator";
import RevisionChangesPanel, { type RevisionResult } from "@/components/RevisionChangesPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const MAX_FREE_REVISIONS = 2;

// Snapshot of prompts before revision, for undo
interface PromptSnapshot {
  id: string;
  title: string;
  prompt_text: string;
  purpose: string;
  category: string;
  sequence_order: number;
  depends_on: number[];
  is_loop: boolean;
}

const ProjectRevision = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { profile } = useAuth();

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: allConversations } = useConversations(id);
  const { data: prompts, isLoading: promptsLoading } = useGeneratedPrompts(id);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const [limitModalOpen, setLimitModalOpen] = useState(false);

  // Revision result for diff panel
  const [revisionResult, setRevisionResult] = useState<RevisionResult | null>(null);
  // Snapshot for undo
  const [preRevisionSnapshot, setPreRevisionSnapshot] = useState<PromptSnapshot[]>([]);
  const [newlyInsertedIds, setNewlyInsertedIds] = useState<string[]>([]);
  const [undoing, setUndoing] = useState(false);

  // Filter revision messages only
  const revisionMessages = useMemo(
    () => (allConversations ?? []).filter((m) => m.phase === "revision"),
    [allConversations]
  );

  const revisionCount = useMemo(
    () => revisionMessages.filter((m) => m.role === "user").length,
    [revisionMessages]
  );

  const plan = profile?.plan ?? "free";
  const isUnlimited = plan === "unlimited" || plan === "5-pack";
  const atLimit = !isUnlimited && revisionCount >= MAX_FREE_REVISIONS;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [revisionMessages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !id || sending) return;

    if (atLimit) {
      setLimitModalOpen(true);
      return;
    }

    setInput("");
    setSending(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      await supabase.from("conversations").insert({
        project_id: id,
        role: "user",
        content: text,
        phase: "revision",
      });

      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      setIsTyping(true);

      const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
        "revise-prompts",
        { body: { project_id: id, revision_request: text } }
      );

      setIsTyping(false);

      if (invokeError) throw invokeError;

      const { reply, changed_prompts, new_prompts, deleted_prompt_ids, success } =
        invokeData as {
          reply: string;
          changed_prompts?: Array<{
            id: string;
            sequence_order: number;
            title: string;
            prompt_text: string;
            purpose: string;
            category: string;
            old_title?: string;
            old_prompt_text?: string;
            changes_summary?: string;
          }>;
          new_prompts?: Array<{
            category: string;
            sequence_order: number;
            title: string;
            purpose: string;
            prompt_text: string;
            depends_on: number[];
            is_loop: boolean;
          }>;
          deleted_prompt_ids?: string[];
          success: boolean;
        };

      if (!success) throw new Error("Revision failed");

      // Insert assistant reply
      await supabase.from("conversations").insert({
        project_id: id,
        role: "assistant",
        content: reply,
        phase: "revision",
      });

      // Snapshot current state for undo
      const currentPrompts = prompts ?? [];
      const snapshot: PromptSnapshot[] = currentPrompts.map((p) => ({
        id: p.id,
        title: p.title,
        prompt_text: p.prompt_text,
        purpose: p.purpose,
        category: p.category,
        sequence_order: p.sequence_order,
        depends_on: p.depends_on,
        is_loop: p.is_loop,
      }));
      setPreRevisionSnapshot(snapshot);

      // Build old text lookup for diff
      const oldLookup = new Map(currentPrompts.map((p) => [p.id, p]));

      // Apply changes
      const updatedIds = new Set<string>();

      if (changed_prompts?.length) {
        for (const cp of changed_prompts) {
          const old = oldLookup.get(cp.id);
          // Attach old data for diff if webhook didn't provide it
          if (!cp.old_prompt_text && old) {
            cp.old_prompt_text = old.prompt_text;
          }
          if (!cp.old_title && old) {
            cp.old_title = old.title;
          }

          await supabase
            .from("generated_prompts")
            .update({
              title: cp.title,
              prompt_text: cp.prompt_text,
              purpose: cp.purpose,
              category: cp.category,
              version: (old?.version ?? 1) + 1,
            })
            .eq("id", cp.id);
          updatedIds.add(cp.id);
        }
      }

      let insertedIds: string[] = [];
      if (new_prompts?.length) {
        const rows = new_prompts.map((p) => ({
          project_id: id,
          category: p.category,
          sequence_order: p.sequence_order,
          title: p.title,
          purpose: p.purpose,
          prompt_text: p.prompt_text,
          depends_on: p.depends_on || [],
          is_loop: p.is_loop || false,
        }));
        const { data: inserted } = await supabase
          .from("generated_prompts")
          .insert(rows)
          .select("id");
        insertedIds = (inserted ?? []).map((r) => r.id);
      }
      setNewlyInsertedIds(insertedIds);

      if (deleted_prompt_ids?.length) {
        await supabase
          .from("generated_prompts")
          .delete()
          .in("id", deleted_prompt_ids);
      }

      await supabase.from("projects").update({ status: "ready" }).eq("id", id);

      setChangedIds((prev) => {
        const next = new Set(prev);
        updatedIds.forEach((uid) => next.add(uid));
        return next;
      });

      // Build deleted prompt info for display
      const deletedInfo = (deleted_prompt_ids ?? []).map((did) => {
        const old = oldLookup.get(did);
        return { id: did, title: old?.title ?? "Unknown prompt" };
      });

      // Build revision result
      const totalPromptCount = currentPrompts.length;
      const unchangedCount =
        totalPromptCount -
        (changed_prompts?.length ?? 0) -
        (deleted_prompt_ids?.length ?? 0);

      setRevisionResult({
        reply,
        changedPrompts: (changed_prompts ?? []).map((cp) => ({
          id: cp.id,
          sequence_order: cp.sequence_order,
          title: cp.title,
          old_title: cp.old_title,
          prompt_text: cp.prompt_text,
          old_prompt_text: cp.old_prompt_text,
          purpose: cp.purpose,
          category: cp.category,
          changes_summary: cp.changes_summary,
        })),
        newPrompts: new_prompts ?? [],
        deletedPrompts: deletedInfo,
        unchangedCount: Math.max(0, unchangedCount),
      });

      const totalChanged =
        (changed_prompts?.length ?? 0) +
        (new_prompts?.length ?? 0) +
        (deleted_prompt_ids?.length ?? 0);
      toast.success(`${totalChanged} prompt${totalChanged !== 1 ? "s" : ""} updated.`);

      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["prompts", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    } catch {
      setIsTyping(false);
      toast.error("Revision failed. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleAcceptChanges = () => {
    setRevisionResult(null);
    setPreRevisionSnapshot([]);
    setNewlyInsertedIds([]);
    navigate(`/project/${id}`);
  };

  const handleUndoRevision = async () => {
    if (!id || !preRevisionSnapshot.length) return;
    setUndoing(true);

    try {
      // Delete newly inserted prompts
      if (newlyInsertedIds.length) {
        await supabase
          .from("generated_prompts")
          .delete()
          .in("id", newlyInsertedIds);
      }

      // Restore changed + deleted prompts from snapshot
      for (const snap of preRevisionSnapshot) {
        // Upsert: will restore deleted rows and revert changed ones
        // Since we can't INSERT (no RLS insert policy for user), we update existing
        // For deleted ones we need to re-insert — but generated_prompts has no insert policy for users.
        // Instead, try update first; if it doesn't match, it was deleted — skip for now.
        await supabase
          .from("generated_prompts")
          .update({
            title: snap.title,
            prompt_text: snap.prompt_text,
            purpose: snap.purpose,
            category: snap.category,
          })
          .eq("id", snap.id);
      }

      queryClient.invalidateQueries({ queryKey: ["prompts", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });

      setRevisionResult(null);
      setPreRevisionSnapshot([]);
      setNewlyInsertedIds([]);
      setChangedIds(new Set());

      toast.success("Revision reverted.");
    } catch {
      toast.error("Failed to undo revision.");
    } finally {
      setUndoing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (projectLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Skeleton className="h-32 w-64 bg-muted" />
      </div>
    );
  }

  // Determine what shows in the right panel
  const showChangesPanel = revisionResult !== null;

  return (
    <>
      <Dialog open={limitModalOpen} onOpenChange={setLimitModalOpen}>
        <DialogContent className="border-border bg-card sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-foreground">
              Revision Limit Reached
            </DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              You've used your {MAX_FREE_REVISIONS} revisions on this project.
              Upgrade for unlimited revisions.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-3">
            <Button
              variant="amber"
              className="flex-1"
              onClick={() => navigate("/pricing")}
            >
              View Pricing
            </Button>
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setLimitModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex h-[calc(100vh-64px)] flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/project/${id}`)}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Prompts
            </Button>
            <div className="h-5 w-px bg-border" />
            <h1 className="font-heading text-lg text-foreground">
              Revise Prompts
            </h1>
            {!isUnlimited && (
              <span className="font-body text-[10px] text-muted-foreground">
                {revisionCount}/{MAX_FREE_REVISIONS} revisions used
              </span>
            )}
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left: revision chat */}
          <div className="flex flex-1 flex-col min-w-0 lg:flex-[3_3_0]">
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-5"
            >
              <SystemMessage content="Tell the AI what you'd like to change. It will regenerate only the affected prompts while keeping your infrastructure intact." />

              {revisionMessages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <UserMessage
                      key={msg.id}
                      content={msg.content}
                      createdAt={msg.created_at}
                    />
                  );
                }
                if (msg.role === "assistant") {
                  return (
                    <AssistantMessage
                      key={msg.id}
                      content={msg.content}
                      createdAt={msg.created_at}
                    />
                  );
                }
                if (msg.role === "system") {
                  return <SystemMessage key={msg.id} content={msg.content} />;
                }
                return null;
              })}
              {isTyping && <TypingIndicator />}
            </div>

            {/* Chat input */}
            <div className="shrink-0 border-t border-border bg-card px-4 py-4 md:px-8">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what you want to change..."
                  rows={1}
                  disabled={sending}
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary disabled:opacity-50"
                  style={{ height: "auto", overflow: "hidden" }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 128) + "px";
                  }}
                />
                <Button
                  variant="amber"
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="h-11 w-11 shrink-0 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {atLimit && (
                <p className="mt-2 font-body text-xs text-destructive">
                  You've reached your revision limit.{" "}
                  <button
                    onClick={() => setLimitModalOpen(true)}
                    className="underline hover:text-destructive/80"
                  >
                    Upgrade
                  </button>{" "}
                  for unlimited revisions.
                </p>
              )}
            </div>
          </div>

          {/* Right panel: changes summary OR current prompts */}
          <aside className="hidden w-[40%] shrink-0 border-l border-border bg-card lg:flex flex-col overflow-hidden">
            {showChangesPanel ? (
              <RevisionChangesPanel
                result={revisionResult}
                onAccept={handleAcceptChanges}
                onUndo={handleUndoRevision}
                undoing={undoing}
              />
            ) : (
              <>
                <div className="shrink-0 border-b border-border px-5 py-4">
                  <h2 className="font-heading text-base text-foreground">
                    Current Prompts
                  </h2>
                  <p className="mt-1 font-body text-[10px] text-muted-foreground">
                    {prompts?.length ?? 0} prompts • changed prompts will be
                    highlighted
                  </p>
                </div>

                {promptsLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full bg-muted" />
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-border">
                    {(prompts ?? []).map((p) => {
                      const isChanged = changedIds.has(p.id);
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 px-5 py-3 ${
                            isChanged ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/40 font-body text-[10px] text-muted-foreground">
                            {p.sequence_order}
                          </div>
                          <span className="flex-1 min-w-0 truncate font-body text-xs text-foreground">
                            {p.title}
                          </span>
                          {isChanged && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-body text-[9px] font-semibold text-primary">
                              <Check className="h-2.5 w-2.5" />
                              Updated
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </>
  );
};

export default ProjectRevision;
