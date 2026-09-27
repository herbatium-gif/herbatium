const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("./db");

const COOKIE_NAME = "formulator_token";
const TOKEN_TTL = "30d";

// ===== Blocare cont după parole greșite repetate =====
// Protecție SUPLIMENTARĂ față de rate-limiting-ul pe IP din routes/auth.js
// (authLimiter taie un IP anume; asta protejează un CONT anume, indiferent de
// la câte adrese IP diferite se încearcă parola — ex. un atacator cu multe
// adrese IP/proxy-uri, care altfel ar ocoli limita pe IP).
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Verifică dacă un cont e blocat ACUM (lockedUntil e în viitor).
function isAccountLocked(user) {
  return !!(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());
}

// Apelată după o parolă greșită: incrementează contorul și, dacă a atins
// pragul, blochează contul pentru LOCKOUT_MINUTES. Întoarce userul actualizat
// (cu noile valori), util pentru mesajul de răspuns către client.
async function recordFailedLogin(user) {
  const attempts = (user.failedLoginAttempts || 0) + 1;
  const data = { failedLoginAttempts: attempts };
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    data.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
  }
  return prisma.user.update({ where: { id: user.id }, data });
}

// Apelată la orice login reușit (parolă corectă, indiferent dacă mai urmează
// și un pas de 2FA) — resetează contorul, ca un login legitim să nu rămână
// "aproape blocat" din încercări vechi, greșite, uitate.
async function resetFailedLogin(user) {
  if (!user.failedLoginAttempts && !user.lockedUntil) return user;
  return prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

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
  isAccountLocked,
  recordFailedLogin,
  resetFailedLogin,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
};
