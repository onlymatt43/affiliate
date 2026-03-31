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

  const voiceGuide = `Ton de voix (IMPORTANT — respecte ça en tout temps):
- Neutre, sexy, confident. Jamais enthousiaste, jamais vendeur.
- Tu parles de TON plaisir, ton expérience, ta satisfaction personnelle. Tu n'invites pas — ça va de soi que les gens feront pareil.
- Langage simple, direct. Mots courts. Pas de jargon marketing.
- Ton qui varie : parfois plus chill, parfois plus intime, parfois matter-of-fact.
- Écris comme un humain : petites fautes, phrases incomplètes ok, pas parfait. Genre "j'ai essayé ça pis..." ou "honnêtement c'est bon".
- JAMAIS : "découvrez", "profitez", "n'attendez plus", "incroyable", "vous allez adorer", "cliquez ici", "offre limitée".`;

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
    res.status(500).json({ ok: false, error: err.message || "Generation failed" });
  }
};
