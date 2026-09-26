// src/routes/billing-netopia.js
//
// ATENȚIE — cod de REZERVĂ, NEFOLOSIT ÎN APLICAȚIE ACUM.
// Nu e cerut (require) din src/index.js — nicio rută de aici nu e activă pe
// server. Pregătit doar pentru cazul în care se decide vreodată trecerea de
// la Stripe la NETOPIA. Vezi capul de fișier din src/netopia.js pentru toate
// avertismentele ("DE CONFIRMAT") înainte de a activa oricare din aceste rute.
//
// Ca să devină activ (NU face asta fără să confirmi punctele din netopia.js):
//   1. în src/index.js: const { router: netopiaBillingRouter } = require("./routes/billing-netopia");
//      app.use("/api/billing-netopia", netopiaBillingRouter);
//      (folosește un prefix DIFERIT de /api/billing ca să nu intri în conflict cu Stripe)
//   2. adaugă în schema Prisma (User) câmpurile de mai jos, dacă nu există:
//        netopiaCurrentPeriodEnd  DateTime?
//        netopiaLastOrderId       String?
//      apoi `npx prisma migrate dev` / `npx prisma generate`.
//   3. setează în .env: NETOPIA_API_KEY, NETOPIA_POS_SIGNATURE, NETOPIA_SANDBOX,
//      APP_URL (deja existent, refolosit pentru notify/return URL).

const express = require("express");
const prisma = require("../db");
const { requireAuth } = require("../auth");
const netopia = require("../netopia");

const router = express.Router();

const SUBSCRIPTION_PRICE_RON = 130;
const RENEWAL_PERIOD_DAYS = 30;

// Aceeași schemă de generare ca în src/routes/billing.js (ensurePaymentCode) —
// codul e stabil pe cont și PARTAJAT între toate metodele de plată (Stripe,
// transfer bancar, Netopia), ca să identifici clientul fără ambiguitate
// indiferent cum plătește. Dacă userul are deja un cod (generat la Stripe sau
// la declararea unui transfer bancar), îl refolosim — nu generăm unul nou.
const PAYMENT_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // fără 0/O, 1/I/L
function generatePaymentCode() {
  let code = "HRB-";
  for (let i = 0; i < 6; i++) {
    code += PAYMENT_CODE_CHARS[Math.floor(Math.random() * PAYMENT_CODE_CHARS.length)];
  }
  return code;
}
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
      if (e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("payment_code_generation_failed");
}

// Pornește o plată lunară manuală (NU un abonament automat — vezi netopia.js).
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const orderId = `herbatium-${user.id}-${Date.now()}`;
    const paymentCode = await ensurePaymentCode(user);

    const { paymentUrl } = await netopia.startPayment({
      orderId,
      amountRon: SUBSCRIPTION_PRICE_RON,
      description: "Abonament Herbatium — o lună de acces",
      notifyUrl: `${process.env.APP_URL}/api/billing-netopia/notify`,
      returnUrl: `${process.env.APP_URL}/app.html?checkout=netopia-pending`,
      billing: {
        email: user.email,
        // Restul câmpurilor de facturare (nume, telefon, adresă) ar trebui
        // colectate o singură dată la înregistrare/profil, dacă se trece pe
        // acest flux — Netopia le cere obligatoriu la fiecare plată.
      },
      paymentCode, // apare în descriere/produs/orderID Netopia — vezi netopia.js
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { netopiaLastOrderId: orderId }, // necesită câmpul în schema Prisma, vezi antetul fișierului
    });

    res.json({ url: paymentUrl });
  } catch (e) {
    console.error("[netopia] checkout eșuat:", e.message);
    res.status(500).json({ error: "checkout_failed" });
  }
});

// Notificare IPN — Netopia confirmă aici rezultatul plății.
// IMPORTANT: ruta asta trebuie montată cu body RAW (nu JSON parsat automat),
// exact ca /api/billing/webhook de la Stripe — vezi cum e făcut acolo în
// src/index.js, ca model.
async function notifyHandler(req, res) {
  const signatureHeader = req.headers["x-netopia-signature"] || req.headers["ipn-signature"]; // *** DE CONFIRMAT: numele real al header-ului ***

  const isValid = netopia.verifyNotification(req.body, signatureHeader);
  if (!isValid) {
    console.error("[netopia] Notificare IPN cu semnătură invalidă — respinsă.");
    return res.status(400).send("invalid_signature");
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch (e) {
    return res.status(400).send("invalid_json");
  }

  // *** DE CONFIRMAT ***: numele exact al câmpurilor din payload-ul real de
  // notificare (order.orderID, payment.status etc.) — structura de mai jos e
  // o presupunere rezonabilă bazată pe structura de request, dar trebuie
  // verificată cu un payload real din sandbox înainte de a te baza pe ea.
  const orderId = payload.order?.orderID;
  const paymentStatus = payload.payment?.status; // ex: "confirmed" / "paid" / "canceled" — DE CONFIRMAT

  if (!orderId) {
    console.error("[netopia] Notificare fără orderID:", JSON.stringify(payload));
    return res.status(400).send("missing_order_id");
  }

  const isPaid = paymentStatus === "confirmed" || paymentStatus === "paid" || paymentStatus === 3; // 3 = cod folosit istoric de mobilPay pentru "confirmed"

  if (isPaid) {
    const user = await prisma.user.findFirst({ where: { netopiaLastOrderId: orderId } });
    if (user) {
      const now = new Date();
      // Dacă mai are timp neexpirat, extinde de la data expirării curente
      // (nu de la azi) — ca să nu piardă zile plătite dacă plătește devreme.
      const base =
        user.netopiaCurrentPeriodEnd && new Date(user.netopiaCurrentPeriodEnd) > now
          ? new Date(user.netopiaCurrentPeriodEnd)
          : now;
      const newPeriodEnd = new Date(base.getTime() + RENEWAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          netopiaCurrentPeriodEnd: newPeriodEnd,
          subscriptionStatus: "active", // reutilizează același câmp ca la Stripe, ca restul aplicației (isSubscriptionActive) să funcționeze neschimbat
          currentPeriodEnd: newPeriodEnd,
        },
      });
    } else {
      console.error("[netopia] Notificare de plată pentru un orderID necunoscut:", orderId);
    }
  }

  // Netopia așteaptă de regulă un răspuns simplu de confirmare primire —
  // *** DE CONFIRMAT *** formatul exact așteptat (poate fi un XML specific
  // la versiunile vechi; la v2 probabil un simplu 200 OK e suficient).
  res.status(200).send("OK");
}

router.get("/status", requireAuth, (req, res) => {
  const u = req.user;
  const active = u.subscriptionStatus === "active" && (!u.netopiaCurrentPeriodEnd || new Date(u.netopiaCurrentPeriodEnd) > new Date());
  res.json({
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.netopiaCurrentPeriodEnd,
    subscriptionActive: active,
  });
});

module.exports = { router, notifyHandler };
