import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleWebhookError } from "@/lib/webhook-error-handler";

interface GenerateLoopPromptsCardProps {
  projectId: string;
}

const GenerateLoopPromptsCard = ({ projectId }: GenerateLoopPromptsCardProps) => {
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("generate-prompts", {
        body: {
          project_id: projectId,
          user_id: userId,
          type: "loop",
        },
      });

      if (error) throw error;

      // n8n saves loop prompts to generated_prompts — just refetch
      queryClient.invalidateQueries({ queryKey: ["prompts", projectId] });
      toast.success(`${data?.loop_prompts?.length ?? 0} loop prompts generated!`);
    } catch {
      toast.error("Failed to generate loop prompts. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="m-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-primary mb-4" />
      <h3 className="font-heading text-lg text-foreground mb-2">
        Generate Loop Prompts
      </h3>
      <p className="font-body text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
        Based on your project's specific architecture, we'll create custom
        self-healing audit prompts.
      </p>
      <Button
        variant="amber"
        onClick={handleGenerate}
        disabled={generating}
        className="gap-2"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Loop Prompts
          </>
        )}
      </Button>
    </div>
  );
};

export default GenerateLoopPromptsCard;
