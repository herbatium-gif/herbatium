const express = require("express");
const prisma = require("../db");
const { requireAuth, requireActiveSubscription, effectiveDataOwnerId } = require("../auth");

const router = express.Router();

router.get("/", requireAuth, requireActiveSubscription, async (req, res) => {
  const data = await prisma.userData.findUnique({ where: { userId: effectiveDataOwnerId(req.user) } });
  res.json(
    data || {
      recipes: [],
      batches: [],
      customIngredients: [],
      products: [],
      ingredientPrices: {},
      stock: {},
      costState: {},
      sales: [],
      lyeState: {},
      pifRecords: {},
      packagingRecords: {},
      updatedAt: null,
    }
  );
});

// Blocare optimistă la salvare (art. de mai jos): clientul citește datele o
// singură dată la pornire și le ține în memorie, apoi trimite tot blob-ul
// înapoi la fiecare modificare. Fără verificare de versiune, o a doua sesiune
// deschisă în paralel (alt tab, alt dispozitiv, sau un coleg invitat în
// echipă — vezi effectiveDataOwnerId, care le face pe toate să scrie în
// același rând) ar suprascrie tăcut modificările celeilalte sesiuni, oricât
// de nelegate seria de câmpuri modificate. Clientul trimite acum
// "expectedUpdatedAt" = versiunea pe care o știa la ultima citire/salvare;
// dacă nu mai coincide cu ce e în bază, respingem cu 409 în loc să
// suprascriem — clientul afișează un avertisment vizibil în loc să piardă
// date fără să știe.
router.put("/", requireAuth, requireActiveSubscription, async (req, res) => {
  const { recipes, batches, customIngredients, products, ingredientPrices, stock, costState, sales, lyeState, pifRecords, packagingRecords, expectedUpdatedAt } =
    req.body || {};
  const ownerId = effectiveDataOwnerId(req.user);

  const existing = await prisma.userData.findUnique({ where: { userId: ownerId } });
  if (existing && expectedUpdatedAt) {
    const knownTime = new Date(expectedUpdatedAt).getTime();
    const actualTime = new Date(existing.updatedAt).getTime();
    if (Number.isFinite(knownTime) && knownTime !== actualTime) {
      return res.status(409).json({
        ok: false,
        conflict: true,
        message: "Datele au fost modificate între timp dintr-o altă sesiune sau de un coleg din echipă.",
        serverUpdatedAt: existing.updatedAt,
      });
    }
  }

  const updated = await prisma.userData.upsert({
    where: { userId: ownerId },
    update: {
      recipes: recipes ?? [],
      batches: batches ?? [],
      customIngredients: customIngredients ?? [],
      products: products ?? [],
      ingredientPrices: ingredientPrices ?? {},
      stock: stock ?? {},
      costState: costState ?? {},
      sales: sales ?? [],
      lyeState: lyeState ?? {},
      pifRecords: pifRecords ?? {},
      packagingRecords: packagingRecords ?? {},
    },
    create: {
      userId: ownerId,
      recipes: recipes ?? [],
      batches: batches ?? [],
      customIngredients: customIngredients ?? [],
      products: products ?? [],
      ingredientPrices: ingredientPrices ?? {},
      stock: stock ?? {},
      costState: costState ?? {},
      sales: sales ?? [],
      lyeState: lyeState ?? {},
      pifRecords: pifRecords ?? {},
      packagingRecords: packagingRecords ?? {},
    },
  });
  res.json({ ok: true, updatedAt: updated.updatedAt });
});

module.exports = router;
