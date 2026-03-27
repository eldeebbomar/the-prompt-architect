import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const PRICE_CONFIG: Record<string, { price_id: string; credits: number; mode: "payment" | "subscription" }> = {
  single: {
    price_id: Deno.env.get("STRIPE_PRICE_SINGLE") || "price_1TD89gAMqigyfbFwhuc7nZlL",
    credits: 1,
    mode: "payment",
  },
  pack: {
    price_id: Deno.env.get("STRIPE_PRICE_PACK") || "price_1TD89hAMqigyfbFwupDmfPeo",
    credits: 5,
    mode: "payment",
  },
  unlimited: {
    price_id: Deno.env.get("STRIPE_PRICE_UNLIMITED") || "price_1TD89iAMqigyfbFwytSYJiUO",
    credits: 0,
    mode: "subscription",
  },
};

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { price_type } = await req.json();
    const config = PRICE_CONFIG[price_type];
    if (!config) {
      return new Response(JSON.stringify({ error: "Invalid price_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or reference existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://lovplan.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: config.price_id, quantity: 1 }],
      mode: config.mode,
      success_url: `${origin}/dashboard?payment=success&plan=${price_type}`,
      cancel_url: `${origin}/pricing?payment=cancelled`,
      metadata: {
        user_id: user.id,
        price_type,
        credits_to_add: String(config.credits),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("create-checkout-session error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
