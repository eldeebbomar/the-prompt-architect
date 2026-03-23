import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { Rocket, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Project name must be at least 3 characters")
    .max(100, "Project name must be under 100 characters"),
  pitch: z
    .string()
    .trim()
    .min(20, "Elevator pitch must be at least 20 characters")
    .max(500, "Elevator pitch must be under 500 characters"),
});

type FormErrors = Partial<Record<keyof z.infer<typeof projectSchema>, string>>;

const NewProject = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = projectSchema.safeParse({ name, pitch });
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!user) return;
    setSubmitting(true);

    try {
      // 1. Create project & deduct credit atomically via secure Edge Function
      const { data: createData, error: createError } = await supabase.functions.invoke("create-project", {
        body: { name: result.data.name, description: result.data.pitch },
      });

      if (createError) {
        throw createError;
      }

      if (createData?.error) {
        if (createData.error === "Insufficient credits") {
          setShowCreditModal(true);
          setSubmitting(false);
          return;
        }
        throw new Error(createData.error);
      }

      const project = createData.project;

      // ProjectDetail.tsx handles inserting the first message and firing the webhook automatically 
      // when it detects an empty conversation history.

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-count"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["credit-stats"] });

      toast.success(`1 credit used for project: ${result.data.name}`);
      navigate(`/project/${project.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center py-8">
      <div className="w-full max-w-[560px]">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-button bg-primary/10">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-[28px] leading-tight text-foreground">
              What are you building?
            </h1>
            <p className="font-body text-sm text-muted-foreground">
              Give your project a name and a quick description.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project name */}
          <div>
            <label className="mb-2 block font-body text-sm font-medium text-foreground">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Marketplace"
              className={`w-full rounded-input border bg-[hsl(var(--surface-elevated))] px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors ${
                errors.name
                  ? "border-destructive focus:border-destructive"
                  : "border-border focus:border-primary"
              }`}
            />
            {errors.name && (
              <p className="mt-1.5 font-body text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Elevator pitch */}
          <div>
            <label className="mb-2 block font-body text-sm font-medium text-foreground">
              Elevator Pitch
            </label>
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="e.g. A marketplace connecting businesses with freelance AI consultants"
              rows={3}
              className={`w-full resize-none rounded-input border bg-[hsl(var(--surface-elevated))] px-4 py-3 font-body text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors ${
                errors.pitch
                  ? "border-destructive focus:border-destructive"
                  : "border-border focus:border-primary"
              }`}
            />
            <div className="mt-1.5 flex items-center justify-between">
              {errors.pitch ? (
                <p className="font-body text-xs text-destructive">{errors.pitch}</p>
              ) : (
                <span />
              )}
              <span className={`font-mono text-[11px] ${pitch.length > 500 ? "text-destructive" : "text-muted-foreground/50"}`}>
                {pitch.length}/500
              </span>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="amber"
            disabled={submitting}
            className="h-12 w-full text-base font-semibold"
          >
            {submitting ? "Creating..." : "Start Discovery"}
          </Button>

          <p className="text-center font-body text-xs text-muted-foreground">
            This will use 1 credit from your account.
          </p>
        </form>
      </div>

      {/* No credits modal */}
      <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Coins className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-center font-heading text-xl text-foreground">
              You need credits
            </DialogTitle>
            <DialogDescription className="text-center font-body text-sm text-muted-foreground">
              You don't have enough credits to start a new project. Purchase credits to continue building.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-3">
            <Link to="/pricing" onClick={() => setShowCreditModal(false)}>
              <Button variant="amber" className="w-full">
                Buy Credits
              </Button>
            </Link>
            <Button
              variant="outline"
              className="border-border text-muted-foreground"
              onClick={() => setShowCreditModal(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewProject;
