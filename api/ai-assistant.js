const { isAuthenticated } = require("../lib/auth");

// Affiliate fields reference for the intake system prompt
const AFFILIATE_SCHEMA = `Fiche AFFILIÉ (type: "affiliate"):
  name          — Nom de la marque (requis)
  promoUrl      — URL promo (requis, https://...)
  promoCode     — Code promo/fan (optionnel)
  socialUrl     — URL profil social de la marque (optionnel)
  mentions      — Handles à mentionner dans les posts (ex: @brand)
  postRequirements — Exigences du post (texte libre)
  specificities — Notes spécifiques (texte libre)
  platform      — "instagram" | "tiktok" | "x"
  niche         — "fitness" | "business" | "lifestyle" | "adult-toys"
  format        — "reel" | "short-video" | "thread" | "post"
  tone          — "motivation" | "authority" | "story"
  logos         — URLs de logos (jusqu'à 3, séparés par des virgules ou nouvelles lignes)`;

const COLLABORATOR_SCHEMA = `Fiche COLLABORATEUR (type: "collaborator"):
  name          — Nom du/de la collaborateur/trice (requis)
  publicLink    — Lien principal public (requis, https://...)
  contact       — @handle ou email de contact
  email         — Email privé (optionnel)
  rates         — Tarifs / conditions / notes financières
  publicLinks   — Liens supplémentaires publics (un par ligne, format "Label: url" ou juste "url")
  privateLinks  — Liens privés (même format)
  bookingDate   — Date du booking (ex: "25 avril", "April 25")
  bookingTime   — Heure (ex: "14h00", "2pm")
  bookingLocation — Lieu (ex: "Montréal", "DM pour adresse")
  platform      — "instagram" | "tiktok" | "x"
  niche         — "fitness" | "business" | "lifestyle"
  format        — "reel" | "short-video" | "thread"
  tone          — "motivation" | "authority" | "story"
  logos         — URLs de logos (jusqu'à 3)`;

const VOICE_GUIDE = `Ton de voix pour les posts (IMPORTANT — respecte ça en tout temps):
- Court. Très court. 3-5 phrases max.
- Comme un ado trop confiant qui s'en fout de ce que les gens pensent — mais qui a raison.
- Humour noir, ton mature, direct. Pas de niaiseries.
- Tu parles de toi, ton expérience, ton plaisir. Pas d'invitation. Pas de CTA.
- Langage simple, cru si nécessaire. Fautes naturelles. Phrases courtes. Parfois juste un mot.
- JAMAIS : "découvrez", "profitez", "incroyable", "vous allez adorer", "n'attendez plus", "cliquez", emojis cheesy.`;

function buildPostSystemPrompt(item, lang) {
  const langLabel = lang === "fr" ? "français" : "English";
  const isAffiliate = !item.publicLink && item.promoUrl;
  const specs = lang === "fr" ? (item.fr?.specs || "") : (item.en?.specs || "");
  const tags = lang === "fr" ? (item.fr?.tags || "") : (item.en?.tags || "");

  if (isAffiliate) {
    return `${VOICE_GUIDE}

Tu es un créateur de contenu OnlyFans. Écris un post promotionnel en ${langLabel}.

Marque: ${item.name}
Plateforme: ${item.platform}
URL promo: ${item.promoUrl}${item.promoCode ? `\nCode promo: ${item.promoCode}` : ""}${item.mentions ? `\nMentions: ${item.mentions}` : ""}${item.postRequirements ? `\nExigences du post: ${item.postRequirements}` : ""}${item.specificities ? `\nSpécificités: ${item.specificities}` : ""}${specs ? `\nSpecs: ${specs}` : ""}${tags ? `\nHashtags à inclure: ${tags}` : ""}

Format: ${item.format || "post"}. Maximum 300 mots.`;
  }

  return `${VOICE_GUIDE}

Tu es un créateur de contenu OnlyFans. Écris un post de collaboration en ${langLabel}.

Collaborateur: ${item.name}
Plateforme: ${item.platform}
Lien: ${item.publicLink}${item.contact ? `\nContact: ${item.contact}` : ""}${item.rates ? `\nRates: ${item.rates}` : ""}${specs ? `\nSpecs de collaboration: ${specs}` : ""}${tags ? `\nHashtags à inclure: ${tags}` : ""}

Format: ${item.format || "short-video"}. Maximum 300 mots.`;
}

function buildIntakeSystemPrompt(entities) {
  const affiliateNames = (entities?.affiliates || []).map((a) => `  - "${a.name}" (id: ${a.id})`).join("\n") || "  (aucun)";
  const collaboratorNames = (entities?.collaborators || []).map((c) => `  - "${c.name}" (id: ${c.id})`).join("\n") || "  (aucun)";

  return `Tu es un assistant de saisie pour gérer des fiches d'affiliés et de collaborateurs/collaboratrices. Ton rôle est de collecter les informations nécessaires pour créer ou modifier une fiche.

FICHES EXISTANTES:
Affiliés:
${affiliateNames}

Collaborateurs:
${collaboratorNames}

SCHÉMAS:
${AFFILIATE_SCHEMA}

${COLLABORATOR_SCHEMA}

RÈGLES:
1. Pose des questions progressivement — pas tout en même temps. Commence par identifier le type (affilié ou collaborateur) et le nom.
2. Si l'utilisateur colle du texte brut (DM, email, message), extrais automatiquement tous les champs possibles sans poser de questions inutiles.
3. Si l'utilisateur mentionne un nom qui correspond à une fiche existante, utilise son id comme editId (modification) plutôt que création.
4. Le champ minimum pour créer une fiche: name + promoUrl (affilié) OU name + publicLink (collaborateur).
5. Quand tu as les champs minimum, émets le bloc d'extraction dans ton message (même si tu poses encore des questions complémentaires):

[EXTRACTED]
{
  "entityType": "affiliate" | "collaborator",
  "editId": null | "id-existant",
  "fields": {
    "name": "...",
    "promoUrl": "...",
    ... (tous les champs extraits disponibles)
  }
}
[/EXTRACTED]

6. Tu peux continuer la conversation après avoir émis le bloc (poser des questions pour raffiner).
7. Si l'utilisateur demande de générer un post après la saisie, réponds en mode créatif avec le ton décrit ici: ${VOICE_GUIDE}
8. Réponds toujours en français sauf si l'utilisateur écrit en anglais.
9. Sois bref et direct. Pas de longues explications.`;
}

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

  const { mode = "post", lang = "fr", item = null, entities = {}, messages: extraMessages = [] } = req.body || {};

  if (mode !== "post" && mode !== "intake") {
    res.status(400).json({ ok: false, error: "Invalid mode" });
    return;
  }

  if (mode === "post" && (!item || typeof item !== "object")) {
    res.status(400).json({ ok: false, error: "Missing item payload for post mode" });
    return;
  }

  // Build system prompt based on mode
  const systemPrompt = mode === "post"
    ? buildPostSystemPrompt(item, lang)
    : buildIntakeSystemPrompt(entities);

  // Build messages array
  const messages = [{ role: "system", content: systemPrompt }];

  if (mode === "post") {
    if (extraMessages.length === 0) {
      messages.push({ role: "user", content: "Génère le post." });
    } else {
      for (const m of extraMessages) {
        if ((m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
  } else {
    // intake mode — pass full conversation history
    for (const m of extraMessages) {
      if ((m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
        messages.push({ role: m.role, content: m.content });
      }
    }
    // If no history yet, the frontend sends an empty array and we return the initial greeting
    if (extraMessages.length === 0) {
      messages.push({ role: "user", content: "__init__" });
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
        max_tokens: mode === "post" ? 500 : 800,
        temperature: mode === "post" ? 0.8 : 0.4
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || "OpenAI request failed: " + response.status);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || "";

    // Parse [EXTRACTED]...[/EXTRACTED] block for intake mode
    let extracted = null;
    let message = rawContent;

    if (mode === "intake") {
      const extractMatch = rawContent.match(/\[EXTRACTED\]([\s\S]*?)\[\/EXTRACTED\]/);
      if (extractMatch) {
        try {
          extracted = JSON.parse(extractMatch[1].trim());
        } catch (_) {
          extracted = null;
        }
        // Strip the block from the visible message
        message = rawContent.replace(/\[EXTRACTED\][\s\S]*?\[\/EXTRACTED\]/g, "").trim();
      }
    }

    if (mode === "post") {
      res.status(200).json({ ok: true, post: rawContent, message: rawContent });
    } else {
      res.status(200).json({ ok: true, message, extracted });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "Assistant failed" });
  }
};
