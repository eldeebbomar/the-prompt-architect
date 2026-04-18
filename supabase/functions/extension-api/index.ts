import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const extensionToken = req.headers.get("X-Extension-Token");
    if (!extensionToken) {
      return new Response(
        JSON.stringify({ error: "Missing extension token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Validate token + expiry.
    const { data: session, error: sessionError } = await admin
      .from("extension_sessions")
      .select("id, user_id, expires_at")
      .eq("token", extensionToken)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      await admin.from("extension_sessions").delete().eq("id", session.id);
      return new Response(
        JSON.stringify({ error: "Session expired", code: "session_expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = session.user_id;

    // Subscription gate: extension requires a paid plan and no failed payment.
    // Fetched once per request — every endpoint needs this check.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, plan, full_name, payment_failed")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (profile.plan === "free" || profile.payment_failed === true) {
      return new Response(
        JSON.stringify({
          error: "Subscription required",
          code: "subscription_required",
          plan: profile.plan,
          payment_failed: profile.payment_failed === true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin
      .from("extension_sessions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", session.id);

    const url = new URL(req.url);
    const path = url.pathname.split("/extension-api").pop() || "/";

    if (path === "/me" || path === "/me/") {
      return new Response(
        JSON.stringify({
          id: profile.id,
          email: profile.email,
          plan: profile.plan,
          full_name: profile.full_name,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (path === "/projects" || path === "/projects/") {
      const { data: projects, error: projError } = await admin
        .from("projects")
        .select("id, name, status, description, created_at, updated_at")
        .eq("user_id", userId)
        .in("status", ["ready", "completed"])
        .order("updated_at", { ascending: false });

      if (projError) throw projError;

      const projectsWithCounts = await Promise.all(
        (projects || []).map(async (p) => {
          const { count } = await admin
            .from("generated_prompts")
            .select("id", { count: "exact", head: true })
            .eq("project_id", p.id);
          return { ...p, prompt_count: count || 0 };
        }),
      );

      return new Response(
        JSON.stringify({ projects: projectsWithCounts }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const promptsMatch = path.match(/^\/projects\/([^/]+)\/prompts\/?$/);
    if (promptsMatch) {
      const projectId = promptsMatch[1];

      const { data: project, error: projError } = await admin
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", userId)
        .maybeSingle();

      if (projError || !project) {
        return new Response(
          JSON.stringify({ error: "Project not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: prompts, error: promptError } = await admin
        .from("generated_prompts")
        .select("id, sequence_order, category, title, purpose, prompt_text, depends_on, is_loop, repeat_count, version")
        .eq("project_id", projectId)
        .order("sequence_order", { ascending: true });

      if (promptError) throw promptError;

      return new Response(
        JSON.stringify({ prompts: prompts || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const deployMatch = path.match(/^\/projects\/([^/]+)\/deploy-complete\/?$/);
    if (deployMatch && req.method === "POST") {
      const projectId = deployMatch[1];

      const { data: proj, error: projErr } = await admin
        .from("projects")
        .select("id, status, metadata")
        .eq("id", projectId)
        .eq("user_id", userId)
        .maybeSingle();

      if (projErr || !proj) {
        return new Response(
          JSON.stringify({ error: "Project not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let body: { prompt_count?: number } = {};
      try { body = await req.json(); } catch { /* empty body ok */ }

      const existingMeta = (typeof proj.metadata === "object" && proj.metadata !== null)
        ? proj.metadata as Record<string, unknown>
        : {};

      // Idempotent: only set deployed_at once. Subsequent calls return
      // current state without mutating anything.
      if (existingMeta.deployed_at) {
        return new Response(
          JSON.stringify({
            success: true,
            already_completed: true,
            deployed_at: existingMeta.deployed_at,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const promptCount =
        typeof body.prompt_count === "number" &&
        Number.isFinite(body.prompt_count) &&
        body.prompt_count >= 0
          ? body.prompt_count
          : null;

      const updatedMeta = {
        ...existingMeta,
        deployed_at: new Date().toISOString(),
        deployed_via: "chrome_extension",
        deployed_prompt_count: promptCount,
      };

      const { error: updateErr } = await admin
        .from("projects")
        .update({ status: "completed", metadata: updatedMeta })
        .eq("id", projectId);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, already_completed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("extension-api error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
