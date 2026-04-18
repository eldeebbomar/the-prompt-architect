import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const backoff = (attempt: number) =>
  Math.min(1000 * 2 ** attempt, 30_000);

export function useConversations(projectId: string | undefined, phase?: string) {
  return useQuery({
    queryKey: ["conversations", projectId, phase],
    enabled: !!projectId,
    // Shorter staleTime so two tabs (or re-opened tabs) see each other's
    // messages sooner. The ProjectDetail view explicitly invalidates after
    // each send so this mainly affects cross-tab / refresh cases.
    staleTime: 2_000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: backoff,
    queryFn: async () => {
      let query = supabase
        .from("conversations")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (phase) query = query.eq("phase", phase);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useProject(projectId: string | undefined, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: backoff,
    refetchInterval: options?.refetchInterval,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
