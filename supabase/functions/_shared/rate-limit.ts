/**
 * Thin wrapper around the rate_limit_check RPC. Returns null on success, or
 * a ready-to-send 429 Response if the caller is throttled. Edge functions
 * pattern:
 *
 *   const limited = await enforceRateLimit(admin, userId, "discovery", 1, 2, cors);
 *   if (limited) return limited;
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function enforceRateLimit(
  admin: SupabaseClient,
  userId: string,
  bucket: string,
  maxHits: number,
  windowSeconds: number,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await admin.rpc("rate_limit_check", {
    p_user_id: userId,
    p_bucket: bucket,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });

  // On error we fail-open: a broken rate limiter shouldn't block all traffic.
  if (error) {
    console.warn(`[rate-limit:${bucket}] RPC failed, bypassing:`, error.message);
    return null;
  }

  if (data?.throttled) {
    const retryAfter = Math.max(1, Number(data.retry_after) || windowSeconds);
    return new Response(
      JSON.stringify({
        error: "Too many requests. Slow down.",
        code: "rate_limited",
        retry_after: retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  return null;
}
