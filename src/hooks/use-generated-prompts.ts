import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGeneratedPrompts(projectId: string | undefined) {
  return useQuery({
    queryKey: ["prompts", projectId],
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_prompts")
        .select("*")
        .eq("project_id", projectId!)
        .order("sequence_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
