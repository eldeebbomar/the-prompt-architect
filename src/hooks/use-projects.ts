import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProjectCount() {
  return useQuery({
    queryKey: ["project-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useRecentProjects(limit = 4) {
  return useQuery({
    queryKey: ["projects", "recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function usePromptCount() {
  return useQuery({
    queryKey: ["prompt-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("generated_prompts")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}
