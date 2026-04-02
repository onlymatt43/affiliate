const { listCollaborators } = require("../lib/collaborators-store");

function toText(v) {
  return String(v || "").trim();
}

function bookingSummary(b) {
  if (!b || typeof b !== "object") return "";
  const parts = [b.dateLabel, b.timeLabel, b.location].map(toText).filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : toText(b.note);
}

function socialAvatarUrl(url) {
  if (!url) return "";
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const u = new URL(url).pathname.split("/").filter(Boolean)[0];
    if (!u) return "";
    if (["x.com", "twitter.com"].includes(h)) return "https://unavatar.io/x/" + u;
    if (h === "instagram.com") return "https://unavatar.io/instagram/" + u;
    if (h === "tiktok.com") return "https://unavatar.io/tiktok/" + u;
  } catch (e) {}
  return "";
}

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async function handler(req, res) {
  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = toText(rawId);
  if (!id) {
    res.redirect(302, "/");
    return;
  }

  let collab = null;
  try {
    const { collaborators } = await listCollaborators();
    collab = collaborators.find((c) => c.id === id) || null;
  } catch (e) {}

  if (!collab) {
    res.redirect(302, "/?share=" + encodeURIComponent(id));
    return;
  }

  const name = toText(collab.name);
  const booking = bookingSummary(collab.booking);
  const loc = toText(collab.booking && collab.booking.location);
  const avatar = socialAvatarUrl(collab.primaryUrl || collab.publicLink);
  const appUrl = "https://affiliates.onlymatt.ca/?share=" + encodeURIComponent(id);
  const title = booking ? "RV \u00b7 " + name + " \u2014 " + booking : name;
  const desc = loc || (booking ? booking : "Voir le profil de collaboration");
  const img = avatar || "https://affiliates.onlymatt.ca/favicon.ico";

  const html = [
    "<!doctype html><html lang=\"fr\"><head>",
    "<meta charset=\"utf-8\" />",
    "<title>" + escHtml(title) + "</title>",
    "<meta name=\"description\" content=\"" + escHtml(desc) + "\" />",
    "<meta property=\"og:type\" content=\"profile\" />",
    "<meta property=\"og:title\" content=\"" + escHtml(title) + "\" />",
    "<meta property=\"og:description\" content=\"" + escHtml(desc) + "\" />",
    "<meta property=\"og:image\" content=\"" + escHtml(img) + "\" />",
    "<meta property=\"og:url\" content=\"" + escHtml(appUrl) + "\" />",
    "<meta property=\"og:site_name\" content=\"Affiliate Hub\" />",
    "<meta name=\"twitter:card\" content=\"summary\" />",
    "<meta name=\"twitter:title\" content=\"" + escHtml(title) + "\" />",
    "<meta name=\"twitter:description\" content=\"" + escHtml(desc) + "\" />",
    "<meta name=\"twitter:image\" content=\"" + escHtml(img) + "\" />",
    "<meta http-equiv=\"refresh\" content=\"0;url=" + escHtml(appUrl) + "\" />",
    "</head><body>",
    "<p>Redirection... <a href=\"" + escHtml(appUrl) + "\">Cliquer ici</a></p>",
    "<script>location.replace(" + JSON.stringify(appUrl) + ");<\/script>",
    "</body></html>",
  ].join("\n");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.status(200).send(html);
};
