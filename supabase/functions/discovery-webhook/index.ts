import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchN8n, n8nErrorResponse } from "../_shared/n8n.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

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

    // 1 request per 2 seconds; allows natural typing pace, blocks spam.
    const throttled = await enforceRateLimit(admin, userId, "discovery", 1, 2, corsHeaders);
    if (throttled) return throttled;

    const body = await req.json().catch(() => ({}));
    const project_id = typeof body?.project_id === "string" ? body.project_id : "";
    const message = typeof body?.message === "string" ? body.message : "";
    if (!project_id || !message) {
      return new Response(
        JSON.stringify({ error: "project_id and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Cheap guard against oversized payloads hitting n8n.
    if (message.length > 8000) {
      return new Response(
        JSON.stringify({ error: "Message too long (max 8000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    const webhookUrl = `${webhookBase.replace(/\/$/, "")}/webhook/discovery`;

    const result = await fetchN8n(webhookUrl, {
      timeoutMs: 30_000,
      headers: { Authorization: authHeader },
      body: {
        project_id,
        message,
        user_id: userId,
        response_format: "always_include_choices",
      },
    });

    if (!result.ok) {
      if (result.status === 402) {
        return new Response(JSON.stringify({ error: "No credits" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return n8nErrorResponse(result, corsHeaders);
    }

    return new Response(JSON.stringify(result.body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("discovery-webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
