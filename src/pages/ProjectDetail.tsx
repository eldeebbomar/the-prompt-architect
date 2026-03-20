import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Send, PanelRightOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useProject } from "@/hooks/use-conversations";
import { UserMessage, AssistantMessage, SystemMessage } from "@/components/ChatMessages";
import ProjectInfoSidebar from "@/components/ProjectInfoSidebar";
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

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: messages, isLoading: messagesLoading } = useConversations(id);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Derive current phase from messages
  const currentPhase = (() => {
    if (!messages?.length) return 0;
    const systemMsgs = messages.filter((m) => m.role === "system");
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

    try {
      await supabase.from("conversations").insert({
        project_id: id,
        role: "user",
        content: text,
        phase: "discovery",
      });
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
    } catch {
      toast.error("Failed to send message.");
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
          ) : !messages?.length ? (
            <div className="flex h-full items-center justify-center">
              <p className="font-body text-sm text-muted-foreground">
                Start your discovery conversation…
              </p>
            </div>
          ) : (
            messages.map((msg) => {
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
            })
          )}
        </div>

        {/* Input area */}
        {project?.status === "discovery" && (
          <div className="shrink-0 border-t border-border bg-background px-4 py-4 md:px-8">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your idea or answer the architect's questions…"
                rows={1}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary"
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
                className="h-11 w-11 shrink-0"
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
