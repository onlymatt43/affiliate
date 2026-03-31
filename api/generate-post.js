const { isAuthenticated } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

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

  let systemPrompt = "";

  if (isAffiliate) {
    const specs = lang === "fr" ? (item.fr?.specs || "") : (item.en?.specs || "");
    const tags = lang === "fr" ? (item.fr?.tags || "") : (item.en?.tags || "");
    systemPrompt = `Tu es un créateur de contenu OnlyFans qui écrit des posts promotionnels en ${langLabel}.

Marque: ${item.name}
Plateforme: ${item.platform}
URL promo: ${item.promoUrl}${item.promoCode ? `\nCode promo: ${item.promoCode}` : ""}${item.mentions ? `\nMentions: ${item.mentions}` : ""}${item.postRequirements ? `\nExigences du post: ${item.postRequirements}` : ""}${item.specificities ? `\nSpécificités: ${item.specificities}` : ""}${specs ? `\nSpecs: ${specs}` : ""}${tags ? `\nHashtags à inclure: ${tags}` : ""}

Ton: ${item.tone}. Format: ${item.format}. Sois naturel, engageant, authentique. Inclure le lien et les hashtags fournis. Maximum 300 mots.`;
  } else {
    const specs = lang === "fr" ? (item.fr?.specs || "") : (item.en?.specs || "");
    const tags = lang === "fr" ? (item.fr?.tags || "") : (item.en?.tags || "");
    systemPrompt = `Tu es un créateur de contenu OnlyFans qui écrit des posts de collaboration en ${langLabel}.

Collaborateur: ${item.name}
Plateforme: ${item.platform}
Lien: ${item.publicLink}${item.contact ? `\nContact: ${item.contact}` : ""}${item.rates ? `\nRates: ${item.rates}` : ""}${specs ? `\nSpecs de collaboration: ${specs}` : ""}${tags ? `\nHashtags à inclure: ${tags}` : ""}

Ton: ${item.tone || "authority"}. Format: ${item.format || "short-video"}. Sois naturel, engageant, authentique. Maximum 300 mots.`;
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
    res.status(500).json({ ok: false, error: err.message || "Generation failed" });
  }
};
