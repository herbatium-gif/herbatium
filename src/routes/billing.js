const express = require("express");
const prisma = require("../db");
const stripe = require("../stripe");
const { requireAuth, isSubscriptionActive } = require("../auth");
const { sendCancellationRetentionNotice } = require("../retention");
const { sendEmail } = require("../notify");

const router = express.Router();

// Email-ul TĂU (administrator), unde primești notificare de fiecare dată când
// un client declară o plată prin transfer bancar — ca să știi să intri în
// panoul de admin și să activezi contul. Folosește ADMIN_NOTIFY_EMAIL dacă e
// setat separat, altfel cade pe ADMIN_EMAIL (același cont admin din
// src/seedAdmin.js) — deci în multe cazuri nu trebuie să adaugi nimic nou în
// .env, funcționează direct cu ce ai deja configurat.
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;

// Trimite notificarea de "plată declarată" către admin — best-effort: dacă
// trimiterea eșuează (sau RESEND_API_KEY nu e setat), doar loghează eroarea,
// nu blochează răspunsul către client (clientul tot vede codul/suma generate).
async function notifyAdminOfDeclaredPayment(user, { months, amountRon, code }) {
  if (!ADMIN_NOTIFY_EMAIL) {
    console.warn(
      "[billing] Niciun ADMIN_NOTIFY_EMAIL/ADMIN_EMAIL setat — nu pot trimite notificarea de plată declarată."
    );
    return;
  }
  const html = `
    <h2 style="font-family:sans-serif">Plată declarată — transfer bancar</h2>
    <p style="font-family:sans-serif;font-size:15px;line-height:1.6">
      Un client a declarat că plătește prin transfer bancar. Verifică extrasul de cont pentru suma și codul de mai jos, apoi activează-i contul din panoul de admin.
    </p>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;margin-top:8px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Client:</td><td style="font-weight:600">${user.email}</td></tr>
      ${user.businessName ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Firmă:</td><td>${user.businessName}</td></tr>` : ""}
      ${user.cui ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">CUI:</td><td>${user.cui}</td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Luni declarate:</td><td>${months} ${months === 1 ? "lună" : "luni"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Sumă așteptată:</td><td style="font-weight:600">${amountRon} RON</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Cod de verificare:</td><td style="font-family:monospace;font-weight:700;font-size:16px">${code}</td></tr>
    </table>
    <p style="font-family:sans-serif;color:#888;font-size:12px;margin-top:16px">
      Notificare automată Herbatium — trimisă la fiecare declarare/modificare a duratei alese de un client pe pagina de abonament.
    </p>
  `;
  const r = await sendEmail(ADMIN_NOTIFY_EMAIL, `Plată declarată: ${user.email} — cod ${code}`, html);
  if (!r.ok && !r.skipped) {
    console.error("[billing] Notificarea de plată declarată nu a putut fi trimisă către admin.");
  }
}

// ============================================================================
// COD DE PLATĂ — identificator unic per client, valabil pentru orice metodă
// de plată (transfer bancar acum; Stripe/Netopia includ acest cod în
// metadata/descriere, dacă sunt reactivate — vezi mai jos la /checkout).
// Scop: elimini ambiguitatea „ce nume/email a scris clientul pe transfer" —
// codul e generat de aplicație, stabil, și nu se poate confunda cu numele
// firmei, alt email, sau titularul real al contului bancar.
// ============================================================================
const PAYMENT_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // fără 0/O, 1/I/L — evită confuzia la citire/scriere manuală

function generatePaymentCode() {
  let code = "HRB-";
  for (let i = 0; i < 6; i++) {
    code += PAYMENT_CODE_CHARS[Math.floor(Math.random() * PAYMENT_CODE_CHARS.length)];
  }
  return code;
}

// Generează și salvează un cod de plată pentru user, dacă nu are deja unul.
// Reîncearcă la coliziune (extrem de improbabilă, dar codul e scurt) — eroare
// Prisma P2002 = unique constraint violation.
async function ensurePaymentCode(user) {
  if (user.paymentCode) return user.paymentCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { paymentCode: generatePaymentCode() },
      });
      return updated.paymentCode;
    } catch (e) {
      if (e.code === "P2002") continue; // coliziune de cod — reîncearcă cu altul
      throw e;
    }
  }
  throw new Error("payment_code_generation_failed");
}

function getMonthlyPriceRon() {
  return Number(process.env.BANK_TRANSFER_AMOUNT_RON) || 130;
}

// Pornește plata: creează o sesiune Stripe Checkout pentru abonamentul lunar
// și întoarce URL-ul către care browser-ul utilizatorului trebuie redirecționat.
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    // Cod de plată — inclus și în metadata Stripe, ca să poți identifica
    // ușor plata (căutare în Stripe Dashboard) cu ACELAȘI cod folosit la
    // transfer bancar, indiferent de metoda de plată aleasă.
    const paymentCode = await ensurePaymentCode(user);

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id, paymentCode },
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
      metadata: { userId: user.id, paymentCode },
      subscription_data: {
        metadata: { userId: user.id, paymentCode },
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

// Date pentru plata prin transfer bancar (alternativă manuală la Stripe,
// pentru cazul în care Stripe nu e încă activat live sau clientul preferă
// transfer direct). Complet publică (fără autentificare), la fel ca /price,
// fiindcă e afișată pe pagina de abonament înainte de login. IBAN-ul NU e
// scris în cod — vine din variabila de mediu BANK_TRANSFER_IBAN, setată în
// Railway direct de tine (nu de Claude — e dată bancară).
router.get("/bank-transfer-info", async (req, res) => {
  if (!process.env.BANK_TRANSFER_IBAN) {
    return res.status(404).json({ error: "not_configured" });
  }
  res.json({
    iban: process.env.BANK_TRANSFER_IBAN,
    holder: process.env.BANK_TRANSFER_HOLDER || "NICOALE SILVIA PERSOANĂ FIZICĂ AUTORIZATĂ",
    bankName: process.env.BANK_TRANSFER_BANK_NAME || "",
    amountRon: getMonthlyPriceRon(),
  });
});

// "Declară" intenția de plată prin transfer bancar: clientul alege pentru
// câte luni vrea să plătească, iar noi (1) îi asigurăm un cod de plată
// stabil (îl generăm dacă nu are deja unul) și (2) reținem ce a ales, ca să
// apară în panoul de admin exact ce se așteaptă (nu doar "cineva a plătit
// ceva"). NU confirmă nicio plată reală — doar pregătește datele pentru ea.
// Apelat automat de abonament.html de fiecare dată când clientul schimbă
// selectorul de luni, ca suma și codul să se completeze fără intervenție.
router.post("/bank-transfer/declare", requireAuth, async (req, res) => {
  const months = Number((req.body || {}).months);
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    return res.status(400).json({ error: "months_invalid" });
  }
  try {
    const code = await ensurePaymentCode(req.user);
    const amountRon = months * getMonthlyPriceRon();
    await prisma.user.update({
      where: { id: req.user.id },
      data: { declaredMonths: months, declaredAmountRon: amountRon, declaredAt: new Date() },
    });
    res.json({ code, months, amountRon });
  } catch (e) {
    console.error("[billing] declarare plată prin transfer bancar eșuată:", e.message);
    res.status(500).json({ error: "declare_failed" });
  }
});

// Notificare EXPLICITĂ către admin — apelată doar când clientul apasă
// "Am făcut transferul" (nu automat la fiecare schimbare a selectorului de
// luni, ca să nu primești un email de fiecare dată când cineva doar
// deschide pagina de abonament). Necesită o declarație existentă (clientul
// trebuie să fi ales deja o durată — vezi /bank-transfer/declare).
router.post("/bank-transfer/notify-paid", requireAuth, async (req, res) => {
  const user = req.user;
  if (!user.paymentCode || !user.declaredMonths || !user.declaredAmountRon) {
    return res.status(400).json({ error: "no_declaration" });
  }
  try {
    await notifyAdminOfDeclaredPayment(user, {
      months: user.declaredMonths,
      amountRon: user.declaredAmountRon,
      code: user.paymentCode,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[billing] Notificarea explicită de plată eșuată:", e.message);
    // Nu blocăm clientul din cauza unei erori de email — el tot a "confirmat"
    // plata; doar tu ai putea afla mai târziu prin panoul de admin oricum.
    res.json({ ok: true, emailWarning: true });
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
