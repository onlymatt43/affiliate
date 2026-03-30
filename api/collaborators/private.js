const { listCollaborators } = require("../../lib/collaborators-store");
const { verifyToken } = require("../../lib/collab-token");

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
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
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
