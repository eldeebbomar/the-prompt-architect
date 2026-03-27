import { useState } from "react";
import { Link } from "react-router-dom";
import { Rocket, Chrome, CreditCard, HelpCircle, ChevronDown, FileText, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";

const sections = [
  {
    id: "getting-started",
    icon: Rocket,
    title: "Getting Started",
    content: [
      {
        q: "How does LovPlan work?",
        a: "LovPlan's AI architect interviews you about your app idea through a guided discovery chat. Based on your answers, it generates 50+ structured, dependency-ordered prompts that you paste into Lovable.dev to build your app step by step.",
      },
      {
        q: "How do I create my first project?",
        a: 'Go to your Dashboard and click "Start a new project." Give it a name and a brief description. You\'ll enter a discovery chat where the AI asks questions about your app. Once discovery is complete, prompts are generated automatically.',
      },
      {
        q: "What happens during the discovery phase?",
        a: "The AI asks targeted questions about your app's features, users, tech stack, and business logic. Your answers are compiled into a structured spec that drives prompt generation. You can review and confirm before generating.",
      },
      {
        q: "How do I use the generated prompts?",
        a: "Open your project's prompt viewer, then copy prompts one at a time (in order) and paste them into Lovable.dev. The \"Copy Next\" button always shows you the next prompt in sequence. Alternatively, use the Chrome extension to auto-deploy all prompts.",
      },
    ],
  },
  {
    id: "chrome-extension",
    icon: Chrome,
    title: "Chrome Extension",
    content: [
      {
        q: "What does the Chrome extension do?",
        a: "The Chrome extension auto-deploys your generated prompts to Lovable.dev. Instead of copying and pasting 50+ prompts manually, the extension sends them one by one automatically.",
      },
      {
        q: "How do I set up the extension?",
        a: "1. Download the extension from the Chrome Extension page in your dashboard.\n2. Install it in Chrome (Developer mode → Load unpacked).\n3. Go to Dashboard → Chrome Extension and generate a link code.\n4. Enter the 6-digit code in the extension popup to connect your account.",
      },
      {
        q: "Can I resume a failed deployment?",
        a: "Yes. If deployment stops or you close the popup, the extension saves your progress. Next time you open the project, you'll see a \"Resume from #N\" option to continue where you left off.",
      },
      {
        q: "The extension isn't working — what should I check?",
        a: "Make sure you're on lovable.dev with a project open. Check that your link code hasn't expired (codes last 10 minutes). Try revoking your session and re-linking. The extension needs the Lovable editor's chat input to be visible.",
      },
    ],
  },
  {
    id: "billing",
    icon: CreditCard,
    title: "Credits & Billing",
    content: [
      {
        q: "How do credits work?",
        a: "Each project costs 1 credit. When you create a project, 1 credit is deducted. If project creation fails, the credit is automatically refunded. You can buy credits individually or in packs.",
      },
      {
        q: "What plans are available?",
        a: "Free: 1 credit to try LovPlan. Single: $12.99 for 1 credit. 5-Pack: $44.99 for 5 credits ($9/each, save 31%). Unlimited: $29.99/month for unlimited projects.",
      },
      {
        q: "How do refunds work?",
        a: "If prompt generation fails due to a system error, your credit is automatically refunded. For billing disputes, contact support through the app.",
      },
      {
        q: "What is the referral program?",
        a: "Share your referral link (found in Settings → Refer & Earn). When someone signs up using your link, you both get 1 free credit after they create their first project.",
      },
    ],
  },
  {
    id: "troubleshooting",
    icon: HelpCircle,
    title: "Troubleshooting",
    content: [
      {
        q: "My prompts are stuck on \"Generating\"",
        a: "Prompt generation typically takes 1-3 minutes. If it's been more than 5 minutes, try refreshing the page. You'll receive a notification when generation completes. If the issue persists, the generation may have failed — check your credits to see if they were refunded.",
      },
      {
        q: "I can't log in / my session expired",
        a: "Try clearing your browser cookies for LovPlan and logging in again. If you signed up with Google, make sure you're using the same Google account. Check your email for a confirmation link if you just signed up.",
      },
      {
        q: "My prompts don't seem right for my project",
        a: "The quality of generated prompts depends on the discovery conversation. Be specific in your answers — mention concrete features, user roles, and technical requirements. You can use the \"Revise Prompts\" feature to regenerate with updated specs.",
      },
      {
        q: "The page is showing an error or won't load",
        a: "Check your internet connection first. Try a hard refresh (Ctrl+Shift+R). If the issue persists, clear your browser cache. Most errors are temporary — wait a moment and try again.",
      },
    ],
  },
];

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="font-body text-sm font-medium text-foreground">{q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="pb-4 font-body text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
          {a}
        </div>
      )}
    </div>
  );
};

const Help = () => {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <SEO
        title="Help Center"
        description="Get help with LovPlan — guides for getting started, Chrome extension setup, billing, and troubleshooting."
      />

      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Help Center</h1>
        <p className="mt-3 font-body text-sm text-muted-foreground max-w-md mx-auto">
          Everything you need to know about using LovPlan to build your app with AI-powered prompts.
        </p>
      </div>

      {/* Quick links */}
      <div className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-3 rounded-card border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-warm"
          >
            <s.icon className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-body text-sm font-medium text-foreground">{s.title}</span>
          </a>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <div className="mb-4 flex items-center gap-2">
              <s.icon className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-xl text-foreground">{s.title}</h2>
            </div>
            <div className="rounded-card border border-border bg-card px-5">
              {s.content.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Still need help CTA */}
      <div className="mt-14 rounded-card border border-primary/30 bg-primary/5 p-8 text-center">
        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h3 className="font-heading text-lg text-foreground">Still need help?</h3>
        <p className="mt-2 font-body text-sm text-muted-foreground max-w-sm mx-auto">
          Can't find what you're looking for? Start a new project and our AI discovery chat will guide you through every step.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link to="/dashboard/new">
            <Button variant="amber" className="gap-1.5">
              <FileText className="h-4 w-4" /> Start a Project
            </Button>
          </Link>
          <Link to="/examples">
            <Button variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
              View Examples <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Help;
