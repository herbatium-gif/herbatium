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
    }
  );
});

router.put("/", requireAuth, requireActiveSubscription, async (req, res) => {
  const { recipes, batches, customIngredients, products, ingredientPrices, stock, costState, sales, lyeState } =
    req.body || {};
  const ownerId = effectiveDataOwnerId(req.user);
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
    },
  });
  res.json({ ok: true, updatedAt: updated.updatedAt });
});

module.exports = router;
