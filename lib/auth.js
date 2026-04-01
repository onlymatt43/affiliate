function parseCookies(cookieHeader) {
  const out = {};
  const source = cookieHeader || "";
  source.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return;
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function getSessionToken() {
  return String(process.env.ADMIN_SESSION_TOKEN || "").trim();
}

function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || "").trim();
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = getSessionToken();
  if (!token) return false;
  return cookies.affiliate_admin === token;
}

function buildSessionCookie(value, maxAgeSeconds) {
  const attrs = [
    `affiliate_admin=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${maxAgeSeconds}`
  ];
  return attrs.join("; ");
}

module.exports = {
  parseCookies,
  isAuthenticated,
  getSessionToken,
  getAdminPassword,
  buildSessionCookie
};
