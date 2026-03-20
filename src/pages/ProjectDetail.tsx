import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Send, PanelRightOpen, FolderOpen, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useProject } from "@/hooks/use-conversations";
import { UserMessage, AssistantMessage, SystemMessage } from "@/components/ChatMessages";
import ProjectInfoSidebar from "@/components/ProjectInfoSidebar";
import TypingIndicator from "@/components/TypingIndicator";
import GenerationOverlay from "@/components/GenerationOverlay";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import PromptViewer from "@/components/PromptViewer";

/* ──────── 404 card ──────── */
const ProjectNotFound = () => (
  <div className="flex h-[calc(100vh-64px)] items-center justify-center">
    <div className="max-w-sm rounded-card border border-border bg-card p-10 text-center">
      <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
      <h2 className="font-heading text-xl text-foreground">Project not found</h2>
      <p className="mt-2 font-body text-sm text-muted-foreground">
        This project may have been deleted.
      </p>
      <Link to="/dashboard">
        <Button variant="amber" className="mt-6">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  </div>
);

/* ──────── Generating view ──────── */
const GeneratingView = ({ projectName }: { projectName: string }) => (
  <div className="flex h-[calc(100vh-64px)] items-center justify-center">
    <div className="max-w-md text-center space-y-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <div>
        <h2 className="font-heading text-2xl text-foreground">Generating your prompts…</h2>
        <p className="mt-2 font-body text-sm text-muted-foreground">
          Building a custom prompt blueprint for <span className="text-foreground">{projectName}</span>. This usually takes 15–30 seconds.
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
          <div key={step} className="flex items-center gap-2.5 font-body text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: `${i * 3}s` }}>
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
            {step}
          </div>
        ))}
      </div>
    </div>
  </div>
);

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationDone, setGenerationDone] = useState(false);
  const [promptCount, setPromptCount] = useState(0);
  const autoSentRef = useRef(false);

  const allMessages = (() => {
    const real = messages ?? [];
    const realIds = new Set(real.map((m) => m.id));
    const extras = optimisticMessages.filter((m) => !realIds.has(m.id));
    return [...real, ...extras];
  })();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages, isTyping]);

  const currentPhase = (() => {
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
  })();

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    if (inputRef.current) inputRef.current.style.height = "auto";

    const tempId = `opt-${Date.now()}`;
    setOptimisticMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: text, created_at: new Date().toISOString(), phase: "discovery", project_id: id, metadata: {} },
    ]);

    try {
      await supabase.from("conversations").insert({ project_id: id, role: "user", content: text, phase: "discovery" });
      setIsTyping(true);

      const { data: invokeData, error: invokeError } = await supabase.functions.invoke("discovery-webhook", {
        body: { project_id: id, message: text },
      });

      setIsTyping(false);

      if (invokeError) {
        const msg = invokeError.message || "";
        if (msg.includes("401") || msg.includes("Unauthorized")) { toast.error("Session expired. Please sign in again."); navigate("/login"); return; }
        if (msg.includes("402") || msg.includes("No credits")) { toast.error("You need credits to continue."); navigate("/pricing"); return; }
        throw invokeError;
      }

      const { reply, phase, is_complete, spec_data } = invokeData as {
        reply: string; phase: string; is_complete: boolean; spec_data?: Record<string, string | number | boolean | null>;
      };

      await supabase.from("conversations").insert({
        project_id: id, role: "assistant", content: reply, phase: phase || "discovery",
        metadata: spec_data ? ({ spec_data } as unknown as Json) : {},
      });

      if (spec_data && Object.keys(spec_data).length > 0) {
        const currentSpec = typeof project.spec_data === "object" && project.spec_data !== null ? project.spec_data : {};
        await supabase.from("projects").update({ spec_data: { ...(currentSpec as Record<string, unknown>), ...spec_data } as Json }).eq("id", id);
      }

      if (is_complete) {
        await supabase.from("conversations").insert({ project_id: id, role: "system", content: "✓ Discovery complete. Let's review your project spec.", phase: "discovery" });
        await supabase.from("projects").update({ status: "generating" }).eq("id", id);
        toast.success("Discovery complete! Review your spec in the sidebar.");
      }

      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setOptimisticMessages([]);
    } catch {
      setIsTyping(false);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleEndDiscovery = async () => {
    await supabase.from("conversations").insert({ project_id: id, role: "system", content: "✓ Discovery ended early. Review your project spec.", phase: "discovery" });
    await supabase.from("projects").update({ status: "generating" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    queryClient.invalidateQueries({ queryKey: ["conversations", id] });
    toast.info("Discovery ended. Review your spec and generate prompts.");
  };

  const handleGeneratePrompts = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationDone(false);

    try {
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke("generate-prompts", { body: { project_id: id } });
      if (invokeError) throw invokeError;

      const { success, prompt_count, prompts } = invokeData as {
        success: boolean; prompt_count: number;
        prompts: Array<{ category: string; sequence_order: number; title: string; purpose: string; prompt_text: string; depends_on: number[]; is_loop: boolean }>;
      };
      if (!success || !prompts?.length) throw new Error("No prompts returned");

      setPromptCount(prompt_count || prompts.length);
      setGenerationDone(true);

      const { error: insertError } = await supabase.from("generated_prompts").insert(
        prompts.map((p) => ({ project_id: id, category: p.category, sequence_order: p.sequence_order, title: p.title, purpose: p.purpose, prompt_text: p.prompt_text, depends_on: p.depends_on || [], is_loop: p.is_loop || false }))
      );
      if (insertError) { toast.error("Failed to save prompts."); return; }

      await supabase.from("projects").update({ status: "ready" }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["project", id] });

      setTimeout(() => {
        setIsGenerating(false);
        setGenerationDone(false);
        queryClient.invalidateQueries({ queryKey: ["project", id] });
        queryClient.invalidateQueries({ queryKey: ["prompts", id] });
      }, 2000);
    } catch {
      setIsGenerating(false);
      setGenerationDone(false);
      toast.error("Prompt generation failed. Please try again.");
    }
  };

  return (
    <>
      <GenerationOverlay visible={isGenerating} done={generationDone} promptCount={promptCount} />
      <div className="flex h-[calc(100vh-64px)] gap-0">
        <div className="flex flex-1 flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-5">
            {messagesLoading ? (
              <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                  <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
                    <div className={`space-y-2 ${i % 2 ? "w-[55%]" : "w-[65%]"}`}>
                      <Skeleton className={`h-3 w-20 rounded ${i % 2 ? "ml-auto" : ""}`} />
                      <Skeleton className={`h-14 w-full ${i % 2 ? "rounded-[12px_12px_4px_12px]" : "rounded-[12px_12px_12px_4px]"}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : !allMessages.length ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-[400px] rounded-card border border-border bg-card p-8 text-center">
                  <p className="font-heading text-xl text-foreground">
                    Hi! I'm your LovPlan Architect 🏗
                  </p>
                  <p className="mt-2 font-body text-sm text-muted-foreground">
                    I'll ask you about your app idea, target users, features, and tech preferences. Let's start!
                  </p>
                </div>
              </div>
            ) : (
              <>
                {allMessages.map((msg) => {
                  if (msg.role === "user") return <UserMessage key={msg.id} content={msg.content} createdAt={msg.created_at} />;
                  if (msg.role === "assistant") return <AssistantMessage key={msg.id} content={msg.content} createdAt={msg.created_at} />;
                  if (msg.role === "system") return <SystemMessage key={msg.id} content={msg.content} />;
                  return null;
                })}
                {isTyping && <TypingIndicator />}
              </>
            )}
          </div>

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
                onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 128) + "px"; }}
              />
              <Button variant="amber" size="icon" onClick={handleSend} disabled={!input.trim() || sending} className="h-11 w-11 shrink-0 rounded-full">
                <Send className="h-4 w-4" />
              </Button>
              <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                    <PanelRightOpen className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] border-l-border bg-card p-0">
                  <SheetHeader className="sr-only"><SheetTitle>Project Info</SheetTitle></SheetHeader>
                  <ProjectInfoSidebar project={project} currentPhase={currentPhase} loading={false} onEndDiscovery={handleEndDiscovery} onGeneratePrompts={handleGeneratePrompts} isGenerating={isGenerating} />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        <aside className="hidden w-[320px] shrink-0 border-l border-border bg-card lg:block overflow-y-auto">
          <ProjectInfoSidebar project={project} currentPhase={currentPhase} loading={false} onEndDiscovery={handleEndDiscovery} onGeneratePrompts={handleGeneratePrompts} isGenerating={isGenerating} />
        </aside>
      </div>
    </>
  );
};

/* ──────── Smart Router ──────── */

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [isGeneratingStatus, setIsGeneratingStatus] = useState(false);

  const { data: activeProject, isLoading, error } = useProject(id, {
    refetchInterval: isGeneratingStatus ? 3000 : false,
  });

  // Track generating status for polling
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
      return <GeneratingView projectName={activeProject.name} />;
    case "ready":
      return <PromptViewer projectId={activeProject.id} projectName={activeProject.name} />;
    case "completed":
      return <PromptViewer projectId={activeProject.id} projectName={activeProject.name} />;
    case "revising":
      return <PromptViewer projectId={activeProject.id} projectName={activeProject.name} />;
    default:
      return <DiscoveryChat project={activeProject} />;
  }
};

export default ProjectDetail;
