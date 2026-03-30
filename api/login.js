const crypto = require("crypto");
const { getAdminPassword, getSessionToken, buildSessionCookie } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const password = String(req.body?.password || "");
  const expected = getAdminPassword();
  const passwordBuf = Buffer.from(password);
  const expectedBuf = Buffer.from(expected);
  const match = passwordBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(passwordBuf, expectedBuf);
  if (!match) {
    res.status(401).json({ ok: false, error: "Invalid password" });
    return;
  }

  res.setHeader("Set-Cookie", buildSessionCookie(getSessionToken(), 60 * 60 * 12));
  res.status(200).json({ ok: true });
};
