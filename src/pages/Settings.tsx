import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
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

const Settings = () => {
  const { user, profile, signOut } = useAuth();
  const { data: creditStats } = useCreditStats();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    } catch {
      toast.error("Failed to delete account. Please try again.");
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

        {/* Section 3: Danger Zone */}
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
