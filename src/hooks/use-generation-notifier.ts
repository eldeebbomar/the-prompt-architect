import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Subscribes to Supabase Realtime updates on the projects table.
 * When a project transitions to "ready" status, shows a toast notification
 * so the user knows their prompts are done — even if they navigated away.
 */
export function useGenerationNotifier(userId: string | undefined) {
  const navigate = useNavigate();
  const knownGenerating = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    // Seed the set with currently-generating projects so we only notify on transitions
    supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "generating")
      .then(({ data }) => {
        if (data) {
          knownGenerating.current = new Set(data.map((p) => p.id));
        }
      });

    const channel = supabase
      .channel(`project-status-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as { id: string; name: string; status: string };
          const oldRow = payload.old as { id: string; status: string };

          // Track generating projects
          if (newRow.status === "generating") {
            knownGenerating.current.add(newRow.id);
          }

          // Notify on generating → ready transition
          if (
            newRow.status === "ready" &&
            (oldRow?.status === "generating" || knownGenerating.current.has(newRow.id))
          ) {
            knownGenerating.current.delete(newRow.id);
            toast.success(`Prompts for "${newRow.name}" are ready!`, {
              action: {
                label: "View",
                onClick: () => navigate(`/project/${newRow.id}`),
              },
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, navigate]);
}
