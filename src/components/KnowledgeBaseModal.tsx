import { useState, useCallback } from "react";
import { Copy, RefreshCw, Info, Pencil, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface KnowledgeBaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  metadata: Json;
  onMetadataUpdate: (metadata: Json) => void;
}

function getKbText(metadata: Json): string {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "knowledge_base" in metadata &&
    typeof (metadata as Record<string, unknown>).knowledge_base === "string"
  ) {
    return (metadata as Record<string, string>).knowledge_base;
  }
  return "";
}

const KnowledgeBaseModal = ({
  open,
  onOpenChange,
  projectId,
  metadata,
  onMetadataUpdate,
}: KnowledgeBaseModalProps) => {
  const { user } = useAuth();
  const kbText = getKbText(metadata);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(kbText);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data: secretData } = await supabase.functions.invoke("get-secret", {
        body: { name: "N8N_WEBHOOK_BASE" },
      });
      const webhookBase =
        secretData?.value || import.meta.env.VITE_N8N_WEBHOOK_BASE || "";

      const res = await fetch(`${webhookBase}/webhook/generate-knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_id: user.id }),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const result = await res.json();

      if (!result.success || !result.knowledge_base) {
        throw new Error("Failed to generate knowledge base");
      }

      // n8n saves to projects.metadata — just update UI optimistically and refetch
      const newMetadata = {
        ...(typeof metadata === "object" && metadata && !Array.isArray(metadata)
          ? metadata
          : {}),
        knowledge_base: result.knowledge_base,
      } as Json;

      onMetadataUpdate(newMetadata);
      toast.success("Knowledge base generated!");
    } catch (err) {
      console.error("Knowledge base generation error:", err);
      toast.error("Failed to generate knowledge base. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [user, projectId, metadata, onMetadataUpdate]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(kbText);
    toast.success(
      "Knowledge base copied! Paste it into Lovable's Project Settings → Knowledge."
    );
  }, [kbText]);

  const handleSaveEdit = useCallback(async () => {
    const newMetadata = {
      ...(typeof metadata === "object" && metadata && !Array.isArray(metadata)
        ? metadata
        : {}),
      knowledge_base: editText,
    } as Json;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ metadata: newMetadata })
        .eq("id", projectId);

      if (error) throw error;
      onMetadataUpdate(newMetadata);
      setIsEditing(false);
      toast.success("Knowledge base saved.");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save knowledge base.");
    }
  }, [editText, metadata, projectId, onMetadataUpdate]);

  const startEdit = useCallback(() => {
    setEditText(kbText);
    setIsEditing(true);
  }, [kbText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-[720px] max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-heading text-2xl text-foreground">
            Lovable Knowledge Base
          </DialogTitle>
          <DialogDescription className="sr-only">
            Project knowledge base document for Lovable
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-card bg-primary/15 border border-primary/30 px-4 py-3">
            <Zap className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <p className="font-body text-sm text-foreground">
              <span className="font-semibold">IMPORTANT:</span> Paste this into
              your Lovable project's Knowledge Base{" "}
              <span className="font-semibold">BEFORE</span> queuing any prompts.
              Go to{" "}
              <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                Project Settings → Knowledge
              </span>
            </p>
          </div>

          <p className="font-body text-sm text-muted-foreground">
            This document gives Lovable persistent context about your entire
            project. It's sent with every prompt automatically.
          </p>

          {kbText ? (
            <>
              {/* Character count */}
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-muted-foreground">
                  {kbText.length.toLocaleString()}/10,000 characters
                </span>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
                {isEditing ? (
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[300px] font-mono text-[13px] bg-[#1A1815] border-border resize-none"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap rounded-card bg-[#1A1815] border border-border p-4 font-mono text-[13px] text-foreground/90 leading-relaxed">
                    {kbText}
                  </pre>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Info className="mx-auto h-10 w-10 text-primary/40" />
                <p className="font-body text-sm text-muted-foreground">
                  No knowledge base generated yet.
                </p>
                <Button
                  variant="amber"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="gap-2"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Generate Knowledge Base
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {kbText && (
          <div className="flex items-center gap-2 border-t border-border px-6 py-4">
            {isEditing ? (
              <>
                <Button variant="amber" size="sm" onClick={handleSaveEdit}>
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="amber"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCopy}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Knowledge Base
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={startEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KnowledgeBaseModal;
