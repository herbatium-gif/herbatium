const express = require("express");
const prisma = require("../db");
const stripe = require("../stripe");
const { requireAuth } = require("../auth");

const router = express.Router();

// Pornește plata: creează o sesiune Stripe Checkout pentru abonamentul lunar
// și întoarce URL-ul către care browser-ul utilizatorului trebuie redirecționat.
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.APP_URL}/app.html?checkout=success`,
      cancel_url: `${process.env.APP_URL}/abonament.html?checkout=cancel`,
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
      },
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "checkout_failed" });
  }
});

// Portalul Stripe — de acolo utilizatorul își poate schimba cardul, anula sau
// vedea facturile. Reînnoirea lunară automată e gestionată integral de Stripe;
// noi doar reflectăm starea prin webhook (mai jos).
router.post("/portal", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: "no_stripe_customer" });
    }
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.APP_URL}/app.html`,
    });
    res.json({ url: portalSession.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "portal_failed" });
  }
});

// Preț public (fără autentificare) — folosit pe pagina de abonament, ca să nu fie hardcodat în HTML.
router.get("/price", async (req, res) => {
  try {
    const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
    res.json({
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring && price.recurring.interval,
    });
  } catch (e) {
    res.status(500).json({ error: "price_unavailable" });
  }
});

router.get("/status", requireAuth, (req, res) => {
  const u = req.user;
  const active =
    u.subscriptionStatus === "active" &&
    (!u.currentPeriodEnd || new Date(u.currentPeriodEnd).getTime() > Date.now());
  res.json({
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd,
    subscriptionActive: active,
  });
});

// Webhook Stripe — AICI se reflectă plata inițială și fiecare reînnoire automată
// lunară. Trebuie înregistrat în Stripe Dashboard > Developers > Webhooks, cu
// URL-ul public: https://domeniul-tau.ro/api/billing/webhook
// IMPORTANT: ruta asta primește body RAW (nesparsat ca JSON) — vezi src/index.js.
async function webhookHandler(req, res) {
  let event;
  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature invalid:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata && session.metadata.userId;
        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await prisma.user.update({
            where: { id: userId },
            data: {
              stripeCustomerId: session.customer,
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status, // de regulă "active"
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });
        }
        break;
      }

      // Se declanșează la PLATA INIȚIALĂ și la FIECARE reînnoire lunară automată.
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const userId = subscription.metadata && subscription.metadata.userId;
          if (userId) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                subscriptionStatus: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              },
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const userId = subscription.metadata && subscription.metadata.userId;
          if (userId) {
            await prisma.user.update({
              where: { id: userId },
              data: { subscriptionStatus: "past_due" },
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata && subscription.metadata.userId;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionStatus: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata && subscription.metadata.userId;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { subscriptionStatus: "canceled" },
          });
        }
        break;
      }

      default:
        break; // ignorăm restul evenimentelor
    }
    res.json({ received: true });
  } catch (e) {
    console.error("Eroare la procesarea webhook-ului:", e);
    res.status(500).send("webhook_processing_failed");
  }
}

module.exports = { router, webhookHandler };
