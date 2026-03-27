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
        // Use session ID as idempotency key — unique per checkout, survives webhook retries
        const idempotencyKey = session.id;

        if (!userId || !priceType) {
          console.error("Missing metadata", session.metadata);
          break;
        }

        // Store stripe customer id and clear any payment_failed flag
        if (session.customer) {
          await supabase
            .from("profiles")
            .update({ stripe_customer_id: session.customer as string, payment_failed: false })
            .eq("id", userId);
        }

        if (priceType === "unlimited") {
          await supabase
            .from("profiles")
            .update({ plan: "unlimited", revision_limit: 100, payment_failed: false })
            .eq("id", userId);

          // add_credits is idempotent — safe against webhook retries
          await supabase.rpc("add_credits", {
            p_user_id: userId,
            p_amount: 0,
            p_stripe_id: idempotencyKey,
            p_plan: "unlimited",
          });
        } else {
          // Normalize "5-pack" → "pack" for consistency
          const normalizedType = priceType === "5-pack" ? "pack" : priceType;
          const revisionLimit = normalizedType === "pack" ? 5 : 2;
          await supabase
            .from("profiles")
            .update({ plan: normalizedType, revision_limit: revisionLimit })
            .eq("id", userId);

          await supabase.rpc("add_credits", {
            p_user_id: userId,
            p_amount: creditsToAdd,
            p_stripe_id: idempotencyKey,
            p_plan: normalizedType,
          });
        }

        console.log(`[stripe-webhook] Credits added for ${userId}: ${priceType} (${creditsToAdd})`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, plan")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          // Only downgrade if currently unlimited (don't touch credit-based plans)
          if (profile.plan === "unlimited") {
            await supabase
              .from("profiles")
              .update({ plan: "free", revision_limit: 2 })
              .eq("id", profile.id);
          }

          // Log the cancellation in credit_transactions for audit trail
          await supabase.from("credit_transactions").insert({
            user_id: profile.id,
            amount: 0,
            type: "subscription_cancelled",
            description: "Subscription cancelled — downgraded to free plan",
            stripe_payment_id: subscription.id,
          });

          console.log(`[stripe-webhook] Subscription cancelled for ${profile.id}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.error(`[stripe-webhook] Payment failed for customer: ${customerId}, invoice: ${invoice.id}`);

        // Find user and flag the payment failure so frontend can show a banner
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ payment_failed: true })
            .eq("id", profile.id);
          console.log(`[stripe-webhook] Flagged payment_failed for ${profile.id}`);
        }
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
