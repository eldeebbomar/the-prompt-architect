/**
 * Shared CORS configuration for all edge functions.
 *
 * In production, set the ALLOWED_ORIGINS env var to a comma-separated list:
 *   ALLOWED_ORIGINS=https://lovplan.com,https://www.lovplan.com
 *
 * Falls back to "*" for local development when the env var is not set.
 *
 * Browser-extension origins (chrome-extension://, moz-extension://) are
 * always allowed — they're how the LovPlan Deployer extension talks to
 * verify-link-code, extension-api, etc. Extension IDs aren't easily
 * enumerable in advance (especially for unpacked dev installs and pre-Web
 * Store builds), so allowing the protocol prefix is the standard pattern.
 * Auth on these endpoints is enforced by the X-Extension-Token / 6-digit
 * code, not by Origin.
 */

const ALLOWED_ORIGINS_RAW = Deno.env.get("ALLOWED_ORIGINS") || "";

const allowedOrigins: string[] = ALLOWED_ORIGINS_RAW
  ? ALLOWED_ORIGINS_RAW.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, idempotency-key, x-extension-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function isExtensionOrigin(origin: string): boolean {
  return (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin.startsWith("safari-web-extension://")
  );
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";

  // Browser extensions are always allowed; reflect their origin so the
  // browser accepts the response.
  if (origin && isExtensionOrigin(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Vary": "Origin",
    };
  }

  // If no allowed origins configured (dev), allow everything
  if (allowedOrigins.length === 0) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    };
  }

  // Check if origin matches any allowed origin
  const isAllowed = allowedOrigins.some((allowed) => origin === allowed);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    ...(isAllowed ? { "Vary": "Origin" } : {}),
  };
}
