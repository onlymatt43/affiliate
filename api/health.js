const { getDb, hasTursoConfig } = require("../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const now = new Date().toISOString();
  const payload = {
    ok: true,
    ts: now,
    persistence: {
      tursoConfigured: hasTursoConfig(),
      tursoHealthy: false
    }
  };

  if (!hasTursoConfig()) {
    res.status(200).json(payload);
    return;
  }

  try {
    const db = getDb();
    await db.execute("SELECT 1");
    payload.persistence.tursoHealthy = true;
    res.status(200).json(payload);
  } catch (error) {
    console.error("[health] Turso check failed", { message: String(error?.message || error) });
    payload.ok = false;
    res.status(503).json(payload);
  }
};
