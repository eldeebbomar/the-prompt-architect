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

    // Validate token
    const { data: session, error: sessionError } = await admin
      .from("extension_sessions")
      .select("id, user_id")
      .eq("token", extensionToken)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update last_used_at
    await admin
      .from("extension_sessions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", session.id);

    const userId = session.user_id;

    // Route based on URL path
    const url = new URL(req.url);
    const path = url.pathname.split("/extension-api").pop() || "/";

    // GET /me
    if (path === "/me" || path === "/me/") {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, email, plan, full_name")
        .eq("id", userId)
        .single();

      return new Response(
        JSON.stringify(profile),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // GET /projects
    if (path === "/projects" || path === "/projects/") {
      const { data: projects, error: projError } = await admin
        .from("projects")
        .select("id, name, status, description, created_at, updated_at")
        .eq("user_id", userId)
        .in("status", ["ready", "completed"])
        .order("updated_at", { ascending: false });

      if (projError) throw projError;

      // Get prompt counts for each project
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

    // GET /projects/:id/prompts
    const promptsMatch = path.match(/^\/projects\/([^/]+)\/prompts\/?$/);
    if (promptsMatch) {
      const projectId = promptsMatch[1];

      // Verify project belongs to user
      const { data: project, error: projError } = await admin
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();

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

    // POST /projects/:id/deploy-complete
    const deployMatch = path.match(/^\/projects\/([^/]+)\/deploy-complete\/?$/);
    if (deployMatch && req.method === "POST") {
      const projectId = deployMatch[1];

      // Verify project belongs to user
      const { data: proj, error: projErr } = await admin
        .from("projects")
        .select("id, metadata")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();

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

      const updatedMeta = {
        ...existingMeta,
        deployed_at: new Date().toISOString(),
        deployed_via: "chrome_extension",
        deployed_prompt_count: body.prompt_count || null,
      };

      const { error: updateErr } = await admin
        .from("projects")
        .update({ status: "completed", metadata: updatedMeta })
        .eq("id", projectId);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true }),
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
