const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("./db");

const COOKIE_NAME = "formulator_token";
const TOKEN_TTL = "30d";

function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(userId) {
  return jwt.sign({ uid: userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 zile
    path: "/",
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// Middleware: cere un utilizator autentificat. Atașează req.user.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "not_authenticated" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user) return res.status(401).json({ error: "not_authenticated" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "not_authenticated" });
  }
}

function isSubscriptionActive(u) {
  return (
    u.subscriptionStatus === "active" &&
    (!u.currentPeriodEnd || new Date(u.currentPeriodEnd).getTime() > Date.now())
  );
}

// Un membru de echipă (teamOwnerId setat) n-are abonament propriu — moștenește
// accesul cât timp abonamentul contului principal ("owner") e activ.
// Contul de administrator (isAdmin) are mereu acces, indiferent de Stripe.
async function requireActiveSubscription(req, res, next) {
  const u = req.user;
  if (u.isAdmin) return next();
  let active = isSubscriptionActive(u);
  if (!active && u.teamOwnerId) {
    const owner = await prisma.user.findUnique({ where: { id: u.teamOwnerId } });
    active = !!owner && isSubscriptionActive(owner);
  }
  if (!active) {
    return res.status(402).json({ error: "subscription_required" });
  }
  next();
}

// Middleware: cere un cont de administrator (după requireAuth). Contul de
// admin e creat automat din ADMIN_EMAIL/ADMIN_PASSWORD — vezi src/seedAdmin.js.
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "admin_only" });
  }
  next();
}

// Id-ul contului ale cărui date (rețete, loturi, produse, pagina publică) se
// folosesc — al utilizatorului însuși, sau al contului principal dacă e membru
// de echipă. Toate rutele care citesc/scriu date de aplicație trebuie să
// folosească acest id, nu req.user.id direct.
function effectiveDataOwnerId(user) {
  return user.teamOwnerId || user.id;
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireActiveSubscription,
  requireAdmin,
  effectiveDataOwnerId,
  isSubscriptionActive,
};
