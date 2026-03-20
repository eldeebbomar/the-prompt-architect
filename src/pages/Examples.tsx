import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, Layers, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";

const examples = [
  {
    name: "AI Marketplace",
    category: "Marketplace",
    description: "Connecting businesses with freelance AI consultants.",
    prompts: 54, categories: 6, loops: 5,
    samplePrompts: [
      { cat: "INFRASTRUCTURE", title: "Set up Supabase project with auth, storage, and RLS policies", purpose: "Initialize the backend foundation with proper security." },
      { cat: "INFRASTRUCTURE", title: "Configure Stripe Connect for marketplace payments", purpose: "Enable split payments between platform and consultants." },
      { cat: "BACKEND", title: "Create consultant profiles table with skills, rates, and availability", purpose: "Store structured consultant data for search and matching." },
      { cat: "BACKEND", title: "Build project posting and bidding system", purpose: "Allow businesses to post projects and receive consultant bids." },
      { cat: "BACKEND", title: "Implement real-time messaging between clients and consultants", purpose: "Enable direct communication within the platform." },
      { cat: "FRONTEND", title: "Build consultant search with filters for skill, rate, and rating", purpose: "Help businesses find the right AI consultant quickly." },
      { cat: "FRONTEND", title: "Create project dashboard with status tracking", purpose: "Give both parties visibility into project progress." },
      { cat: "INTEGRATION", title: "Add email notifications for bids, messages, and milestones", purpose: "Keep users engaged with timely updates." },
      { cat: "POLISH", title: "Implement responsive layouts and loading states", purpose: "Ensure smooth experience across all devices." },
    ],
  },
  {
    name: "SaaS Analytics Dashboard",
    category: "Analytics",
    description: "Real-time metrics with team management and alerts.",
    prompts: 48, categories: 5, loops: 4,
    samplePrompts: [
      { cat: "INFRASTRUCTURE", title: "Set up real-time data pipeline with Supabase subscriptions", purpose: "Enable live metric updates without polling." },
      { cat: "INFRASTRUCTURE", title: "Configure role-based access for team workspaces", purpose: "Separate data access by team and permission level." },
      { cat: "BACKEND", title: "Create metrics aggregation engine with time-series rollups", purpose: "Efficiently compute daily, weekly, and monthly summaries." },
      { cat: "BACKEND", title: "Build alert rules engine with threshold and anomaly detection", purpose: "Notify teams when metrics exceed defined bounds." },
      { cat: "FRONTEND", title: "Design chart dashboard with drag-and-drop widget layout", purpose: "Let users customize their analytics view." },
      { cat: "FRONTEND", title: "Build team management panel with invite and role assignment", purpose: "Enable workspace collaboration and access control." },
      { cat: "INTEGRATION", title: "Add Slack and email alert delivery channels", purpose: "Push notifications where teams already communicate." },
      { cat: "POLISH", title: "Optimize chart rendering for large datasets", purpose: "Maintain 60fps with thousands of data points." },
    ],
  },
  {
    name: "E-Commerce Platform",
    category: "E-Commerce",
    description: "Product catalog, cart, checkout, inventory, admin panel.",
    prompts: 62, categories: 6, loops: 6,
    samplePrompts: [
      { cat: "INFRASTRUCTURE", title: "Set up product catalog schema with variants and inventory", purpose: "Model complex product data with size, color, and stock." },
      { cat: "INFRASTRUCTURE", title: "Configure Stripe for one-time payments and subscriptions", purpose: "Handle both product purchases and membership plans." },
      { cat: "BACKEND", title: "Build shopping cart with persistent state and guest checkout", purpose: "Allow users to build orders across sessions." },
      { cat: "BACKEND", title: "Create order management system with status workflow", purpose: "Track orders from placement through fulfillment." },
      { cat: "FRONTEND", title: "Design product listing page with filters and search", purpose: "Help customers discover products efficiently." },
      { cat: "FRONTEND", title: "Build checkout flow with address, shipping, and payment steps", purpose: "Guide users through a frictionless purchase experience." },
      { cat: "INTEGRATION", title: "Add order confirmation and shipping notification emails", purpose: "Keep customers informed about their purchases." },
      { cat: "POLISH", title: "Implement image optimization and lazy loading for catalog", purpose: "Ensure fast page loads with many product images." },
    ],
  },
  {
    name: "Social Media Scheduler",
    category: "Marketing",
    description: "Queue posts, analytics, AI captions, collaboration.",
    prompts: 51, categories: 5, loops: 4,
    samplePrompts: [
      { cat: "INFRASTRUCTURE", title: "Set up multi-platform OAuth for social media accounts", purpose: "Connect Twitter, Instagram, and LinkedIn accounts securely." },
      { cat: "BACKEND", title: "Build post queue with scheduling and timezone support", purpose: "Schedule content across time zones with precise delivery." },
      { cat: "BACKEND", title: "Create AI caption generator using OpenAI integration", purpose: "Help users write engaging captions with AI assistance." },
      { cat: "FRONTEND", title: "Design calendar view with drag-and-drop post scheduling", purpose: "Visualize and rearrange scheduled content intuitively." },
      { cat: "FRONTEND", title: "Build analytics dashboard with engagement metrics", purpose: "Track post performance across all connected platforms." },
      { cat: "INTEGRATION", title: "Implement team approval workflow for scheduled posts", purpose: "Add review steps before content goes live." },
      { cat: "POLISH", title: "Add media library with image editing and cropping", purpose: "Manage visual assets without leaving the app." },
    ],
  },
  {
    name: "Online Learning Platform",
    category: "Education",
    description: "Courses, progress tracking, video, certificates.",
    prompts: 58, categories: 6, loops: 5,
    samplePrompts: [
      { cat: "INFRASTRUCTURE", title: "Set up video storage and streaming with Supabase Storage", purpose: "Host course videos with secure, performant delivery." },
      { cat: "BACKEND", title: "Create course and lesson schema with ordering and prerequisites", purpose: "Model structured learning paths with dependencies." },
      { cat: "BACKEND", title: "Build progress tracking system with completion percentages", purpose: "Track student advancement through course materials." },
      { cat: "FRONTEND", title: "Design course catalog with category filtering and search", purpose: "Help students discover relevant courses." },
      { cat: "FRONTEND", title: "Build video player with note-taking and bookmarking", purpose: "Enhance the learning experience with study tools." },
      { cat: "INTEGRATION", title: "Generate PDF certificates on course completion", purpose: "Reward students with verifiable completion credentials." },
      { cat: "POLISH", title: "Add offline mode for downloaded course content", purpose: "Enable learning without an internet connection." },
    ],
  },
  {
    name: "Community Forum",
    category: "Social",
    description: "Threads, comments, reputation, moderation dashboard.",
    prompts: 46, categories: 5, loops: 4,
    samplePrompts: [
      { cat: "INFRASTRUCTURE", title: "Set up threaded discussion schema with categories and tags", purpose: "Model nested conversations with flexible organization." },
      { cat: "BACKEND", title: "Build reputation system with upvotes, badges, and levels", purpose: "Incentivize quality contributions with gamification." },
      { cat: "BACKEND", title: "Create moderation queue with report handling and auto-flags", purpose: "Keep the community safe with scalable moderation." },
      { cat: "FRONTEND", title: "Design thread view with nested comments and voting", purpose: "Display conversations in an intuitive hierarchy." },
      { cat: "FRONTEND", title: "Build user profile pages with activity history and stats", purpose: "Showcase member contributions and reputation." },
      { cat: "INTEGRATION", title: "Add notification system for replies, mentions, and badges", purpose: "Keep users engaged with relevant activity alerts." },
      { cat: "POLISH", title: "Implement markdown editor with preview for posts", purpose: "Enable rich text formatting without complexity." },
    ],
  },
];

const catColors: Record<string, string> = {
  INFRASTRUCTURE: "text-primary border-primary/40",
  BACKEND: "text-[hsl(var(--sage))] border-[hsl(var(--sage))]/40",
  FRONTEND: "text-[hsl(var(--steel-blue))] border-[hsl(var(--steel-blue))]/40",
  INTEGRATION: "text-primary border-primary/40",
  POLISH: "text-muted-foreground border-muted-foreground/40",
};

const Examples = () => {
  const [selected, setSelected] = useState<typeof examples[number] | null>(null);
  const [activeTab, setActiveTab] = useState("ALL");

  const filteredPrompts = selected
    ? activeTab === "ALL"
      ? selected.samplePrompts
      : selected.samplePrompts.filter((p) => p.cat === activeTab)
    : [];

  const tabs = selected
    ? ["ALL", ...Array.from(new Set(selected.samplePrompts.map((p) => p.cat)))]
    : [];

  return (
    <div className="blueprint-grid" id="main-content">
      <SEO
        title="Examples"
        description="Browse real prompt blueprints created by LovPlan for different app ideas. See what 50+ structured prompts look like for marketplaces, dashboards, e-commerce, and more."
      />

      {/* Hero */}
      <section className="container pt-32 pb-12 text-center" aria-label="Examples hero">
        <ScrollReveal>
          <h1 className="font-heading text-[32px] leading-[1.1] text-foreground md:text-[40px]">
            See what LovPlan generates
          </h1>
          <p className="mx-auto mt-5 max-w-lg font-body text-sm font-light leading-relaxed text-muted-foreground" style={{ textWrap: "pretty" }}>
            Browse real prompt blueprints created by LovPlan for different app ideas.
          </p>
        </ScrollReveal>
      </section>

      {/* Example Cards */}
      <section className="container pb-24" aria-label="Example blueprints">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {examples.map((ex, i) => (
            <ScrollReveal key={ex.name} delay={i * 80 + 60}>
              <div className="group flex h-full flex-col rounded-card border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_4px_20px_hsl(var(--primary)/0.08)]">
                <span className="mb-4 inline-block w-fit rounded-full border border-primary/40 px-2.5 py-0.5 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-primary">
                  {ex.category}
                </span>
                <h2 className="font-heading text-lg text-foreground">{ex.name}</h2>
                <p className="mt-1.5 font-body text-sm leading-relaxed text-muted-foreground">
                  {ex.description}
                </p>
                <div className="mt-4 flex items-center gap-4 font-mono text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{ex.prompts} prompts</span>
                  <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{ex.categories} categories</span>
                  <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />{ex.loops} loops</span>
                </div>
                <div className="mt-auto pt-5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setSelected(ex); setActiveTab("ALL"); }}
                  >
                    View Blueprint <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Blueprint Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border-border bg-card p-0">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="font-heading text-xl text-foreground">
              {selected?.name} — Blueprint Preview
            </DialogTitle>
            <p className="mt-1 font-body text-sm text-muted-foreground">{selected?.description}</p>
          </DialogHeader>

          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-border px-6 py-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-3 py-1 font-body text-xs font-medium transition-colors duration-150 ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Prompt list */}
          <div className="relative overflow-y-auto px-6 py-4" style={{ maxHeight: "55vh" }}>
            <div className="space-y-3">
              {filteredPrompts.map((p, i) => (
                <div
                  key={`${p.cat}-${p.title}`}
                  className={`rounded-card border border-border p-4 transition-opacity ${i >= 3 ? "opacity-40 blur-[2px]" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${catColors[p.cat] ?? "text-muted-foreground border-border"}`}>
                      {p.cat}
                    </span>
                  </div>
                  <h3 className="font-heading text-sm text-foreground">{p.title}</h3>
                  <p className="mt-1 font-body text-xs italic text-muted-foreground">{p.purpose}</p>
                  {i < 3 && (
                    <div className="mt-3 rounded-[8px] border border-border bg-[hsl(var(--surface-elevated))] p-3">
                      <p className="font-mono text-xs leading-relaxed text-foreground/80">
                        {p.title}. {p.purpose} Ensure proper error handling, loading states, and responsive design. Follow the existing project architecture and design system.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Blur overlay CTA */}
            {filteredPrompts.length > 3 && (
              <div className="sticky bottom-0 -mx-6 mt-0 bg-gradient-to-t from-card via-card/95 to-transparent px-6 pb-2 pt-16 text-center">
                <p className="mb-3 font-heading text-lg text-foreground">Want the full blueprint?</p>
                <Link to="/signup">
                  <Button variant="amber" className="gap-2">
                    Create your own blueprint <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Examples;
