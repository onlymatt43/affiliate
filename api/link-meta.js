const { isAuthenticated } = require("./_auth");

function extractMeta(html, property, attr = "property") {
  const re = new RegExp(`<meta[^>]*${attr}=["']${property}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  const match = html.match(re);
  return match ? match[1] : "";
}

function getHost(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch (error) {
    return "";
  }
}

function isUnsafeHost(host) {
  return (
    !host ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.")
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const rawUrl = String(req.query.url || "").trim();
  if (!rawUrl) {
    res.status(400).json({ ok: false, error: "Missing url" });
    return;
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    res.status(400).json({ ok: false, error: "Invalid url" });
    return;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    res.status(400).json({ ok: false, error: "Unsupported protocol" });
    return;
  }

  if (isUnsafeHost(getHost(url.toString()))) {
    res.status(400).json({ ok: false, error: "Unsafe host" });
    return;
  }

  const includeDescription = isAuthenticated(req);

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "affiliate-hub/1.0 (+https://affiliates.onlymatt.ca)" }
    });

    const html = await response.text();
    const image =
      extractMeta(html, "og:image") ||
      extractMeta(html, "twitter:image", "name") ||
      "";
    const title =
      extractMeta(html, "og:title") ||
      extractMeta(html, "twitter:title", "name") ||
      "";
    const description =
      extractMeta(html, "og:description") ||
      extractMeta(html, "twitter:description", "name") ||
      "";

    res.status(200).json({
      ok: true,
      image,
      title,
      description: includeDescription ? description : ""
    });
  } catch (error) {
    res.status(200).json({ ok: true, image: "", title: "", description: "" });
  }
};
