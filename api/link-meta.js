const { isAuthenticated } = require("../lib/auth");

function extractMeta(html, property, attr = "property") {
  // Match <meta> regardless of attribute order (property/content can appear in any order)
  const tagRe = /<meta(\s[^>]*)?>/gi;
  let tag;
  while ((tag = tagRe.exec(html)) !== null) {
    const attrs = tag[0];
    const propMatch = new RegExp(`${attr}=["']${property}["']`, "i").test(attrs);
    if (!propMatch) continue;
    const contentMatch = attrs.match(/content=["']([^"']+)["']/i);
    if (contentMatch) return contentMatch[1];
  }
  return "";
}

function extractLinkIcon(html) {
  const tagRe = /<link(\s[^>]*)?>/gi;
  const priority = ["apple-touch-icon", "icon", "shortcut icon"];
  let best = "";
  let bestScore = Infinity;

  let tag;
  while ((tag = tagRe.exec(html)) !== null) {
    const attrs = tag[0];
    const relMatch = attrs.match(/rel=["']([^"']+)["']/i);
    if (!relMatch) continue;
    const relValue = relMatch[1].toLowerCase();

    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = String(hrefMatch[1] || "").trim();
    if (!href) continue;

    for (let i = 0; i < priority.length; i += 1) {
      if (relValue.includes(priority[i])) {
        if (i < bestScore) {
          bestScore = i;
          best = href;
        }
        break;
      }
    }
  }

  return best;
}

function resolveUrl(base, relative) {
  if (!relative) return "";
  try {
    return new URL(relative, base).toString();
  } catch (_) {
    return relative;
  }
}

function getHost(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch (error) {
    return "";
  }
}

function buildDomainLogoUrl(value) {
  const host = getHost(value);
  if (!host) return "";
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
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
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }
    });

    if (!response.ok) {
      res.status(200).json({ ok: true, image: "", title: "", description: "" });
      return;
    }

    const html = await response.text();
    const rawImage =
      extractMeta(html, "og:image") ||
      extractMeta(html, "twitter:image", "name") ||
      "";
    const rawIcon = extractLinkIcon(html) || "/favicon.ico";
    const image = resolveUrl(url.toString(), rawImage);
    const siteLogo = resolveUrl(url.toString(), rawIcon) || buildDomainLogoUrl(url.toString());
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
      siteLogo,
      title,
      description: includeDescription ? description : ""
    });
  } catch (error) {
    res.status(200).json({ ok: true, image: "", siteLogo: buildDomainLogoUrl(url.toString()), title: "", description: "" });
  }
};
