import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log(`[stripe-webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const priceType = session.metadata?.price_type;
        const creditsToAdd = parseInt(session.metadata?.credits_to_add || "0", 10);
        const paymentId = session.payment_intent as string || session.subscription as string || session.id;

        if (!userId || !priceType) {
          console.error("Missing metadata", session.metadata);
          break;
        }

        // Store stripe customer id
        if (session.customer) {
          await supabase
            .from("profiles")
            .update({ stripe_customer_id: session.customer as string })
            .eq("id", userId);
        }

        if (priceType === "unlimited") {
          // Set plan to unlimited
          await supabase
            .from("profiles")
            .update({ plan: "unlimited", revision_limit: 100 })
            .eq("id", userId);

          await supabase.rpc("add_credits", {
            p_user_id: userId,
            p_amount: 0,
            p_stripe_id: paymentId,
            p_plan: "unlimited",
          });
        } else {
          // Set revision limit based on pack size (usually 5 for pack)
          const revisionLimit = priceType === "pack" || priceType === "5-pack" ? 5 : 2;
          await supabase
            .from("profiles")
            .update({ plan: priceType, revision_limit: revisionLimit })
            .eq("id", userId);

          await supabase.rpc("add_credits", {
            p_user_id: userId,
            p_amount: creditsToAdd,
            p_stripe_id: paymentId,
            p_plan: priceType,
          });
        }

        console.log(`[stripe-webhook] Credits added for ${userId}: ${priceType} (${creditsToAdd})`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by stripe_customer_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ plan: "free" })
            .eq("id", profile.id);
          console.log(`[stripe-webhook] Subscription cancelled for ${profile.id}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.error(`[stripe-webhook] Payment failed for customer: ${invoice.customer}, invoice: ${invoice.id}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
