const {
  listCollaborators,
  updateCollaboratorBooking,
  addCollaboratorTaggedUrl
} = require("../../lib/collaborators-store");
const { verifyToken } = require("../../lib/collab-token");
const { enforceRateLimit, enforcePayloadLimit } = require("../../lib/request-guards");

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (req.method === "GET") {
    if (await enforceRateLimit(req, res, { name: "collaborators-private-read", limit: 240, windowMs: 5 * 60 * 1000 })) return;
  }

  if (req.method === "POST") {
    if (await enforceRateLimit(req, res, { name: "collaborators-private-write", limit: 90, windowMs: 5 * 60 * 1000 })) return;
    if (enforcePayloadLimit(req, res, 128 * 1024)) return;
  }

  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = String(rawId || "").trim();
  if (!id) {
    res.status(400).json({ ok: false, error: "Missing id" });
    return;
  }

  // Verify collab_token cookie
  const cookies = parseCookies(req.headers.cookie || "");
  const tokenCollabId = verifyToken(cookies.collab_token || "");
  if (!tokenCollabId || tokenCollabId !== id) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  const rawOp = Array.isArray(req.query.op) ? req.query.op[0] : req.query.op;
  const op = String(rawOp || "").trim();

  if (req.method === "POST") {
    try {
      if (op === "update-booking") {
        const result = await updateCollaboratorBooking(id, req.body?.booking || {});
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({ ok: true, collaborator: result.collaborator, warning: result.warning || null });
        return;
      }

      if (op === "add-tagged-url") {
        const collaborator = await addCollaboratorTaggedUrl(id, req.body?.taggedUrl || req.body || {});
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({ ok: true, collaborator });
        return;
      }

      res.status(400).json({ ok: false, error: "Invalid op" });
      return;
    } catch (err) {
      const msg = String(err?.message || "Server error");
      if (msg === "Collaborator not found") {
        res.status(404).json({ ok: false, error: msg });
        return;
      }
      if (msg.includes("Invalid")) {
        res.status(400).json({ ok: false, error: msg });
        return;
      }
      res.status(500).json({ ok: false, error: "Server error" });
      return;
    }
  }

  try {
    const { collaborators } = await listCollaborators();
    const collab = collaborators.find((c) => c.id === id);
    if (!collab) {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, collaborator: collab });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
};
