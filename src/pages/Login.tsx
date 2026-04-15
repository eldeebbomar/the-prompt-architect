import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Sign in failed", { description: error.message, duration: 6000 });
    } else {
      navigate("/dashboard");
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://lovplan.com/dashboard" },
    });
  };

  return (
    <div className="blueprint-grid flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <SEO title="Sign In" />
      <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-12">
        {/* Logo */}
        <p className="mb-8 text-center font-heading text-2xl tracking-[0.05em] text-primary">
          LovPlan
        </p>

        {/* Heading */}
        <h1 className="mb-1 text-center font-heading text-3xl leading-[1.1] text-foreground">
          Welcome back
        </h1>
        <p className="mb-8 text-center font-body text-sm text-muted-foreground">
          Sign in to continue building
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
          </Button>
        </form>


        {/* Footer links */}
        <p className="mt-6 text-center font-body text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
        </p>
        <p className="mt-4 text-center font-body text-[11px] text-muted-foreground">
          By signing in you agree to our Terms and Privacy.
        </p>
      </div>
    </div>
  );
};

export default Login;
