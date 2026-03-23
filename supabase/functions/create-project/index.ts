import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    // Initialize regular client for auth, service role client to bypass RLS for credit deduction atomically
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

    const { name, description } = await req.json();
    if (!name || name.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Project name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Attempt to deduct credit with service role so it cannot be spoofed by browser
    const { data: creditOk, error: creditError } = await supabaseAdmin.rpc("deduct_credit", {
      p_user_id: user.id,
      p_project_id: null,
      p_description: `Project: ${name}`,
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

    // 2. Create the project AFTER credit is successfully docked
    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        name,
        description,
        user_id: user.id,
        status: "discovery"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Project insert error:", insertError);
      // Give them their credit back because insertion failed
      await supabaseAdmin.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: 1,
        p_description: `Refund: Project creation failed`
      });
      throw insertError;
    }

    return new Response(JSON.stringify({ project }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-project error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
