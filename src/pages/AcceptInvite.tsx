import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Store token and redirect to login
      localStorage.setItem("lovplan_invite_token", token || "");
      navigate("/login");
      return;
    }

    if (!token) {
      setStatus("error");
      setErrorMsg("Invalid invite link.");
      return;
    }

    supabase.functions
      .invoke("project-team", {
        body: { action: "accept", token },
      })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setStatus("error");
          setErrorMsg(data?.error || "Failed to accept invite.");
        } else {
          setStatus("success");
          setProjectId(data?.project_id);
        }
      });
  }, [user, authLoading, token, navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <SEO title="Accept Invite" />
      <div className="max-w-sm rounded-card border border-border bg-card p-10 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="font-body text-sm text-muted-foreground">Accepting invite...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="mx-auto mb-4 h-10 w-10 text-[hsl(var(--sage))]" />
            <h2 className="font-heading text-xl text-foreground">You're in!</h2>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              You now have access to this project.
            </p>
            <Button
              variant="amber"
              className="mt-5"
              onClick={() => navigate(projectId ? `/project/${projectId}` : "/dashboard")}
            >
              Go to Project
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h2 className="font-heading text-xl text-foreground">Invite Failed</h2>
            <p className="mt-2 font-body text-sm text-muted-foreground">{errorMsg}</p>
            <Button
              variant="amber"
              className="mt-5"
              onClick={() => navigate("/dashboard")}
            >
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
