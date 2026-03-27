const { createClient } = require("@libsql/client");

let cachedClient = null;

function hasTursoConfig() {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

function getDb() {
  if (!hasTursoConfig()) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  return cachedClient;
}

async function ensureSchema(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS affiliates (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS collaborators (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

module.exports = {
  hasTursoConfig,
  getDb,
  ensureSchema
};
