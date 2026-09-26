// src/netopia.js
//
// ATENȚIE — cod de REZERVĂ, NEFOLOSIT ÎN APLICAȚIE ACUM.
// Aplicația live folosește Stripe (src/stripe.js, src/routes/billing.js).
// Acest fișier NU e cerut (require) din index.js și nicio rută nu îl expune.
// Există doar pentru cazul în care se decide vreodată trecerea la NETOPIA.
//
// ============================================================================
// MODEL DE PLATĂ: LUNARĂ MANUALĂ, NU ABONAMENT AUTOMAT
// ============================================================================
// Verificat 2026-09-26 în documentația publică NETOPIA (doc.netopia-payments.com,
// API v2.x) și în SDK-ul neoficial "netopia-card" de pe npm: NU există un
// mecanism documentat public prin care un card, o dată introdus, să fie
// retaxat automat lună de lună fără interacțiunea clientului (spre deosebire
// de Stripe Billing, care face asta nativ).
//
// De aceea, acest client implementează un flux de PLATĂ LUNARĂ MANUALĂ:
//   1. Clientul apasă "Plătește" -> primește un link către pagina găzduită Netopia.
//   2. Plătește cu cardul, o singură dată.
//   3. La confirmare (notificare IPN), extindem accesul cu 30 de zile.
//   4. Cu câteva zile înainte de expirare, îi trimitem un nou link de plată
//      pe email (extensie posibilă a src/notify.js — vezi funcția
//      buildRenewalReminderText() de mai jos).
// NU există card salvat, NU există reîncercare automată a taxării.
//
// ============================================================================
// *** DE CONFIRMAT ÎNAINTE DE PRODUCȚIE *** (marcat și inline mai jos)
// ============================================================================
// Documentația publică nu specifică explicit:
//   (a) numele exact al header-ului HTTP pentru API key (spune doar
//       "pass the API KEY in the HTTP Headers", fără nume de header);
//   (b) algoritmul exact de semnare/verificare a notificării IPN pentru
//       API v2 (JSON) — variantele vechi (mobilPay XML) foloseau criptare
//       cu cheie publică RSA, dar v2 poate folosi altceva.
// Confirmă ambele DIRECT din contul tău de merchant NETOPIA (Admin > Security >
// Documentație API) sau cu suportul lor tehnic, și testează exhaustiv în
// sandbox (https://sandbox.netopia-payments.com) înainte de a proceda cu bani
// reali. Fără această confirmare, verifyNotification() de mai jos NU trebuie
// considerată sigură — implementarea din acest fișier e un punct de plecare,
// nu un cod gata de producție.
// ============================================================================

const axios = require("axios");
const crypto = require("crypto");

const isSandbox = String(process.env.NETOPIA_SANDBOX || "true") === "true";

// Confirmat din documentația oficială (doc.netopia-payments.com/docs/payment-api/v2.x/start/start-strc):
const BASE_URL = isSandbox
  ? "https://secure.sandbox.netopia-payments.com"
  : "https://secure.mobilpay.ro";
const START_PAYMENT_PATH = "/payment/card/start"; // varianta sandbox; verifică dacă live diferă la activare

if (!process.env.NETOPIA_API_KEY) {
  console.warn("[netopia] NETOPIA_API_KEY lipsește din .env — plățile Netopia nu vor funcționa.");
}
if (!process.env.NETOPIA_POS_SIGNATURE) {
  console.warn(
    "[netopia] NETOPIA_POS_SIGNATURE lipsește din .env (semnătura punctului de vânzare, din Admin > Security)."
  );
}

/**
 * Pornește o plată unică (nu abonament) în valoare de `amountRon` RON.
 * Întoarce { paymentUrl } — clientul trebuie redirecționat acolo (302 sau
 * window.location.href, ca la Stripe Checkout).
 *
 * @param {Object} p
 * @param {string} p.orderId     - ID unic al comenzii (ex: `${userId}-${Date.now()}`)
 * @param {number} p.amountRon   - sumă în RON, ex: 130
 * @param {string} p.description - ex: "Abonament Herbatium — reînnoire lunară"
 * @param {string} p.notifyUrl   - URL public unde Netopia trimite confirmarea (IPN)
 * @param {string} p.returnUrl   - URL unde revine clientul după plată
 * @param {Object} p.billing     - { email, phone, firstName, lastName, city, country, county, postalCode, address }
 * @param {string} [p.paymentCode] - codul stabil de plată al clientului (User.paymentCode,
 *   vezi src/routes/billing.js ensurePaymentCode) — ACELAȘI cod folosit și la Stripe și
 *   la transferul bancar, ca să identifici fără ambiguitate cine a plătit, indiferent de
 *   metodă. Îl băgăm în descriere/produs (vizibil în panoul Netopia) și în orderID, ca
 *   să apară automat lângă plată, fără să depinzi de nume/email introdus de client.
 */
async function startPayment({ orderId, amountRon, description, notifyUrl, returnUrl, billing, paymentCode }) {
  const fullDescription = paymentCode ? `${description} [${paymentCode}]` : description;
  // Codul e inclus și în orderID (dacă e furnizat) — util ca a doua sursă de adevăr
  // dacă vreodată descrierea/produsul nu se afișează integral în panoul Netopia.
  const fullOrderId = paymentCode ? `${orderId}-${paymentCode}` : orderId;
  // Structura confirmată din documentația publică (câmpuri obligatorii:
  // config, payment, order cu billing/shipping). "shipping" e cerut de schema
  // publicată chiar și pentru un serviciu digital fără livrare fizică — dacă
  // API-ul respinge cu "shipping required", trimite aceleași date ca la billing.
  const payload = {
    config: {
      emailTemplate: "",
      notifyUrl,
      redirectUrl: returnUrl,
      language: "ro",
    },
    payment: {
      options: { installments: 1, bonus: 0 },
      instrument: { type: "card" },
      data: {},
    },
    order: {
      posSignature: process.env.NETOPIA_POS_SIGNATURE,
      dateTime: new Date().toISOString(),
      description: fullDescription,
      orderID: fullOrderId,
      amount: amountRon,
      currency: "RON",
      billing: {
        email: billing.email,
        phone: billing.phone || "0700000000",
        firstName: billing.firstName || "Client",
        lastName: billing.lastName || "Herbatium",
        city: billing.city || "Bucuresti",
        country: 642, // România — cod numeric ISO 3166-1, cerut de schema Netopia
        state: billing.county || "Bucuresti",
        postalCode: billing.postalCode || "000000",
        details: billing.address || "-",
      },
      shipping: {
        email: billing.email,
        phone: billing.phone || "0700000000",
        firstName: billing.firstName || "Client",
        lastName: billing.lastName || "Herbatium",
        city: billing.city || "Bucuresti",
        country: 642,
        state: billing.county || "Bucuresti",
        postalCode: billing.postalCode || "000000",
        details: billing.address || "-",
      },
      products: [{ name: fullDescription, code: "abonament-lunar", category: "servicii", price: amountRon, vat: 19 }],
      installments: { selected: 1, available: [1] },
      data: {},
    },
  };

  // *** DE CONFIRMAT ***: numele exact al header-ului. "Authorization: Bearer"
  // e presupunerea cea mai probabilă (uzuală pentru API-uri REST NETOPIA
  // documentate ca "JSON endpoints secured with API tokens"), dar confirmă
  // din Admin > Security înainte să te bazezi pe asta.
  const res = await axios.post(`${BASE_URL}${START_PAYMENT_PATH}`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NETOPIA_API_KEY}`,
    },
  });

  // Răspunsul conține de regulă fie un URL de redirecționare (payment.paymentURL
  // sau customerAction.url pentru 3DSecure), fie un status de eroare — verifică
  // forma exactă în sandbox, poate diferi ușor față de ce e presupus aici.
  const paymentUrl =
    res.data?.payment?.paymentURL || res.data?.customerAction?.url || res.data?.redirectUrl || null;

  if (!paymentUrl) {
    console.error("[netopia] Răspuns neașteptat la startPayment:", JSON.stringify(res.data));
    throw new Error("netopia_no_redirect_url");
  }

  return { paymentUrl, raw: res.data };
}

/**
 * Verifică autenticitatea unei notificări IPN primite de la Netopia.
 *
 * *** DE CONFIRMAT ***: NU implementa în producție fără să confirmi algoritmul
 * exact cu documentația din contul tău de merchant. Implementarea de mai jos
 * e un PLACEHOLDER care presupune un HMAC-SHA256 pe corpul brut, cu
 * NETOPIA_API_KEY ca secret — un model comun pentru webhook-uri REST, dar
 * NECONFIRMAT explicit pentru Netopia v2 în documentația publică consultată.
 * Dacă verificarea reală e diferită (ex: semnătură RSA cu cheia publică a
 * Netopia, ca la vechiul mobilPay), acest cod trebuie înlocuit înainte de
 * folosire — altfel oricine ar putea trimite o notificare falsă de "plată
 * reușită" către endpoint-ul tău de notify.
 *
 * @param {Buffer|string} rawBody - corpul brut al request-ului (nu JSON parsat)
 * @param {string} signatureHeader - valoarea header-ului de semnătură primit
 * @returns {boolean}
 */
function verifyNotification(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha256", process.env.NETOPIA_API_KEY || "")
    .update(rawBody)
    .digest("hex");
  // Comparație în timp constant, ca să nu scurgem informație prin timing.
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // lungimi diferite = sigur nepotrivit
  }
}

/**
 * Text simplu pentru un email de reamintire de plată lunară — de folosit ca
 * extensie a src/notify.js dacă se trece vreodată pe acest flux. Nu e cerut
 * (require) de nicăieri momentan.
 */
function buildRenewalReminderText(user, paymentUrl) {
  return (
    `Bună,\n\nAbonamentul tău Herbatium expiră în curând. ` +
    `Ca să continui să ai acces, plătește aici: ${paymentUrl}\n\n` +
    `Dacă nu reînnoiești, accesul se va suspenda automat la data expirării.\n\nEchipa Herbatium`
  );
}

module.exports = { startPayment, verifyNotification, buildRenewalReminderText };
