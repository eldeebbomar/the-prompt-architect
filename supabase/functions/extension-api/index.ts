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

    // Single-project read — used by the extension on resume to recover state
    // even when chrome.storage.local has been wiped (e.g. user re-installed,
    // or different device).
    const projectMatch = path.match(/^\/projects\/([^/]+)\/?$/);
    if (projectMatch && req.method === "GET") {
      const projectId = projectMatch[1];

      const { data: proj, error: projErr } = await admin
        .from("projects")
        .select("id, name, status, description, metadata, created_at, updated_at")
        .eq("id", projectId)
        .eq("user_id", userId)
        .maybeSingle();

      if (projErr || !proj) {
        return new Response(
          JSON.stringify({ error: "Project not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const meta = (typeof proj.metadata === "object" && proj.metadata !== null)
        ? proj.metadata as Record<string, unknown>
        : {};

      return new Response(
        JSON.stringify({
          project: {
            id: proj.id,
            name: proj.name,
            status: proj.status,
            description: proj.description,
            created_at: proj.created_at,
            updated_at: proj.updated_at,
            // Promote the deploy-state fields the extension/app care about so
            // callers don't need to dig through the metadata blob.
            deploy_state: {
              last_deployed_index:
                typeof meta.last_deployed_index === "number" ? meta.last_deployed_index : null,
              total_prompts:
                typeof meta.total_prompts === "number" ? meta.total_prompts : null,
              paused: meta.paused === true,
              deploy_error: typeof meta.deploy_error === "string" ? meta.deploy_error : null,
              deploy_error_at: typeof meta.deploy_error_at === "string" ? meta.deploy_error_at : null,
              last_progress_at: typeof meta.last_progress_at === "string" ? meta.last_progress_at : null,
              deployed_at: typeof meta.deployed_at === "string" ? meta.deployed_at : null,
              deployed_via: typeof meta.deployed_via === "string" ? meta.deployed_via : null,
              deployed_prompt_count:
                typeof meta.deployed_prompt_count === "number" ? meta.deployed_prompt_count : null,
            },
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Partial progress upsert. Idempotent — only advances last_deployed_index
    // unless the caller is explicitly resetting (paused=true keeps the value).
    const progressMatch = path.match(/^\/projects\/([^/]+)\/deploy-progress\/?$/);
    if (progressMatch && req.method === "POST") {
      const projectId = progressMatch[1];

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

      let body: { last_deployed_index?: number; total_prompts?: number; paused?: boolean } = {};
      try { body = await req.json(); } catch { /* empty body */ }

      const existingMeta = (typeof proj.metadata === "object" && proj.metadata !== null)
        ? proj.metadata as Record<string, unknown>
        : {};

      // Once a project has been marked deployed we don't accept progress
      // events — they're stale (probably from an old tab).
      if (existingMeta.deployed_at) {
        return new Response(
          JSON.stringify({ success: true, ignored: "already_completed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const incomingIndex =
        typeof body.last_deployed_index === "number" && Number.isFinite(body.last_deployed_index)
          ? Math.max(0, Math.floor(body.last_deployed_index))
          : null;

      const totalPrompts =
        typeof body.total_prompts === "number" && Number.isFinite(body.total_prompts) && body.total_prompts > 0
          ? Math.floor(body.total_prompts)
          : (typeof existingMeta.total_prompts === "number" ? existingMeta.total_prompts : null);

      // Monotonic: never let progress slide backwards from a stale message.
      const existingIndex =
        typeof existingMeta.last_deployed_index === "number" ? existingMeta.last_deployed_index : -1;
      const nextIndex =
        incomingIndex === null ? existingIndex : Math.max(existingIndex, incomingIndex);

      const updatedMeta: Record<string, unknown> = {
        ...existingMeta,
        last_deployed_index: nextIndex >= 0 ? nextIndex : null,
        total_prompts: totalPrompts,
        last_progress_at: new Date().toISOString(),
        paused: body.paused === true,
      };
      // A successful progress write means there's no active error to surface.
      delete updatedMeta.deploy_error;
      delete updatedMeta.deploy_error_at;

      const { error: updErr } = await admin
        .from("projects")
        .update({ metadata: updatedMeta })
        .eq("id", projectId);

      if (updErr) throw updErr;

      return new Response(
        JSON.stringify({
          success: true,
          last_deployed_index: nextIndex >= 0 ? nextIndex : null,
          total_prompts: totalPrompts,
          paused: body.paused === true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mid-deploy failure — record the error and the last index that succeeded
    // so the user can resume from there.
    const errorMatch = path.match(/^\/projects\/([^/]+)\/deploy-error\/?$/);
    if (errorMatch && req.method === "POST") {
      const projectId = errorMatch[1];

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

      let body: { error_message?: string; last_deployed_index?: number; error_code?: string } = {};
      try { body = await req.json(); } catch { /* empty body */ }

      const existingMeta = (typeof proj.metadata === "object" && proj.metadata !== null)
        ? proj.metadata as Record<string, unknown>
        : {};

      // Don't poison a completed project's metadata with stale error noise.
      if (existingMeta.deployed_at) {
        return new Response(
          JSON.stringify({ success: true, ignored: "already_completed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const errorMessage =
        typeof body.error_message === "string" && body.error_message.trim().length > 0
          ? body.error_message.slice(0, 500)
          : "Unknown deploy error";

      const incomingIndex =
        typeof body.last_deployed_index === "number" && Number.isFinite(body.last_deployed_index)
          ? Math.max(0, Math.floor(body.last_deployed_index))
          : null;

      const existingIndex =
        typeof existingMeta.last_deployed_index === "number" ? existingMeta.last_deployed_index : -1;
      const nextIndex =
        incomingIndex === null ? existingIndex : Math.max(existingIndex, incomingIndex);

      const updatedMeta: Record<string, unknown> = {
        ...existingMeta,
        last_deployed_index: nextIndex >= 0 ? nextIndex : existingMeta.last_deployed_index ?? null,
        deploy_error: errorMessage,
        deploy_error_at: new Date().toISOString(),
        deploy_error_code: typeof body.error_code === "string" ? body.error_code : null,
        last_progress_at: new Date().toISOString(),
        paused: false,
      };

      const { error: updErr } = await admin
        .from("projects")
        .update({ metadata: updatedMeta })
        .eq("id", projectId);

      if (updErr) throw updErr;

      return new Response(
        JSON.stringify({ success: true }),
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

      // Strip the partial-deploy fields on full completion — they no longer
      // describe truth and would confuse the app's progress UI.
      const updatedMeta = { ...existingMeta };
      delete updatedMeta.last_deployed_index;
      delete updatedMeta.total_prompts;
      delete updatedMeta.last_progress_at;
      delete updatedMeta.paused;
      delete updatedMeta.deploy_error;
      delete updatedMeta.deploy_error_at;
      delete updatedMeta.deploy_error_code;
      updatedMeta.deployed_at = new Date().toISOString();
      updatedMeta.deployed_via = "chrome_extension";
      updatedMeta.deployed_prompt_count = promptCount;

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
