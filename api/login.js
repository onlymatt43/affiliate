const crypto = require("crypto");
const { getAdminPassword, getSessionToken, buildSessionCookie } = require("../lib/auth");
const { enforceRateLimit, enforcePayloadLimit } = require("../lib/request-guards");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (await enforceRateLimit(req, res, { name: "login", limit: 20, windowMs: 5 * 60 * 1000 })) return;
  if (enforcePayloadLimit(req, res, 16 * 1024)) return;

  const expected = getAdminPassword();
  const sessionToken = getSessionToken();
  if (!expected || !sessionToken) {
    console.error("[login] Missing ADMIN_PASSWORD or ADMIN_SESSION_TOKEN");
    res.status(500).json({ ok: false, error: "Server auth is not configured" });
    return;
  }

  const password = String(req.body?.password || "");
  const passwordBuf = Buffer.from(password);
  const expectedBuf = Buffer.from(expected);
  const match = passwordBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(passwordBuf, expectedBuf);
  if (!match) {
    res.status(401).json({ ok: false, error: "Invalid password" });
    return;
  }

  res.setHeader("Set-Cookie", buildSessionCookie(sessionToken, 60 * 60 * 12));
  res.status(200).json({ ok: true });
};
