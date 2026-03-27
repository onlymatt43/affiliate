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
  return process.env.ADMIN_SESSION_TOKEN || "dev-local-session-token-change-me";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "change-me";
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.affiliate_admin === getSessionToken();
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
