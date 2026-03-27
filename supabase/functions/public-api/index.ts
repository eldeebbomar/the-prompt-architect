import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Public API for programmatic access (Unlimited plan only).
 * Auth via `Authorization: Bearer lp_...` API key header.
 *
 * Endpoints:
 *   GET  /public-api/projects           — list user's projects
 *   GET  /public-api/projects/:id        — get project details
 *   GET  /public-api/projects/:id/prompts — get project prompts
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Auth via API key ---
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer lp_")) {
      return json({ error: "Invalid API key. Use 'Authorization: Bearer lp_...'" }, 401, corsHeaders);
    }
    const apiKey = authHeader.replace("Bearer ", "");

    // Hash the key to look up
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: keyRow, error: keyError } = await supabaseAdmin
      .from("api_keys")
      .select("id, user_id")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (keyError || !keyRow) {
      return json({ error: "Invalid or revoked API key" }, 401, corsHeaders);
    }

    // Update last_used_at
    await supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);

    // Check user has unlimited plan
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", keyRow.user_id)
      .single();

    if (profile?.plan !== "unlimited") {
      return json({ error: "API access requires the Unlimited plan" }, 403, corsHeaders);
    }

    const userId = keyRow.user_id;

    // --- Routing ---
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/public-api\/?/, "");
    const segments = path.split("/").filter(Boolean);

    // GET /projects
    if (segments[0] === "projects" && !segments[1]) {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select("id, name, description, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json({ projects: data }, 200, corsHeaders);
    }

    // GET /projects/:id
    if (segments[0] === "projects" && segments[1] && !segments[2]) {
      const projectId = segments[1];
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select("id, name, description, status, spec_data, created_at")
        .eq("id", projectId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ error: "Project not found" }, 404, corsHeaders);
      return json({ project: data }, 200, corsHeaders);
    }

    // GET /projects/:id/prompts
    if (segments[0] === "projects" && segments[1] && segments[2] === "prompts") {
      const projectId = segments[1];

      // Verify ownership
      const { data: proj } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!proj) return json({ error: "Project not found" }, 404, corsHeaders);

      const { data, error } = await supabaseAdmin
        .from("generated_prompts")
        .select("id, sequence_order, category, title, purpose, prompt_text, is_loop, depends_on")
        .eq("project_id", projectId)
        .order("sequence_order");

      if (error) throw error;
      return json({ prompts: data }, 200, corsHeaders);
    }

    return json({ error: "Not found", endpoints: ["GET /projects", "GET /projects/:id", "GET /projects/:id/prompts"] }, 404, corsHeaders);
  } catch (err) {
    console.error("public-api error:", err);
    return json({ error: "Internal server error" }, 500, getCorsHeaders(req));
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
