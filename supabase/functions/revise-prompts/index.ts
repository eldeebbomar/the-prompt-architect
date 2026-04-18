import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchN8n, n8nErrorResponse } from "../_shared/n8n.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
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

    const throttled = await enforceRateLimit(
      admin,
      user.id,
      "revise-prompts",
      10,
      3600,
      corsHeaders,
    );
    if (throttled) return throttled;

    const body = await req.json().catch(() => ({}));
    const project_id = typeof body?.project_id === "string" ? body.project_id : "";
    const revision_request =
      typeof body?.revision_request === "string" ? body.revision_request : "";

    if (!project_id || !revision_request) {
      return new Response(
        JSON.stringify({ error: "project_id and revision_request required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (revision_request.length > 4000) {
      return new Response(
        JSON.stringify({ error: "Revision request too long (max 4000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: owns } = await supabase.rpc("owns_project", {
      _project_id: project_id,
    });
    if (!owns) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookBase = Deno.env.get("N8N_WEBHOOK_BASE");
    if (!webhookBase) {
      return new Response(
        JSON.stringify({ error: "N8N_WEBHOOK_BASE not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl = `${webhookBase.replace(/\/$/, "")}/webhook/revise`;

    const result = await fetchN8n(webhookUrl, {
      timeoutMs: 120_000,
      headers: { Authorization: authHeader },
      body: { project_id, revision_request, user_id: user.id },
    });

    if (!result.ok) {
      return n8nErrorResponse(result, corsHeaders);
    }

    return new Response(JSON.stringify(result.body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("revise-prompts error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
