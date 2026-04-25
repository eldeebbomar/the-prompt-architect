import { useState, useEffect, useCallback } from "react";
import { Chrome, Link2, Loader2, Trash2, ArrowUpRight, Shield, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExtensionSessions, useRevokeSession, useRevokeAllSessions } from "@/hooks/use-extension-sessions";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { handleWebhookError } from "@/lib/webhook-error-handler";
import { copyToClipboard } from "@/lib/clipboard";
import { formatDistanceToNow } from "date-fns";
import SEO from "@/components/SEO";

const ChromeExtension = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data: sessions, isLoading: sessionsLoading } = useExtensionSessions();
  const revokeMutation = useRevokeSession();
  const revokeAllMutation = useRevokeAllSessions();

  const [generating, setGenerating] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyCode = useCallback(async () => {
    if (!linkCode) return;
    const ok = await copyToClipboard(linkCode);
    if (ok) {
      setCodeCopied(true);
      toast.success("Code copied — paste it into the extension.");
      setTimeout(() => setCodeCopied(false), 2000);
    } else {
      toast.error("Couldn't copy. Type the code manually.");
    }
  }, [linkCode]);

  const isFree = (profile?.plan ?? "free") === "free";

  // Countdown timer for active code
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setLinkCode(null);
        setExpiresAt(null);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleGenerateCode = useCallback(async () => {
    setGenerating(true);
    try {
      const { data, error, response } = await supabase.functions.invoke("generate-link-code") as {
        data: { code?: string; expires_at?: string; error?: string } | null;
        error: Error | null;
        response?: Response;
      };

      if (error) {
        // Extract the actual error message from the response body
        let detail = "Failed to generate code.";
        const res = response ?? (error as { context?: Response }).context;
        if (res) {
          try {
            const body = await res.clone().json();
            if (body?.error) detail = body.error;
            else if (body?.message) detail = body.message;
          } catch {
            try { detail = await res.clone().text(); } catch { /* ignore */ }
          }
        }
        console.error("[ChromeExtension] generate-link-code error:", error, detail);
        toast.error(detail);
        return;
      }

      if (data?.error) {
        console.error("[ChromeExtension] generate-link-code returned error:", data.error);
        toast.error(data.error);
        return;
      }

      if (!data?.code) {
        console.error("[ChromeExtension] generate-link-code returned no code:", data);
        toast.error("No code returned. Please try again.");
        return;
      }

      setLinkCode(data.code);
      setExpiresAt(data.expires_at ?? null);
      toast.success("Link code generated!");
    } catch (err) {
      console.error("[ChromeExtension] generate-link-code unexpected error:", err);
      if (!handleWebhookError(err as any, navigate)) {
        toast.error(err instanceof Error ? err.message : "Failed to generate code.");
      }
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleRevoke = async (sessionId: string) => {
    try {
      await revokeMutation.mutateAsync(sessionId);
      toast.success("Session revoked.");
    } catch {
      toast.error("Failed to revoke session.");
    }
  };

  const handleRevokeAll = async () => {
    try {
      await revokeAllMutation.mutateAsync();
      toast.success("All sessions revoked.");
    } catch {
      toast.error("Failed to revoke sessions.");
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <>
      <SEO title="Chrome Extension" description="Link your Chrome Extension to deploy prompts to Lovable." noindex />
      <div className="mx-auto max-w-[640px] space-y-10">
        {/* Header */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Chrome className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-heading text-[28px] text-foreground">Chrome Extension</h1>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Deploy your LovPlan prompts directly to Lovable.dev with one click.
          </p>
        </section>

        {/* Feature gate for free users */}
        {isFree ? (
          <section className="rounded-card border border-border bg-card p-8 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-heading text-xl text-foreground">Available on paid plans</h2>
            <p className="font-body text-sm text-muted-foreground max-w-md mx-auto">
              The Chrome extension auto-types your prompts into Lovable on your behalf. It runs
              against our infrastructure to keep your account linked, so it's available on the
              Single, 5-Pack, and Unlimited plans.
            </p>
            <Button variant="amber" onClick={() => navigate("/pricing")} className="gap-1.5">
              View Pricing <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </section>
        ) : (
          <>
            {/* Link Extension section */}
            <section className="space-y-5">
              <h2 className="font-heading text-[22px] text-foreground">Link Extension</h2>

              {linkCode ? (
                <div className="rounded-card border border-primary/30 bg-primary/5 p-6 text-center space-y-4">
                  <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                    Enter this code in the Chrome Extension
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {linkCode.split("").map((digit, i) => (
                      <span
                        key={i}
                        className="flex h-14 w-11 items-center justify-center rounded-lg border border-primary/40 bg-[hsl(var(--surface-elevated))] font-mono text-2xl font-bold text-primary"
                      >
                        {digit}
                      </span>
                    ))}
                  </div>
                  <p className="font-body text-xs text-muted-foreground">
                    Expires in{" "}
                    <span className={`font-mono font-semibold ${countdown <= 60 ? "text-destructive" : "text-foreground"}`}>
                      {formatCountdown(countdown)}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="amber"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleCopyCode}
                    >
                      {codeCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {codeCopied ? "Copied" : "Copy code"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground"
                      onClick={() => {
                        if (window.confirm("This will invalidate the current code. Continue?")) {
                          handleGenerateCode();
                        }
                      }}
                      disabled={generating}
                    >
                      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generate New Code"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-card border border-border bg-card p-6 text-center space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto">
                    <Link2 className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-body text-sm text-muted-foreground">
                    Generate a 6-digit code to pair your Chrome Extension with your LovPlan account.
                  </p>
                  <Button
                    variant="amber"
                    onClick={handleGenerateCode}
                    disabled={generating}
                    className="gap-2"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Generate Link Code
                  </Button>
                </div>
              )}
            </section>

            {/* Divider */}
            <div className="h-px bg-primary/20" />

            {/* Active Sessions */}
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-[22px] text-foreground">Linked Devices</h2>
                {sessions && sessions.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={handleRevokeAll}
                    disabled={revokeAllMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke All
                  </Button>
                )}
              </div>

              {sessionsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : sessions && sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--surface-elevated))] px-5 py-4"
                    >
                      <div>
                        <p className="font-body text-sm font-medium text-foreground">
                          {s.device_name}
                        </p>
                        <p className="font-body text-[10px] text-muted-foreground">
                          Linked {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                          {" · "}
                          Last used {formatDistanceToNow(new Date(s.last_used_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevoke(s.id)}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-sm text-muted-foreground">
                  No devices linked yet. Generate a code above to get started.
                </p>
              )}
            </section>

            {/* Divider */}
            <div className="h-px bg-primary/20" />

            {/* How It Works */}
            <section className="space-y-5 pb-10">
              <h2 className="font-heading text-[22px] text-foreground">How It Works</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { step: "1", title: "Generate Code", desc: "Click the button above to create a 6-digit pairing code." },
                  { step: "2", title: "Enter in Extension", desc: "Open the LovPlan Deployer extension and enter your code." },
                  { step: "3", title: "Deploy to Lovable", desc: "Select a project and click Deploy. Prompts are sent automatically." },
                ].map((item) => (
                  <div key={item.step} className="rounded-lg border border-border bg-card p-5 space-y-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                      {item.step}
                    </div>
                    <h3 className="font-heading text-sm text-foreground">{item.title}</h3>
                    <p className="font-body text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
};

export default ChromeExtension;
