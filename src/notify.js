// Notificări email — rezumat zilnic cu loturi care expiră curând și materii
// prime sub pragul minim de stoc. Folosește API-ul Resend (https://resend.com)
// direct prin fetch (Node 18+ îl are nativ — nicio dependență nouă).
//
// Inactiv implicit: dacă RESEND_API_KEY nu e setat în .env, digestul zilnic
// nu trimite nimic (doar loghează un mesaj) — aplicația funcționează normal
// fără el. Vezi README, secțiunea despre notificări email, pentru configurare.
const prisma = require("./db");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_FROM = process.env.NOTIFY_FROM_EMAIL || "Herbatium <notificari@resend.dev>";

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return { skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: NOTIFY_FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Trimitere email eșuată:", res.status, text);
    }
    return { ok: res.ok };
  } catch (e) {
    console.error("Trimitere email eșuată:", e.message);
    return { ok: false };
  }
}

function daysUntil(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((d - today) / 86400000);
}
function addMonths(dateISO, months) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

// Construiește HTML-ul digestului pentru un utilizator, sau null dacă n-are nimic de raportat.
function buildDigestHtml(userData) {
  const batches = Array.isArray(userData.batches) ? userData.batches : [];
  const stock = userData.stock && typeof userData.stock === "object" ? userData.stock : {};

  const expiringSoon = [];
  for (const b of batches) {
    if (!b.shelfMonths || !b.date) continue;
    const expiry = addMonths(b.date, b.shelfMonths);
    if (!expiry) continue;
    const days = daysUntil(expiry);
    if (days >= 0 && days <= 30) expiringSoon.push({ ...b, expiry, days });
  }

  const lowStock = [];
  for (const [ingId, s] of Object.entries(stock)) {
    if (s && Number(s.minQty) > 0 && Number(s.qty || 0) < Number(s.minQty)) {
      lowStock.push({ ingId, qty: s.qty || 0, minQty: s.minQty, supplier: s.supplier || "" });
    }
  }

  if (expiringSoon.length === 0 && lowStock.length === 0) return null;

  let html = `<h2 style="font-family:sans-serif">Rezumat zilnic — Herbatium</h2>`;
  if (expiringSoon.length) {
    html += `<h3 style="font-family:sans-serif">Loturi care expiră în curând (${expiringSoon.length})</h3><ul style="font-family:sans-serif">`;
    expiringSoon.sort((a, b) => a.days - b.days).forEach((b) => {
      html += `<li>${b.recipeName || "?"} — lot ${b.code || "?"} — expiră ${b.expiry} (${b.days} zile)</li>`;
    });
    html += `</ul>`;
  }
  if (lowStock.length) {
    html += `<h3 style="font-family:sans-serif">Materii prime sub pragul minim (${lowStock.length})</h3><ul style="font-family:sans-serif">`;
    lowStock.forEach((s) => {
      html += `<li>${s.ingId} — stoc ${s.qty}${s.supplier ? ` (furnizor: ${s.supplier})` : ""} — prag minim ${s.minQty}</li>`;
    });
    html += `</ul>`;
  }
  html += `<p style="font-family:sans-serif;color:#888;font-size:12px">Trimis automat de Herbatium, o dată pe zi, doar când există ceva de raportat.</p>`;
  return html;
}

async function runDailyDigest() {
  if (!RESEND_API_KEY) {
    console.log("Notificări email dezactivate (RESEND_API_KEY nesetat) — sar peste digestul zilnic.");
    return;
  }
  // Doar conturile principale (nu membrii de echipă, care nu au propriul UserData
  // — vezi teamOwnerId în schema.prisma) primesc digestul, ca să nu se trimită
  // de mai multe ori pentru aceleași date.
  const users = await prisma.user.findMany({
    where: { subscriptionStatus: "active", teamOwnerId: null },
    include: { data: true },
  });
  for (const user of users) {
    if (!user.data) continue;
    const html = buildDigestHtml(user.data);
    if (html) {
      await sendEmail(user.email, "Rezumatul tău zilnic — loturi & stoc", html);
    }
  }
}

function scheduleDailyDigest(hourLocal) {
  const hour = typeof hourLocal === "number" ? hourLocal : 8;
  function msUntilNext() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }
  function tick() {
    runDailyDigest().catch((e) => console.error("Digest zilnic eșuat:", e.message));
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }
  setTimeout(tick, msUntilNext());
}

module.exports = { runDailyDigest, scheduleDailyDigest, buildDigestHtml, sendEmail };
