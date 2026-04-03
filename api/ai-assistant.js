const { isAuthenticated, parseCookies } = require("../lib/auth");
const { verifyToken } = require("../lib/collab-token");
const { enforceRateLimit, enforcePayloadLimit } = require("../lib/request-guards");

// Affiliate fields reference for the intake system prompt
const AFFILIATE_SCHEMA = `Fiche AFFILIÉ (type: "affiliate"):
  name          — Nom de la marque (requis)
  primaryUrl    — URL principal / promo (requis, https://...)
  promoCode     — Code promo/fan (optionnel)
  socialUrl     — URL profil social de la marque (optionnel)
  mentions      — Handles à mentionner dans les posts (ex: @brand)
  postRequirements — Exigences du post (texte libre)
  specificities — Notes spécifiques (texte libre)
  platform      — "x" | "onlyfans" | "autre"
  niche         — "lifestyle" | "adult-toys" | "business" | "autre"
  format        — "post" | "short-video" | "thread" | "reel"
  tone          — "authority" | "story" | "motivation"
  logos         — URLs de logos (jusqu'à 3, séparés par des virgules ou nouvelles lignes)
  mediaImages   — URLs d'images (une par ligne)
  mediaVideos   — URLs de vidéos (une par ligne)
  visibility    — Objet optionnel de visibilite par champ. Valeurs: "public", "private", "both".
                  Defauts affilie: name=both, primaryUrl=both, promoCode=public, socialUrl=private, mentions=private, postRequirements=private, specificities=private, logos=both, mediaImages=both, mediaVideos=both`;

const COLLABORATOR_SCHEMA = `Fiche COLLABORATEUR (type: "collaborator"):
  name          — Nom du/de la collaborateur/trice (requis)
  primaryUrl    — Lien principal public (requis, https://...)
  contact       — @handle ou email de contact
  email         — Email privé (optionnel)
  rates         — Tarifs / conditions / notes financières
  publicLinks   — Liens supplémentaires publics (un par ligne, format "Label: url" ou juste "url")
  privateLinks  — Liens privés (même format)
  taggedUrls    — URLs taggées (array): [{"label":"...","url":"https://...","tags":["..."],"visibility":"public|private|both"}]
  bookingDate   — Date du booking (ex: "25 avril", "April 25")
  bookingTime   — Heure (ex: "14h00", "2pm")
  bookingLocation — Lieu (ex: "Montréal", "DM pour adresse")
  platform      — "x" | "onlyfans" | "autre"
  niche         — "lifestyle" | "adult-toys" | "business" | "autre"
  format        — "post" | "short-video" | "thread" | "reel"
  tone          — "authority" | "story" | "motivation"
  logos         — URLs de logos (jusqu'à 3)
  mediaImages   — URLs d'images (une par ligne)
  mediaVideos   — URLs de vidéos (une par ligne)
  visibility    — Objet optionnel de visibilite par champ. Valeurs: "public", "private", "both".
                  Defauts collab: name=both, primaryUrl=both, publicLinks=public, privateLinks=private, contact=public, email=private, rates=private, booking=both, sourceNotes=private, logos=both, mediaImages=both, mediaVideos=both`;

const VOICE_GUIDE = `Ton de voix pour les posts (IMPORTANT — respecte ça en tout temps):
- Court. Très court. 3-5 phrases max.
- Comme un ado trop confiant qui s'en fout de ce que les gens pensent — mais qui a raison.
- Humour noir, ton mature, direct. Pas de niaiseries.
- Tu parles de toi, ton expérience, ton plaisir. Pas d'invitation. Pas de CTA.
- Langage simple, cru si nécessaire. Fautes naturelles. Phrases courtes. Parfois juste un mot.
- JAMAIS : "découvrez", "profitez", "incroyable", "vous allez adorer", "n'attendez plus", "cliquez", emojis cheesy.`;

function buildPostSystemPrompt(item, lang) {
  const langLabel = lang === "fr" ? "French" : "English";
  const isAffiliate = item.category === "affiliate" || (!item.category && item.promoCode);
  const specs = lang === "fr" ? (item.fr?.specs || "") : (item.en?.specs || "");
  const tags = lang === "fr" ? (item.fr?.tags || "") : (item.en?.tags || "");
  const caption = lang === "fr" ? (item.fr?.caption || "") : (item.en?.caption || "");

  // Build a complete context block from all available fields
  const lines = [];
  if (item.name) lines.push(`Nom: ${item.name}`);
  if (item.category) lines.push(`Catégorie: ${item.category}`);
  if (item.platform) lines.push(`Plateforme: ${item.platform}`);
  if (item.niche) lines.push(`Niche: ${item.niche}`);
  if (item.format) lines.push(`Format: ${item.format}`);
  if (item.tone) lines.push(`Ton: ${item.tone}`);

  if (isAffiliate) {
    if (item.primaryUrl) lines.push(`URL promo: ${item.primaryUrl}`);
    if (item.promoCode) lines.push(`Code promo: ${item.promoCode}`);
    if (item.socialUrl) lines.push(`Profil social: ${item.socialUrl}`);
    if (item.mentions) lines.push(`Mentions: ${item.mentions}`);
    if (item.postRequirements) lines.push(`Exigences du post: ${item.postRequirements}`);
    if (item.specificities) lines.push(`Spécificités: ${item.specificities}`);
  } else {
    if (item.primaryUrl) lines.push(`Lien principal: ${item.primaryUrl}`);
    if (item.contact) lines.push(`Contact: ${item.contact}`);
    if (item.email) lines.push(`Email: ${item.email}`);
    if (item.rates) lines.push(`Tarifs: ${item.rates}`);
    if (item.sourceNotes) lines.push(`Notes source: ${item.sourceNotes}`);
    const booking = item.booking || {};
    const bookingParts = [booking.dateLabel, booking.timeLabel, booking.location].filter(Boolean);
    if (bookingParts.length) lines.push(`Booking: ${bookingParts.join(" — ")}`);
    if (booking.note) lines.push(`Note booking: ${booking.note}`);
    const pubLinks = Array.isArray(item.publicLinks) ? item.publicLinks.map((l) => l.url || l).filter(Boolean) : [];
    if (pubLinks.length) lines.push(`Liens publics: ${pubLinks.join(", ")}`);
    const taggedUrls = Array.isArray(item.taggedUrls)
      ? item.taggedUrls.map((entry) => `${entry.label || "Link"}: ${entry.url || ""}`).filter(Boolean)
      : [];
    if (taggedUrls.length) lines.push(`Tagged URLs: ${taggedUrls.join(", ")}`);
  }

  if (specs) lines.push(`Specs: ${specs}`);
  if (tags) lines.push(`Hashtags à inclure: ${tags}`);
  if (caption) lines.push(`Caption existante: ${caption}`);
  const images = Array.isArray(item.mediaImages) ? item.mediaImages.filter(Boolean) : [];
  if (images.length) lines.push(`Images: ${images.join(", ")}`);
  const videos = Array.isArray(item.mediaVideos) ? item.mediaVideos.filter(Boolean) : [];
  if (videos.length) lines.push(`Vidéos: ${videos.join(", ")}`);

  const contextBlock = lines.join("\n");
  const typeLabel = isAffiliate ? "promotionnel" : "de collaboration";

  return `${VOICE_GUIDE}

Tu es un créateur de contenu OnlyFans. Écris un post ${typeLabel} en ${langLabel}.

Analyse bien toutes les infos de la fiche ci-dessous pour comprendre le contexte et utilise-les intelligemment dans le post:

${contextBlock}

Format: ${item.format || "post"}. Maximum 300 mots.`;
}

function buildIntakeSystemPrompt(entities) {
  const affiliateNames = (entities?.affiliates || []).map((a) => `  - "${a.name}" (id: ${a.id})`).join("\n") || "  (aucun)";
  const collaboratorNames = (entities?.collaborators || []).map((c) => `  - "${c.name}" (id: ${c.id})`).join("\n") || "  (aucun)";

  return `Tu es HeyHi, un assistant de saisie pour gérer des fiches d'affiliés et de collaborateurs/collaboratrices.

PERSONA HEYHI:
- Ton familier mais propre, sérieux, calme.
- Pas enthousiaste. Blagues rares.
- Tu aides sans en faire trop. Tu ne te laisses pas intimider.
- Tu t'adaptes au style d'écriture de l'utilisateur.

Ton rôle est de collecter les informations nécessaires pour créer ou modifier une fiche.

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
4. Le champ minimum pour créer une fiche: name + primaryUrl (affilié ou collaborateur).
5. Quand tu as les champs minimum, émets le bloc d'extraction dans ton message (même si tu poses encore des questions complémentaires):

[EXTRACTED]
{
  "entityType": "affiliate" | "collaborator",
  "editId": null | "id-existant",
  "fields": {
    "name": "...",
    "primaryUrl": "...",
    ... (tous les champs extraits disponibles)
  }
}
[/EXTRACTED]

6. Si l'utilisateur demande de SUPPRIMER une fiche existante, confirme le nom et l'id, puis émets:

[DELETE]
{
  "entityType": "affiliate" | "collaborator",
  "id": "id-de-la-fiche",
  "name": "nom-de-la-fiche"
}
[/DELETE]

7. Tu peux continuer la conversation après avoir émis le bloc (poser des questions pour raffiner).
8. Si l'utilisateur demande de générer un post après la saisie, réponds en mode créatif avec le ton décrit ici: ${VOICE_GUIDE}
9. Réponds dans la langue de l'utilisateur pour la conversation.
10. Sois bref et direct. Pas de longues explications.
11. Pour chaque fiche, assigne la visibilite de chaque champ dans un objet "visibility". Utilise les defauts du schema sauf si le contexte indique autrement (ex: email partage publiquement -> email: "public"). N'inclus dans visibility que les champs dont la valeur differe du defaut.
12. IMPORTANT: Tu peux converser dans la langue de l'utilisateur, MAIS toutes les valeurs structurées du bloc [EXTRACTED] doivent être en ANGLAIS canonique (labels, tags, booking notes générées, champs normalisés).
13. Si une traduction est ambiguë, pose une question de clarification avant d'émettre [EXTRACTED].
14. Scheduling policy: do NOT be overly strict. Overlaps are allowed if user accepts them. If you detect a likely overlap, warn briefly and propose an earlier alternative slot when possible.
15. Si le dernier message utilisateur est "__init__", commence par un mini mémo concret (5-8 lignes max):
  - Ce que HeyHi peut faire maintenant
  - Différence public/private/both, simplement
  - Rappel URL-only pour liens et documents
  - Exemple de 2 commandes utiles
  Le mémo doit rester court et actionnable.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (await enforceRateLimit(req, res, { name: "ai-assistant", limit: 60, windowMs: 5 * 60 * 1000 })) return;
  if (enforcePayloadLimit(req, res, 384 * 1024)) return;

  const isAdmin = isAuthenticated(req);
  const cookies = parseCookies(req.headers.cookie || "");
  const collaboratorId = verifyToken(cookies.collab_token || "");

  if (!isAdmin && !collaboratorId) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(501).json({ ok: false, error: "OPENAI_API_KEY not configured" });
    return;
  }

  let { mode = "post", lang = "fr", item = null, entities = {}, messages: extraMessages = [] } = req.body || {};

  if (mode !== "post" && mode !== "intake") {
    res.status(400).json({ ok: false, error: "Invalid mode" });
    return;
  }

  if (mode === "post" && (!item || typeof item !== "object")) {
    res.status(400).json({ ok: false, error: "Missing item payload for post mode" });
    return;
  }

  if (!isAdmin && collaboratorId) {
    if (mode === "post") {
      const itemId = String(item?.id || "").trim();
      if (!itemId || itemId !== collaboratorId) {
        res.status(403).json({ ok: false, error: "Forbidden for this collaborator" });
        return;
      }
    }

    if (mode === "intake") {
      entities = {
        affiliates: [],
        collaborators: [{ id: collaboratorId, name: String(item?.name || "My card") }]
      };
    }
  }

  // Build system prompt based on mode
  const systemPrompt = mode === "post"
    ? buildPostSystemPrompt(item, lang)
    : buildIntakeSystemPrompt(entities);

  // Build messages array
  const messages = [{ role: "system", content: systemPrompt }];

  if (mode === "post") {
    if (extraMessages.length === 0) {
      messages.push({ role: "user", content: "Generate the post." });
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
    let deleteRequest = null;
    let message = rawContent;

    if (mode === "intake") {
      const extractMatch = rawContent.match(/\[EXTRACTED\]([\s\S]*?)\[\/EXTRACTED\]/);
      if (extractMatch) {
        try {
          extracted = JSON.parse(extractMatch[1].trim());
        } catch (_) {
          extracted = null;
        }
      }

      const deleteMatch = rawContent.match(/\[DELETE\]([\s\S]*?)\[\/DELETE\]/);
      if (deleteMatch) {
        try {
          deleteRequest = JSON.parse(deleteMatch[1].trim());
        } catch (_) {
          deleteRequest = null;
        }
      }

      // Strip blocks from the visible message
      message = rawContent.replace(/\[EXTRACTED\][\s\S]*?\[\/EXTRACTED\]/g, "").replace(/\[DELETE\][\s\S]*?\[\/DELETE\]/g, "").trim();
    }

    if (mode === "post") {
      res.status(200).json({ ok: true, post: rawContent, message: rawContent });
    } else {
      res.status(200).json({ ok: true, message, extracted, deleteRequest });
    }
  } catch (err) {
    console.error("[ai-assistant] Assistant request failed", { message: String(err?.message || err) });
    res.status(500).json({ ok: false, error: err.message || "Assistant failed" });
  }
};
