const { isAuthenticated } = require("../lib/auth");
const { enforceRateLimit, enforcePayloadLimit } = require("../lib/request-guards");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (await enforceRateLimit(req, res, { name: "generate-post", limit: 50, windowMs: 5 * 60 * 1000 })) return;
  if (enforcePayloadLimit(req, res, 256 * 1024)) return;

  if (!isAuthenticated(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ ok: false, error: "OPENAI_API_KEY not configured" });
    return;
  }

  const { item, lang = "fr", messages: extraMessages = [] } = req.body || {};
  if (!item || typeof item !== "object") {
    res.status(400).json({ ok: false, error: "Missing item payload" });
    return;
  }

  const isAffiliate = !item.publicLink && item.promoUrl;
  const langLabel = lang === "fr" ? "français" : "English";

  const voiceGuide = `Ton de voix (IMPORTANT — respecte ça en tout temps):
- Court. Très court. 3-5 phrases max.
- Comme un ado trop confiant qui s'en fout de ce que les gens pensent — mais qui a raison.
- Humour noir, ton mature, direct. Pas de niaiseries.
- Tu parles de toi, ton expérience, ton plaisir. Pas d'invitation. Pas de CTA.
- Langage simple, cru si nécessaire. Fautes naturelles. Phrases courtes. Parfois juste un mot.
- JAMAIS : "découvrez", "profitez", "incroyable", "vous allez adorer", "n'attendez plus", "cliquez", emojis cheesy.`;

  let systemPrompt = "";

  if (isAffiliate) {
    const specs = lang === "fr" ? (item.fr?.specs || "") : (item.en?.specs || "");
    const tags = lang === "fr" ? (item.fr?.tags || "") : (item.en?.tags || "");
    systemPrompt = `${voiceGuide}

Tu es un créateur de contenu OnlyFans. Écris un post promotionnel en ${langLabel}.

Marque: ${item.name}
Plateforme: ${item.platform}
URL promo: ${item.promoUrl}${item.promoCode ? `\nCode promo: ${item.promoCode}` : ""}${item.mentions ? `\nMentions: ${item.mentions}` : ""}${item.postRequirements ? `\nExigences du post: ${item.postRequirements}` : ""}${item.specificities ? `\nSpécificités: ${item.specificities}` : ""}${specs ? `\nSpecs: ${specs}` : ""}${tags ? `\nHashtags à inclure: ${tags}` : ""}

Format: ${item.format}. Maximum 300 mots.`;
  } else {
    const specs = lang === "fr" ? (item.fr?.specs || "") : (item.en?.specs || "");
    const tags = lang === "fr" ? (item.fr?.tags || "") : (item.en?.tags || "");
    systemPrompt = `${voiceGuide}

Tu es un créateur de contenu OnlyFans. Écris un post de collaboration en ${langLabel}.

Collaborateur: ${item.name}
Plateforme: ${item.platform}
Lien: ${item.publicLink}${item.contact ? `\nContact: ${item.contact}` : ""}${item.rates ? `\nRates: ${item.rates}` : ""}${specs ? `\nSpecs de collaboration: ${specs}` : ""}${tags ? `\nHashtags à inclure: ${tags}` : ""}

Format: ${item.format || "short-video"}. Maximum 300 mots.`;
  }

  // Build message history: system context + prior turns + new user message (if any)
  const messages = [{ role: "system", content: systemPrompt }];

  if (extraMessages.length === 0) {
    // Initial generation
    messages.push({ role: "user", content: "Génère le post." });
  } else {
    // Continuation — extraMessages already contains the full conversation history
    for (const m of extraMessages) {
      if ((m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || "OpenAI request failed: " + response.status);
    }

    const data = await response.json();
    const post = data.choices?.[0]?.message?.content?.trim() || "";

    res.status(200).json({ ok: true, post });
  } catch (err) {
    console.error("[generate-post] OpenAI request failed", { message: String(err?.message || err) });
    res.status(500).json({ ok: false, error: err.message || "Generation failed" });
  }
};
