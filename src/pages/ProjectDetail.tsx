import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, PanelRightOpen } from "lucide-react";
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

interface OptimisticMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  phase: string;
  project_id: string;
  metadata: Record<string, unknown>;
}

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { session } = useAuth();

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: messages, isLoading: messagesLoading } = useConversations(id);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationDone, setGenerationDone] = useState(false);
  const [promptCount, setPromptCount] = useState(0);

  // Show prompt viewer when project is ready/completed and not generating
  const showPromptViewer =
    !isGenerating &&
    (project?.status === "ready" || project?.status === "completed");

  // Merge real + optimistic messages
  const allMessages = (() => {
    const real = messages ?? [];
    const realIds = new Set(real.map((m) => m.id));
    const extras = optimisticMessages.filter((m) => !realIds.has(m.id));
    return [...real, ...extras];
  })();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages, isTyping]);

  // Derive current phase from messages
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

  // Show chat input for discovery status OR when status is generating (user can still chat)
  const showChatInput = project?.status === "discovery" || project?.status === "generating";

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !id || sending) return;

    setInput("");
    setSending(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const tempId = `opt-${Date.now()}`;
    const optimisticMsg: OptimisticMessage = {
      id: tempId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      phase: "discovery",
      project_id: id,
      metadata: {},
    };
    setOptimisticMessages((prev) => [...prev, optimisticMsg]);

    try {
      await supabase.from("conversations").insert({
        project_id: id,
        role: "user",
        content: text,
        phase: "discovery",
      });

      setIsTyping(true);

      const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
        "discovery-webhook",
        { body: { project_id: id, message: text } }
      );

      setIsTyping(false);

      if (invokeError) {
        const errorMessage = invokeError.message || "";
        if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
          toast.error("Session expired. Please sign in again.");
          navigate("/login");
          return;
        }
        if (errorMessage.includes("402") || errorMessage.includes("No credits")) {
          toast.error("You need credits to continue. Purchase more to keep building.");
          navigate("/pricing");
          return;
        }
        throw invokeError;
      }

      const { reply, phase, is_complete, spec_data } = invokeData as {
        reply: string;
        phase: string;
        is_complete: boolean;
        spec_data?: Record<string, string | number | boolean | null>;
      };

      await supabase.from("conversations").insert({
        project_id: id,
        role: "assistant",
        content: reply,
        phase: phase || "discovery",
        metadata: spec_data ? ({ spec_data } as unknown as Json) : {},
      });

      if (spec_data && Object.keys(spec_data).length > 0) {
        const currentSpec =
          typeof project?.spec_data === "object" && project.spec_data !== null
            ? project.spec_data
            : {};
        await supabase
          .from("projects")
          .update({
            spec_data: { ...(currentSpec as Record<string, unknown>), ...spec_data } as Json,
          })
          .eq("id", id);
      }

      if (is_complete) {
        await supabase.from("conversations").insert({
          project_id: id,
          role: "system",
          content: "✓ Discovery complete. Let's review your project spec.",
          phase: "discovery",
        });
        await supabase
          .from("projects")
          .update({ status: "generating" })
          .eq("id", id);
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEndDiscovery = async () => {
    if (!id) return;
    await supabase.from("conversations").insert({
      project_id: id,
      role: "system",
      content: "✓ Discovery ended early. Review your project spec.",
      phase: "discovery",
    });
    await supabase
      .from("projects")
      .update({ status: "generating" })
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    queryClient.invalidateQueries({ queryKey: ["conversations", id] });
    toast.info("Discovery ended. Review your spec and generate prompts.");
  };

  const handleGeneratePrompts = async () => {
    if (!id || isGenerating) return;

    setIsGenerating(true);
    setGenerationDone(false);

    try {
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
        "generate-prompts",
        { body: { project_id: id } }
      );

      if (invokeError) throw invokeError;

      const { success, prompt_count, prompts } = invokeData as {
        success: boolean;
        prompt_count: number;
        prompts: Array<{
          category: string;
          sequence_order: number;
          title: string;
          purpose: string;
          prompt_text: string;
          depends_on: number[];
          is_loop: boolean;
        }>;
      };

      if (!success || !prompts?.length) {
        throw new Error("No prompts returned");
      }

      setPromptCount(prompt_count || prompts.length);
      setGenerationDone(true);

      // Batch insert prompts
      const promptRows = prompts.map((p) => ({
        project_id: id,
        category: p.category,
        sequence_order: p.sequence_order,
        title: p.title,
        purpose: p.purpose,
        prompt_text: p.prompt_text,
        depends_on: p.depends_on || [],
        is_loop: p.is_loop || false,
      }));

      const { error: insertError } = await supabase
        .from("generated_prompts")
        .insert(promptRows);

      if (insertError) {
        console.error("Failed to insert prompts:", insertError);
        toast.error("Failed to save prompts. Please try again.");
        return;
      }

      // Update project status
      await supabase
        .from("projects")
        .update({ status: "ready" })
        .eq("id", id);

      queryClient.invalidateQueries({ queryKey: ["project", id] });

      // Brief pause to show done state, then navigate
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationDone(false);
        navigate(`/project/${id}`);
        // Force a full refresh of project data
        queryClient.invalidateQueries({ queryKey: ["project", id] });
        queryClient.invalidateQueries({ queryKey: ["prompts", id] });
      }, 2000);
    } catch {
      setIsGenerating(false);
      setGenerationDone(false);
      toast.error("Prompt generation failed. Please try again.");
    }
  };

  if (showPromptViewer && project) {
    return <PromptViewer projectId={id!} projectName={project.name} />;
  }

  return (
    <>
      <GenerationOverlay
        visible={isGenerating}
        done={generationDone}
        promptCount={promptCount}
      />

      <div className="flex h-[calc(100vh-64px)] gap-0">
        {/* Chat panel */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-5">
            {messagesLoading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
                    <Skeleton className={`h-16 rounded-card bg-muted ${i % 2 ? "w-[60%]" : "w-[70%]"}`} />
                  </div>
                ))}
              </div>
            ) : !allMessages.length ? (
              <div className="flex h-full items-center justify-center">
                <p className="font-body text-sm text-muted-foreground">
                  Start your discovery conversation…
                </p>
              </div>
            ) : (
              <>
                {allMessages.map((msg) => {
                  if (msg.role === "user") {
                    return <UserMessage key={msg.id} content={msg.content} createdAt={msg.created_at} />;
                  }
                  if (msg.role === "assistant") {
                    return <AssistantMessage key={msg.id} content={msg.content} createdAt={msg.created_at} />;
                  }
                  if (msg.role === "system") {
                    return <SystemMessage key={msg.id} content={msg.content} />;
                  }
                  return null;
                })}
                {isTyping && <TypingIndicator />}
              </>
            )}
          </div>

          {/* Input area — available during discovery AND after completion */}
          {showChatInput && (
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

                {/* Mobile info toggle */}
                <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
                  <SheetTrigger asChild className="lg:hidden">
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                      <PanelRightOpen className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] border-l-border bg-card p-0">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Project Info</SheetTitle>
                    </SheetHeader>
                    <ProjectInfoSidebar
                      project={project ?? null}
                      currentPhase={currentPhase}
                      loading={projectLoading}
                      onEndDiscovery={handleEndDiscovery}
                      onGeneratePrompts={handleGeneratePrompts}
                      isGenerating={isGenerating}
                    />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          )}
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden w-[320px] shrink-0 border-l border-border bg-card lg:block overflow-y-auto">
          <ProjectInfoSidebar
            project={project ?? null}
            currentPhase={currentPhase}
            loading={projectLoading}
            onEndDiscovery={handleEndDiscovery}
            onGeneratePrompts={handleGeneratePrompts}
            isGenerating={isGenerating}
          />
        </aside>
      </div>
    </>
  );
};

export default ProjectDetail;
