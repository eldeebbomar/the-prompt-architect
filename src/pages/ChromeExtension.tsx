import { Chrome, Sparkles } from "lucide-react";
import SEO from "@/components/SEO";

const ChromeExtension = () => {
  return (
    <>
      <SEO title="Chrome Extension — LovPlan" description="LovPlan Chrome Extension coming soon." />
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
          <Chrome className="h-10 w-10 text-primary" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-body text-xs tracking-wider uppercase text-primary">Coming Soon</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl text-foreground mb-3">Chrome Extension</h1>
        <p className="max-w-md font-body text-muted-foreground leading-relaxed">
          Use your LovPlan prompts directly inside Lovable with our Chrome Extension. 
          Copy prompts in one click, track progress, and build faster — right from your browser.
        </p>
        <div className="mt-10 rounded-card border border-dashed border-primary/30 bg-card p-8 max-w-sm w-full">
          <p className="font-body text-sm text-muted-foreground">
            We're building something special. Stay tuned for updates.
          </p>
        </div>
      </div>
    </>
  );
};

export default ChromeExtension;
