const fs = require("node:fs");
const path = require("node:path");
const { getDb, ensureSchema, hasTursoConfig } = require("./db");

function readJsonFallback() {
  try {
    const filePath = path.join(process.cwd(), "data", "collaborators.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function toText(value) {
  return String(value || "").trim();
}

function normalizeLinks(input) {
  if (Array.isArray(input)) {
    return input
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const label = toText(entry.label) || "Lien";
        const url = toText(entry.url);
        if (!isValidHttpUrl(url)) return null;
        return { label, url };
      })
      .filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(/\n|,/g)
      .map((raw) => toText(raw))
      .filter((url) => isValidHttpUrl(url))
      .map((url, index) => ({ label: `Lien ${index + 1}`, url }));
  }

  return [];
}

function normalizeLogos(raw) {
  const values = [];
  if (Array.isArray(raw)) values.push(...raw);
  else if (raw) values.push(raw);

  const deduped = [];
  const seen = new Set();
  values.forEach((value) => {
    const url = toText(value);
    if (!isValidHttpUrl(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    deduped.push(url);
  });

  return deduped.slice(0, 3);
}

function normalizeForStore(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid collaborator payload");
  }

  const name = toText(input.name);
  if (!name) {
    throw new Error("Collaborator name is required");
  }

  const publicLink = toText(input.publicLink || input.mainLink || input.link);
  if (!isValidHttpUrl(publicLink)) {
    throw new Error("Collaborator publicLink must be a valid URL");
  }

  const incomingId = toText(input.id);
  const id = incomingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const logos = normalizeLogos(input.logos);
  const privateLinks = normalizeLinks(input.privateLinks);

  return {
    ...input,
    id,
    name,
    publicLink,
    privateLinks,
    logos,
    contact: toText(input.contact),
    rates: toText(input.rates),
    platform: toText(input.platform || "instagram"),
    niche: toText(input.niche || "business"),
    format: toText(input.format || "short-video"),
    tone: toText(input.tone || "authority"),
    fr: {
      tags: toText(input?.fr?.tags),
      specs: toText(input?.fr?.specs),
      caption: toText(input?.fr?.caption)
    },
    en: {
      tags: toText(input?.en?.tags),
      specs: toText(input?.en?.specs),
      caption: toText(input?.en?.caption)
    }
  };
}

async function listCollaborators() {
  if (!hasTursoConfig()) {
    return {
      mode: "json",
      writable: false,
      collaborators: readJsonFallback()
    };
  }

  const db = getDb();
  await ensureSchema(db);
  const result = await db.execute("SELECT payload FROM collaborators ORDER BY updated_at DESC");
  const collaborators = result.rows
    .map((row) => {
      try {
        return JSON.parse(String(row.payload || "{}"));
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

  // In remote mode, allow a seed fallback for first-time empty collaborators table.
  if (collaborators.length === 0) {
    return {
      mode: "turso",
      writable: true,
      collaborators: readJsonFallback()
    };
  }

  return {
    mode: "turso",
    writable: true,
    collaborators
  };
}

async function upsertCollaborator(collaboratorInput) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }

  const db = getDb();
  await ensureSchema(db);

  const collaborator = normalizeForStore(collaboratorInput);
  const now = new Date().toISOString();

  await db.execute({
    sql: `
      INSERT INTO collaborators (id, payload, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?3)
      ON CONFLICT(id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
    args: [collaborator.id, JSON.stringify(collaborator), now]
  });

  return collaborator;
}

async function bulkUpsertCollaborators(inputs) {
  if (!Array.isArray(inputs)) return [];
  const out = [];

  for (const input of inputs) {
    const saved = await upsertCollaborator(input);
    out.push(saved);
  }

  return out;
}

async function replaceAllCollaborators(inputs) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }

  const db = getDb();
  await ensureSchema(db);
  await db.execute("DELETE FROM collaborators");
  return bulkUpsertCollaborators(Array.isArray(inputs) ? inputs : []);
}

async function clearCollaborators() {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }

  const db = getDb();
  await ensureSchema(db);
  await db.execute("DELETE FROM collaborators");
}

module.exports = {
  listCollaborators,
  upsertCollaborator,
  bulkUpsertCollaborators,
  replaceAllCollaborators,
  clearCollaborators,
  normalizeCollaboratorForStore: normalizeForStore
};
