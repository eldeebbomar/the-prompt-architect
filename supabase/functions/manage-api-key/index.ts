import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Manage API keys (create / revoke).
 * Requires JWT auth (logged in user).
 *
 * POST { action: "create", name?: string }
 *   → { key: "lp_...", key_prefix: "lp_abc12...", name: "..." }
 *
 * POST { action: "revoke", key_id: "uuid" }
 *   → { success: true }
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    // Check unlimited plan
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (profile?.plan !== "unlimited") {
      return json({ error: "API keys require the Unlimited plan" }, 403, corsHeaders);
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      // Generate a random API key
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const rawKey = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const apiKey = `lp_${rawKey}`;
      const keyPrefix = apiKey.slice(0, 11) + "...";

      // Hash for storage
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const name = (body.name || "Default").slice(0, 50);

      const { data: inserted, error } = await supabaseAdmin
        .from("api_keys")
        .insert({
          user_id: user.id,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          name,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Return the raw key ONCE — it cannot be retrieved again
      return json({ key: apiKey, key_prefix: keyPrefix, name, id: inserted.id }, 200, corsHeaders);
    }

    if (action === "revoke") {
      const { key_id } = body;
      if (!key_id) return json({ error: "key_id required" }, 400, corsHeaders);

      const { error } = await supabaseAdmin
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", key_id)
        .eq("user_id", user.id);

      if (error) throw error;
      return json({ success: true }, 200, corsHeaders);
    }

    return json({ error: "Invalid action. Use 'create' or 'revoke'." }, 400, corsHeaders);
  } catch (err) {
    console.error("manage-api-key error:", err);
    return json({ error: "Internal server error" }, 500, getCorsHeaders(req));
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
