import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Send, PanelRightOpen, FolderOpen, Loader2, Settings2, Download, RotateCcw, ArrowDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useProject } from "@/hooks/use-conversations";
import { UserMessage, AssistantMessage, SystemMessage } from "@/components/ChatMessages";
import ProjectInfoSidebar from "@/components/ProjectInfoSidebar";
import TypingIndicator from "@/components/TypingIndicator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import PromptViewer from "@/components/PromptViewer";
import DiscoveryCompleteCard from "@/components/DiscoveryCompleteCard";
import { handleWebhookError } from "@/lib/webhook-error-handler";

/* ──────── 404 card ──────── */
const ProjectNotFound = () => (
  <div className="flex h-[calc(100vh-64px)] items-center justify-center">
    <div className="max-w-sm rounded-card border border-border bg-card p-10 text-center">
      <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
      <h2 className="font-heading text-xl text-foreground">Project not found</h2>
      <p className="mt-2 font-body text-sm text-muted-foreground">This project may have been deleted.</p>
      <Link to="/dashboard">
        <Button variant="amber" className="mt-6">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  </div>
);

/* ──────── Generating view ──────── */
const GeneratingView = ({ projectName, projectId }: { projectName: string; projectId: string }) => {
  const [showRetry, setShowRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => setShowRetry(true), 60000); // show after 60s
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      // Delete existing prompts and reset to discovery, then re-trigger generation
      await supabase.from("generated_prompts").delete().eq("project_id", projectId);
      const { error: invokeError } = await supabase.functions.invoke("generate-prompts", {
        body: { project_id: projectId },
      });
      if (invokeError) throw invokeError;
      await supabase.from("projects").update({ status: "generating" }).eq("id", projectId);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["prompts", projectId] });
      setShowRetry(false);
      toast.info("Regenerating prompts…");
    } catch {
      toast.error("Retry failed. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] items-center justify-center">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-2xl text-foreground">Generating your prompts…</h2>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Building a custom prompt blueprint for <span className="text-foreground">{projectName}</span>. This usually
            takes 15–30 seconds.
          </p>
        </div>
        <div className="mx-auto max-w-xs space-y-2.5">
          {[
            "Analyzing your spec…",
            "Building infrastructure prompts…",
            "Creating feature prompts…",
            "Generating backend prompts…",
            "Adding polish & loop prompts…",
          ].map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-2.5 font-body text-xs text-muted-foreground animate-fade-in"
              style={{ animationDelay: `${i * 3}s` }}
            >
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
              {step}
            </div>
          ))}
        </div>
        {showRetry && (
          <div className="pt-4 space-y-2 animate-fade-in">
            <p className="font-body text-xs text-muted-foreground">
              Taking longer than expected?
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Retry Generation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
/* ──────── Discovery Chat ──────── */

interface OptimisticMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  phase: string;
  project_id: string;
  metadata: Record<string, unknown>;
}

const DiscoveryChat = ({ project }: { project: NonNullable<ReturnType<typeof useProject>["data"]> }) => {
  const id = project.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { session } = useAuth();

  const { data: messages, isLoading: messagesLoading } = useConversations(id);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // guards double-click only
  const [pendingComplete, setPendingComplete] = useState(false); // AI thinks done, user hasn't confirmed
  const [completeDismissed, setCompleteDismissed] = useState(false); // user clicked "Keep Discussing"
  const autoSentRef = useRef(false);
  const generateTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastProjectIdRef = useRef<string | null>(null);
  const specCompleteChecked = useRef(false);

  // Reset auto-send when navigating between projects (component may stay
  // mounted across id changes depending on router behaviour).
  useEffect(() => {
    if (lastProjectIdRef.current !== id) {
      autoSentRef.current = false;
      specCompleteChecked.current = false;
      lastProjectIdRef.current = id;
    }
  }, [id]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(rateLimitTimerRef.current);
      clearTimeout(generateTimerRef.current);
    };
  }, []);

  // Detect if spec was already marked complete on load (e.g. page refresh)
  useEffect(() => {
    if (specCompleteChecked.current || messagesLoading) return;
    const specData =
      typeof project.spec_data === "object" && project.spec_data !== null
        ? (project.spec_data as Record<string, unknown>)
        : {};
    if (specData.is_complete === true && project.status === "discovery" && !completeDismissed) {
      setPendingComplete(true);
      specCompleteChecked.current = true;
    }
  }, [project.spec_data, project.status, messagesLoading, completeDismissed]);

  // Auto-scroll state
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const prevMessageCount = useRef(0);

  // Clear & restart dialog
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  // Credits modal
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  // Rate limit cooldown
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleRateLimit = useCallback(() => {
    setRateLimited(true);
    setSending(true);
    setRateLimitCountdown(5);
    const interval = setInterval(() => {
      setRateLimitCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    clearTimeout(rateLimitTimerRef.current);
    rateLimitTimerRef.current = setTimeout(() => {
      setRateLimited(false);
      setSending(false);
    }, 5000);
  }, []);

  const allMessages = useMemo(() => {
    const real = messages ?? [];
    const realIds = new Set(real.map((m) => m.id));
    // Dedup strategy:
    // 1. Drop optimistic whose temp ID matches a real row (shouldn't happen but cheap).
    // 2. Drop optimistic whose client_id metadata matches a real message's metadata
    //    (n8n persists metadata when configured; this is the reliable path).
    // 3. Fall back to (role, content, coarse-timestamp) tuple — same-content
    //    messages sent seconds apart by the same role collide rarely.
    const realClientIds = new Set(
      real
        .map((m) => (m.metadata as Record<string, unknown> | null)?.client_id as string | undefined)
        .filter(Boolean),
    );
    const realFingerprints = new Set(
      real.map((m) => {
        const ts = Math.floor(new Date(m.created_at).getTime() / 10_000); // 10s bucket
        return `${m.role}::${m.content}::${ts}`;
      }),
    );
    const extras = optimisticMessages.filter((m) => {
      if (realIds.has(m.id)) return false;
      const clientId = (m.metadata as Record<string, unknown>)?.client_id as string | undefined;
      if (clientId && realClientIds.has(clientId)) return false;
      const ts = Math.floor(new Date(m.created_at).getTime() / 10_000);
      return !realFingerprints.has(`${m.role}::${m.content}::${ts}`);
    });
    return [...real, ...extras];
  }, [messages, optimisticMessages]);

  // Auto-scroll logic
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    setHasNewMessage(false);
    setUserScrolledUp(false);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    setUserScrolledUp(!atBottom);
    if (atBottom) setHasNewMessage(false);
  }, []);

  useEffect(() => {
    if (allMessages.length > prevMessageCount.current) {
      if (userScrolledUp) {
        setHasNewMessage(true);
      } else {
        const timer = setTimeout(() => scrollToBottom(), 50);
        prevMessageCount.current = allMessages.length;
        return () => clearTimeout(timer);
      }
    }
    prevMessageCount.current = allMessages.length;
  }, [allMessages.length, userScrolledUp, scrollToBottom]);

  // Also scroll when typing indicator appears
  useEffect(() => {
    if (isTyping && !userScrolledUp) {
      const timer = setTimeout(() => scrollToBottom(), 50);
      return () => clearTimeout(timer);
    }
  }, [isTyping, userScrolledUp, scrollToBottom]);

  // Only the last assistant message shows interactive options
  const lastAssistantMsgId = useMemo(() => {
    const assistantMsgs = allMessages.filter((m) => m.role === "assistant");
    return assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1].id : null;
  }, [allMessages]);

  const currentPhase = useMemo(() => {
    if (!allMessages.length) return 0;
    const systemMsgs = allMessages.filter((m) => m.role === "system");
    const phaseKeywords = ["users", "features", "tech", "scope"];
    let phase = 0;
    systemMsgs.forEach((msg) => {
      const lower = msg.content.toLowerCase();
      phaseKeywords.forEach((kw, i) => {
        if (lower.includes(kw)) phase = Math.max(phase, i + 1);
      });
    });
    return phase;
  }, [allMessages]);

  // Auto-send project description as first message
  useEffect(() => {
    if (autoSentRef.current || messagesLoading) return;
    if (messages && messages.length === 0 && project.description) {
      autoSentRef.current = true;
      setInput(project.description);
      const timer = setTimeout(() => {
        const syntheticText = project.description!;
        setInput("");
        setSending(true);

        const tempId = `opt-${Date.now()}`;
        const clientId = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setOptimisticMessages((prev) => [
          ...prev,
          {
            id: tempId,
            role: "user",
            content: syntheticText,
            created_at: new Date().toISOString(),
            phase: "discovery",
            project_id: id,
            metadata: { client_id: clientId },
          },
        ]);

        (async () => {
          try {
            const { error: insertError } = await supabase
              .from("conversations")
              .insert({
                project_id: id,
                role: "user",
                content: syntheticText,
                phase: "discovery",
                metadata: { client_id: clientId },
              });
            if (insertError) throw insertError;
            setIsTyping(true);

            const { data: invokeData, error: invokeError } = await supabase.functions.invoke("discovery-webhook", {
              body: { project_id: id, message: syntheticText },
            });

            setIsTyping(false);

            if (invokeError) {
              if (!handleWebhookError(invokeError, navigate, { setCreditsModalOpen, onRateLimit: handleRateLimit })) {
                toast.error("Failed to reach AI architect. Please try again.");
              }
              setSending(false);
              return;
            }

            const { reply, phase: respPhase } = (invokeData ?? {}) as {
              reply?: string;
              phase?: string;
              is_complete?: boolean;
              spec_data?: Record<string, string | number | boolean | null>;
            };

            const trimmedReply = typeof reply === "string" ? reply.trim() : "";
            if (!trimmedReply) {
              toast.error("The AI architect returned an empty reply. Please try again.");
              queryClient.invalidateQueries({ queryKey: ["conversations", id] });
              setSending(false);
              return;
            }

            // Display reply optimistically
            const tempAssistantId = `opt-assistant-${Date.now()}`;
            setOptimisticMessages((prev) => [
              ...prev,
              {
                id: tempAssistantId,
                role: "assistant",
                content: trimmedReply,
                created_at: new Date().toISOString(),
                phase: respPhase || "discovery",
                project_id: id,
                metadata: {},
              },
            ]);

            // n8n saves assistant message, spec_data, and status — just refetch
            // Clear optimistic messages before refetch to prevent duplicates
            setOptimisticMessages([]);
            queryClient.invalidateQueries({ queryKey: ["conversations", id] });
            queryClient.invalidateQueries({ queryKey: ["project", id] });
          } catch {
            toast.error("Failed to reach AI architect. Please try again.");
            setIsTyping(false);
          }
          setSending(false);
        })();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, messagesLoading, project.description, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (text: string) => {
    if (!text || sending) return;
    setSending(true);

    const tempId = `opt-${Date.now()}`;
    const clientId = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setOptimisticMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        phase: "discovery",
        project_id: id,
        metadata: { client_id: clientId },
      },
    ]);

    try {
      const { error: insertError } = await supabase
        .from("conversations")
        .insert({
          project_id: id,
          role: "user",
          content: text,
          phase: "discovery",
          metadata: { client_id: clientId },
        });
      if (insertError) throw insertError;
      setIsTyping(true);

      const { data: invokeData, error: invokeError } = await supabase.functions.invoke("discovery-webhook", {
        body: { project_id: id, message: text },
      });

      setIsTyping(false);

      if (invokeError) {
        if (!handleWebhookError(invokeError, navigate, { setCreditsModalOpen, onRateLimit: handleRateLimit })) {
          toast.error("Something went wrong. Please try again.");
        }
        return;
      }

      const { reply, phase, is_complete } = (invokeData ?? {}) as {
        reply?: string;
        phase?: string;
        is_complete?: boolean;
        spec_data?: Record<string, string | number | boolean | null>;
      };

      const trimmedReply = typeof reply === "string" ? reply.trim() : "";
      if (!trimmedReply) {
        // n8n returned 200 with an empty body — treat as upstream hiccup rather
        // than render a ghost assistant bubble.
        toast.error("The AI architect returned an empty reply. Please try again.");
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
        queryClient.invalidateQueries({ queryKey: ["conversations", id] });
        return;
      }

      // Display reply optimistically
      const tempAssistantId = `opt-assistant-${Date.now()}`;
      setOptimisticMessages((prev) => [
        ...prev,
        {
          id: tempAssistantId,
          role: "assistant",
          content: trimmedReply,
          created_at: new Date().toISOString(),
          phase: phase || "discovery",
          project_id: id,
          metadata: {},
        },
      ]);

      if (is_complete && !completeDismissed) {
        setPendingComplete(true);
      }

      // n8n saves assistant message, spec_data, status, and system messages — just refetch
      // Clear optimistic messages before refetch to prevent duplicates
      setOptimisticMessages([]);
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    } catch {
      setIsTyping(false);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Edit message: delete subsequent messages and re-send
  const handleEditMessage = async (messageId: string, newContent: string) => {
    const sorted = [...(messages ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const idx = sorted.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    // Delete this message and all subsequent
    const toDelete = sorted.slice(idx).map((m) => m.id);
    for (const delId of toDelete) {
      const { error: delError } = await supabase.from("conversations").delete().eq("id", delId);
      if (delError) throw delError;
    }
    queryClient.invalidateQueries({ queryKey: ["conversations", id] });

    // Re-send with edited content
    await sendMessage(newContent);
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from("conversations").delete().eq("id", messageId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      toast.success("Message deleted.");
    } catch {
      toast.error("Failed to delete message.");
    }
  };

  // Export conversation as markdown
  const handleExportConversation = () => {
    const sorted = [...(messages ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const lines = sorted.map((m) => {
      const role = m.role === "user" ? "**You**" : m.role === "assistant" ? "**LovPlan Architect**" : "*System*";
      const time = new Date(m.created_at).toLocaleString();
      return `${role} — ${time}\n\n${m.content}\n\n---`;
    });
    const md = `# ${project.name} — Discovery Conversation\n\n${lines.join("\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Sanitize: alphanumeric + dash/underscore only. Prevents weird characters
    // (slashes, quotes, unicode homoglyphs) from creating invalid filenames
    // on Windows or in some email clients.
    const safeName = project.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/-+/g, "-")
      .slice(0, 80) || "project";
    a.download = `${safeName}-conversation.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation exported!");
  };

  // Clear & restart
  const handleClearRestart = async () => {
    setClearDialogOpen(false);
    try {
      const { error: e1 } = await supabase.from("conversations").delete().eq("project_id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("generated_prompts").delete().eq("project_id", id);
      if (e2) throw e2;
      const { error: e3 } = await supabase
        .from("projects")
        .update({ status: "discovery", spec_data: {} as Json })
        .eq("id", id);
      if (e3) throw e3;
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["prompts", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setOptimisticMessages([]);
      autoSentRef.current = false;
      toast.success("Conversation cleared. Starting fresh.");
    } catch {
      toast.error("Failed to clear conversation.");
    }
  };

  const handleKeepRefining = useCallback(() => {
    setPendingComplete(false);
    setCompleteDismissed(true);
    inputRef.current?.focus();
  }, []);

  const handleEndDiscovery = async () => {
    try {
      // Invoke edge function to end discovery — n8n handles status + system message
      const { error: invokeError } = await supabase.functions.invoke("discovery-webhook", {
        body: { project_id: id, message: "__END_DISCOVERY__" },
      });
      if (invokeError) {
        if (!handleWebhookError(invokeError, navigate)) {
          toast.error("Failed to end discovery. Please try again.");
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      setPendingComplete(true);
      setCompleteDismissed(false);
    } catch (err) {
      if (!handleWebhookError(err, navigate)) {
        toast.error("Failed to end discovery.");
      }
    }
  };

  const handleGeneratePrompts = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setPendingComplete(false);

    try {
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke("generate-prompts", {
        body: { project_id: id },
      });
      if (invokeError) {
        if (!handleWebhookError(invokeError, navigate, { setCreditsModalOpen })) {
          throw invokeError;
        }
        setIsGenerating(false);
        return;
      }

      // The edge function will trigger n8n, which responds immediately (async background task).
      // We don't expect the prompt list in 'invokeData'.
      // Instead, we manually set the project to "generating" so the UI begins polling.
      await supabase.from("projects").update({ status: "generating" }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.info("Prompt generation started in the background.");

      // n8n saves prompts and updates project status — just refetch after short delay
      const genTimer = setTimeout(() => {
        setIsGenerating(false);
        queryClient.invalidateQueries({ queryKey: ["project", id] });
        queryClient.invalidateQueries({ queryKey: ["prompts", id] });
      }, 2000);
      // Store ref so it can be cleaned up if component unmounts
      generateTimerRef.current = genTimer;
    } catch {
      setIsGenerating(false);
      toast.error("Prompt generation failed. Please try again.");
    }
  };

  return (
    <>
      <SEO title={activeProject?.name ? `${activeProject.name}` : "Project"} description="LovPlan project workspace — discovery chat and AI-generated prompt blueprint." noindex />
      {/* Clear & Restart confirm dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg text-foreground">Clear & Restart?</DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              This will delete the conversation and prompts. Your credit will NOT be refunded.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" size="sm" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearRestart}>
              Clear & Restart
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credits needed modal */}
      <Dialog open={creditsModalOpen} onOpenChange={setCreditsModalOpen}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg text-foreground">Credits Needed</DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              You need credits to continue. Purchase more to keep building.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" size="sm" onClick={() => setCreditsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="amber" size="sm" onClick={() => navigate("/pricing")}>
              Buy Credits
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex h-[calc(100vh-64px)] gap-0">
        <div className="flex flex-1 flex-col min-w-0">
          {/* Chat header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 md:px-8">
            <h2 className="font-heading text-sm text-foreground truncate">{project.name}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Chat options"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem onClick={handleExportConversation}>
                  <Download className="mr-2 h-3.5 w-3.5" /> Export Conversation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setClearDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" /> Clear & Restart
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-5"
          >
            {messagesLoading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
                    <div className={`space-y-2 ${i % 2 ? "w-[55%]" : "w-[65%]"}`}>
                      <Skeleton className={`h-3 w-20 rounded ${i % 2 ? "ml-auto" : ""}`} />
                      <Skeleton
                        className={`h-14 w-full ${i % 2 ? "rounded-[12px_12px_4px_12px]" : "rounded-[12px_12px_12px_4px]"}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : !allMessages.length ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-[400px] rounded-card border border-border bg-card p-8 text-center">
                  <p className="font-heading text-xl text-foreground">Hi! I'm your LovPlan Architect 🏗</p>
                  <p className="mt-2 font-body text-sm text-muted-foreground">
                    I'll ask you about your app idea, target users, features, and tech preferences. Let's start!
                  </p>
                </div>
              </div>
            ) : (
              <>
                {allMessages.map((msg) => {
                  if (msg.role === "user")
                    return (
                      <UserMessage
                        key={msg.id}
                        content={msg.content}
                        createdAt={msg.created_at}
                        messageId={msg.id}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                      />
                    );
                  if (msg.role === "assistant")
                    return (
                      <AssistantMessage
                        key={msg.id}
                        content={msg.content}
                        createdAt={msg.created_at}
                        onOptionClick={
                          msg.id === lastAssistantMsgId
                            ? (text) => {
                                // text may be a single option or comma-joined multi-select choices
                                const cleanText = text.trim();
                                // If the only thing selected is "Other (specify)" alone, populate the input
                                const parts = cleanText.split(",").map((s) => s.trim());
                                const isSoleOther =
                                  parts.length === 1 && /other.*specify|specify.*other/i.test(parts[0]);
                                if (isSoleOther) {
                                  setInput("");
                                  setTimeout(() => inputRef.current?.focus(), 50);
                                } else {
                                  sendMessage(cleanText);
                                }
                              }
                            : undefined
                        }
                      />
                    );
                  if (msg.role === "system") return <SystemMessage key={msg.id} content={msg.content} />;
                  return null;
                })}
                {isTyping && <TypingIndicator />}
                {pendingComplete && !isTyping && (
                  <DiscoveryCompleteCard
                    specData={
                      (typeof project.spec_data === "object" && project.spec_data !== null
                        ? project.spec_data
                        : {}) as Record<string, unknown>
                    }
                    onGeneratePrompts={handleGeneratePrompts}
                    onKeepRefining={handleKeepRefining}
                    isGenerating={isGenerating}
                    accepted={isGenerating}
                  />
                )}
              </>
            )}

            {/* New message pill */}
            {hasNewMessage && (
              <button
                onClick={scrollToBottom}
                className="sticky bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full border border-primary/50 bg-card px-4 py-2 font-body text-xs font-medium text-primary shadow-lg transition-all duration-200 hover:bg-primary hover:text-primary-foreground animate-fade-in"
              >
                New message <ArrowDown className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Chat input */}
          <div className="shrink-0 border-t border-border bg-card px-4 py-4 md:px-8">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your idea or answer the AI's question..."
                rows={1}
                disabled={sending}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary disabled:opacity-50"
                style={{ height: "auto", overflow: "hidden" }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  // Pasting a large block fires onInput synchronously and the
                  // layout recalc it triggers stutters the thread. Defer to
                  // next frame so we only resize once per paint.
                  requestAnimationFrame(() => {
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 128) + "px";
                  });
                }}
              />
              <Button
                variant="amber"
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="h-11 w-11 shrink-0 rounded-full"
                aria-label="Send message"
              >
                {rateLimited && rateLimitCountdown > 0 ? (
                  <span className="font-body text-xs font-semibold">{rateLimitCountdown}s</span>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 text-muted-foreground"
                    aria-label="Project info"
                  >
                    <PanelRightOpen className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] border-l-border bg-card p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Project Info</SheetTitle>
                  </SheetHeader>
                  <ProjectInfoSidebar
                    project={project}
                    currentPhase={currentPhase}
                    loading={false}
                    onEndDiscovery={handleEndDiscovery}
                    onGeneratePrompts={handleGeneratePrompts}
                    isGenerating={isGenerating}
                    pendingComplete={pendingComplete}
                    onKeepRefining={handleKeepRefining}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        <aside className="hidden w-[320px] shrink-0 border-l border-border bg-card lg:block overflow-y-auto">
          <ProjectInfoSidebar
            project={project}
            currentPhase={currentPhase}
            loading={false}
            onEndDiscovery={handleEndDiscovery}
            onGeneratePrompts={handleGeneratePrompts}
            isGenerating={isGenerating}
            pendingComplete={pendingComplete}
            onKeepRefining={handleKeepRefining}
          />
        </aside>
      </div>
    </>
  );
};

/* ──────── Smart Router ──────── */

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [isGeneratingStatus, setIsGeneratingStatus] = useState(false);

  const {
    data: activeProject,
    isLoading,
    error,
  } = useProject(id, {
    refetchInterval: isGeneratingStatus ? 3000 : false,
  });

  useEffect(() => {
    setIsGeneratingStatus(activeProject?.status === "generating");
  }, [activeProject?.status]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !activeProject) {
    return <ProjectNotFound />;
  }

  switch (activeProject.status) {
    case "discovery":
      return <DiscoveryChat project={activeProject} />;
    case "generating":
      return <GeneratingView projectName={activeProject.name} projectId={activeProject.id} />;
    case "ready":
    case "completed":
    case "revising":
      return (
        <PromptViewer projectId={activeProject.id} projectName={activeProject.name} metadata={activeProject.metadata} />
      );
    default:
      return <DiscoveryChat project={activeProject} />;
  }
};

export default ProjectDetail;
