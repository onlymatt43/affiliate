const crypto = require("crypto");

const TOKEN_VERSION = "1";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret() {
  const secret = process.env.COLLAB_TOKEN_SECRET;
  if (!secret) throw new Error("COLLAB_TOKEN_SECRET is not set");
  return secret;
}

function hmac(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Sign a token for a specific collaborator ID.
 * Format: v1.<collabId_b64>.<expiry_ms>.<hmac>
 */
function signToken(collabId) {
  const secret = getSecret();
  const idEncoded = Buffer.from(collabId, "utf8").toString("base64url");
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${TOKEN_VERSION}.${idEncoded}.${expiry}`;
  const sig = hmac(secret, payload);
  return `${payload}.${sig}`;
}

/**
 * Verify a token. Returns the collabId if valid, null otherwise.
 */
function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const secret = getSecret();
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [version, idEncoded, expiryStr, sig] = parts;
    if (version !== TOKEN_VERSION) return null;

    const payload = `${version}.${idEncoded}.${expiryStr}`;
    const expected = hmac(secret, payload);
    // Constant-time comparison
    if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) return null;

    const expiry = Number(expiryStr);
    if (!Number.isFinite(expiry) || Date.now() > expiry) return null;

    return Buffer.from(idEncoded, "base64url").toString("utf8");
  } catch (_) {
    return null;
  }
}

module.exports = { signToken, verifyToken };
