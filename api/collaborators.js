const {
  listCollaborators,
  upsertCollaborator,
  bulkUpsertCollaborators,
  replaceAllCollaborators,
  clearCollaborators
} = require("../lib/collaborators-store");
const { isAuthenticated } = require("../lib/auth");

function getOp(req) {
  const raw = req.query?.op;
  if (Array.isArray(raw)) return String(raw[0] || "");
  return String(raw || "");
}

module.exports = async function handler(req, res) {
  const op = getOp(req);

  if (req.method === "GET") {
    try {
      const payload = await listCollaborators();
      res.status(200).json({
        ok: true,
        collaborators: payload.collaborators,
        persistence: {
          mode: payload.mode,
          writable: payload.writable
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: "Unable to load collaborators" });
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (!isAuthenticated(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  try {
    if (op === "upsert") {
      const collaborator = await upsertCollaborator(req.body?.collaborator || req.body);
      res.status(200).json({ ok: true, collaborator });
      return;
    }

    if (op === "bulk-upsert") {
      const items = Array.isArray(req.body?.collaborators) ? req.body.collaborators : [];
      const saved = await bulkUpsertCollaborators(items);
      res.status(200).json({ ok: true, count: saved.length });
      return;
    }

    if (op === "replace") {
      const items = Array.isArray(req.body?.collaborators) ? req.body.collaborators : [];
      const saved = await replaceAllCollaborators(items);
      res.status(200).json({ ok: true, count: saved.length });
      return;
    }

    if (op === "clear") {
      await clearCollaborators();
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, error: "Missing or invalid op" });
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("not configured")) {
      res.status(501).json({ ok: false, error: "Turso not configured" });
      return;
    }
    res.status(400).json({ ok: false, error: message || "Invalid collaborators payload" });
  }
};
