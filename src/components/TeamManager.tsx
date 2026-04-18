import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, Trash2, Loader2, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { handleWebhookError } from "@/lib/webhook-error-handler";

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: { full_name: string | null; email: string; avatar_url: string | null } | null;
}

interface Invite {
  id: string;
  invited_email: string;
  role: string;
  created_at: string;
}

interface TeamManagerProps {
  projectId: string;
  isOwner: boolean;
}

const TeamManager = ({ projectId, isOwner }: TeamManagerProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("project-team", {
        body: { action: "list", project_id: projectId },
      });
      if (error) throw error;
      setMembers(data?.members ?? []);
      setInvites(data?.invites ?? []);
    } catch (err) {
      // 403 means user isn't owner — that's expected, silence it. Anything
      // else should surface through the shared handler so 401/500 don't get
      // swallowed.
      const status = (err as { context?: { status?: number } })?.context?.status;
      if (status && status !== 403) {
        handleWebhookError(err as any, navigate);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    if (open) fetchTeam();
  }, [open, fetchTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("project-team", {
        body: { action: "invite", project_id: projectId, email: inviteEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Invite sent to ${inviteEmail}`);
        setInviteEmail("");
        fetchTeam();
      }
    } catch (err) {
      if (!handleWebhookError(err as any, navigate)) {
        toast.error("Failed to send invite.");
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase.functions.invoke("project-team", {
        body: { action: "remove", project_id: projectId, member_id: memberId },
      });
      if (error) throw error;
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Team member removed.");
    } catch (err) {
      if (!handleWebhookError(err as any, navigate)) {
        toast.error("Failed to remove member.");
      }
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden sm:inline-flex gap-1.5 border-primary/30 text-primary hover:bg-primary/20 hover:text-white"
        onClick={() => setOpen(true)}
      >
        <Users className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Team</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-card sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Members
            </DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              {isOwner
                ? "Invite people to view and copy prompts from this project."
                : "Team members who have access to this project."}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {/* Invite form (owner only) */}
              {isOwner && (
                <form onSubmit={handleInvite} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <label className="font-body text-xs font-medium text-muted-foreground">
                      Invite by email
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@example.com"
                      required
                      className="w-full rounded-input border border-border bg-[hsl(var(--surface-elevated))] px-3 py-2 font-body text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="amber"
                    size="sm"
                    className="gap-1.5"
                    disabled={inviting}
                  >
                    {inviting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Invite
                  </Button>
                </form>
              )}

              {/* Current members */}
              {members.length > 0 && (
                <div className="space-y-2">
                  <p className="font-body text-xs font-medium text-muted-foreground">Members</p>
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-[hsl(var(--surface-elevated))] px-3 py-2.5"
                    >
                      {m.profiles?.avatar_url ? (
                        <img
                          src={m.profiles.avatar_url}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 font-heading text-xs text-primary">
                          {m.profiles?.full_name?.charAt(0)?.toUpperCase() ||
                            m.profiles?.email?.charAt(0)?.toUpperCase() ||
                            "?"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm text-foreground truncate">
                          {m.profiles?.full_name || m.profiles?.email}
                        </p>
                        <p className="font-body text-[10px] text-muted-foreground capitalize">{m.role}</p>
                      </div>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveMember(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pending invites */}
              {invites.length > 0 && (
                <div className="space-y-2">
                  <p className="font-body text-xs font-medium text-muted-foreground">Pending Invites</p>
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm text-muted-foreground truncate">
                          {inv.invited_email}
                        </p>
                        <p className="font-body text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> Pending
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {members.length === 0 && invites.length === 0 && (
                <p className="py-4 text-center font-body text-sm text-muted-foreground">
                  No team members yet. {isOwner ? "Invite someone above." : ""}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamManager;
