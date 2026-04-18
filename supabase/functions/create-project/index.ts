import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// UUID v4 shape. In 2026 every supported browser has crypto.randomUUID, so
// we expect callers to send real UUIDs. A non-UUID sneaking through just
// means we generate a fresh one and the retry dedupe doesn't kick in for
// that one unlucky client — they'll still succeed, just not idempotently.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description : "";

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Project name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (name.length > 120) {
      return new Response(
        JSON.stringify({ error: "Project name too long (max 120 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (description.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Description too long (max 2000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prefer client-supplied key (dedupes retries); fall back to header; else generate.
    const headerKey = req.headers.get("Idempotency-Key") ?? "";
    const bodyKey =
      typeof body?.idempotency_key === "string" ? body.idempotency_key : "";
    const candidate = headerKey || bodyKey;
    const idempotencyKey =
      candidate && UUID_RE.test(candidate) ? candidate : crypto.randomUUID();

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "create_project_atomic",
      {
        p_user_id: user.id,
        p_name: name,
        p_description: description,
        p_idempotency_key: idempotencyKey,
      }
    );

    if (rpcError) {
      console.error("create_project_atomic error:", rpcError);
      throw rpcError;
    }

    if (result?.error === "insufficient_credits") {
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        project: result.project,
        idempotent_replay: result.idempotent_replay === true,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      }
    );
  } catch (err) {
    console.error("create-project error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
