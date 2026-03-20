import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useConversations(projectId: string | undefined, phase?: string) {
  return useQuery({
    queryKey: ["conversations", projectId, phase],
    enabled: !!projectId,
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
    refetchInterval: options?.refetchInterval,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
