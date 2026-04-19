import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://lovplan.com/reset-password",
    });
    setLoading(false);
    if (error) {
      toast.error("Couldn't send reset email", { description: error.message, duration: 6000 });
    } else {
      setSent(true);
      toast.success("Check your email for the reset link");
    }
  };

  return (
    <div className="blueprint-grid flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <SEO title="Forgot Password" description="Reset your LovPlan account password." noindex />
      <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-12">
        <div className="mb-8 flex justify-center">
          <img src="/logo-options/wordmark-1-serif-v2.png" alt="Lovplan" width={180} height={45} className="h-10 w-auto" />
        </div>
        <h1 className="mb-1 text-center font-heading text-3xl leading-[1.1] text-foreground">
          Reset your password
        </h1>
        <p className="mb-8 text-center font-body text-sm text-muted-foreground">
          {sent
            ? "We've sent you a reset link. Check your inbox."
            : "Enter your email and we'll send you a reset link"}
        </p>

        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-body text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-3 font-body text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                placeholder="you@example.com"
              />
            </div>
            <Button
              type="submit"
              variant="amber"
              className="h-11 w-full text-sm font-semibold"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center font-body text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
