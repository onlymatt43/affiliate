const { getAdminPassword, getSessionToken, buildSessionCookie } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const password = String(req.body?.password || "");
  if (password !== getAdminPassword()) {
    res.status(401).json({ ok: false, error: "Invalid password" });
    return;
  }

  res.setHeader("Set-Cookie", buildSessionCookie(getSessionToken(), 60 * 60 * 12));
  res.status(200).json({ ok: true });
};
