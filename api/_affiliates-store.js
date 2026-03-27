const fs = require("node:fs");
const path = require("node:path");
const { getDb, ensureSchema, hasTursoConfig } = require("./_db");

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

async function upsertAffiliate(affiliateInput) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }

  const db = getDb();
  await ensureSchema(db);

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
  await db.execute("DELETE FROM affiliates");
  return bulkUpsertAffiliates(Array.isArray(inputs) ? inputs : []);
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
  clearAffiliates
};
