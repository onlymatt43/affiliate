const fs = require("node:fs");
const path = require("node:path");
const { getDb, ensureSchema, hasTursoConfig } = require("./db");

function readJsonFallback() {
  try {
    const filePath = path.join(process.cwd(), "data", "affiliates.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeForStore(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid affiliate payload");
  }

  const name = String(input.name || "").trim();
  if (!name) {
    throw new Error("Affiliate name is required");
  }

  const incomingId = String(input.id || "").trim();
  const id = incomingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return { ...input, id };
}

async function listAffiliates() {
  if (!hasTursoConfig()) {
    return {
      mode: "json",
      writable: false,
      affiliates: readJsonFallback()
    };
  }

  const db = getDb();
  await ensureSchema(db);
  const result = await db.execute("SELECT payload FROM affiliates ORDER BY updated_at DESC");
  const affiliates = result.rows
    .map((row) => {
      try {
        return JSON.parse(String(row.payload || "{}"));
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

  return {
    mode: "turso",
    writable: true,
    affiliates
  };
}

async function findExistingIdByPrimaryUrl(db, primaryUrl) {
  if (!primaryUrl) return null;
  const result = await db.execute("SELECT id, payload FROM affiliates");
  for (const row of result.rows) {
    try {
      const parsed = JSON.parse(String(row.payload || "{}"));
      const stored = (parsed.primaryUrl || parsed.promoUrl || "").toLowerCase();
      if (stored && stored === primaryUrl.toLowerCase()) {
        return String(row.id);
      }
    } catch (e) {}
  }
  return null;
}

async function upsertAffiliate(affiliateInput) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }

  const db = getDb();
  await ensureSchema(db);

  // If no explicit id was provided, check for an existing entry with the same primaryUrl
  // to avoid creating duplicates.
  const hasExplicitId = String(affiliateInput?.id || "").trim().length > 0;
  if (!hasExplicitId) {
    const primaryUrl = String(affiliateInput?.primaryUrl || affiliateInput?.promoUrl || "").trim();
    const existingId = await findExistingIdByPrimaryUrl(db, primaryUrl);
    if (existingId) {
      affiliateInput = { ...affiliateInput, id: existingId };
    }
  }

  const affiliate = normalizeForStore(affiliateInput);
  const now = new Date().toISOString();

  await db.execute({
    sql: `
      INSERT INTO affiliates (id, payload, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?3)
      ON CONFLICT(id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
    args: [affiliate.id, JSON.stringify(affiliate), now]
  });

  return affiliate;
}

async function bulkUpsertAffiliates(inputs) {
  if (!Array.isArray(inputs)) return [];
  const out = [];

  for (const input of inputs) {
    // Intentional sequential writes to keep behavior deterministic in serverless logs.
    const saved = await upsertAffiliate(input);
    out.push(saved);
  }

  return out;
}

async function replaceAllAffiliates(inputs) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }

  const db = getDb();
  await ensureSchema(db);
  const normalized = Array.isArray(inputs) ? inputs.map((input) => normalizeForStore(input)) : [];
  const now = new Date().toISOString();

  await db.execute("BEGIN");
  try {
    await db.execute("DELETE FROM affiliates");
    for (const affiliate of normalized) {
      await db.execute({
        sql: `
          INSERT INTO affiliates (id, payload, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?3)
        `,
        args: [affiliate.id, JSON.stringify(affiliate), now]
      });
    }
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK").catch(() => {});
    throw error;
  }

  return normalized;
}

async function deleteAffiliate(id) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }
  if (!id || typeof id !== "string") {
    throw new Error("Invalid affiliate id");
  }

  const db = getDb();
  await ensureSchema(db);
  await db.execute({ sql: "DELETE FROM affiliates WHERE id = ?1", args: [id] });
}

async function clearAffiliates() {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }

  const db = getDb();
  await ensureSchema(db);
  await db.execute("DELETE FROM affiliates");
}

module.exports = {
  listAffiliates,
  upsertAffiliate,
  bulkUpsertAffiliates,
  replaceAllAffiliates,
  deleteAffiliate,
  clearAffiliates
};
