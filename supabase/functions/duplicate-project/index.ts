import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

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

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(
        JSON.stringify({ error: "project_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the original project (RLS ensures ownership)
    const { data: original, error: fetchError } = await supabase
      .from("projects")
      .select("name, description, spec_data, metadata")
      .eq("id", project_id)
      .single();

    if (fetchError || !original) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credit
    const { data: creditOk, error: creditError } = await supabaseAdmin.rpc("deduct_credit", {
      p_user_id: user.id,
      p_project_id: null,
      p_description: `Duplicate: ${original.name}`,
    });

    if (creditError) {
      console.error("Credit deduction error:", creditError);
      throw creditError;
    }

    if (!creditOk) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the duplicate project
    const { data: newProject, error: insertError } = await supabase
      .from("projects")
      .insert({
        name: `${original.name} (Copy)`,
        description: original.description,
        spec_data: original.spec_data,
        metadata: original.metadata,
        user_id: user.id,
        status: "discovery",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Project insert error:", insertError);
      // Refund credit
      await supabaseAdmin.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: 1,
        p_description: "Refund: Project duplication failed",
      });
      throw insertError;
    }

    // Copy conversations from original project
    const { data: conversations } = await supabase
      .from("conversations")
      .select("role, content, phase, spec_data, is_complete")
      .eq("project_id", project_id)
      .order("created_at", { ascending: true });

    if (conversations && conversations.length > 0) {
      const copies = conversations.map((c) => ({
        project_id: newProject.id,
        user_id: user.id,
        role: c.role,
        content: c.content,
        phase: c.phase,
        spec_data: c.spec_data,
        is_complete: false, // Reset completion so user can continue discovery
      }));
      await supabase.from("conversations").insert(copies);
    }

    return new Response(JSON.stringify({ project: newProject }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("duplicate-project error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
