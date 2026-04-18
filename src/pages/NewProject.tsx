import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { Rocket, Coins, Sparkles, LayoutTemplate, PenLine } from "lucide-react";
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
import { handleWebhookError } from "@/lib/webhook-error-handler";

const PROJECT_TEMPLATES = [
  {
    id: "saas-dashboard",
    label: "SaaS Dashboard",
    category: "Analytics",
    description: "Admin dashboard with user management, analytics charts, subscription billing, and role-based access control.",
    prefill: {
      name: "SaaS Dashboard",
      pitch: "An admin dashboard for SaaS products with real-time analytics, team management, role-based access, and subscription billing via Stripe.",
    },
  },
  {
    id: "ecommerce",
    label: "E-Commerce Store",
    category: "E-Commerce",
    description: "Product catalog with cart, checkout, inventory management, order tracking, and an admin panel.",
    prefill: {
      name: "E-Commerce Store",
      pitch: "A full-featured online store with product catalog, shopping cart, Stripe checkout, order management, and an admin dashboard for inventory.",
    },
  },
  {
    id: "social-platform",
    label: "Social Platform",
    category: "Social",
    description: "User profiles, feeds, posts, comments, likes, real-time messaging, and notifications.",
    prefill: {
      name: "Social Platform",
      pitch: "A social media platform with user profiles, content feeds, posts with comments and likes, real-time chat, and push notifications.",
    },
  },
  {
    id: "project-management",
    label: "Project Management",
    category: "Productivity",
    description: "Kanban boards, task assignment, due dates, team collaboration, and file attachments.",
    prefill: {
      name: "Project Management Tool",
      pitch: "A project management app with Kanban boards, task assignment, due dates, team collaboration, file attachments, and activity tracking.",
    },
  },
  {
    id: "booking-platform",
    label: "Booking Platform",
    category: "Marketplace",
    description: "Service listings, calendar availability, booking flow, payments, and review system.",
    prefill: {
      name: "Booking Platform",
      pitch: "A booking marketplace where service providers list availability, customers book appointments, pay online, and leave reviews.",
    },
  },
  {
    id: "learning-platform",
    label: "Learning Platform",
    category: "Education",
    description: "Courses, video lessons, progress tracking, quizzes, certificates, and instructor dashboard.",
    prefill: {
      name: "Learning Platform",
      pitch: "An online learning platform with video courses, progress tracking, quizzes, completion certificates, and an instructor dashboard.",
    },
  },
];

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

function generateUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 polyfill for the rare browser without randomUUID. Uses
  // getRandomValues for entropy when available, Math.random as a last resort.
  const rand = (n: number) => {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const buf = new Uint8Array(n);
      crypto.getRandomValues(buf);
      return buf;
    }
    const buf = new Uint8Array(n);
    for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
    return buf;
  };
  const bytes = rand(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

const NewProject = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"blank" | "template">("blank");
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleSelectTemplate = (template: typeof PROJECT_TEMPLATES[number]) => {
    setName(template.prefill.name);
    setPitch(template.prefill.pitch);
    setTab("blank"); // Switch to form so user can customise
    setErrors({});
  };

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
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    // Reuse the same idempotency key across retries of this submit so the
    // backend dedupes; a fresh submit (after navigating back or clearing the
    // form) gets a new key. Must be a valid UUID — the server regex is
    // strict and falls back to generating its own key otherwise, defeating
    // the whole dedupe.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateUuidV4();
    }

    try {
      const { data: createData, error: createError } = await supabase.functions.invoke("create-project", {
        body: {
          name: result.data.name,
          description: result.data.pitch,
          idempotency_key: idempotencyKeyRef.current,
        },
        headers: { "Idempotency-Key": idempotencyKeyRef.current },
      });

      if (createError) {
        throw createError;
      }

      if (createData?.error) {
        if (createData.error === "Insufficient credits") {
          setShowCreditModal(true);
          submittingRef.current = false;
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

      if (!createData.idempotent_replay) {
        toast.success(`1 credit used for project: ${result.data.name}`);
      }
      idempotencyKeyRef.current = null;
      navigate(`/project/${project.id}`);
    } catch (err) {
      if (!handleWebhookError(err as any, navigate)) {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      submittingRef.current = false;
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
              Start from scratch or pick a template to get going faster.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setTab("blank")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 font-body text-sm font-medium transition-colors ${
              tab === "blank"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenLine className="h-4 w-4" /> Blank Project
          </button>
          <button
            type="button"
            onClick={() => setTab("template")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 font-body text-sm font-medium transition-colors ${
              tab === "template"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutTemplate className="h-4 w-4" /> From Template
          </button>
        </div>

        {/* Template gallery */}
        {tab === "template" && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {PROJECT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTemplate(t)}
                className="group rounded-card border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-warm"
              >
                <span className="mb-1 inline-block rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider text-primary">
                  {t.category}
                </span>
                <h4 className="mt-1.5 font-heading text-sm text-foreground group-hover:text-primary transition-colors">
                  {t.label}
                </h4>
                <p className="mt-1 font-body text-xs text-muted-foreground line-clamp-2">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        )}

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
              maxLength={100}
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
              maxLength={500}
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

        {/* Prompt preview — show what you'll get */}
        <div className="mt-10 rounded-card border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-heading text-base text-foreground">What you'll get</h3>
          </div>
          <p className="font-body text-xs text-muted-foreground mb-4">
            50+ structured prompts like these, tailored to your project:
          </p>
          <div className="space-y-2">
            {[
              { cat: "INFRASTRUCTURE", title: "Set up database schema with auth and security policies" },
              { cat: "BACKEND", title: "Build core API endpoints and data models" },
              { cat: "FRONTEND", title: "Create responsive UI components and navigation" },
            ].map((sample) => (
              <div
                key={sample.title}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5"
              >
                <div className={`h-2 w-2 shrink-0 rounded-full ${
                  sample.cat === "INFRASTRUCTURE" ? "bg-primary" :
                  sample.cat === "BACKEND" ? "bg-[hsl(var(--sage))]" :
                  "bg-[#6B8EBF]"
                }`} />
                <span className="font-body text-xs text-foreground">{sample.title}</span>
              </div>
            ))}
            <p className="pt-1 text-center font-body text-[11px] text-muted-foreground">
              + integration, polish, and self-healing loop prompts
            </p>
          </div>
        </div>
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
