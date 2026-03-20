import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Sign up failed", { description: error.message, duration: 6000 });
    } else {
      toast.info("Check your email — we sent a confirmation link.");
      navigate("/login");
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
  };

  return (
    <div className="blueprint-grid flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <SEO title="Sign Up" />
      <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-12">
        <p className="mb-8 text-center font-heading text-2xl tracking-[0.05em] text-primary">
          LovPlan
        </p>

        <h1 className="mb-1 text-center font-heading text-3xl leading-[1.1] text-foreground">
          Start building
        </h1>
        <p className="mb-8 text-center font-body text-sm text-muted-foreground">
          Create your account to get started
        </p>

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

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-body text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          className="h-11 w-full gap-2 border-border bg-[hsl(var(--surface-elevated))] text-foreground hover:bg-accent"
          onClick={handleGoogle}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </Button>

        <p className="mt-6 text-center font-body text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
        <p className="mt-4 text-center font-body text-[11px] text-muted-foreground">
          By signing up you agree to our Terms and Privacy.
        </p>
      </div>
    </div>
  );
};

export default Signup;
