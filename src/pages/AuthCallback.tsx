import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

type VerifyType = "signup" | "magiclink" | "recovery" | "invite" | "email_change" | "email";

const AuthCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const tokenHash = params.get("token_hash");
      const type = (params.get("type") || "signup") as VerifyType;
      const redirectTo = params.get("redirect_to") || "/dashboard";

      if (!tokenHash) {
        setError("Missing confirmation token.");
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });

      if (verifyError) {
        setError(verifyError.message);
        toast.error("Couldn't confirm your email", { description: verifyError.message });
        return;
      }

      // Recovery flow → send to reset-password page so the user can set a new password.
      if (type === "recovery") {
        navigate("/reset-password", { replace: true });
        return;
      }

      toast.success("Email confirmed! Welcome to LovPlan.");
      // External absolute URLs → use full navigation; internal paths → react-router.
      try {
        const url = new URL(redirectTo);
        if (url.origin === window.location.origin) {
          navigate(url.pathname + url.search + url.hash, { replace: true });
        } else {
          window.location.replace(redirectTo);
        }
      } catch {
        navigate(redirectTo.startsWith("/") ? redirectTo : "/dashboard", { replace: true });
      }
    };
    run();
  }, [params, navigate]);

  return (
    <div className="blueprint-grid flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <SEO title="Confirming your email" description="Verifying your LovPlan account." noindex />
      <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-12 text-center">
        {error ? (
          <>
            <h1 className="mb-2 font-heading text-2xl text-foreground">Confirmation failed</h1>
            <p className="font-body text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate("/login")}
              className="mt-6 text-sm text-primary hover:underline"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 h-6 w-6 animate-spin text-primary" />
            <h1 className="font-heading text-2xl text-foreground">Confirming your email…</h1>
            <p className="mt-2 font-body text-sm text-muted-foreground">Hang tight, this only takes a moment.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
