const state = {
  activeEntity: "affiliates",
  activeLang: "fr",
  viewMode: "full",
  isUnlocked: false,
  authMode: "api",
  debug: {
    enabled: new URLSearchParams(window.location.search).get("debug") === "1",
    loadSourceAffiliates: "unknown",
    loadSourceCollaborators: "unknown",
    loadErrorAffiliates: "",
    loadErrorCollaborators: "",
    renderedCount: 0,
    visibleCount: 0,
    initError: ""
  },
  persistenceByEntity: {
    affiliates: { mode: "local", writable: false },
    collaborators: { mode: "local", writable: false }
  },
  editingAffiliateId: null,
  editingCollaboratorId: null,
  affiliates: [],
  baseAffiliates: [],
  localAffiliates: [],
  collaborators: [],
  baseCollaborators: [],
  localCollaborators: []
};

const metaCache = new Map();

const refs = {
  cardsGrid: document.getElementById("cardsGrid"),
  entityButtons: Array.from(document.querySelectorAll(".entity-btn")),
  searchInput: document.getElementById("searchInput"),
  platformFilter: document.getElementById("platformFilter"),
  nicheFilter: document.getElementById("nicheFilter"),
  formatFilter: document.getElementById("formatFilter"),
  toneFilter: document.getElementById("toneFilter"),
  upcomingBookingsToggle: document.getElementById("upcomingBookingsToggle"),
  resultsInfo: document.getElementById("resultsInfo"),
  debugInfo: document.getElementById("debugInfo"),
  emptyState: document.getElementById("emptyState"),
  langButtons: Array.from(document.querySelectorAll(".lang-btn")),
  viewButtons: Array.from(document.querySelectorAll(".view-btn")),
  copyAllTemplate: document.getElementById("copyAllTemplate"),
  copyAllCollaboratorTemplate: document.getElementById("copyAllCollaboratorTemplate"),
  composerTitle: document.getElementById("composerTitle"),
  composerSubtitle: document.getElementById("composerSubtitle"),
  importTitle: document.getElementById("importTitle"),
  importSubtitle: document.getElementById("importSubtitle"),
  affiliateForm: document.getElementById("affiliateForm"),
  submitAffiliateBtn: document.getElementById("submitAffiliateBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  formFeedback: document.getElementById("formFeedback"),
  unlockInput: document.getElementById("unlockInput"),
  unlockBtn: document.getElementById("unlockBtn"),
  lockBtn: document.getElementById("lockBtn"),
  accessStatus: document.getElementById("accessStatus")
};

const LOCAL_STORAGE_KEY = "affiliateHubLocalAffiliates";
const COLLABORATOR_LOCAL_STORAGE_KEY = "affiliateHubLocalCollaborators";
const VIEW_MODE_STORAGE_KEY = "affiliateHubViewMode";
const AUTO_EXPORT_STORAGE_KEY = "affiliateHubAutoExportLocal";
const API_ONLY_TESTING = true;

function updateDebugInfo() {
  if (!refs.debugInfo) return;
  if (!state.debug.enabled) {
    refs.debugInfo.classList.add("is-hidden");
    refs.debugInfo.textContent = "";
    return;
  }

  const lines = [
    `debug=1 | entity=${state.activeEntity} | unlocked=${state.isUnlocked ? "yes" : "no"} | authMode=${state.authMode}`,
    `load affiliates=${state.debug.loadSourceAffiliates}${state.debug.loadErrorAffiliates ? ` (error: ${state.debug.loadErrorAffiliates})` : ""}`,
    `load collaborators=${state.debug.loadSourceCollaborators}${state.debug.loadErrorCollaborators ? ` (error: ${state.debug.loadErrorCollaborators})` : ""}`,
    `counts affiliates base=${state.baseAffiliates.length} local=${state.localAffiliates.length} merged=${state.affiliates.length}`,
    `counts collaborators base=${state.baseCollaborators.length} local=${state.localCollaborators.length} merged=${state.collaborators.length}`,
    `cards rendered=${state.debug.renderedCount} visible=${state.debug.visibleCount}`,
    `filters search='${refs.searchInput?.value || ""}' platform=${refs.platformFilter?.value || "all"} niche=${refs.nicheFilter?.value || "all"} format=${refs.formatFilter?.value || "all"} tone=${refs.toneFilter?.value || "all"} upcoming=${refs.upcomingBookingsToggle?.checked ? "on" : "off"}`
  ];

  if (state.debug.initError) {
    lines.push(`init error=${state.debug.initError}`);
  }

  refs.debugInfo.textContent = lines.join("\n");
  refs.debugInfo.classList.remove("is-hidden");
}

const PLATFORM_LABELS = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X"
};

const NICHE_LABELS = {
  fitness: "Fitness",
  business: "Business",
  lifestyle: "Lifestyle"
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toText(value) {
  return String(value || "").trim();
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function normalizeLogoUrls(raw) {
  const values = [];

  if (Array.isArray(raw)) {
    values.push(...raw);
  } else if (typeof raw === "string") {
    values.push(...raw.split(/[,\n]/g));
  } else if (raw) {
    values.push(raw);
  }

  const deduped = [];
  const seen = new Set();

  values.forEach((value) => {
    const url = toText(value);
    if (!url || !isValidHttpUrl(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    deduped.push(url);
  });

  return deduped.slice(0, 3);
}

function logoStripMarkup(logos, affiliateName) {
  if (!Array.isArray(logos) || logos.length === 0) return "";

  return `
    <div class="logo-strip" aria-label="Logos ${escapeHtml(affiliateName)}">
      ${logos
        .map(
          (logoUrl, index) =>
            `<img src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(affiliateName)} ${index + 1}" class="logo-chip" loading="lazy" />`
        )
        .join("")}
    </div>
  `;
}

function normalizeAffiliateShape(raw, index) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Element ${index + 1}: format invalide`);
  }

  const name = toText(raw.name) || `Affiliation ${index + 1}`;
  const platform = toText(raw.platform) || "instagram";
  const niche = toText(raw.niche) || "business";
  const format = toText(raw.format) || "short-video";
  const tone = toText(raw.tone) || "authority";

  const promoUrlRaw = toText(raw.promoUrl || raw.contactUrl);
  const promoUrl = isValidHttpUrl(promoUrlRaw) ? promoUrlRaw : "";
  const promoCode = toText(raw.promoCode || raw.code);
  const socialUrlRaw = toText(raw.socialUrl || raw.contactUrl);
  const socialUrl = isValidHttpUrl(socialUrlRaw) ? socialUrlRaw : "";
  const mentions = toText(raw.mentions);
  const postRequirements = toText(raw.postRequirements || raw.fr?.specs);
  const specificities = toText(raw.specificities);
  const rawLogoCandidates = [];
  if (Array.isArray(raw.logos)) rawLogoCandidates.push(...raw.logos);
  else rawLogoCandidates.push(raw.logos);
  if (Array.isArray(raw.logoUrls)) rawLogoCandidates.push(...raw.logoUrls);
  else rawLogoCandidates.push(raw.logoUrls);
  rawLogoCandidates.push(raw.logo, raw.logo1, raw.logo2, raw.logo3);
  const logos = normalizeLogoUrls(rawLogoCandidates);

  const fr = raw.fr || {};
  const en = raw.en || {};

  return {
    id: raw.id ? String(raw.id).trim() : `${slugify(name) || "affiliate"}-${Date.now()}-${index}`,
    name,
    platform,
    niche,
    format,
    tone,
    promoUrl,
    promoCode,
    socialUrl,
    mentions,
    postRequirements,
    specificities,
    logos,
    fr: {
      tags: toText(fr.tags),
      specs: toText(fr.specs),
      caption: toText(fr.caption)
    },
    en: {
      tags: toText(en.tags),
      specs: toText(en.specs),
      caption: toText(en.caption)
    }
  };
}

function normalizePrivateLinks(raw) {
  const values = [];
  if (Array.isArray(raw)) values.push(...raw);
  else if (typeof raw === "string") values.push(...raw.split(/[\n,]/g));
  else if (raw && typeof raw === "object") values.push(raw);

  const deduped = [];
  const seen = new Set();

  values.forEach((entry, index) => {
    if (entry && typeof entry === "object") {
      const label = toText(entry.label) || `Lien ${index + 1}`;
      const url = toText(entry.url);
      if (!isValidHttpUrl(url) || seen.has(url)) return;
      seen.add(url);
      deduped.push({ label, url });
      return;
    }

    const url = toText(entry);
    if (!isValidHttpUrl(url) || seen.has(url)) return;
    seen.add(url);
    deduped.push({ label: `Lien ${deduped.length + 1}`, url });
  });

  return deduped;
}

function normalizeBooking(raw) {
  const booking = raw && typeof raw === "object" ? raw : {};

  return {
    dateLabel: toText(booking.dateLabel || booking.date),
    timeLabel: toText(booking.timeLabel || booking.time),
    location: toText(booking.location || booking.place),
    note: toText(booking.note)
  };
}

function bookingSummary(raw) {
  const booking = normalizeBooking(raw);
  const parts = [booking.dateLabel, booking.timeLabel, booking.location].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return booking.note;
}

const MONTH_TOKEN_TO_INDEX = {
  jan: 0,
  january: 0,
  janvier: 0,
  enero: 0,
  feb: 1,
  february: 1,
  fevrier: 1,
  febrero: 1,
  mar: 2,
  march: 2,
  mars: 2,
  marzo: 2,
  apr: 3,
  april: 3,
  avril: 3,
  abril: 3,
  may: 4,
  mai: 4,
  mayo: 4,
  jun: 5,
  june: 5,
  juin: 5,
  junio: 5,
  jul: 6,
  july: 6,
  juillet: 6,
  julio: 6,
  aug: 7,
  august: 7,
  aout: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  september: 8,
  septembre: 8,
  setiembre: 8,
  oct: 9,
  october: 9,
  octobre: 9,
  octubre: 9,
  nov: 10,
  november: 10,
  novembre: 10,
  noviembre: 10,
  dec: 11,
  december: 11,
  decembre: 11,
  diciembre: 11
};

function normalizeTextForDate(value) {
  return toText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractDay(value) {
  const match = toText(value).match(/\b([0-3]?\d)(?:st|nd|rd|th)?\b/i);
  if (!match) return null;
  const day = Number(match[1]);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function extractMonthIndex(...values) {
  const source = normalizeTextForDate(values.filter(Boolean).join(" "));
  if (!source) return null;

  for (const [token, monthIndex] of Object.entries(MONTH_TOKEN_TO_INDEX)) {
    if (source.includes(token)) return monthIndex;
  }

  const numericMonth = source.match(/\b([0-3]?\d)\s*[\/.-]\s*([0-1]?\d)(?:\s*[\/.-]\s*(\d{2,4}))?\b/);
  if (numericMonth) {
    const month = Number(numericMonth[2]);
    if (month >= 1 && month <= 12) return month - 1;
  }

  return null;
}

function extractYear(...values) {
  const source = values.filter(Boolean).join(" ");
  const match = source.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function extractTimeParts(value) {
  const source = toText(value);
  if (!source) return null;

  const match = source.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const suffix = (match[3] || "").toLowerCase();

  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;

  return { hours, minutes };
}

function getBookingTimestamp(item, now = new Date()) {
  const booking = normalizeBooking(item?.booking);
  const day = extractDay(booking.dateLabel);
  if (!day) return null;

  const monthIndex = extractMonthIndex(booking.dateLabel, item?.rates, item?.sourceNotes);
  const explicitYear = extractYear(booking.dateLabel, item?.rates, item?.sourceNotes);
  const year = explicitYear || now.getFullYear();
  const month = monthIndex ?? now.getMonth();
  const timeParts = extractTimeParts(booking.timeLabel) || { hours: 9, minutes: 0 };

  const candidate = new Date(year, month, day, timeParts.hours, timeParts.minutes, 0, 0);
  if (Number.isNaN(candidate.getTime())) return null;

  if (!explicitYear && monthIndex == null && candidate.getTime() < now.getTime()) {
    candidate.setMonth(candidate.getMonth() + 1);
  }

  if (!explicitYear && monthIndex != null && candidate.getTime() < now.getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }

  return candidate.getTime();
}

function titleCaseWords(value) {
  return toText(value)
    .split(/\s+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanDetectedUrl(value) {
  const trimmed = toText(value).replace(/[),.;]+$/g, "");
  if (!trimmed) return "";
  if (/^(?:t\.me|x\.com|twitter\.com|instagram\.com|tiktok\.com)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function extractUrlCandidates(rawText) {
  const candidates = [];
  const seen = new Set();
  const patterns = [
    /https?:\/\/[^\s<>"]+/gi,
    /\b(?:t\.me|x\.com|twitter\.com|instagram\.com|tiktok\.com)\/[^\s<>"]+/gi
  ];

  patterns.forEach((pattern) => {
    const matches = rawText.match(pattern) || [];
    matches.forEach((match) => {
      const cleaned = cleanDetectedUrl(match);
      if (!isValidHttpUrl(cleaned)) return;
      const dedupeKey = cleaned.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      candidates.push(cleaned);
    });
  });

  return candidates;
}

function detectPrivateLinkLabel(url, index) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (hostname === "t.me") return "Telegram";
    if (hostname === "t.co") return "Tracking";
    if (hostname.includes("drive.google.com")) return "Drive";
    if (hostname.includes("justfor.fans")) return "JustForFans";
    if (hostname.includes("linktr.ee")) return "Linktree";
  } catch (error) {
    return `Lien ${index + 1}`;
  }

  return `Lien ${index + 1}`;
}

function extractCollaboratorInsights(rawText) {
  const source = toText(rawText);
  if (!source) {
    return {
      publicLink: "",
      privateLinks: [],
      contact: "",
      booking: normalizeBooking(null)
    };
  }

  const urls = extractUrlCandidates(source);
  const emails = Array.from(new Set(source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []));
  const handles = Array.from(new Set((source.match(/(^|[\s(/])@[A-Za-z0-9_]{2,32}\b/gm) || [])
    .map((match) => match.trim())
    .map((match) => match.replace(/^[(/\s]+/, ""))));

  const publicLink = urls.find((url) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      return ["x.com", "twitter.com", "instagram.com", "tiktok.com"].includes(hostname);
    } catch (error) {
      return false;
    }
  }) || urls[0] || "";

  const privateLinks = urls
    .filter((url) => url !== publicLink)
    .map((url, index) => ({ label: detectPrivateLinkLabel(url, index), url }));

  const telegramHandles = privateLinks
    .filter((entry) => entry.label === "Telegram")
    .map((entry) => {
      const match = entry.url.match(/t\.me\/([A-Za-z0-9_]+)/i);
      return match ? `@${match[1]}` : "";
    })
    .filter(Boolean);

  const contactParts = [];
  if (handles.length > 0) contactParts.push(handles.join(" / "));
  if (emails.length > 0) contactParts.push(emails.join(" / "));
  if (telegramHandles.length > 0) contactParts.push(`Telegram: ${telegramHandles.join(" / ")}`);

  const scheduleMatch = source.match(/\b(?:for\s+the\s+|on\s+the\s+|the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?:\s+at\s+|\s*@\s*)(\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i);
  const locationMatch = source.match(/\bat\s+(?:the\s+)?([A-Za-z][A-Za-z0-9' -]{1,60}(?:hotel|club|studio|bar|cafe|café|restaurant|resort|villa|house))\b/i);
  const noteMatch = source.match(/can you confirm our collab.*?(?:[.!?]|$)/i);

  return {
    publicLink,
    privateLinks,
    contact: contactParts.join(" / "),
    booking: {
      dateLabel: scheduleMatch ? `${scheduleMatch[1]}th` : "",
      timeLabel: scheduleMatch ? scheduleMatch[2].toUpperCase().replace(/\s+/g, "") : "",
      location: locationMatch ? titleCaseWords(locationMatch[1]) : "",
      note: noteMatch ? toText(noteMatch[0]) : ""
    }
  };
}

function normalizeCollaboratorShape(raw, index) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Element ${index + 1}: format invalide`);
  }

  const name = toText(raw.name);
  if (!name) {
    throw new Error(`Element ${index + 1}: name est requis`);
  }

  const publicLinkRaw = toText(raw.publicLink || raw.mainLink || raw.link);
  if (!isValidHttpUrl(publicLinkRaw)) {
    throw new Error(`Element ${index + 1}: publicLink invalide`);
  }

  const platform = toText(raw.platform) || "instagram";
  const niche = toText(raw.niche) || "business";
  const format = toText(raw.format) || "short-video";
  const tone = toText(raw.tone) || "authority";
  const fr = raw.fr || {};
  const en = raw.en || {};
  const booking = normalizeBooking(raw.booking);

  return {
    id: raw.id ? String(raw.id).trim() : `${slugify(name) || "collaborator"}-${Date.now()}-${index}`,
    name,
    platform,
    niche,
    format,
    tone,
    publicLink: publicLinkRaw,
    privateLinks: normalizePrivateLinks(raw.privateLinks),
    contact: toText(raw.contact),
    rates: toText(raw.rates),
    sourceNotes: toText(raw.sourceNotes),
    booking,
    logos: normalizeLogoUrls(raw.logos),
    fr: {
      tags: toText(fr.tags),
      specs: toText(fr.specs),
      caption: toText(fr.caption)
    },
    en: {
      tags: toText(en.tags),
      specs: toText(en.specs),
      caption: toText(en.caption)
    }
  };
}

function activePersistence() {
  return state.persistenceByEntity[state.activeEntity] || { mode: "local", writable: false };
}

function isCollaboratorMode() {
  return state.activeEntity === "collaborators";
}

function getActiveItems() {
  return isCollaboratorMode() ? state.collaborators : state.affiliates;
}

function publicCardMarkup(item, platformLabel, nicheLabel) {
  return `
    <article class="affiliate-card public-card" data-id="${escapeHtml(item.id)}" data-promo-url="${escapeHtml(item.promoUrl)}" data-promo-code="${escapeHtml(item.promoCode)}">
      <div class="preview-shell" data-preview-shell="${escapeHtml(item.id)}">
        <img class="preview-image is-hidden" data-preview-image="${escapeHtml(item.id)}" alt="Apercu du lien promo" loading="lazy" />
        <div class="preview-fallback" data-preview-fallback="${escapeHtml(item.id)}">Apercu lien</div>
      </div>

      ${logoStripMarkup(item.logos, item.name)}

      <div class="card-head">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
        </div>
      </div>

      <section class="content-block affiliation-kit">
        <div class="kit-row">
          <span class="kit-label">Promo URL</span>
          ${item.promoUrl ? `<a href="${escapeHtml(item.promoUrl)}" target="_blank" rel="noopener noreferrer" class="kit-link">${escapeHtml(item.promoUrl)}</a>` : `<span class="kit-value">-</span>`}
        </div>
        <div class="kit-row">
          <span class="kit-label">Code fan</span>
          <span class="kit-value">${escapeHtml(item.promoCode || "-")}</span>
        </div>
      </section>
    </article>
  `;
}

function privateCardMarkup(item, platformLabel, nicheLabel) {
  const socialLink = item.socialUrl
    ? `<a href="${escapeHtml(item.socialUrl)}" target="_blank" rel="noopener noreferrer" class="contact-link">Profil social</a>`
    : "";

  return `
    <article
      class="affiliate-card"
      data-id="${escapeHtml(item.id)}"
      data-platform="${escapeHtml(item.platform)}"
      data-niche="${escapeHtml(item.niche)}"
      data-format="${escapeHtml(item.format)}"
      data-tone="${escapeHtml(item.tone)}"
      data-promo-url="${escapeHtml(item.promoUrl)}"
      data-promo-code="${escapeHtml(item.promoCode)}"
      data-mentions="${escapeHtml(item.mentions)}"
      data-post-requirements="${escapeHtml(item.postRequirements)}"
      data-specificities="${escapeHtml(item.specificities)}"
      data-logos="${escapeHtml(JSON.stringify(item.logos || []))}"
      data-social-url="${escapeHtml(item.socialUrl)}">
      ${logoStripMarkup(item.logos, item.name)}

      <div class="card-head">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <p class="meta">${escapeHtml(platformLabel)} · ${escapeHtml(nicheLabel)}</p>
        </div>
        <div class="card-head__actions">${socialLink}</div>
      </div>

      <section class="content-block affiliation-kit">
        <h3>Kit affiliation</h3>
        <div class="kit-row">
          <span class="kit-label">Promo URL</span>
          ${item.promoUrl ? `<a href="${escapeHtml(item.promoUrl)}" target="_blank" rel="noopener noreferrer" class="kit-link">${escapeHtml(item.promoUrl)}</a>` : `<span class="kit-value">-</span>`}
        </div>
        <div class="kit-row">
          <span class="kit-label">Code fan</span>
          <span class="kit-value">${escapeHtml(item.promoCode || "-")}</span>
        </div>
        <div class="kit-row">
          <span class="kit-label">Mentions</span>
          <span class="kit-value">${escapeHtml(item.mentions || "-")}</span>
        </div>
        <div class="kit-row">
          <span class="kit-label">Demandes post</span>
          <span class="kit-value">${escapeHtml(item.postRequirements || "-")}</span>
        </div>
        <div class="kit-row">
          <span class="kit-label">Specificites</span>
          <span class="kit-value">${escapeHtml(item.specificities || "-")}</span>
        </div>
      </section>

      <div class="lang-panel" data-lang="fr">
        <section class="content-block">
          <h3>Tags (FR)</h3>
          <pre class="copy-source" data-copy="tags">${escapeHtml(item.fr.tags)}</pre>
        </section>
        <section class="content-block">
          <h3>Specifications post (FR)</h3>
          <pre class="copy-source" data-copy="specs">${escapeHtml(item.fr.specs)}</pre>
        </section>
        <section class="content-block">
          <h3>Caption exemple (FR)</h3>
          <pre class="copy-source" data-copy="caption">${escapeHtml(item.fr.caption)}</pre>
        </section>
      </div>

      <div class="lang-panel is-hidden" data-lang="en">
        <section class="content-block">
          <h3>Tags (EN)</h3>
          <pre class="copy-source" data-copy="tags">${escapeHtml(item.en.tags)}</pre>
        </section>
        <section class="content-block">
          <h3>Post specs (EN)</h3>
          <pre class="copy-source" data-copy="specs">${escapeHtml(item.en.specs)}</pre>
        </section>
        <section class="content-block">
          <h3>Caption sample (EN)</h3>
          <pre class="copy-source" data-copy="caption">${escapeHtml(item.en.caption)}</pre>
        </section>
      </div>

      <div class="card-actions">
        <button type="button" data-action="copy-promo-url">Copier URL promo</button>
        <button type="button" data-action="copy-promo-code">Copier code</button>
        <button type="button" data-action="copy-affiliation-kit">Copier kit affiliation</button>
        <button type="button" data-action="copy-tags">Copier tags</button>
        <button type="button" data-action="copy-specs">Copier specs</button>
        <button type="button" data-action="edit">Modifier</button>
        <button type="button" data-action="duplicate">Dupliquer bloc</button>
        <button type="button" data-action="copy-all" class="accent">Copier tout</button>
        <span class="copy-feedback" aria-live="polite"></span>
      </div>
    </article>
  `;
}

function collaboratorPublicCardMarkup(item, platformLabel, nicheLabel) {
  const allLinks = [];
  if (item.publicLink) {
    let display = item.publicLink;
    try {
      const u = new URL(item.publicLink);
      display = u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
    } catch (_) {}
    allLinks.push({ label: display, url: item.publicLink });
  }
  (item.privateLinks || []).forEach((pl) => allLinks.push(pl));

  const linksMarkup = allLinks
    .map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="collab-panel__link">${escapeHtml(l.label || l.url)}</a>`)
    .join("");

  const contactMarkup = item.contact
    ? `<div class="collab-panel__copy-row" data-action="copy-contact-inline" data-copy-value="${escapeHtml(item.contact)}" title="Cliquer pour copier">${escapeHtml(item.contact)}</div>`
    : "";

  return `
    <article
      class="affiliate-card collaborator-card public-card"
      data-id="${escapeHtml(item.id)}"
      data-public-link="${escapeHtml(item.publicLink)}"
      tabindex="0">
      <div class="collab-bg">
        <div class="collab-bg__fallback" data-preview-fallback="${escapeHtml(item.id)}"></div>
        <img class="collab-bg__img is-hidden" data-preview-image="${escapeHtml(item.id)}" alt="" loading="lazy" />
      </div>
      <div class="collab-overlay">
        ${logoStripMarkup(item.logos, item.name)}
        <div class="collab-info">
          <h2>${escapeHtml(item.name)}</h2>
          <p class="meta">${escapeHtml(platformLabel)} · ${escapeHtml(nicheLabel)}</p>
        </div>
      </div>
      <div class="collab-panel">
        <div class="collab-panel__name">${escapeHtml(item.name)}</div>
        <div class="collab-panel__links">${linksMarkup}</div>
        ${contactMarkup}
      </div>
    </article>
  `;
}

function collaboratorPrivateCardMarkup(item, platformLabel, nicheLabel) {
  const privateLinksText = item.privateLinks?.length
    ? item.privateLinks.map((entry) => `${entry.label}: ${entry.url}`).join("\n")
    : "-";
  const bookingText = bookingSummary(item.booking) || "-";
  const bookingTs = getBookingTimestamp(item);

  return `
    <article
      class="affiliate-card collaborator-card"
      data-id="${escapeHtml(item.id)}"
      data-platform="${escapeHtml(item.platform)}"
      data-niche="${escapeHtml(item.niche)}"
      data-format="${escapeHtml(item.format)}"
      data-tone="${escapeHtml(item.tone)}"
      data-public-link="${escapeHtml(item.publicLink)}"
      data-private-links="${escapeHtml(JSON.stringify(item.privateLinks || []))}"
      data-contact="${escapeHtml(item.contact)}"
      data-rates="${escapeHtml(item.rates)}"
      data-booking="${escapeHtml(JSON.stringify(item.booking || {}))}"
      data-booking-ts="${bookingTs || ""}"
      data-logos="${escapeHtml(JSON.stringify(item.logos || []))}">
      <div class="preview-shell" data-preview-shell="${escapeHtml(item.id)}">
        <img class="preview-image is-hidden" data-preview-image="${escapeHtml(item.id)}" alt="Apercu du lien principal" loading="lazy" />
        <div class="preview-fallback" data-preview-fallback="${escapeHtml(item.id)}">Apercu lien</div>
      </div>
      ${logoStripMarkup(item.logos, item.name)}

      <div class="card-head">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <p class="meta">${escapeHtml(platformLabel)} · ${escapeHtml(nicheLabel)}</p>
        </div>
      </div>

      <section class="content-block affiliation-kit">
        <h3>Kit collaboration</h3>
        <div class="kit-row">
          <span class="kit-label">Lien principal</span>
          <a href="${escapeHtml(item.publicLink)}" target="_blank" rel="noopener noreferrer" class="kit-link">Ouvrir</a>
        </div>
        <div class="kit-row">
          <span class="kit-label">Contact</span>
          <span class="kit-value">${escapeHtml(item.contact || "-")}</span>
        </div>
        <div class="kit-row">
          <span class="kit-label">Rates</span>
          <span class="kit-value">${escapeHtml(item.rates || "-")}</span>
        </div>
        <div class="kit-row">
          <span class="kit-label">Booking</span>
          <span class="kit-value">${escapeHtml(bookingText)}</span>
        </div>
        <div class="kit-row">
          <span class="kit-label">Liens prives</span>
          <span class="kit-value">${escapeHtml(privateLinksText)}</span>
        </div>
      </section>

      <div class="lang-panel" data-lang="fr">
        <section class="content-block">
          <h3>Tags (FR)</h3>
          <pre class="copy-source" data-copy="tags">${escapeHtml(item.fr.tags)}</pre>
        </section>
        <section class="content-block">
          <h3>Specifications (FR)</h3>
          <pre class="copy-source" data-copy="specs">${escapeHtml(item.fr.specs)}</pre>
        </section>
        <section class="content-block">
          <h3>Caption (FR)</h3>
          <pre class="copy-source" data-copy="caption">${escapeHtml(item.fr.caption)}</pre>
        </section>
      </div>

      <div class="lang-panel is-hidden" data-lang="en">
        <section class="content-block">
          <h3>Tags (EN)</h3>
          <pre class="copy-source" data-copy="tags">${escapeHtml(item.en.tags)}</pre>
        </section>
        <section class="content-block">
          <h3>Specifications (EN)</h3>
          <pre class="copy-source" data-copy="specs">${escapeHtml(item.en.specs)}</pre>
        </section>
        <section class="content-block">
          <h3>Caption (EN)</h3>
          <pre class="copy-source" data-copy="caption">${escapeHtml(item.en.caption)}</pre>
        </section>
      </div>

      <div class="card-actions">
        <button type="button" data-action="copy-public-link">Copier lien principal</button>
        <button type="button" data-action="copy-contact">Copier contact</button>
        <button type="button" data-action="copy-collaboration-kit">Copier kit collaboration</button>
        <button type="button" data-action="edit">Modifier</button>
        <button type="button" data-action="duplicate">Dupliquer bloc</button>
        <button type="button" data-action="copy-all" class="accent">Copier tout</button>
        <span class="copy-feedback" aria-live="polite"></span>
      </div>
    </article>
  `;
}

function cardMarkup(item) {
  const platformLabel = PLATFORM_LABELS[item.platform] || item.platform;
  const nicheLabel = NICHE_LABELS[item.niche] || item.niche;

  if (isCollaboratorMode()) {
    if (!state.isUnlocked) {
      return collaboratorPublicCardMarkup(item, platformLabel, nicheLabel);
    }
    return collaboratorPrivateCardMarkup(item, platformLabel, nicheLabel);
  }

  if (!state.isUnlocked) {
    return publicCardMarkup(item, platformLabel, nicheLabel);
  }

  return privateCardMarkup(item, platformLabel, nicheLabel);
}

async function fetchLinkMeta(url) {
  if (!url) return { image: "", title: "", description: "" };
  if (metaCache.has(url)) return metaCache.get(url);

  try {
    const response = await fetch(`/api/link-meta?url=${encodeURIComponent(url)}`);
    const payload = await response.json();
    const value = {
      image: toText(payload.image),
      title: toText(payload.title),
      description: toText(payload.description)
    };
    metaCache.set(url, value);
    return value;
  } catch (error) {
    const fallback = { image: "", title: "", description: "" };
    metaCache.set(url, fallback);
    return fallback;
  }
}

function socialAvatarUrl(profileUrl) {
  try {
    const parsed = new URL(profileUrl);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const username = parsed.pathname.split("/").filter(Boolean)[0];
    if (!username) return "";
    if (hostname === "x.com" || hostname === "twitter.com") {
      return `https://unavatar.io/x/${encodeURIComponent(username)}`;
    }
    if (hostname === "instagram.com") {
      return `https://unavatar.io/instagram/${encodeURIComponent(username)}`;
    }
    if (hostname === "tiktok.com") {
      return `https://unavatar.io/tiktok/${encodeURIComponent(username)}`;
    }
  } catch (error) {
    // ignore
  }
  return "";
}

async function hydrateCardPreviews(cards, urlField) {
  await Promise.all(
    cards.map(async (card) => {
      const id = card.dataset.id;
      const url = card.dataset[urlField] || "";
      if (!id || !url) return;

      const meta = await fetchLinkMeta(url);
      let imageUrl = meta.image;
      if (!imageUrl) imageUrl = socialAvatarUrl(url);
      if (!imageUrl) return;

      const img = refs.cardsGrid.querySelector(`[data-preview-image="${CSS.escape(id)}"]`);
      const fallback = refs.cardsGrid.querySelector(`[data-preview-fallback="${CSS.escape(id)}"]`);
      if (!img) return;
      img.src = imageUrl;
      img.classList.remove("is-hidden");
      if (fallback) fallback.classList.add("is-hidden");
    })
  );
}

async function hydratePublicPreviews() {
  if (state.isUnlocked) return;
  const cards = Array.from(refs.cardsGrid.querySelectorAll(".public-card:not(.collaborator-card)"));
  await hydrateCardPreviews(cards, "promoUrl");
  const collabCards = Array.from(refs.cardsGrid.querySelectorAll(".collaborator-card.public-card"));
  await hydrateCardPreviews(collabCards, "publicLink");
}

async function hydratePrivateCollaboratorPreviews() {
  if (!state.isUnlocked || !isCollaboratorMode()) return;
  const cards = Array.from(refs.cardsGrid.querySelectorAll(".collaborator-card:not(.public-card)"));
  await hydrateCardPreviews(cards, "publicLink");
}

function renderCards() {
  const activeItems = getActiveItems();
  state.debug.renderedCount = activeItems.length;
  refs.cardsGrid.innerHTML = activeItems.map(cardMarkup).join("");
  hydratePublicPreviews();
  hydratePrivateCollaboratorPreviews();
  updateDebugInfo();
}

function mergeAffiliates() {
  const byId = new Map();
  const ordered = [];

  state.baseAffiliates.forEach((item) => {
    byId.set(item.id, ordered.length);
    ordered.push(item);
  });

  state.localAffiliates.forEach((item) => {
    const existingIndex = byId.get(item.id);
    if (typeof existingIndex === "number") {
      ordered[existingIndex] = item;
      return;
    }

    byId.set(item.id, ordered.length);
    ordered.push(item);
  });

  state.affiliates = ordered;
}

function mergeCollaborators() {
  const byId = new Map();
  const ordered = [];

  state.baseCollaborators.forEach((item) => {
    byId.set(item.id, ordered.length);
    ordered.push(item);
  });

  state.localCollaborators.forEach((item) => {
    const existingIndex = byId.get(item.id);
    if (typeof existingIndex === "number") {
      ordered[existingIndex] = item;
      return;
    }

    byId.set(item.id, ordered.length);
    ordered.push(item);
  });

  state.collaborators = ordered;
}

function affiliateDedupKey(item) {
  const idKey = String(item.id || "").trim().toLowerCase();
  if (idKey) return `id:${idKey}`;
  const name = String(item.name || "").trim().toLowerCase();
  const platform = String(item.platform || "").trim().toLowerCase();
  return `np:${name}|${platform}`;
}

function collaboratorDedupKey(item) {
  const idKey = String(item.id || "").trim().toLowerCase();
  if (idKey) return `id:${idKey}`;
  const name = String(item.name || "").trim().toLowerCase();
  const platform = String(item.platform || "").trim().toLowerCase();
  return `np:${name}|${platform}`;
}

function mergeUnique(existing, incoming, keyFn) {
  const seen = new Set(existing.map(keyFn));
  const merged = [...existing];
  let addedCount = 0;
  let skippedCount = 0;

  incoming.forEach((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      skippedCount += 1;
      return;
    }
    seen.add(key);
    merged.push(item);
    addedCount += 1;
  });

  return { merged, addedCount, skippedCount };
}

function mergeUniqueAffiliates(existing, incoming) {
  return mergeUnique(existing, incoming, affiliateDedupKey);
}

function mergeUniqueCollaborators(existing, incoming) {
  return mergeUnique(existing, incoming, collaboratorDedupKey);
}

function getFullDataset() {
  return [...getActiveItems()];
}

function findAffiliateById(id) {
  return state.affiliates.find((item) => item.id === id) || null;
}

function findCollaboratorById(id) {
  return state.collaborators.find((item) => item.id === id) || null;
}

function setComposerEditMode(affiliate) {
  if (isCollaboratorMode()) {
    if (affiliate) {
      state.editingCollaboratorId = affiliate.id;
      if (refs.composerTitle) refs.composerTitle.textContent = "Modifier un collaborator";
      if (refs.submitAffiliateBtn) refs.submitAffiliateBtn.textContent = "Enregistrer les modifications";
      if (refs.cancelEditBtn) refs.cancelEditBtn.classList.remove("is-hidden");
      return;
    }

    state.editingCollaboratorId = null;
    if (refs.composerTitle) refs.composerTitle.textContent = "Ajouter un collaborator";
    if (refs.submitAffiliateBtn) refs.submitAffiliateBtn.textContent = "Ajouter et afficher";
    if (refs.cancelEditBtn) refs.cancelEditBtn.classList.add("is-hidden");
    return;
  }

  if (affiliate) {
    state.editingAffiliateId = affiliate.id;
    if (refs.composerTitle) refs.composerTitle.textContent = "Modifier une affiliation";
    if (refs.submitAffiliateBtn) refs.submitAffiliateBtn.textContent = "Enregistrer les modifications";
    if (refs.cancelEditBtn) refs.cancelEditBtn.classList.remove("is-hidden");
    return;
  }

  state.editingAffiliateId = null;
  if (refs.composerTitle) refs.composerTitle.textContent = "Ajouter une affiliation (V4)";
  if (refs.submitAffiliateBtn) refs.submitAffiliateBtn.textContent = "Ajouter et afficher";
  if (refs.cancelEditBtn) refs.cancelEditBtn.classList.add("is-hidden");
}

function populateFormFromAffiliate(affiliate) {
  const form = refs.affiliateForm;
  form.elements.name.value = affiliate.name || "";
  form.elements.promoUrl.value = affiliate.promoUrl || "";
  form.elements.promoCode.value = affiliate.promoCode || "";
  form.elements.socialUrl.value = affiliate.socialUrl || "";
  form.elements.logo1.value = affiliate.logos?.[0] || "";
  form.elements.logo2.value = affiliate.logos?.[1] || "";
  form.elements.logo3.value = affiliate.logos?.[2] || "";
  form.elements.mentions.value = affiliate.mentions || "";
  form.elements.platform.value = affiliate.platform || "instagram";
  form.elements.niche.value = affiliate.niche || "business";
  form.elements.format.value = affiliate.format || "short-video";
  form.elements.tone.value = affiliate.tone || "authority";
  form.elements.frTags.value = affiliate.fr?.tags || "";
  form.elements.enTags.value = affiliate.en?.tags || "";
  form.elements.frSpecs.value = affiliate.fr?.specs || "";
  form.elements.enSpecs.value = affiliate.en?.specs || "";
  form.elements.frCaption.value = affiliate.fr?.caption || "";
  form.elements.enCaption.value = affiliate.en?.caption || "";
  form.elements.postRequirements.value = affiliate.postRequirements || "";
  form.elements.specificities.value = affiliate.specificities || "";
}

function populateFormFromCollaborator(collaborator) {
  const form = refs.affiliateForm;
  form.elements.name.value = collaborator.name || "";
  form.elements.publicLink.value = collaborator.publicLink || "";
  form.elements.privateLinks.value = (collaborator.privateLinks || []).map((entry) => entry.url).join("\n");
  form.elements.contact.value = collaborator.contact || "";
  form.elements.rates.value = collaborator.rates || "";
  form.elements.sourceNotes.value = collaborator.sourceNotes || "";
  form.elements.bookingDate.value = collaborator.booking?.dateLabel || "";
  form.elements.bookingTime.value = collaborator.booking?.timeLabel || "";
  form.elements.bookingLocation.value = collaborator.booking?.location || "";
  form.elements.logo1.value = collaborator.logos?.[0] || "";
  form.elements.logo2.value = collaborator.logos?.[1] || "";
  form.elements.logo3.value = collaborator.logos?.[2] || "";
  form.elements.platform.value = collaborator.platform || "instagram";
  form.elements.niche.value = collaborator.niche || "business";
  form.elements.format.value = collaborator.format || "short-video";
  form.elements.tone.value = collaborator.tone || "authority";
  form.elements.frTags.value = collaborator.fr?.tags || "";
  form.elements.enTags.value = collaborator.en?.tags || "";
  form.elements.frSpecs.value = collaborator.fr?.specs || "";
  form.elements.enSpecs.value = collaborator.en?.specs || "";
  form.elements.frCaption.value = collaborator.fr?.caption || "";
  form.elements.enCaption.value = collaborator.en?.caption || "";

  form.elements.promoUrl.value = "";
  form.elements.promoCode.value = "";
  form.elements.socialUrl.value = "";
  form.elements.mentions.value = "";
  form.elements.postRequirements.value = "";
  form.elements.specificities.value = "";
}

function upsertLocalAffiliate(item) {
  const existingIndex = state.localAffiliates.findIndex((affiliate) => affiliate.id === item.id);
  if (existingIndex >= 0) {
    state.localAffiliates[existingIndex] = item;
    return;
  }

  state.localAffiliates.push(item);
}

function upsertLocalCollaborator(item) {
  const existingIndex = state.localCollaborators.findIndex((collaborator) => collaborator.id === item.id);
  if (existingIndex >= 0) {
    state.localCollaborators[existingIndex] = item;
    return;
  }

  state.localCollaborators.push(item);
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function saveLocalAffiliates() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.localAffiliates));
}

function saveLocalCollaborators() {
  localStorage.setItem(COLLABORATOR_LOCAL_STORAGE_KEY, JSON.stringify(state.localCollaborators));
}

function saveViewMode() {
  localStorage.setItem(VIEW_MODE_STORAGE_KEY, state.viewMode);
}

function isAutoExportEnabled() {
  return false;
}

function loadAutoExportPreference() {}

function saveAutoExportPreference() {}

function autoExportLocalIfEnabled(reason) {
  if (!isAutoExportEnabled()) return;

  try {
    const suffix = isRemotePersistenceEnabled() ? "remote" : "local";
    const entityPrefix = isCollaboratorMode() ? "collaborators" : "affiliations";
    const filename = `${entityPrefix}-${suffix}-autosave-${new Date().toISOString().slice(0, 10)}.json`;
    const payload = isRemotePersistenceEnabled()
      ? getFullDataset()
      : (isCollaboratorMode() ? state.localCollaborators : state.localAffiliates);
    downloadJsonFile(filename, payload);
    setFormFeedback(`Auto-export JSON effectue (${reason}).`);
  } catch (error) {
    setFormFeedback("Auto-export impossible.", true);
  }
}

function loadLocalAffiliates() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      state.localAffiliates = [];
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      state.localAffiliates = [];
      return;
    }

    state.localAffiliates = parsed
      .map((item, index) => {
        try {
          return normalizeAffiliateShape(item, index);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    state.localAffiliates = [];
  }
}

function loadLocalCollaborators() {
  try {
    const raw = localStorage.getItem(COLLABORATOR_LOCAL_STORAGE_KEY);
    if (!raw) {
      state.localCollaborators = [];
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      state.localCollaborators = [];
      return;
    }

    state.localCollaborators = parsed
      .map((item, index) => {
        try {
          return normalizeCollaboratorShape(item, index);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    state.localCollaborators = [];
  }
}

function loadViewMode() {
  const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  state.viewMode = stored === "compact" ? "compact" : "full";
}

async function fetchSession() {
  try {
    const response = await fetch("/api/session", { credentials: "include" });
    if (!response.ok) {
      throw new Error("Session API unavailable");
    }
    const payload = await response.json();
    state.authMode = "api";
    state.isUnlocked = Boolean(payload.authenticated);
  } catch (error) {
    state.authMode = "api-unavailable";
    state.isUnlocked = false;
  }
}

async function loadAffiliates() {
  try {
    const response = await fetch("/api/affiliates", { cache: "no-store", credentials: "include" });
    if (!response.ok) {
      throw new Error("Unable to load affiliates data");
    }
    const payload = await response.json();
    if (!Array.isArray(payload.affiliates)) {
      throw new Error("Affiliates payload must be an array");
    }

    state.persistenceByEntity.affiliates = {
      mode: payload.persistence?.mode === "turso" ? "remote" : "local",
      writable: Boolean(payload.persistence?.writable)
    };
    state.debug.loadSourceAffiliates = "api";
    state.debug.loadErrorAffiliates = "";
    state.baseAffiliates = payload.affiliates
      .map((item, index) => {
        try {
          return normalizeAffiliateShape(item, index);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);

    if (state.persistenceByEntity.affiliates.mode === "remote") {
      state.localAffiliates = [];
    }
  } catch (error) {
    state.debug.loadSourceAffiliates = "api";
    state.debug.loadErrorAffiliates = String(error?.message || "api fetch failed");
    if (API_ONLY_TESTING) {
      throw new Error("API-only testing enabled: run the app with dev API server (no local fallback).");
    }
    throw error;
  }
}

async function loadCollaborators() {
  try {
    const response = await fetch("/api/collaborators", { cache: "no-store", credentials: "include" });
    if (!response.ok) {
      throw new Error("Unable to load collaborators data");
    }
    const payload = await response.json();
    if (!Array.isArray(payload.collaborators)) {
      throw new Error("Collaborators payload must be an array");
    }

    state.persistenceByEntity.collaborators = {
      mode: payload.persistence?.mode === "turso" ? "remote" : "local",
      writable: Boolean(payload.persistence?.writable)
    };
    state.debug.loadSourceCollaborators = "api";
    state.debug.loadErrorCollaborators = "";
    state.baseCollaborators = payload.collaborators
    .map((item, index) => {
      try {
        return normalizeCollaboratorShape(item, index);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

    if (state.persistenceByEntity.collaborators.mode === "remote") {
      state.localCollaborators = [];
    }
  } catch (error) {
    state.debug.loadSourceCollaborators = "api";
    state.debug.loadErrorCollaborators = String(error?.message || "api fetch failed");
    if (API_ONLY_TESTING) {
      throw new Error("API-only testing enabled: run the app with dev API server (no local fallback).");
    }
    throw error;
  }
}

function setFormFeedback(message, isError = false) {
  refs.formFeedback.textContent = message;
  refs.formFeedback.classList.toggle("error", Boolean(isError));
  setTimeout(() => {
    if (refs.formFeedback.textContent === message) {
      refs.formFeedback.textContent = "";
      refs.formFeedback.classList.remove("error");
    }
  }, 2200);
}

function buildAffiliateFromForm(formData) {
  const raw = {
    id: `${slugify(toText(formData.get("name")) || "affiliate")}-${Date.now()}`,
    name: toText(formData.get("name")),
    platform: toText(formData.get("platform")),
    niche: toText(formData.get("niche")),
    format: toText(formData.get("format")),
    tone: toText(formData.get("tone")),
    promoUrl: toText(formData.get("promoUrl")),
    promoCode: toText(formData.get("promoCode")),
    socialUrl: toText(formData.get("socialUrl")),
    mentions: toText(formData.get("mentions")),
    logos: [
      toText(formData.get("logo1")),
      toText(formData.get("logo2")),
      toText(formData.get("logo3"))
    ],
    postRequirements: toText(formData.get("postRequirements")),
    specificities: toText(formData.get("specificities")),
    fr: {
      tags: toText(formData.get("frTags")),
      specs: toText(formData.get("frSpecs")),
      caption: toText(formData.get("frCaption"))
    },
    en: {
      tags: toText(formData.get("enTags")),
      specs: toText(formData.get("enSpecs")),
      caption: toText(formData.get("enCaption"))
    }
  };

  return normalizeAffiliateShape(raw, 0);
}

function buildCollaboratorFromForm(formData) {
  const sourceNotes = toText(formData.get("sourceNotes"));
  const extracted = extractCollaboratorInsights(sourceNotes);
  const privateLinksRaw = toText(formData.get("privateLinks")) || extracted.privateLinks.map((entry) => entry.url).join("\n");

  const raw = {
    id: `${slugify(toText(formData.get("name")) || "collaborator")}-${Date.now()}`,
    name: toText(formData.get("name")),
    platform: toText(formData.get("platform")),
    niche: toText(formData.get("niche")),
    format: toText(formData.get("format")),
    tone: toText(formData.get("tone")),
    publicLink: toText(formData.get("publicLink")) || extracted.publicLink,
    privateLinks: privateLinksRaw,
    contact: toText(formData.get("contact")) || extracted.contact,
    rates: toText(formData.get("rates")),
    sourceNotes,
    booking: {
      dateLabel: toText(formData.get("bookingDate")) || extracted.booking.dateLabel,
      timeLabel: toText(formData.get("bookingTime")) || extracted.booking.timeLabel,
      location: toText(formData.get("bookingLocation")) || extracted.booking.location,
      note: extracted.booking.note
    },
    logos: [
      toText(formData.get("logo1")),
      toText(formData.get("logo2")),
      toText(formData.get("logo3"))
    ],
    fr: {
      tags: toText(formData.get("frTags")),
      specs: toText(formData.get("frSpecs")),
      caption: toText(formData.get("frCaption"))
    },
    en: {
      tags: toText(formData.get("enTags")),
      specs: toText(formData.get("enSpecs")),
      caption: toText(formData.get("enCaption"))
    }
  };

  return normalizeCollaboratorShape(raw, 0);
}

function parseImportedAffiliates(rawText) {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch (error) {
    throw new Error("JSON invalide.");
  }

  if (!Array.isArray(payload)) {
    throw new Error("Le JSON doit etre un tableau d'affiliations.");
  }

  return payload.map((item, index) => normalizeAffiliateShape(item, index));
}

function parseImportedCollaborators(rawText) {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch (error) {
    throw new Error("JSON invalide.");
  }

  if (!Array.isArray(payload)) {
    throw new Error("Le JSON doit etre un tableau de collaborators.");
  }

  return payload.map((item, index) => normalizeCollaboratorShape(item, index));
}

function isRemotePersistenceEnabled() {
  const persistence = activePersistence();
  return persistence.mode === "remote" && persistence.writable;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let message = "Operation impossible";
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch (error) {
      // Keep fallback message.
    }
    throw new Error(message);
  }

  return response.json();
}

async function remoteUpsertAffiliate(affiliate) {
  await postJson("/api/affiliates-upsert", { affiliate });
}

async function remoteUpsertCollaborator(collaborator) {
  await postJson("/api/collaborators-upsert", { collaborator });
}

async function remoteBulkUpsert(affiliates) {
  await postJson("/api/affiliates-bulk-upsert", { affiliates });
}

async function remoteBulkUpsertCollaborators(collaborators) {
  await postJson("/api/collaborators-bulk-upsert", { collaborators });
}

async function remoteReplaceAll(affiliates) {
  await postJson("/api/affiliates-replace", { affiliates });
}

async function remoteReplaceAllCollaborators(collaborators) {
  await postJson("/api/collaborators-replace", { collaborators });
}

async function remoteClearAll() {
  await postJson("/api/affiliates-clear", {});
}

async function remoteClearAllCollaborators() {
  await postJson("/api/collaborators-clear", {});
}

function rerenderAll() {
  mergeAffiliates();
  mergeCollaborators();
  renderCards();
  applyLanguage();
  applyViewMode();
  applyFilters();
}

function getAllCards() {
  return Array.from(refs.cardsGrid.querySelectorAll(".affiliate-card"));
}

function getVisibleLangPanel(card) {
  return card.querySelector(`.lang-panel[data-lang="${state.activeLang}"]`);
}

function setFeedback(card, message, isError = false) {
  const el = card.querySelector(".copy-feedback");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", Boolean(isError));
  setTimeout(() => {
    if (el.textContent === message) {
      el.textContent = "";
      el.classList.remove("error");
    }
  }, 1800);
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function getCopyText(card, type) {
  const panel = getVisibleLangPanel(card);
  const source = panel?.querySelector(`.copy-source[data-copy="${type}"]`);
  return source?.textContent.trim() || "";
}

function getCardMeta(card) {
  if (isCollaboratorMode()) {
    const name = card.querySelector("h2")?.textContent.trim() || "Collaborator";
    const meta = card.querySelector(".meta")?.textContent.trim() || "";
    const [platform = "", niche = ""] = meta.split("·").map((value) => value.trim());
    const publicLink = card.dataset.publicLink || "";
    const contact = card.dataset.contact || "";
    const rates = card.dataset.rates || "";

    let privateLinks = [];
    let booking = normalizeBooking(null);
    let logos = [];
    try {
      privateLinks = JSON.parse(card.dataset.privateLinks || "[]");
    } catch (error) {
      privateLinks = [];
    }
    try {
      booking = normalizeBooking(JSON.parse(card.dataset.booking || "{}"));
    } catch (error) {
      booking = normalizeBooking(null);
    }
    try {
      const parsedLogos = JSON.parse(card.dataset.logos || "[]");
      logos = normalizeLogoUrls(parsedLogos);
    } catch (error) {
      logos = [];
    }

    return { name, platform, niche, publicLink, privateLinks, contact, rates, booking, logos };
  }

  const name = card.querySelector("h2")?.textContent.trim() || "Affiliate";
  const meta = card.querySelector(".meta")?.textContent.trim() || "";
  const [platform = "", niche = ""] = meta.split("·").map((value) => value.trim());

  const promoUrl = card.dataset.promoUrl || "";
  const promoCode = card.dataset.promoCode || "";
  const mentions = card.dataset.mentions || "";
  const postRequirements = card.dataset.postRequirements || "";
  const specificities = card.dataset.specificities || "";
  const socialUrl = card.dataset.socialUrl || "";
  let logos = [];

  try {
    const parsedLogos = JSON.parse(card.dataset.logos || "[]");
    logos = normalizeLogoUrls(parsedLogos);
  } catch (error) {
    logos = [];
  }

  return { name, platform, niche, promoUrl, promoCode, mentions, postRequirements, specificities, socialUrl, logos };
}

function getAffiliationKitText(card) {
  if (isCollaboratorMode()) {
    const meta = getCardMeta(card);
    return [
      `Lien principal: ${meta.publicLink}`,
      `Contact: ${meta.contact || "-"}`,
      `Rates: ${meta.rates || "-"}`,
      `Booking: ${bookingSummary(meta.booking) || "-"}`,
      `Liens prives: ${meta.privateLinks?.length ? meta.privateLinks.map((entry) => `${entry.label}: ${entry.url}`).join(" | ") : "-"}`,
      `Logos: ${meta.logos.length ? meta.logos.join(" | ") : "-"}`
    ].join("\n");
  }

  const meta = getCardMeta(card);
  return [
    `Promo URL: ${meta.promoUrl}`,
    `Code fan: ${meta.promoCode}`,
    `Mentions: ${meta.mentions}`,
    `Logos: ${meta.logos.length ? meta.logos.join(" | ") : "-"}`,
    `Demandes post: ${meta.postRequirements}`,
    `Specificites: ${meta.specificities || "-"}`
  ].join("\n");
}

function getCopyAllText(card) {
  if (isCollaboratorMode()) {
    const { name, platform, niche, publicLink, privateLinks, contact, rates, booking, logos } = getCardMeta(card);
    const tags = getCopyText(card, "tags");
    const specs = getCopyText(card, "specs");
    const caption = getCopyText(card, "caption");
    const template = refs.copyAllCollaboratorTemplate.textContent;

    return template
      .replace("{{name}}", name)
      .replace("{{platform}}", platform)
      .replace("{{niche}}", niche)
      .replace("{{publicLink}}", publicLink)
      .replace("{{privateLinks}}", privateLinks?.length ? privateLinks.map((entry) => `${entry.label}: ${entry.url}`).join(" | ") : "-")
      .replace("{{contact}}", contact || "-")
      .replace("{{rates}}", rates || "-")
      .replace("{{booking}}", bookingSummary(booking) || "-")
      .replace("{{logos}}", logos.length ? logos.join(" | ") : "-")
      .replace("{{tags}}", tags)
      .replace("{{specs}}", specs)
      .replace("{{caption}}", caption)
      .trim();
  }

  const { name, platform, niche, promoUrl, promoCode, mentions, postRequirements, specificities, socialUrl, logos } = getCardMeta(card);
  const tags = getCopyText(card, "tags");
  const specs = getCopyText(card, "specs");
  const caption = getCopyText(card, "caption");

  const template = refs.copyAllTemplate.textContent;
  return template
    .replace("{{name}}", name)
    .replace("{{platform}}", platform)
    .replace("{{niche}}", niche)
    .replace("{{promoUrl}}", promoUrl)
    .replace("{{promoCode}}", promoCode)
    .replace("{{mentions}}", mentions)
    .replace("{{logos}}", logos.length ? logos.join(" | ") : "-")
    .replace("{{postRequirements}}", postRequirements)
    .replace("{{specificities}}", specificities || "-")
    .replace("{{socialUrl}}", socialUrl || "-")
    .replace("{{tags}}", tags)
    .replace("{{specs}}", specs)
    .replace("{{caption}}", caption)
    .trim();
}

function applyLanguage() {
  refs.langButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === state.activeLang);
  });

  if (!state.isUnlocked) return;

  getAllCards().forEach((card) => {
    const panels = card.querySelectorAll(".lang-panel");
    panels.forEach((panel) => {
      const isActive = panel.dataset.lang === state.activeLang;
      panel.classList.toggle("is-hidden", !isActive);
    });
  });
}

function applyViewMode() {
  refs.viewButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === state.viewMode);
  });

  refs.cardsGrid.classList.toggle("is-compact", state.isUnlocked && state.viewMode === "compact");
}

function applyAccessMode() {
  document.body.classList.toggle("is-unlocked", state.isUnlocked);
  document.body.classList.toggle("is-locked", !state.isUnlocked);
  if (refs.accessStatus) {
    if (state.authMode === "api-unavailable") {
      refs.accessStatus.textContent = "API indisponible: lancer le serveur dev (mode API-only).";
    } else {
      refs.accessStatus.textContent = state.isUnlocked ? "Admin actif" : "";
    }
  }
}

function applyEntityMode() {
  refs.entityButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.entity === state.activeEntity);
  });

  const isCollaborator = isCollaboratorMode();
  document.querySelectorAll(".entity-affiliate-only").forEach((el) => {
    el.classList.toggle("is-hidden", isCollaborator);
  });
  document.querySelectorAll(".entity-collaborator-only").forEach((el) => {
    el.classList.toggle("is-hidden", !isCollaborator);
  });

  if (refs.composerTitle) {
    refs.composerTitle.textContent = isCollaborator ? "Ajouter un collaborator" : "Ajouter une affiliation (V4)";
  }
  if (refs.composerSubtitle) {
    refs.composerSubtitle.textContent = isCollaborator
      ? "Colle un bloc brut et l'app extrait lien principal, contacts et booking quand possible."
      : "Les ajouts sont sauves localement dans ton navigateur (localStorage).";
  }
}

function cardMatches(card, searchTerm, platform, niche, format, tone, options = {}) {
  const { upcomingOnly = false, nowTimestamp = Date.now() } = options;

  if (state.isUnlocked) {
    if (platform !== "all" && card.dataset.platform !== platform) return false;
    if (niche !== "all" && card.dataset.niche !== niche) return false;
    if (format !== "all" && card.dataset.format !== format) return false;
    if (tone !== "all" && card.dataset.tone !== tone) return false;

    if (upcomingOnly) {
      const bookingTs = Number(card.dataset.bookingTs || "");
      if (!Number.isFinite(bookingTs) || bookingTs < nowTimestamp) return false;
    }
  }

  if (!searchTerm) return true;
  const searchableText = card.textContent.toLowerCase();
  return searchableText.includes(searchTerm);
}

function applyFilters() {
  const searchTerm = refs.searchInput.value.trim().toLowerCase();
  const platform = refs.platformFilter.value;
  const niche = refs.nicheFilter.value;
  const format = refs.formatFilter.value;
  const tone = refs.toneFilter.value;
  const upcomingOnly = isCollaboratorMode() && Boolean(refs.upcomingBookingsToggle?.checked);
  const nowTimestamp = Date.now();
  let visibleCount = 0;

  getAllCards().forEach((card) => {
    const isVisible = cardMatches(card, searchTerm, platform, niche, format, tone, {
      upcomingOnly,
      nowTimestamp
    });
    card.style.display = isVisible ? "grid" : "none";
    if (isVisible) visibleCount += 1;
  });

  if (upcomingOnly) {
    const visibleCards = getAllCards().filter((card) => card.style.display !== "none");
    visibleCards
      .sort((cardA, cardB) => {
        const aTs = Number(cardA.dataset.bookingTs || "");
        const bTs = Number(cardB.dataset.bookingTs || "");
        if (!Number.isFinite(aTs)) return 1;
        if (!Number.isFinite(bTs)) return -1;
        return aTs - bTs;
      })
      .forEach((card) => refs.cardsGrid.append(card));
  }

  refs.emptyState.classList.toggle("is-hidden", visibleCount !== 0);
  state.debug.visibleCount = visibleCount;
  const noun = isCollaboratorMode() ? "collaborator" : "affiliation";
  const suffix = upcomingOnly ? " (RDV a venir)" : "";
  refs.resultsInfo.textContent = `${visibleCount} ${noun}${visibleCount > 1 ? "s" : ""} affiche${visibleCount > 1 ? "es" : "e"}${suffix}`;
  updateDebugInfo();
}

function duplicateCard(card) {
  const clone = card.cloneNode(true);
  const nameNode = clone.querySelector("h2");
  if (nameNode) nameNode.textContent = `${nameNode.textContent} Copy`;

  const sourceId = card.dataset.id || "affiliate";
  const copyCount = getAllCards().filter((item) => (item.dataset.id || "").startsWith(`${sourceId}-copy`)).length;
  clone.dataset.id = `${sourceId}-copy-${copyCount + 1}`;

  refs.cardsGrid.append(clone);
  applyLanguage();
  applyFilters();
  clone.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindFilters() {
  [refs.searchInput, refs.platformFilter, refs.nicheFilter, refs.formatFilter, refs.toneFilter, refs.upcomingBookingsToggle]
    .filter(Boolean)
    .forEach((control) => {
    control.addEventListener("input", applyFilters);
    control.addEventListener("change", applyFilters);
  });
}

function bindLanguageToggle() {
  refs.langButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeLang = btn.dataset.lang;
      applyLanguage();
    });
  });
}

function bindViewToggle() {
  refs.viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.viewMode = btn.dataset.view;
      saveViewMode();
      applyViewMode();
    });
  });
}

async function unlock(password) {
  const response = await fetch("/api/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  return response.ok;
}

async function lock() {
  await fetch("/api/logout", {
    method: "POST",
    credentials: "include"
  });
}

function bindAccessControls() {
  refs.unlockBtn.addEventListener("click", async () => {
    const ok = await unlock(refs.unlockInput.value);
    if (!ok) {
      if (refs.accessStatus) {
        refs.accessStatus.textContent = "Mot de passe incorrect";
      }
      return;
    }

    state.isUnlocked = true;
    refs.unlockInput.value = "";
    applyAccessMode();
    rerenderAll();
    setFormFeedback("Mode admin active.");
  });

  refs.unlockInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      refs.unlockBtn.click();
    }
  });

  refs.lockBtn.addEventListener("click", async () => {
    await lock();
    state.isUnlocked = false;
    applyAccessMode();
    rerenderAll();
  });
}

function bindCardActions() {
  refs.cardsGrid.addEventListener("click", async (event) => {
    if (!state.isUnlocked) {
      if (isCollaboratorMode()) {
        const copyBtn = event.target.closest("[data-action='copy-contact-inline']");
        if (copyBtn) {
          copyText(copyBtn.dataset.copyValue || "").then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = "Copie !";
            setTimeout(() => { copyBtn.textContent = orig; }, 1500);
          });
          return;
        }

        const card = event.target.closest(".collaborator-card.public-card");
        if (card && !event.target.closest(".collab-panel__link")) {
          const isOpen = card.classList.contains("is-panel-open");
          refs.cardsGrid.querySelectorAll(".collaborator-card.public-card.is-panel-open").forEach((c) => c.classList.remove("is-panel-open"));
          if (!isOpen) card.classList.add("is-panel-open");
        }
      }
      return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest(".affiliate-card");
    if (!card) return;

    const action = button.dataset.action;

    try {
      if (isCollaboratorMode()) {
        if (action === "copy-public-link") {
          await copyText(card.dataset.publicLink || "");
          setFeedback(card, "Lien principal copie");
          return;
        }

        if (action === "copy-contact") {
          await copyText(card.dataset.contact || "");
          setFeedback(card, "Contact copie");
          return;
        }

        if (action === "copy-collaboration-kit") {
          await copyText(getAffiliationKitText(card));
          setFeedback(card, "Kit collaboration copie");
          return;
        }

        if (action === "edit") {
          const collaborator = findCollaboratorById(card.dataset.id || "");
          if (!collaborator) {
            setFeedback(card, "Fiche introuvable", true);
            return;
          }

          populateFormFromCollaborator(collaborator);
          setComposerEditMode(collaborator);
          refs.affiliateForm.scrollIntoView({ behavior: "smooth", block: "start" });
          setFeedback(card, "Formulaire pre-rempli");
          return;
        }

        if (action === "duplicate") {
          duplicateCard(card);
          setFeedback(card, "Bloc duplique");
          return;
        }

        await copyText(getCopyAllText(card));
        setFeedback(card, "Bloc complet copie");
        return;
      }

      if (action === "copy-promo-url") {
        await copyText(card.dataset.promoUrl || "");
        setFeedback(card, "URL promo copiee");
        return;
      }

      if (action === "copy-promo-code") {
        await copyText(card.dataset.promoCode || "");
        setFeedback(card, "Code promo copie");
        return;
      }

      if (action === "copy-affiliation-kit") {
        await copyText(getAffiliationKitText(card));
        setFeedback(card, "Kit affiliation copie");
        return;
      }

      if (action === "copy-tags") {
        await copyText(getCopyText(card, "tags"));
        setFeedback(card, "Tags copies");
        return;
      }

      if (action === "copy-specs") {
        await copyText(getCopyText(card, "specs"));
        setFeedback(card, "Specs copiees");
        return;
      }

      if (action === "edit") {
        const affiliate = findAffiliateById(card.dataset.id || "");
        if (!affiliate) {
          setFeedback(card, "Fiche introuvable", true);
          return;
        }

        populateFormFromAffiliate(affiliate);
        setComposerEditMode(affiliate);
        refs.affiliateForm.scrollIntoView({ behavior: "smooth", block: "start" });
        setFeedback(card, "Formulaire pre-rempli");
        return;
      }

      if (action === "duplicate") {
        duplicateCard(card);
        setFeedback(card, "Bloc duplique");
        return;
      }

      await copyText(getCopyAllText(card));
      setFeedback(card, "Bloc complet copie");
    } catch (error) {
      setFeedback(card, "Action impossible", true);
    }
  });

  refs.cardsGrid.addEventListener("keydown", (event) => {
    if (state.isUnlocked || !isCollaboratorMode()) return;
    const card = event.target.closest(".collaborator-card.public-card");
    if (!card) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const isOpen = card.classList.contains("is-panel-open");
      refs.cardsGrid.querySelectorAll(".collaborator-card.public-card.is-panel-open").forEach((c) => c.classList.remove("is-panel-open"));
      if (!isOpen) card.classList.add("is-panel-open");
    } else if (event.key === "Escape") {
      card.classList.remove("is-panel-open");
    }
  });

  document.addEventListener("click", (event) => {
    if (state.isUnlocked || !isCollaboratorMode()) return;
    if (event.target.closest(".collaborator-card.public-card")) return;
    refs.cardsGrid.querySelectorAll(".collaborator-card.public-card.is-panel-open").forEach((c) => c.classList.remove("is-panel-open"));
  });
}

function bindEntityToggle() {
  refs.entityButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextEntity = btn.dataset.entity;
      if (!nextEntity || nextEntity === state.activeEntity) return;
      state.activeEntity = nextEntity;

      // Avoid carrying restrictive filters across entities (e.g. X-only collaborators hiding affiliates).
      refs.searchInput.value = "";
      refs.platformFilter.value = "all";
      refs.nicheFilter.value = "all";
      refs.formatFilter.value = "all";
      refs.toneFilter.value = "all";
      if (refs.upcomingBookingsToggle) refs.upcomingBookingsToggle.checked = false;

      state.editingAffiliateId = null;
      state.editingCollaboratorId = null;
      refs.affiliateForm.reset();
      setComposerEditMode(null);
      applyEntityMode();
      rerenderAll();
    });
  });
}

function bindComposerActions() {
  const fSourceNotes = document.getElementById("fSourceNotes");
  if (fSourceNotes) {
    fSourceNotes.addEventListener("blur", () => {
      if (!isCollaboratorMode()) return;
      const source = fSourceNotes.value.trim();
      if (!source) return;
      const extracted = extractCollaboratorInsights(source);

      const fPublicLink = document.getElementById("fPublicLink");
      const fPrivateLinks = document.getElementById("fPrivateLinks");
      const fContact = document.getElementById("fContact");
      const fBookingDate = document.getElementById("fBookingDate");
      const fBookingTime = document.getElementById("fBookingTime");
      const fBookingLocation = document.getElementById("fBookingLocation");

      if (fPublicLink && !fPublicLink.value && extracted.publicLink) fPublicLink.value = extracted.publicLink;
      if (fPrivateLinks && !fPrivateLinks.value && extracted.privateLinks.length) fPrivateLinks.value = extracted.privateLinks.map((e) => e.url).join("\n");
      if (fContact && !fContact.value && extracted.contact) fContact.value = extracted.contact;
      if (fBookingDate && !fBookingDate.value && extracted.booking.dateLabel) fBookingDate.value = extracted.booking.dateLabel;
      if (fBookingTime && !fBookingTime.value && extracted.booking.timeLabel) fBookingTime.value = extracted.booking.timeLabel;
      if (fBookingLocation && !fBookingLocation.value && extracted.booking.location) fBookingLocation.value = extracted.booking.location;
    });
  }

  refs.affiliateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.isUnlocked) return;

    try {
      const formData = new FormData(refs.affiliateForm);

      if (isCollaboratorMode()) {
        const collaborator = buildCollaboratorFromForm(formData);

        if (state.editingCollaboratorId) {
          collaborator.id = state.editingCollaboratorId;
          if (isRemotePersistenceEnabled()) {
            await remoteUpsertCollaborator(collaborator);
            await loadCollaborators();
          } else {
            upsertLocalCollaborator(collaborator);
            saveLocalCollaborators();
          }
          rerenderAll();
          refs.affiliateForm.reset();
          setComposerEditMode(null);
          setFormFeedback(isRemotePersistenceEnabled() ? "Collaborator modifie. Sauve en base." : "Collaborator modifie. Sauve localement.");
          refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const candidate = mergeUniqueCollaborators(state.collaborators, [collaborator]);
        if (candidate.addedCount === 0) {
          setFormFeedback("Doublon detecte (id ou name+platform).", true);
          return;
        }

        if (isRemotePersistenceEnabled()) {
          await remoteUpsertCollaborator(collaborator);
          await loadCollaborators();
        } else {
          state.localCollaborators.push(collaborator);
          saveLocalCollaborators();
        }
        rerenderAll();
        refs.affiliateForm.reset();
        setFormFeedback(isRemotePersistenceEnabled() ? "Collaborator ajoute. Sauve en base." : "Collaborator ajoute. Sauve localement.");
        refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const affiliate = buildAffiliateFromForm(formData);

      if (state.editingAffiliateId) {
        affiliate.id = state.editingAffiliateId;
        if (isRemotePersistenceEnabled()) {
          await remoteUpsertAffiliate(affiliate);
          await loadAffiliates();
        } else {
          upsertLocalAffiliate(affiliate);
          saveLocalAffiliates();
        }
        rerenderAll();
        refs.affiliateForm.reset();
        setComposerEditMode(null);
        setFormFeedback(isRemotePersistenceEnabled() ? "Affiliation modifiee. Sauvee en base." : "Affiliation modifiee. Sauvee localement.");
        refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const candidate = mergeUniqueAffiliates(state.affiliates, [affiliate]);
      if (candidate.addedCount === 0) {
        setFormFeedback("Doublon detecte (id ou name+platform).", true);
        return;
      }

      if (isRemotePersistenceEnabled()) {
        await remoteUpsertAffiliate(affiliate);
        await loadAffiliates();
      } else {
        state.localAffiliates.push(affiliate);
        saveLocalAffiliates();
      }
      rerenderAll();
      refs.affiliateForm.reset();
      setFormFeedback(isRemotePersistenceEnabled() ? "Affiliation ajoutee. Sauvee en base." : "Affiliation ajoutee. Sauvee localement.");
      refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setFormFeedback(error.message || "Impossible d'ajouter cette affiliation.", true);
    }
  });

  refs.cancelEditBtn.addEventListener("click", () => {
    refs.affiliateForm.reset();
    state.editingAffiliateId = null;
    state.editingCollaboratorId = null;
    setComposerEditMode(null);
    setFormFeedback("Edition annulee.");
  });
}

async function init() {
  try {
    await loadAffiliates();
    await loadCollaborators();
    if (state.persistenceByEntity.affiliates.mode === "local") {
      loadLocalAffiliates();
    }
    if (state.persistenceByEntity.collaborators.mode === "local") {
      loadLocalCollaborators();
    }
    loadViewMode();
    await fetchSession();
    applyAccessMode();
    applyEntityMode();
    mergeAffiliates();
    mergeCollaborators();
    renderCards();
    applyLanguage();
    applyViewMode();
    applyFilters();
    bindEntityToggle();
    bindFilters();
    bindLanguageToggle();
    bindViewToggle();
    bindAccessControls();
    bindCardActions();
    bindComposerActions();
    updateDebugInfo();
  } catch (error) {
    state.debug.initError = String(error?.message || error || "unknown init error");
    refs.resultsInfo.textContent = "Erreur: mode API-only. Lance le serveur dev (ex: npx vercel dev).";
    refs.emptyState.classList.add("is-hidden");
    updateDebugInfo();
  }
}

init();
