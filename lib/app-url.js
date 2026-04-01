function normalizeBaseUrl(raw) {
  const value = String(raw || "").trim().replace(/\/$/, "");
  if (!value) return "";

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin;
  } catch (_) {
    return "";
  }
}

function getAppBaseUrl(req) {
  const fromEnv = normalizeBaseUrl(process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL);
  if (fromEnv) return fromEnv;

  const forwardedHost = req?.headers?.["x-forwarded-host"];
  const host = String(forwardedHost || req?.headers?.host || "").split(",")[0].trim();
  const protoHeader = String(req?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = protoHeader || (host.includes("localhost") ? "http" : "https");

  if (host) return `${proto}://${host}`;

  const vercelHost = String(process.env.VERCEL_URL || "").trim();
  if (vercelHost) return `https://${vercelHost}`;

  return "http://localhost:3000";
}

module.exports = {
  getAppBaseUrl
};
