import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import lovplanWordmark from "@/assets/lovplan-wordmark.png";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: "https://lovplan.com",
        },
      });
      if (error) {
        console.error("Signup error:", error.message, error.status);
        toast.error("Sign up failed", {
          description: error.message || "Please check your details and try again.",
          duration: 6000,
        });
      } else {
        // Store referral code so it can be applied after email confirmation
        if (refCode) {
          localStorage.setItem("lovplan_referral_code", refCode);
        }
        toast.info("Check your email — we sent a confirmation link.");
        navigate("/login");
      }
    } catch (err) {
      console.error("Unexpected signup error:", err);
      toast.error("Sign up failed", {
        description: "Something went wrong. Please try again.",
        duration: 6000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (refCode) {
      localStorage.setItem("lovplan_referral_code", refCode);
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://lovplan.com/dashboard" },
    });
  };

  return (
    <div className="blueprint-grid flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <SEO title="Sign Up" />
      <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-12">
        <div className="mb-8 flex justify-center">
          <img src={lovplanWordmark} alt="Lovplan" width={180} height={45} className="h-10 w-auto" />
        </div>

        <h1 className="mb-1 text-center font-heading text-3xl leading-[1.1] text-foreground">
          Start building
        </h1>
        <p className="mb-4 text-center font-body text-sm text-muted-foreground">
          Create your account to get started
        </p>

        {refCode && (
          <div className="mb-6 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-center">
            <p className="font-body text-xs font-medium text-secondary">
              You've been referred! Sign up and get a bonus credit.
            </p>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-body text-xs font-medium text-muted-foreground">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-3 font-body text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              placeholder="Jane Doe"
            />
          </div>
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
          <div>
            <label className="mb-1.5 block font-body text-xs font-medium text-muted-foreground">Password</label>
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
          <Button
            type="submit"
            variant="amber"
            className="h-11 w-full text-sm font-semibold"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
          </Button>
        </form>


        <p className="mt-6 text-center font-body text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
        <p className="mt-4 text-center font-body text-[11px] text-muted-foreground">
          By signing up you agree to our{" "}
          <Link to="/terms" className="text-primary hover:underline">Terms</Link>
          {" "}and{" "}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default Signup;
