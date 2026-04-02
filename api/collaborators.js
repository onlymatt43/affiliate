const {
  listCollaborators,
  upsertCollaborator,
  bulkUpsertCollaborators,
  replaceAllCollaborators,
  deleteCollaborator,
  clearCollaborators
} = require("../lib/collaborators-store");
const { isAuthenticated } = require("../lib/auth");
const { enforceRateLimit, enforcePayloadLimit } = require("../lib/request-guards");

const PUBLIC_FIELDS = new Set(["id", "name", "primaryUrl", "publicLinks", "logos", "contact", "platform", "category", "taggedUrls"]);

function toPublicShape(collab) {
  const vis = collab.visibility || {};
  const out = {};
  // Normalize primaryUrl from legacy field names before filtering
  const normalized = { ...collab, primaryUrl: collab.primaryUrl || collab.publicLink || collab.mainLink || collab.link };
  for (const key of PUBLIC_FIELDS) {
    const v = vis[key];
    if (v === "private") continue;
    if (key in normalized) out[key] = normalized[key];
  }
  if (Array.isArray(normalized.taggedUrls)) {
    out.taggedUrls = normalized.taggedUrls.filter((entry) => {
      const entryVisibility = String(entry?.visibility || "private").toLowerCase();
      return entryVisibility === "public" || entryVisibility === "both";
    });
  }
  // Expose only dateLabel + timeLabel for booking badge / sort — not location or note
  const bVis = vis.booking || "both";
  if (bVis !== "private") {
    const b = collab.booking || {};
    out.booking = { dateLabel: b.dateLabel || "", timeLabel: b.timeLabel || "" };
  }
  return out;
}

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
      const isAdmin = isAuthenticated(req);
      const collaborators = isAdmin
        ? payload.collaborators
        : payload.collaborators.map(toPublicShape);
      res.status(200).json({
        ok: true,
        collaborators,
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

  if (await enforceRateLimit(req, res, { name: "collaborators-write", limit: 120, windowMs: 5 * 60 * 1000 })) return;
  if (enforcePayloadLimit(req, res, 1024 * 1024)) return;

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

    if (op === "delete") {
      const id = String(req.body?.id || "").trim();
      if (!id) {
        res.status(400).json({ ok: false, error: "Missing id" });
        return;
      }
      await deleteCollaborator(id);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, error: "Missing or invalid op" });
  } catch (error) {
    const message = String(error?.message || "");
    console.error("[collaborators] Operation failed", { op, message });
    if (message.includes("not configured")) {
      res.status(501).json({ ok: false, error: "Turso not configured" });
      return;
    }
    res.status(400).json({ ok: false, error: message || "Invalid collaborators payload" });
  }
};
