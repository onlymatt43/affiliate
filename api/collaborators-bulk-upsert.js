const { isAuthenticated } = require("./_auth");
const { bulkUpsertCollaborators } = require("./_collaborators-store");

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
    const items = Array.isArray(req.body?.collaborators) ? req.body.collaborators : [];
    const saved = await bulkUpsertCollaborators(items);
    res.status(200).json({ ok: true, count: saved.length });
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("not configured")) {
      res.status(501).json({ ok: false, error: "Turso not configured" });
      return;
    }
    res.status(400).json({ ok: false, error: message || "Invalid collaborators payload" });
  }
};
