/**
 * Shared CORS configuration for all edge functions.
 *
 * In production, set the ALLOWED_ORIGINS env var to a comma-separated list:
 *   ALLOWED_ORIGINS=https://lovplan.com,https://www.lovplan.com
 *
 * Falls back to "*" for local development when the env var is not set.
 */

const ALLOWED_ORIGINS_RAW = Deno.env.get("ALLOWED_ORIGINS") || "";

const allowedOrigins: string[] = ALLOWED_ORIGINS_RAW
  ? ALLOWED_ORIGINS_RAW.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";

  // If no allowed origins configured (dev), allow everything
  if (allowedOrigins.length === 0) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, idempotency-key, x-extension-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    };
  }

  // Check if origin matches any allowed origin
  const isAllowed = allowedOrigins.some((allowed) => origin === allowed);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, idempotency-key, x-extension-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    ...(isAllowed ? { "Vary": "Origin" } : {}),
  };
}
