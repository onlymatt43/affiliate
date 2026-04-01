const { listCollaborators } = require("../../../lib/collaborators-store");
const { signToken } = require("../../../lib/collab-token");
const { getAppBaseUrl } = require("../../../lib/app-url");

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function clearCookies() {
  const opts = "; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure";
  return [
    "tw_cv=" + opts,
    "tw_state=" + opts,
    "tw_collab=" + opts
  ];
}

function extractHandle(publicLink) {
  try {
    const segments = new URL(publicLink).pathname.split("/").filter(Boolean);
    return segments[0] ? segments[0].toLowerCase().replace(/^@/, "") : "";
  } catch (_) {
    return "";
  }
}

module.exports = async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const codeVerifier = cookies.tw_cv;
  const savedState = cookies.tw_state;
  const collabId = cookies.tw_collab;

  const appBase = getAppBaseUrl(req);

  // Validate state to prevent CSRF
  const { code, state } = req.query;
  if (!code || !state || !savedState || state !== savedState || !codeVerifier || !collabId) {
    res.setHeader("Set-Cookie", clearCookies());
    res.redirect(302, appBase + "/?auth_error=1");
    return;
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.setHeader("Set-Cookie", clearCookies());
    res.redirect(302, appBase + "/?auth_error=1");
    return;
  }

  // Exchange code for access token
  let twitterUsername = "";
  try {
    const callbackUrl = appBase + "/api/auth/twitter/callback";
    const basicAuth = Buffer.from(clientId + ":" + clientSecret).toString("base64");

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + basicAuth
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: callbackUrl,
        code_verifier: codeVerifier
      }).toString()
    });

    if (!tokenRes.ok) {
      throw new Error("Token exchange failed: " + tokenRes.status);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("No access token");

    // Fetch authenticated user's Twitter username
    const meRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { "Authorization": "Bearer " + accessToken }
    });

    if (!meRes.ok) throw new Error("User fetch failed: " + meRes.status);
    const meData = await meRes.json();
    twitterUsername = (meData.data?.username || "").toLowerCase();
  } catch (err) {
    console.error("[twitter-callback] OAuth exchange failed", {
      collabId,
      message: String(err?.message || err)
    });
    res.setHeader("Set-Cookie", clearCookies());
    res.redirect(302, appBase + "/?auth_error=1&id=" + encodeURIComponent(collabId));
    return;
  }

  // Verify: does the logged-in Twitter handle match this collaborator's publicLink handle?
  let matched = false;
  try {
    const { collaborators } = await listCollaborators();
    const collab = collaborators.find((c) => c.id === collabId);
    if (collab && collab.publicLink) {
      const expected = extractHandle(collab.publicLink);
      matched = expected.length > 0 && expected === twitterUsername;
    }
  } catch (_) {}

  res.setHeader("Set-Cookie", clearCookies());

  if (matched) {
    let token = "";
    try { token = signToken(collabId); } catch (_) {}
    const tokenCookie = "collab_token=" + encodeURIComponent(token) + "; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax; Secure";
    res.setHeader("Set-Cookie", [tokenCookie]);
    res.redirect(302, appBase + "/?unlocked=" + encodeURIComponent(collabId));
  } else {
    res.redirect(302, appBase + "/?auth_error=1&id=" + encodeURIComponent(collabId));
  }
};
