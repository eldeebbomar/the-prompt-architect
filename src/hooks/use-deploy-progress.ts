import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// Stale window — once we haven't heard a progress event for this long,
// treat the deploy as inactive (paused / abandoned / errored).
const ACTIVE_STALENESS_MS = 5 * 60 * 1000;

// While a deploy is active, refetch the project metadata so the UI ticks
// along with the extension. Cheap query (single row).
const ACTIVE_REFETCH_MS = 3000;

export interface DeployProgress {
  // True once any progress has been reported and we haven't seen completion.
  hasProgress: boolean;
  // Live deploy: progress reported within ACTIVE_STALENESS_MS.
  isActive: boolean;
  isPaused: boolean;
  isErrored: boolean;
  isCompleted: boolean;
  // Zero-indexed last completed prompt; null when nothing reported yet.
  lastDeployedIndex: number | null;
  // Total prompts the extension reported (not necessarily DB count).
  totalPrompts: number | null;
  // Friendly count for "X of Y deployed" copy. deployedCount = lastDeployedIndex+1.
  deployedCount: number;
  totalCount: number;
  percent: number;
  errorMessage: string | null;
  errorAt: string | null;
  lastProgressAt: string | null;
  deployedAt: string | null;
  deployedVia: string | null;
}

function readMetaField<T>(meta: unknown, key: string): T | null {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
  const value = (meta as Record<string, unknown>)[key];
  return value === undefined ? null : (value as T);
}

export function deriveDeployProgress(metadata: Json | null | undefined, fallbackTotal: number): DeployProgress {
  const meta = (metadata ?? null) as unknown;

  const lastDeployedIndex = readMetaField<number>(meta, "last_deployed_index");
  const totalPrompts = readMetaField<number>(meta, "total_prompts");
  const paused = readMetaField<boolean>(meta, "paused") === true;
  const deployError = readMetaField<string>(meta, "deploy_error");
  const deployErrorAt = readMetaField<string>(meta, "deploy_error_at");
  const lastProgressAt = readMetaField<string>(meta, "last_progress_at");
  const deployedAt = readMetaField<string>(meta, "deployed_at");
  const deployedVia = readMetaField<string>(meta, "deployed_via");

  const totalCount = totalPrompts ?? fallbackTotal ?? 0;
  const deployedCount =
    typeof lastDeployedIndex === "number" && lastDeployedIndex >= 0
      ? lastDeployedIndex + 1
      : deployedAt
        ? totalCount
        : 0;
  const percent = totalCount > 0 ? Math.min(100, Math.round((deployedCount / totalCount) * 100)) : 0;

  const isCompleted = !!deployedAt;
  const isErrored = !!deployError && !isCompleted;
  const hasProgress =
    !isCompleted && (typeof lastDeployedIndex === "number" && lastDeployedIndex >= 0);

  let isActive = false;
  if (hasProgress && !isErrored && !paused && lastProgressAt) {
    const last = Date.parse(lastProgressAt);
    if (!Number.isNaN(last) && Date.now() - last < ACTIVE_STALENESS_MS) {
      isActive = true;
    }
  }

  return {
    hasProgress,
    isActive,
    isPaused: paused && hasProgress,
    isErrored,
    isCompleted,
    lastDeployedIndex,
    totalPrompts,
    deployedCount,
    totalCount,
    percent,
    errorMessage: deployError,
    errorAt: deployErrorAt,
    lastProgressAt,
    deployedAt,
    deployedVia,
  };
}

// React Query hook that polls a single project's metadata while a deploy is
// active. Falls back to no polling once the deploy is done or stale.
export function useDeployProgress(projectId: string | undefined, fallbackTotal: number) {
  const query = useQuery({
    queryKey: ["deploy-progress", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("metadata, status")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    // Refetch every ACTIVE_REFETCH_MS while the deploy looks active. Once it
    // settles, React Query stops polling on its own (interval=false).
    refetchInterval: (q) => {
      const data = q.state.data as { metadata?: Json } | null | undefined;
      const progress = deriveDeployProgress(data?.metadata ?? null, fallbackTotal);
      return progress.isActive ? ACTIVE_REFETCH_MS : false;
    },
    refetchIntervalInBackground: false,
    staleTime: 1000,
  });

  const progress = useMemo(
    () => deriveDeployProgress(query.data?.metadata ?? null, fallbackTotal),
    [query.data?.metadata, fallbackTotal],
  );

  return { progress, query };
}
