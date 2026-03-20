import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, PanelRightOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useProject } from "@/hooks/use-conversations";
import { UserMessage, AssistantMessage, SystemMessage } from "@/components/ChatMessages";
import ProjectInfoSidebar from "@/components/ProjectInfoSidebar";
import TypingIndicator from "@/components/TypingIndicator";
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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !id || sending) return;

    setInput("");
    setSending(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Optimistic user message
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
      // Insert user message to DB
      await supabase.from("conversations").insert({
        project_id: id,
        role: "user",
        content: text,
        phase: "discovery",
      });

      // Show typing indicator
      setIsTyping(true);

      // Call edge function
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
        "discovery-webhook",
        {
          body: { project_id: id, message: text },
        }
      );

      setIsTyping(false);

      if (invokeError) {
        // Check for specific status codes from the response
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

      // Insert assistant message
      await supabase.from("conversations").insert({
        project_id: id,
        role: "assistant",
        content: reply,
        phase: phase || "discovery",
        metadata: spec_data ? ({ spec_data } as Record<string, unknown> as import("@/integrations/supabase/types").Json) : {},
      });

      // Update spec_data on project if returned
      if (spec_data && Object.keys(spec_data).length > 0) {
        const currentSpec =
          typeof project?.spec_data === "object" && project.spec_data !== null
            ? project.spec_data
            : {};
        await supabase
          .from("projects")
          .update({ spec_data: { ...(currentSpec as Record<string, unknown>), ...spec_data } as import("@/integrations/supabase/types").Json })
          .eq("id", id);
      }

      // Handle discovery complete
      if (is_complete) {
        await supabase.from("conversations").insert({
          project_id: id,
          role: "system",
          content: "Discovery complete! Your project spec is ready.",
          phase: "discovery",
        });
        await supabase
          .from("projects")
          .update({ status: "generating" })
          .eq("id", id);
        toast.success("Discovery complete! Generating your prompt blueprint…");
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });

      // Clear optimistic messages since real data will replace them
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
    await supabase
      .from("projects")
      .update({ status: "generating" })
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    toast.info("Discovery ended. Prompts will be generated shortly.");
  };

  return (
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

        {/* Input area */}
        {project?.status === "discovery" && (
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
        />
      </aside>
    </div>
  );
};

export default ProjectDetail;
