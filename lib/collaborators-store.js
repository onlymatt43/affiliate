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

function normalizeBooking(raw) {
  const booking = raw && typeof raw === "object" ? raw : {};
  return {
    dateLabel: toText(booking.dateLabel || booking.date),
    timeLabel: toText(booking.timeLabel || booking.time),
    location: toText(booking.location || booking.place),
    note: toText(booking.note)
  };
}

const MONTH_TOKEN_TO_INDEX = {
  jan: 0,
  january: 0,
  janvier: 0,
  feb: 1,
  february: 1,
  fevrier: 1,
  mar: 2,
  march: 2,
  mars: 2,
  apr: 3,
  april: 3,
  avril: 3,
  may: 4,
  mai: 4,
  jun: 5,
  june: 5,
  juin: 5,
  jul: 6,
  july: 6,
  juillet: 6,
  aug: 7,
  august: 7,
  aout: 7,
  sep: 8,
  sept: 8,
  september: 8,
  septembre: 8,
  oct: 9,
  october: 9,
  octobre: 9,
  nov: 10,
  november: 10,
  novembre: 10,
  dec: 11,
  december: 11,
  decembre: 11
};

function normalizeTextForDate(value) {
  return toText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractDay(value) {
  const match = toText(value).match(/\b([0-3]?\d)(?:st|nd|rd|th)?\b/i);
  if (!match) return null;
  const day = Number(match[1]);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function extractMonthIndex(...values) {
  const source = normalizeTextForDate(values.filter(Boolean).join(" "));
  if (!source) return null;

  for (const [token, monthIndex] of Object.entries(MONTH_TOKEN_TO_INDEX)) {
    if (source.includes(token)) return monthIndex;
  }

  const numericMonth = source.match(/\b([0-3]?\d)\s*[\/.-]\s*([0-1]?\d)(?:\s*[\/.-]\s*(\d{2,4}))?\b/);
  if (numericMonth) {
    const month = Number(numericMonth[2]);
    if (month >= 1 && month <= 12) return month - 1;
  }
  return null;
}

function extractYear(...values) {
  const source = values.filter(Boolean).join(" ");
  const match = source.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function extractTimeParts(value) {
  const source = toText(value);
  if (!source) return null;

  const match = source.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const suffix = (match[3] || "").toLowerCase();

  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;

  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function bookingToTimestamp(rawBooking, fallbackText = "") {
  const booking = normalizeBooking(rawBooking);
  const now = new Date();
  const day = extractDay(booking.dateLabel || booking.note || fallbackText);
  const monthIndex = extractMonthIndex(booking.dateLabel, booking.note, fallbackText);
  if (day == null || monthIndex == null) return null;

  const explicitYear = extractYear(booking.dateLabel, booking.note, fallbackText);
  let year = explicitYear == null ? now.getFullYear() : explicitYear;
  const time = extractTimeParts(booking.timeLabel) || { hours: 12, minutes: 0 };

  let candidate = new Date(year, monthIndex, day, time.hours, time.minutes, 0, 0);
  if (explicitYear == null && candidate.getTime() < now.getTime() - (24 * 60 * 60 * 1000)) {
    candidate = new Date(year + 1, monthIndex, day, time.hours, time.minutes, 0, 0);
  }
  return candidate.getTime();
}

function findBookingConflict(collaborators, targetId, nextBookingTs) {
  if (nextBookingTs == null) return null;
  const THREE_HOURS = 3 * 60 * 60 * 1000;

  for (const collab of collaborators) {
    if (!collab || String(collab.id || "") === String(targetId || "")) continue;
    const otherTs = bookingToTimestamp(collab.booking, collab.sourceNotes || "");
    if (otherTs == null) continue;
    if (Math.abs(otherTs - nextBookingTs) < THREE_HOURS) {
      return {
        id: collab.id,
        name: collab.name || "Unknown",
        booking: normalizeBooking(collab.booking)
      };
    }
  }
  return null;
}

function buildBookingWarning(conflict, nextBookingTs) {
  if (!conflict || !Number.isFinite(nextBookingTs)) return null;
  return {
    type: "schedule-overlap",
    message: `Potential overlap with ${conflict.name}. Consider using an earlier slot if needed.`,
    conflictWith: {
      id: conflict.id,
      name: conflict.name,
      booking: normalizeBooking(conflict.booking)
    },
    suggestion: {
      strategy: "consider-earlier-slot"
    }
  };
}

function normalizeTaggedUrls(input) {
  if (!Array.isArray(input)) return [];

  const out = [];
  const seen = new Set();
  input.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const url = toText(entry.url);
    if (!isValidHttpUrl(url)) return;

    const label = toText(entry.label) || "Link";
    const visibilityRaw = toText(entry.visibility || "private").toLowerCase();
    const visibility = visibilityRaw === "public" || visibilityRaw === "both" ? visibilityRaw : "private";
    const tags = Array.isArray(entry.tags)
      ? entry.tags.map((tag) => toText(tag)).filter(Boolean)
      : [];

    const dedupKey = `${url}::${visibility}::${tags.join("|")}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);

    out.push({ label, url, tags, visibility });
  });

  return out;
}

function normalizeForStore(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid collaborator payload");
  }

  const name = toText(input.name);
  if (!name) {
    throw new Error("Collaborator name is required");
  }

  const primaryUrl = toText(input.primaryUrl || input.publicLink || input.mainLink || input.link);
  if (!isValidHttpUrl(primaryUrl)) {
    throw new Error("Collaborator primaryUrl must be a valid URL");
  }

  const incomingId = toText(input.id);
  const id = incomingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const logos = normalizeLogos(input.logos);
  const publicLinks = normalizeLinks(input.publicLinks);
  const privateLinks = normalizeLinks(input.privateLinks);
  const taggedUrls = normalizeTaggedUrls(input.taggedUrls);
  const booking = normalizeBooking(input.booking);

  return {
    ...input,
    id,
    name,
    primaryUrl,
    publicLinks,
    privateLinks,
    taggedUrls,
    logos,
    contact: toText(input.contact),
    email: toText(input.email),
    rates: toText(input.rates),
    sourceNotes: toText(input.sourceNotes),
    booking,
    platform: toText(input.platform || "x"),
    niche: toText(input.niche || "lifestyle"),
    format: toText(input.format || "post"),
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

async function getCollaboratorById(db, id) {
  const result = await db.execute({
    sql: "SELECT payload FROM collaborators WHERE id = ?1 LIMIT 1",
    args: [id]
  });
  if (!result.rows?.length) return null;
  try {
    return JSON.parse(String(result.rows[0].payload || "{}"));
  } catch (_) {
    return null;
  }
}

async function getAllCollaborators(db) {
  const result = await db.execute("SELECT payload FROM collaborators");
  return (result.rows || [])
    .map((row) => {
      try {
        return JSON.parse(String(row.payload || "{}"));
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

async function updateCollaboratorBooking(id, bookingInput) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }
  const collaboratorId = toText(id);
  if (!collaboratorId) {
    throw new Error("Invalid collaborator id");
  }

  const db = getDb();
  await ensureSchema(db);
  const current = await getCollaboratorById(db, collaboratorId);
  if (!current) {
    throw new Error("Collaborator not found");
  }

  const nextBooking = normalizeBooking(bookingInput);
  const nextBookingTs = bookingToTimestamp(nextBooking, current.sourceNotes || "");
  const allCollaborators = await getAllCollaborators(db);
  const conflict = findBookingConflict(allCollaborators, collaboratorId, nextBookingTs);
  const warning = buildBookingWarning(conflict, nextBookingTs);

  const next = normalizeForStore({
    ...current,
    id: collaboratorId,
    booking: nextBooking
  });

  await db.execute({
    sql: "UPDATE collaborators SET payload = ?1, updated_at = ?2 WHERE id = ?3",
    args: [JSON.stringify(next), new Date().toISOString(), collaboratorId]
  });

  return { collaborator: next, warning };
}

async function addCollaboratorTaggedUrl(id, taggedUrlInput) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }
  const collaboratorId = toText(id);
  if (!collaboratorId) {
    throw new Error("Invalid collaborator id");
  }

  const db = getDb();
  await ensureSchema(db);
  const current = await getCollaboratorById(db, collaboratorId);
  if (!current) {
    throw new Error("Collaborator not found");
  }

  const normalizedNew = normalizeTaggedUrls([taggedUrlInput]);
  if (normalizedNew.length === 0) {
    throw new Error("Invalid tagged URL payload");
  }

  const mergedTaggedUrls = normalizeTaggedUrls([...(current.taggedUrls || []), ...normalizedNew]);
  const next = normalizeForStore({
    ...current,
    id: collaboratorId,
    taggedUrls: mergedTaggedUrls
  });

  await db.execute({
    sql: "UPDATE collaborators SET payload = ?1, updated_at = ?2 WHERE id = ?3",
    args: [JSON.stringify(next), new Date().toISOString(), collaboratorId]
  });

  return next;
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

async function findExistingIdByPrimaryUrl(db, primaryUrl) {
  if (!primaryUrl) return null;
  const result = await db.execute("SELECT id, payload FROM collaborators");
  for (const row of result.rows) {
    try {
      const parsed = JSON.parse(String(row.payload || "{}"));
      const stored = (parsed.primaryUrl || parsed.publicLink || "").toLowerCase();
      if (stored && stored === primaryUrl.toLowerCase()) {
        return String(row.id);
      }
    } catch (e) {}
  }
  return null;
}

async function upsertCollaborator(collaboratorInput) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }

  const db = getDb();
  await ensureSchema(db);

  // If no explicit id was provided, check for an existing entry with the same primaryUrl
  // to avoid creating duplicates.
  const hasExplicitId = toText(collaboratorInput?.id).length > 0;
  if (!hasExplicitId) {
    const primaryUrl = toText(collaboratorInput?.primaryUrl || collaboratorInput?.publicLink || collaboratorInput?.mainLink || collaboratorInput?.link);
    const existingId = await findExistingIdByPrimaryUrl(db, primaryUrl);
    if (existingId) {
      collaboratorInput = { ...collaboratorInput, id: existingId };
    }
  }

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
  const normalized = Array.isArray(inputs) ? inputs.map((input) => normalizeForStore(input)) : [];
  const now = new Date().toISOString();

  await db.execute("BEGIN");
  try {
    await db.execute("DELETE FROM collaborators");
    for (const collaborator of normalized) {
      await db.execute({
        sql: `
          INSERT INTO collaborators (id, payload, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?3)
        `,
        args: [collaborator.id, JSON.stringify(collaborator), now]
      });
    }
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK").catch(() => {});
    throw error;
  }

  return normalized;
}

async function deleteCollaborator(id) {
  if (!hasTursoConfig()) {
    throw new Error("Turso is not configured");
  }
  if (!id || typeof id !== "string") {
    throw new Error("Invalid collaborator id");
  }

  const db = getDb();
  await ensureSchema(db);
  await db.execute({ sql: "DELETE FROM collaborators WHERE id = ?1", args: [id] });
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
  updateCollaboratorBooking,
  addCollaboratorTaggedUrl,
  deleteCollaborator,
  clearCollaborators,
  normalizeCollaboratorForStore: normalizeForStore,
  normalizeTaggedUrls
};
