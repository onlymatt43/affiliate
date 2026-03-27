const { isAuthenticated } = require("./_auth");
const { clearCollaborators } = require("./_collaborators-store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (!isAuthenticated(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  try {
    await clearCollaborators();
    res.status(200).json({ ok: true });
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("not configured")) {
      res.status(501).json({ ok: false, error: "Turso not configured" });
      return;
    }
    res.status(500).json({ ok: false, error: "Unable to clear collaborators" });
  }
};
