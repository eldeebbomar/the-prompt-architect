import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleWebhookError } from "@/lib/webhook-error-handler";

interface GenerateLoopPromptsCardProps {
  projectId: string;
}

const STEPS = [
  "Analyzing Project Architecture...",
  "Mapping System Dependencies...",
  "Generating Self-Healing Logic...",
  "Finalizing Loop Blueprints...",
  "Polishing Audit Prompts..."
];

const GenerateLoopPromptsCard = ({ projectId }: GenerateLoopPromptsCardProps) => {
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const loopTimersRef = useRef<{ refreshInterval?: NodeJS.Timeout; finishTimer?: ReturnType<typeof setTimeout> }>({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearInterval(loopTimersRef.current.refreshInterval);
      clearTimeout(loopTimersRef.current.finishTimer);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generating) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) return 100;
          return prev + (100 / (30 * 10)); // ~30 seconds fill
        });
        setCurrentStep(prev => (prev + 1) % STEPS.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [generating]);

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setCurrentStep(0);
    
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

      if (error) {
        if (!handleWebhookError(error, navigate)) throw error;
        setGenerating(false);
        return;
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.info("Architecting loops... This will take about 30 seconds.");

      // Auto-invalidate cache every 10s during generation for a "pop-in" effect
      const refreshInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["prompts", projectId] });
      }, 10000);

      // Finish state after 30s
      const finishTimer = setTimeout(() => {
        clearInterval(refreshInterval);
        queryClient.invalidateQueries({ queryKey: ["prompts", projectId] });
        setGenerating(false);
      }, 31000);

      // Store refs for cleanup
      loopTimersRef.current = { refreshInterval, finishTimer };
      
    } catch {
      toast.error("Failed to start loop generation. Please try again.");
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div className="m-4 flex flex-col items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/5 p-12 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative mb-6">
          <div className="absolute -inset-4 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
        </div>
        
        <h3 className="mb-2 font-heading text-xl text-foreground">
          {STEPS[currentStep]}
        </h3>
        <p className="mb-8 font-body text-sm text-muted-foreground max-w-sm mx-auto">
          Our AI Architect is constructing your project's custom self-healing loops. This takes a few moments.
        </p>

        <div className="w-full max-w-xs space-y-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-linear" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between font-body text-[10px] font-medium uppercase tracking-wider text-primary/60">
            <span>Architecting</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="m-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-12 text-center transition-all duration-300 hover:border-primary/50 hover:bg-primary/[0.08]">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-transform duration-500 group-hover:scale-110">
        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
      </div>
      
      <h3 className="mb-3 font-heading text-[22px] leading-tight text-foreground">
        Ready to build your Loops?
      </h3>
      <p className="mx-auto mb-8 max-w-md font-body text-sm leading-relaxed text-muted-foreground">
        Based on your project's specific architecture, we'll create custom
        self-healing audit prompts that ensure your build stays on track.
      </p>

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Button
          variant="amber"
          size="lg"
          onClick={handleGenerate}
          className="group h-12 px-8 font-medium shadow-warm transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" />
          Generate Loop Prompts
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>

      <div className="mt-8 flex items-center justify-center gap-6 border-t border-primary/10 pt-8">
        {[
          { icon: CheckCircle2, label: "Self-Healing" },
          { icon: CheckCircle2, label: "Deployment Ready" },
          { icon: CheckCircle2, label: "Full Audit" }
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-secondary" />
            <span className="font-body text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GenerateLoopPromptsCard;
