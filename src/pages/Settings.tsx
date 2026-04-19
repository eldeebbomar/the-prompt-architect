import { useState, useRef, useEffect } from "react";
import { Camera, Loader2, Gift, Copy, Check, Key, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreditStats } from "@/hooks/use-credits";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { handleWebhookError } from "@/lib/webhook-error-handler";
import { copyToClipboard } from "@/lib/clipboard";

const Settings = () => {
  const { user, profile, signOut } = useAuth();
  const { data: creditStats } = useCreditStats();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Referral state
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("profiles")
      .select("referral_code, referral_count")
      .eq("id", user.id)
      .single()
      .then(({ data }: any) => {
        if (data) {
          setReferralCode(data.referral_code);
          setReferralCount(data.referral_count ?? 0);
        }
      });
  }, [user]);

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    const url = `${window.location.origin}/signup?ref=${referralCode}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCodeCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCodeCopied(false), 2000);
    } else {
      toast.error("Couldn't copy. Link: " + url);
    }
  };

  // API key state
  const [apiKeys, setApiKeys] = useState<{ id: string; key_prefix: string; name: string; created_at: string; last_used_at: string | null }[]>([]);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const isUnlimited = (creditStats?.plan ?? profile?.plan) === "unlimited";

  useEffect(() => {
    if (!user || !isUnlimited) return;
    (supabase as any)
      .from("api_keys")
      .select("id, key_prefix, name, created_at, last_used_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        if (data) setApiKeys(data);
      });
  }, [user, isUnlimited]);

  const handleCreateApiKey = async () => {
    setApiKeyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-api-key", {
        body: { action: "create", name: newKeyName || "Default" },
      });
      if (error) throw error;
      if (data?.key) {
        setNewKeyValue(data.key);
        setApiKeys((prev) => [{ id: data.id || "", key_prefix: data.key_prefix, name: data.name, created_at: new Date().toISOString(), last_used_at: null }, ...prev]);
        setNewKeyName("");
        toast.success("API key created. Copy it now — it won't be shown again.");
      }
    } catch (err) {
      if (!handleWebhookError(err as any, navigate)) {
        toast.error("Failed to create API key.");
      }
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      const { error } = await supabase.functions.invoke("manage-api-key", {
        body: { action: "revoke", key_id: keyId },
      });
      if (error) throw error;
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success("API key revoked.");
    } catch (err) {
      if (!handleWebhookError(err as any, navigate)) {
        toast.error("Failed to revoke API key.");
      }
    }
  };

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const avatarUrl = profile?.avatar_url;

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["credit-stats"] });
      toast.success("Profile updated.");
    } catch {
      toast.error("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const allowedExts = ["jpg", "jpeg", "png", "webp", "gif"];
    if (!allowedExts.includes(ext)) {
      toast.error("Please upload an image file (jpg, png, webp, gif).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }

    setUploading(true);
    try {
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      queryClient.invalidateQueries({ queryKey: ["credit-stats"] });
      toast.success("Avatar updated.");
      // Force page refresh for avatar
      window.location.reload();
    } catch {
      toast.error("Failed to upload avatar.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE" || !user) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;

      await signOut();
      navigate("/");
      toast.success("Account deleted.");
    } catch (err) {
      if (!handleWebhookError(err as any, navigate)) {
        toast.error("Failed to delete account. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const planLabel = (() => {
    const p = creditStats?.plan ?? profile?.plan ?? "free";
    if (p === "unlimited") return "Unlimited";
    if (p === "5-pack") return "5-Pack";
    if (p === "single") return "Single Project";
    return "Free";
  })();

  return (
    <>
      <SEO title="Account Settings" description="Manage your LovPlan profile, account preferences, and security." noindex />
      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-border bg-card sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-destructive">
              Delete Account
            </DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              This will permanently delete your account, all projects, and all
              generated prompts. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label className="font-body text-xs text-muted-foreground">
                Type <span className="font-semibold text-foreground">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-1.5 w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-4 py-2.5 font-mono text-sm text-foreground outline-none transition-colors focus:border-destructive"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-border"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirm !== "DELETE" || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirm Delete"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mx-auto max-w-[640px] space-y-10">
        {/* Section 1: Profile */}
        <section className="space-y-6">
          <h2 className="font-heading text-[22px] text-foreground">Profile</h2>

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-primary">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/15 font-heading text-2xl text-primary">
                    {profile?.full_name?.charAt(0)?.toUpperCase() ||
                      profile?.email?.charAt(0)?.toUpperCase() ||
                      "U"}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60 opacity-0 transition-opacity group-hover:opacity-100 active:scale-[0.95]"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                ) : (
                  <Camera className="h-5 w-5 text-foreground" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <p className="font-body text-sm text-foreground">
                {profile?.full_name || "Your Name"}
              </p>
              <p className="font-body text-xs text-muted-foreground">
                Click the avatar to upload a new photo
              </p>
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="font-body text-xs font-medium text-muted-foreground">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-4 py-2.5 font-body text-sm text-foreground outline-none transition-colors focus:border-primary"
              placeholder="Your name"
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <label className="font-body text-xs font-medium text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={profile?.email ?? ""}
              disabled
              className="w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-4 py-2.5 font-body text-sm text-muted-foreground outline-none opacity-60 cursor-not-allowed"
            />
          </div>

          <Button
            variant="amber"
            onClick={handleSaveProfile}
            disabled={saving}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </section>

        {/* Divider */}
        <div className="h-px bg-primary/20" />

        {/* Section 2: Plan & Credits */}
        <section className="space-y-5">
          <h2 className="font-heading text-[22px] text-foreground">
            Plan & Credits
          </h2>

          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-border bg-[hsl(var(--surface-elevated))] px-5 py-4 flex-1">
              <p className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                Current Plan
              </p>
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-body text-xs font-semibold text-primary">
                {planLabel}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-[hsl(var(--surface-elevated))] px-5 py-4 flex-1 text-center">
              <p className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                Credits Remaining
              </p>
              <p className="font-heading text-3xl text-primary">
                {creditStats?.plan === "unlimited"
                  ? "∞"
                  : creditStats?.credits_remaining ?? profile?.credits ?? 0}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="amber"
              onClick={() => navigate("/pricing")}
              className="gap-1.5"
            >
              Buy Credits
            </Button>
            <Button
              variant="outline"
              className="border-border text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/dashboard/billing")}
            >
              View transaction history
            </Button>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-primary/20" />

        {/* Section 3: Referral Program */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-[22px] text-foreground">Refer & Earn</h2>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Share your referral link with friends. When they sign up and create their first project,
            you both get <span className="font-semibold text-primary">1 free credit</span>.
          </p>

          {referralCode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-4 py-2.5 font-mono text-sm text-foreground select-all">
                  {`${window.location.origin}/signup?ref=${referralCode}`}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={handleCopyReferral}
                >
                  {codeCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {codeCopied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-lg border border-border bg-[hsl(var(--surface-elevated))] px-4 py-3">
                  <p className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                    Your Code
                  </p>
                  <p className="font-mono text-sm font-semibold text-primary">{referralCode}</p>
                </div>
                <div className="rounded-lg border border-border bg-[hsl(var(--surface-elevated))] px-4 py-3">
                  <p className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                    Referrals
                  </p>
                  <p className="font-heading text-xl text-foreground">{referralCount}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="h-px bg-primary/20" />

        {/* Section 4: API Access */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-[22px] text-foreground">API Access</h2>
          </div>

          {!isUnlimited ? (
            <div className="rounded-card border border-border bg-muted/10 p-5 text-center">
              <p className="font-body text-sm text-muted-foreground">
                API access is available on the <span className="font-semibold text-primary">Unlimited plan</span>.
              </p>
              <Button
                variant="amber"
                size="sm"
                className="mt-3"
                onClick={() => navigate("/pricing")}
              >
                Upgrade to Unlimited
              </Button>
            </div>
          ) : (
            <>
              <p className="font-body text-sm text-muted-foreground">
                Use API keys to access your projects and prompts programmatically.
              </p>

              {/* New key value (shown once) */}
              {newKeyValue && (
                <div className="rounded-card border border-secondary/30 bg-secondary/5 p-4">
                  <p className="mb-2 font-body text-xs font-medium text-secondary">
                    Copy your API key now — it won't be shown again:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-3 py-2 font-mono text-xs text-foreground select-all break-all">
                      {newKeyValue}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={async () => {
                        const ok = await copyToClipboard(newKeyValue);
                        if (ok) toast.success("API key copied!");
                        else toast.error("Couldn't copy. Select the text manually.");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-muted-foreground"
                    onClick={() => setNewKeyValue(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}

              {/* Create new key */}
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="font-body text-xs font-medium text-muted-foreground">Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. CI Pipeline"
                    className="w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-3 py-2 font-body text-sm text-foreground outline-none transition-colors focus:border-primary"
                  />
                </div>
                <Button
                  variant="amber"
                  size="sm"
                  onClick={handleCreateApiKey}
                  disabled={apiKeyLoading}
                  className="gap-1.5"
                >
                  {apiKeyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                  Generate Key
                </Button>
              </div>

              {/* Existing keys */}
              {apiKeys.length > 0 && (
                <div className="space-y-2">
                  <p className="font-body text-xs font-medium text-muted-foreground">Active Keys</p>
                  {apiKeys.map((k) => (
                    <div
                      key={k.id || k.key_prefix}
                      className="flex items-center gap-3 rounded-lg border border-border bg-[hsl(var(--surface-elevated))] px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm text-foreground">{k.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{k.key_prefix}</p>
                      </div>
                      {k.last_used_at && (
                        <span className="hidden sm:block font-body text-[10px] text-muted-foreground">
                          Last used: {new Date(k.last_used_at).toLocaleDateString()}
                        </span>
                      )}
                      {k.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRevokeApiKey(k.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* API docs hint */}
              <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
                <p className="font-body text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Usage:</span>{" "}
                  <code className="text-primary">curl -H "Authorization: Bearer lp_..." /public-api/projects</code>
                </p>
                <p className="mt-1 font-body text-[11px] text-muted-foreground">
                  Endpoints: <code>GET /projects</code>, <code>GET /projects/:id</code>, <code>GET /projects/:id/prompts</code>
                </p>
              </div>
            </>
          )}
        </section>

        {/* Divider */}
        <div className="h-px bg-primary/20" />

        {/* Section 5: Danger Zone */}
        <section className="space-y-4 pb-10">
          <h2 className="font-heading text-[22px] text-destructive">
            Danger Zone
          </h2>
          <p className="font-body text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action
            cannot be reversed.
          </p>
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            Delete Account
          </Button>
        </section>
      </div>
    </>
  );
};

export default Settings;
