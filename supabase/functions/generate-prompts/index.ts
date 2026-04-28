import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchN8n, n8nErrorResponse } from "../_shared/n8n.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

const VALID_TYPES = new Set(["initial", "loop", "knowledge", undefined, null, ""]);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // 5 generations per hour keeps runaway retries in check while still
    // allowing a normal "retry-after-timeout" flow.
    const throttled = await enforceRateLimit(admin, userId, "generate-prompts", 5, 3600, corsHeaders);
    if (throttled) return throttled;

    const requestBody = await req.json().catch(() => ({}));
    const project_id = typeof requestBody?.project_id === "string" ? requestBody.project_id : "";
    const type = typeof requestBody?.type === "string" ? requestBody.type : undefined;

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: "project_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!VALID_TYPES.has(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: ownsIt } = await supabase.rpc("owns_project", {
      _project_id: project_id,
    });
    if (!ownsIt) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookBase = Deno.env.get("N8N_WEBHOOK_BASE");
    if (!webhookBase) {
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookPath =
      type === "loop" ? "loop-prompts" :
        type === "knowledge" ? "generate-knowledge" :
          "generate-prompts";
    const webhookUrl = `${webhookBase.replace(/\/$/, "")}/webhook/${webhookPath}`;

    // n8n handles generation async — we just need ack. 120s ceiling covers
    // slow n8n startup without hanging requests forever.
    const result = await fetchN8n(webhookUrl, {
      timeoutMs: 120_000,
      headers: { Authorization: authHeader },
      body: { project_id, user_id: userId, type },
    });

    if (!result.ok) {
      return n8nErrorResponse(result, corsHeaders);
    }

    // n8n sometimes returns HTTP 200 with an error payload (workflow-level
    // failures don't always map to non-2xx). Inspect the body and surface
    // user-actionable problems as the right status code so the frontend
    // can show the credits modal / proper toast instead of silently
    // marking the project as "generating".
    const responseBody = result.body as Record<string, unknown> | unknown[];
    if (responseBody && !Array.isArray(responseBody)) {
      const errMsg = typeof responseBody.error === "string" ? responseBody.error : "";
      const code = typeof responseBody.code === "string" ? responseBody.code : "";
      const blob = `${errMsg} ${code}`.toLowerCase();

      if (
        blob.includes("insufficient_credits") ||
        blob.includes("insufficient credits") ||
        blob.includes("no credits") ||
        responseBody.error === "INSUFFICIENT_CREDITS"
      ) {
        console.warn("[generate-prompts] n8n reported insufficient credits");
        return new Response(
          JSON.stringify({ error: "Insufficient credits", code: "insufficient_credits" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (errMsg || code) {
        console.error("[generate-prompts] n8n returned error body:", responseBody);
        return new Response(
          JSON.stringify({ error: errMsg || "Prompt generation failed", code: code || "n8n_error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify(result.body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-prompts error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
