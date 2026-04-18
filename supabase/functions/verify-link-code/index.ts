import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.length !== 6) {
      return new Response(
        JSON.stringify({ error: "Invalid code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Find the code — must be unused and not expired
    const { data: linkCode, error: findError } = await admin
      .from("extension_link_codes")
      .select("id, user_id, expires_at")
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (findError || !linkCode) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark code as used
    await admin
      .from("extension_link_codes")
      .update({ used: true })
      .eq("id", linkCode.id);

    // Generate secure session token (64-char hex)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

    // Reject link attempts from users without a paid plan.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, plan, full_name, payment_failed")
      .eq("id", linkCode.user_id)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (profile.plan === "free" || profile.payment_failed === true) {
      return new Response(
        JSON.stringify({
          error: "Subscription required to link the extension",
          code: "subscription_required",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: sessionRow, error: sessionError } = await admin
      .from("extension_sessions")
      .insert({ token, user_id: linkCode.user_id })
      .select("expires_at")
      .single();

    if (sessionError) {
      console.error("Failed to create session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        token,
        expires_at: sessionRow?.expires_at,
        user: {
          id: profile.id,
          email: profile.email,
          plan: profile.plan,
          full_name: profile.full_name,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("verify-link-code error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
