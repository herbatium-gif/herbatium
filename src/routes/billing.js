const express = require("express");
const prisma = require("../db");
const stripe = require("../stripe");
const { requireAuth, isSubscriptionActive } = require("../auth");
const { sendCancellationRetentionNotice } = require("../retention");

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

    const sessionParams = {
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.APP_URL}/app.html?checkout=success`,
      cancel_url: `${process.env.APP_URL}/abonament.html?checkout=cancel`,
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
      },
    };

    // Preț introductiv opțional (prima lună la 99 lei, apoi prețul normal) —
    // configurat ca un STRIPE PROMOTION CODE (nu un Cupon simplu), cu
    // restricția "First time customer" bifată în Stripe. ID-ul lui se pune
    // în STRIPE_INTRO_PROMO_CODE_ID. Diferența față de un cupon simplu:
    // Stripe însuși verifică dacă acest client (după contul Stripe Customer)
    // a mai avut vreodată un abonament plătit — dacă da, respinge codul, ca
    // să nu poată cineva să anuleze și să se reaboneze la nesfârșit doar ca
    // să tot prindă luna ieftină. Dacă restricția respinge cererea (sau orice
    // altă eroare legată de cod), continuăm automat la checkout FĂRĂ discount,
    // la prețul normal — clientul tot se poate abona, doar fără promoție.
    // (Limită per Stripe Customer, atenuată la nivel de cont: înregistrarea
    // unui cont nou cere acum CUI-ul firmei/PFA, validat și UNIC în baza de
    // date — vezi routes/auth.js. O firmă nu poate deschide un al doilea
    // cont doar cu un alt e-mail, deci nu poate ajunge la un al doilea
    // client Stripe "nou" pentru aceeași firmă. Rămâne teoretic posibil ca
    // cineva să înființeze o firmă/PFA nouă, cu CUI nou, ca să prindă din
    // nou promoția — dar asta are un cost și un efort real, nu doar un
    // e-mail nou, așa că riscul practic e mult redus.)
    if (process.env.STRIPE_INTRO_PROMO_CODE_ID) {
      try {
        const session = await stripe.checkout.sessions.create({
          ...sessionParams,
          discounts: [{ promotion_code: process.env.STRIPE_INTRO_PROMO_CODE_ID }],
        });
        return res.json({ url: session.url });
      } catch (e) {
        console.warn(
          "Codul de promoție introductivă nu s-a putut aplica (probabil clientul nu mai e eligibil, a mai avut abonament) — continuăm la prețul normal:",
          e.message
        );
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
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
    const result = {
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring && price.recurring.interval,
    };
    // Dacă e configurat un cod de promoție introductivă, îl expunem pe
    // pagina de abonament (ex: "prima lună: 99 lei, apoi 170 lei/lună").
    // Afișăm mereu oferta aici, indiferent dacă UN client anume mai e
    // eligibil pentru ea — eligibilitatea reală se verifică abia la
    // checkout (mai sus); dacă nu mai e eligibil, plătește direct prețul
    // normal, fără să vadă o eroare.
    if (process.env.STRIPE_INTRO_PROMO_CODE_ID) {
      try {
        const promo = await stripe.promotionCodes.retrieve(process.env.STRIPE_INTRO_PROMO_CODE_ID);
        const coupon = promo.coupon;
        result.intro = {
          amountOff: coupon.amount_off, // în bani, ca și `amount`
          percentOff: coupon.percent_off,
          durationInMonths: coupon.duration_in_months,
        };
      } catch (e) {
        // codul de promoție nu (mai) există — ignorăm, afișăm doar prețul normal
      }
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "price_unavailable" });
  }
});

router.get("/status", requireAuth, (req, res) => {
  const u = req.user;
  const active = isSubscriptionActive(u);
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
              canceledAt: null, // abonare nouă sau reabonare — anulează ceasul de retenție/ștergere
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
                canceledAt: null, // plată reușită (inițială sau reînnoire) — nu e un cont anulat
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
              // dacă statusul redevine activ (reactivare din Portalul Stripe),
              // anulăm ceasul de retenție/ștergere; altfel îl lăsăm neatins.
              ...(subscription.status === "active" ? { canceledAt: null } : {}),
            },
          });
        }
        break;
      }

      // Abonamentul s-a încheiat definitiv în Stripe (anulare confirmată, nu
      // doar programată). De aici pornește ceasul de retenție: RETENTION_DAYS
      // zile (vezi src/retention.js) până la ștergerea definitivă și automată
      // a contului, dacă nu se reabonează. Trimitem imediat un e-mail de
      // avertizare, cu data exactă a ștergerii.
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata && subscription.metadata.userId;
        if (userId) {
          const updated = await prisma.user.update({
            where: { id: userId },
            data: { subscriptionStatus: "canceled", canceledAt: new Date() },
          });
          sendCancellationRetentionNotice(updated).catch((e) =>
            console.error("Notificare retenție (anulare abonament) eșuată:", e.message)
          );
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
