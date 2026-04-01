const crypto = require("crypto");
const { getAppBaseUrl } = require("../../../lib/app-url");

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

module.exports = async function handler(req, res) {
  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const collabId = String(rawId || "").trim();

  if (!collabId) {
    res.status(400).send("Missing collaborator id");
    return;
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("Twitter OAuth not configured");
    return;
  }

  // PKCE
  const codeVerifier = base64url(crypto.randomBytes(48));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const stateToken = base64url(crypto.randomBytes(24));

  const appBase = getAppBaseUrl(req);
  const callbackUrl = appBase + "/api/auth/twitter/callback";
  const scope = "users.read tweet.read";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope,
    state: stateToken,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });

  const maxAge = 600; // 10 minutes
  const cookieOpts = `; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;

  res.setHeader("Set-Cookie", [
    `tw_cv=${encodeURIComponent(codeVerifier)}${cookieOpts}`,
    `tw_state=${encodeURIComponent(stateToken)}${cookieOpts}`,
    `tw_collab=${encodeURIComponent(collabId)}${cookieOpts}`
  ]);

  res.redirect(302, "https://twitter.com/i/oauth2/authorize?" + params.toString());
};
