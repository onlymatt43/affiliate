const { buildSessionCookie } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  res.setHeader("Set-Cookie", buildSessionCookie("", 0));
  res.status(200).json({ ok: true });
};
