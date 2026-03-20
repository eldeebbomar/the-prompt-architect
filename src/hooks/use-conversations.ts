import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useConversations(projectId: string | undefined) {
  return useQuery({
    queryKey: ["conversations", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
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
