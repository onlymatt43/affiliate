const {
  listAffiliates,
  upsertAffiliate,
  bulkUpsertAffiliates,
  replaceAllAffiliates,
  deleteAffiliate,
  clearAffiliates
} = require("../lib/affiliates-store");
const { isAuthenticated } = require("../lib/auth");
const { enforceRateLimit, enforcePayloadLimit } = require("../lib/request-guards");

function getOp(req) {
  const raw = req.query?.op;
  if (Array.isArray(raw)) return String(raw[0] || "");
  return String(raw || "");
}

module.exports = async function handler(req, res) {
  const op = getOp(req);

  if (req.method === "GET") {
    try {
      const payload = await listAffiliates();
      res.status(200).json({
        ok: true,
        affiliates: payload.affiliates,
        persistence: {
          mode: payload.mode,
          writable: payload.writable
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: "Unable to load affiliates" });
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (await enforceRateLimit(req, res, { name: "affiliates-write", limit: 120, windowMs: 5 * 60 * 1000 })) return;
  if (enforcePayloadLimit(req, res, 1024 * 1024)) return;

  if (!isAuthenticated(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  try {
    if (op === "upsert") {
      const affiliate = await upsertAffiliate(req.body?.affiliate || req.body);
      res.status(200).json({ ok: true, affiliate });
      return;
    }

    if (op === "bulk-upsert") {
      const items = Array.isArray(req.body?.affiliates) ? req.body.affiliates : [];
      const saved = await bulkUpsertAffiliates(items);
      res.status(200).json({ ok: true, count: saved.length });
      return;
    }

    if (op === "replace") {
      const items = Array.isArray(req.body?.affiliates) ? req.body.affiliates : [];
      const saved = await replaceAllAffiliates(items);
      res.status(200).json({ ok: true, count: saved.length });
      return;
    }

    if (op === "clear") {
      await clearAffiliates();
      res.status(200).json({ ok: true });
      return;
    }

    if (op === "delete") {
      const id = String(req.body?.id || "").trim();
      if (!id) {
        res.status(400).json({ ok: false, error: "Missing id" });
        return;
      }
      await deleteAffiliate(id);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, error: "Missing or invalid op" });
  } catch (error) {
    const message = String(error?.message || "");
    console.error("[affiliates] Operation failed", { op, message });
    if (message.includes("not configured")) {
      res.status(501).json({ ok: false, error: "Turso not configured" });
      return;
    }
    res.status(400).json({ ok: false, error: message || "Invalid affiliates payload" });
  }
};
