import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase sets a recovery session via the URL hash; listen for it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check existing session in case event already fired
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Couldn't update password", { description: error.message, duration: 6000 });
    } else {
      toast.success("Password updated");
      navigate("/dashboard");
    }
  };

  return (
    <div className="blueprint-grid flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <SEO title="Set New Password" description="Set a new password for your LovPlan account." noindex />
      <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-12">
        <div className="mb-8 flex justify-center">
          <img src="/logo-options/wordmark-1-serif-v2.png" alt="Lovplan" width={180} height={45} className="h-10 w-auto" />
        </div>
        <h1 className="mb-1 text-center font-heading text-3xl leading-[1.1] text-foreground">
          Set a new password
        </h1>
        <p className="mb-8 text-center font-body text-sm text-muted-foreground">
          {ready ? "Choose a strong password you'll remember" : "Verifying reset link..."}
        </p>

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-body text-xs font-medium text-muted-foreground">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-3 font-body text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-body text-xs font-medium text-muted-foreground">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="h-11 w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-3 font-body text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              variant="amber"
              className="h-11 w-full text-sm font-semibold"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
