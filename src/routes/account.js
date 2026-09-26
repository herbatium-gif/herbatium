const express = require("express");
const fs = require("fs");
const path = require("path");
const prisma = require("../db");
const stripe = require("../stripe");
const { requireAuth, verifyPassword, clearAuthCookie, effectiveDataOwnerId } = require("../auth");
const { eraseIntroPriceHistoryFor } = require("./billing");

const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    createdAt: u.createdAt,
    esteMembruDeEchipa: !!u.teamOwnerId,
    paginaPublica: u.publicPageEnabled
      ? {
          slug: u.slug,
          businessName: u.businessName,
          bio: u.bio,
        }
      : null,
    abonament: {
      status: u.subscriptionStatus,
      valabilPanaLa: u.currentPeriodEnd,
    },
  };
}

// Art. 15 și 20 GDPR: dreptul de acces și de portabilitate a datelor —
// tot ce ține de acest cont, într-un fișier JSON descărcabil.
router.get("/export", requireAuth, async (req, res) => {
  const u = req.user;
  const ownerId = effectiveDataOwnerId(u);
  const data = await prisma.userData.findUnique({ where: { userId: ownerId } });

  const teamMembers = !u.teamOwnerId
    ? await prisma.user.findMany({
        where: { teamOwnerId: u.id },
        select: { id: true, email: true, createdAt: true },
      })
    : [];

  const out = {
    generat_la: new Date().toISOString(),
    operator: "Herbatium",
    cont: publicUser(u),
    consimtamant: {
      termeni_versiune: u.termsVersion,
      termeni_acceptati_la: u.termsAcceptedAt,
      marketing: !!u.marketingConsent,
    },
    echipa: u.teamOwnerId
      ? { rol: "membru", cont_principal_id: u.teamOwnerId }
      : { rol: "principal", membri: teamMembers },
    // Notă: dacă acest cont e membru de echipă, datele de mai jos aparțin
    // contului principal și sunt partajate — nu sunt date separate ale
    // membrului.
    date_aplicatie: data
      ? {
          apartin_contului: ownerId,
          recipes: data.recipes,
          batches: data.batches,
          customIngredients: data.customIngredients,
          products: data.products,
          ingredientPrices: data.ingredientPrices,
          stock: data.stock,
          costState: data.costState,
          sales: data.sales,
          lyeState: data.lyeState,
          actualizat_la: data.updatedAt,
        }
      : null,
  };

  res.setHeader("Content-Disposition", `attachment; filename="herbatium-date-${u.id}.json"`);
  res.json(out);
});

// Art. 7 alin. (3) GDPR: retragerea consimțământului trebuie să fie la fel de
// ușoară ca acordarea lui — o simplă bifă, fără parolă sau confirmare suplimentară.
router.patch("/marketing", requireAuth, async (req, res) => {
  const marketing = !!(req.body || {}).marketing;
  await prisma.user.update({ where: { id: req.user.id }, data: { marketingConsent: marketing } });
  res.json({ ok: true, marketingConsent: marketing });
});

// Art. 17 GDPR: dreptul la ștergere ("dreptul de a fi uitat").
// Necesită parola curentă, ca o simplă sesiune activă (ex. calculator public
// uitat deschis) să nu poată șterge contul fără reconfirmare.
router.delete("/", requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const u = req.user;

  if (typeof password !== "string" || !password) {
    return res.status(400).json({ error: "password_required" });
  }
  const ok = await verifyPassword(password, u.passwordHash);
  if (!ok) {
    return res.status(400).json({ error: "wrong_password" });
  }

  // Un cont principal cu membri de echipă activi nu poate fi șters direct —
  // ștergerea lui ar lăsa membrii fără acces la datele partajate, pe
  // neanunțate. Trebuie mai întâi scoși din echipă (din pagina de Echipă).
  if (!u.teamOwnerId) {
    const teamMembers = await prisma.user.findMany({ where: { teamOwnerId: u.id } });
    if (teamMembers.length > 0) {
      return res.status(409).json({
        error: "team_members_exist",
        message:
          "Contul are membri de echipă activi. Scoate-i din echipă înainte de a șterge contul principal.",
        membri: teamMembers.map((m) => m.email),
      });
    }
  }

  // Anulează abonamentul Stripe activ, dacă există (contul principal poate avea unul).
  if (u.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(u.stripeSubscriptionId);
    } catch (e) {
      console.error("Nu am putut anula abonamentul Stripe la ștergerea contului:", e.message);
      // continuăm oricum — ștergerea contului nu trebuie blocată de o eroare Stripe
    }
  }

  // Feedback-ul trimis de acest utilizator rămâne (util pentru dezvoltarea
  // aplicației), dar se anonimizează — vezi și src/retention.js pentru
  // aceeași logică, aplicată acolo la ștergerea automată.
  await prisma.feedback.updateMany({
    where: { userId: u.id },
    data: { userId: null, email: "(cont șters)" },
  });

  // UserData e legat cu onDelete: Cascade — se șterge automat odată cu User.
  await prisma.user.delete({ where: { id: u.id } });

  // Aceasta e o exercitare ACTIVĂ a dreptului la ștergere (persoana a apăsat
  // explicit "Șterge contul" și și-a confirmat parola) — spre deosebire de
  // ștergerea automată după 30 de zile de inactivitate (src/retention.js),
  // unde persoana nu a cerut nimic. Într-o cerere activă, interesul legitim
  // de a preveni reutilizarea prețului introductiv NU justifică păstrarea
  // datelor peste voința ei explicită (Art. 17/21 GDPR) — vezi Politica de
  // confidențialitate, secțiunea 3. Ștergem deci și evidența de rezervă
  // (CUI/e-mail), nu doar contul. Efect practic: dacă această persoană
  // revine vreodată cu un cont nou, VA fi din nou eligibilă pentru prețul
  // introductiv — o acceptăm ca preț corect al respectării cererii ei.
  await eraseIntroPriceHistoryFor({ cui: u.cui, email: u.email });

  // Curăță pozele încărcate de acest cont (doar dacă era cont principal —
  // un membru de echipă nu are folder propriu, vezi photos.js).
  if (!u.teamOwnerId) {
    const dir = path.join(UPLOAD_ROOT, u.id);
    fs.rm(dir, { recursive: true, force: true }, () => {});
  }

  clearAuthCookie(res);
  res.json({ ok: true });
});

module.exports = router;
