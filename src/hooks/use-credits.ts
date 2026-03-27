import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CreditStats } from "@/types";

export type { CreditStats };

export function useCredits() {
  return useQuery({
    queryKey: ["credits"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("check_credits", { p_user_id: user.id });
      if (error) throw error;

      // Fetch plan from profile to determine unlimited status reliably
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      const credits = data as number;
      const isUnlimited = profile?.plan === "unlimited";
      return { credits, isUnlimited };
    },
  });
}

export function useCreditStats() {
  return useQuery({
    queryKey: ["credit-stats"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("get_credit_stats", { p_user_id: user.id });
      if (error) throw error;

      return data as unknown as CreditStats;
    },
  });
}
