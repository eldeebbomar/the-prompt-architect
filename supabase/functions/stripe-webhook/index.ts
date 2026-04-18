import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const VALID_PRICE_TYPES = new Set(["single", "pack", "5-pack", "unlimited"]);
const PLAN_CONFIG: Record<string, { revisionLimit: number }> = {
  single: { revisionLimit: 2 },
  pack: { revisionLimit: 5 },
  unlimited: { revisionLimit: 100 },
};

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    // No signature → not a real Stripe request. 400 = permanent, no retry.
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
    // Signature mismatch is permanent — likely misconfig or spoofed request.
    // 200 stops Stripe retry storms; we log for alerting.
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature (ack to prevent retry)", { status: 200 });
  }

  console.log(`[stripe-webhook] Event: ${event.type} id=${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const priceTypeRaw = session.metadata?.price_type;
        const creditsRaw = session.metadata?.credits_to_add;
        const idempotencyKey = session.id;

        if (!idempotencyKey) {
          console.error("[stripe-webhook] Missing session.id", session);
          break;
        }
        if (!userId || typeof userId !== "string") {
          console.error("[stripe-webhook] Missing/invalid user_id in metadata", session.metadata);
          break;
        }
        if (!priceTypeRaw || !VALID_PRICE_TYPES.has(priceTypeRaw)) {
          console.error(`[stripe-webhook] Unknown price_type "${priceTypeRaw}"`);
          break;
        }

        const normalizedType = priceTypeRaw === "5-pack" ? "pack" : priceTypeRaw;
        const planCfg = PLAN_CONFIG[normalizedType];
        if (!planCfg) {
          console.error(`[stripe-webhook] No plan config for "${normalizedType}"`);
          break;
        }

        const creditsToAdd = Number.parseInt(creditsRaw || "0", 10);
        if (!Number.isFinite(creditsToAdd) || creditsToAdd < 0 || creditsToAdd > 10_000) {
          console.error(`[stripe-webhook] Invalid credits_to_add "${creditsRaw}"`);
          break;
        }

        if (session.customer) {
          await supabase
            .from("profiles")
            .update({
              stripe_customer_id: session.customer as string,
              payment_failed: false,
            })
            .eq("id", userId);
        }

        await supabase
          .from("profiles")
          .update({
            plan: normalizedType,
            revision_limit: planCfg.revisionLimit,
            payment_failed: false,
          })
          .eq("id", userId);

        // add_credits handles idempotency (unique index on stripe_payment_id).
        // For unlimited we still call it with amount=0 to log the purchase.
        if (normalizedType === "unlimited" || creditsToAdd > 0) {
          const amount = normalizedType === "unlimited" ? 0 : creditsToAdd;
          if (amount > 0) {
            const { error: creditErr } = await supabase.rpc("add_credits", {
              p_user_id: userId,
              p_amount: amount,
              p_stripe_id: idempotencyKey,
              p_plan: normalizedType,
            });
            if (creditErr) {
              console.error("[stripe-webhook] add_credits error:", creditErr);
              throw creditErr;
            }
          } else {
            // Record unlimited purchase idempotently without crediting (credits irrelevant).
            const { data: existing } = await supabase
              .from("credit_transactions")
              .select("id")
              .eq("stripe_payment_id", idempotencyKey)
              .maybeSingle();
            if (!existing) {
              await supabase.from("credit_transactions").insert({
                user_id: userId,
                amount: 0,
                type: "purchase",
                description: `Purchased ${normalizedType} plan`,
                stripe_payment_id: idempotencyKey,
              });
            }
          }
        }

        console.log(
          `[stripe-webhook] Processed ${normalizedType} for ${userId} (+${creditsToAdd} credits)`,
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        if (!customerId || !subscription.id) break;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, plan")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profile) {
          if (profile.plan === "unlimited") {
            await supabase
              .from("profiles")
              .update({ plan: "free", revision_limit: 2 })
              .eq("id", profile.id);
          }

          // Idempotent cancellation log — check-then-insert.
          const { data: existingCancel } = await supabase
            .from("credit_transactions")
            .select("id")
            .eq("stripe_payment_id", subscription.id)
            .maybeSingle();
          if (!existingCancel) {
            await supabase.from("credit_transactions").insert({
              user_id: profile.id,
              amount: 0,
              type: "subscription_cancelled",
              description: "Subscription cancelled — downgraded to free plan",
              stripe_payment_id: subscription.id,
            });
          }

          console.log(`[stripe-webhook] Subscription cancelled for ${profile.id}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;
        console.error(
          `[stripe-webhook] Payment failed customer=${customerId} invoice=${invoice.id}`,
        );

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ payment_failed: true })
            .eq("id", profile.id);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    // Transient failure — return 500 so Stripe retries. All ops above are
    // idempotent (add_credits, upserts keyed on stripe_payment_id, plan
    // updates), so a retry is safe.
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err);
    return new Response("Webhook handler error (retryable)", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
