const crypto = require("crypto");
const { parseCookies, getAdminPassword, getSessionToken, buildSessionCookie } = require("../lib/auth");
const { enforceRateLimit, enforcePayloadLimit } = require("../lib/request-guards");

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = getSessionToken();
  if (!token) return false;
  return cookies.affiliate_admin === token;
}

module.exports = async function handler(req, res) {
  const op = String(req.query?.op || "");

  if (req.method === "GET" && op === "session") {
    res.status(200).json({ ok: true, authenticated: isAuthenticated(req) });
    return;
  }

  if (req.method === "POST" && op === "logout") {
    res.setHeader("Set-Cookie", buildSessionCookie("", 0));
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "POST" && op === "login") {
    if (await enforceRateLimit(req, res, { name: "login", limit: 20, windowMs: 5 * 60 * 1000 })) return;
    if (enforcePayloadLimit(req, res, 16 * 1024)) return;

    const expected = getAdminPassword();
    const sessionToken = getSessionToken();
    if (!expected || !sessionToken) {
      console.error("[auth] Missing ADMIN_PASSWORD or ADMIN_SESSION_TOKEN");
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
    return;
  }

  res.status(405).json({ ok: false, error: "Method not allowed" });
};
