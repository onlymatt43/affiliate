const isLocalDebugHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const enableDebug = isLocalDebugHost && new URLSearchParams(window.location.search).get("debug") === "1";

const state = {
  activeEntity: "affiliates",
  activeTags: [],
  activeLang: "fr",
  viewMode: "full",
  isUnlocked: false,
  authMode: "api",
  debug: {
    enabled: enableDebug,
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
  pendingVisibility: null,
  pendingTaggedUrls: null,
  affiliates: [],
  baseAffiliates: [],
  localAffiliates: [],
  collaborators: [],
  baseCollaborators: [],
  localCollaborators: [],
  allItems: [],
  quickAddMode: false
};

const metaCache = new Map();

const refs = {
  cardsGrid: document.getElementById("cardsGrid"),
  entityButtons: Array.from(document.querySelectorAll(".entity-btn")),
  tagAllBtn: document.getElementById("tagFilter")?.querySelector(".tag-btn--all"),
  tagChips: document.getElementById("tagChips"),
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
  accessStatus: document.getElementById("accessStatus"),
  quickAddToggle: document.getElementById("quickAddToggle"),
  aiAssistantBtn: document.getElementById("aiAssistantBtn")
};

const LOCAL_STORAGE_KEY = "affiliateHubLocalAffiliates";
const COLLABORATOR_LOCAL_STORAGE_KEY = "affiliateHubLocalCollaborators";
const VIEW_MODE_STORAGE_KEY = "affiliateHubViewMode";
const AUTO_EXPORT_STORAGE_KEY = "affiliateHubAutoExportLocal";
const API_ONLY_TESTING = false;

// --- Arty dark mode helpers ---
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function assignCardArchetypes(items) {
  const thresholds = [50, 70, 90, 100]; // default 50%, featured 20%, small 20%, editorial 10%
  const types = ["default", "featured", "small", "editorial"];
  return items.map((item) => {
    const roll = Math.random() * 100;
    const archetype = types[thresholds.findIndex((t) => roll < t)];
    return { item, archetype };
  });
}

const DYNAMIC_THEMES = [
  {
    body: "radial-gradient(circle at 12% 16%, #ffd8bf 0%, transparent 32%), radial-gradient(circle at 84% 18%, #ffefb0 0%, transparent 28%), linear-gradient(180deg, #fff7ef 0%, #ffe4d2 100%)",
    orbA: "#ff7e57",
    orbB: "#2ba191"
  },
  {
    body: "radial-gradient(circle at 20% 10%, #d7f7e9 0%, transparent 34%), radial-gradient(circle at 82% 24%, #ffe2b8 0%, transparent 30%), linear-gradient(180deg, #f4fff8 0%, #e7f6ff 100%)",
    orbA: "#27b08d",
    orbB: "#f39c4a"
  },
  {
    body: "radial-gradient(circle at 10% 18%, #ffe1ef 0%, transparent 30%), radial-gradient(circle at 90% 14%, #cde8ff 0%, transparent 30%), linear-gradient(180deg, #fff8fb 0%, #f2f2ff 100%)",
    orbA: "#ff6aa2",
    orbB: "#4e8cff"
  },
  {
    body: "radial-gradient(circle at 14% 22%, #ffe8c7 0%, transparent 30%), radial-gradient(circle at 86% 18%, #dbf9ff 0%, transparent 34%), linear-gradient(180deg, #fffdf6 0%, #eefcff 100%)",
    orbA: "#ff9d2d",
    orbB: "#0aa3c6"
  }
];

function applyDynamicTheme() {
  const theme = randomPick(DYNAMIC_THEMES);
  if (!theme) return;

  document.body.style.background = theme.body;
  const orbA = document.querySelector(".orb-a");
  const orbB = document.querySelector(".orb-b");
  if (orbA) orbA.style.background = theme.orbA;
  if (orbB) orbB.style.background = theme.orbB;
}

function shuffleItems(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function applyCardChaosLayout() {
  const isNarrow = window.matchMedia("(max-width: 720px)").matches;
  const cards = getAllCards();
  cards.forEach((card, index) => {
    card.classList.toggle("card-chaos", !isNarrow);
    card.classList.remove("card-chaos--wide", "card-chaos--tall");

    if (isNarrow) {
      card.style.setProperty("--chaos-delay", "0ms");
      card.style.setProperty("--chaos-rot", "0deg");
      return;
    }

    const roll = Math.random();
    if (roll > 0.84) {
      card.classList.add("card-chaos--wide");
    } else if (roll > 0.68) {
      card.classList.add("card-chaos--tall");
    }

    card.style.setProperty("--chaos-delay", `${Math.round(randomBetween(0, 450)) + index * 12}ms`);
    card.style.setProperty("--chaos-rot", `${randomBetween(-1.4, 1.4).toFixed(2)}deg`);
  });
}

function injectDarkBackground() {
  document.body.classList.add("dark-collab-mode");
  if (document.querySelector(".dark-orb")) return;
  const orbDefs = [
    { color: "#c8911a", minO: 0.02, maxO: 0.06 },
    { color: "#8b3a0f", minO: 0.025, maxO: 0.065 },
    { color: "#c8911a", minO: 0.015, maxO: 0.04 },
    { color: "#ffffff", minO: 0.01, maxO: 0.025 },
    { color: "#8b3a0f", minO: 0.02, maxO: 0.05 },
    { color: "#c8911a", minO: 0.015, maxO: 0.035 }
  ];
  const count = Math.floor(randomBetween(4, 7));
  for (let i = 0; i < count; i++) {
    const orb = document.createElement("div");
    orb.classList.add("dark-orb");
    const def = orbDefs[i % orbDefs.length];
    const size = Math.round(randomBetween(180, 580));
    const top = Math.round(randomBetween(-8, 95));
    const left = Math.round(randomBetween(-8, 98));
    const opacity = randomBetween(def.minO, def.maxO).toFixed(3);
    orb.style.cssText = `width:${size}px;height:${size}px;top:${top}%;left:${left}%;background:${def.color};opacity:${opacity};`;
    document.body.appendChild(orb);
  }
}

function removeDarkBackground() {
  document.body.classList.remove("dark-collab-mode");
  document.querySelectorAll(".dark-orb").forEach((el) => el.remove());
}
// --- end arty dark mode helpers ---

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
  x: "X",
  onlyfans: "OnlyFans"
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

const VALID_CATEGORIES = ["affiliate", "collaborator", "event"];

const DEFAULT_AFFILIATE_VISIBILITY = {
  name: "both",
  primaryUrl: "both",
  tags: "public",
  promoCode: "public",
  socialUrl: "private",
  mentions: "private",
  postRequirements: "private",
  specificities: "private",
  logos: "both",
  mediaImages: "both",
  mediaVideos: "both"
};

const DEFAULT_COLLABORATOR_VISIBILITY = {
  name: "both",
  primaryUrl: "both",
  tags: "public",
  publicLinks: "public",
  privateLinks: "private",
  taggedUrls: "private",
  contact: "public",
  email: "private",
  rates: "private",
  booking: "both",
  sourceNotes: "private",
  logos: "both",
  mediaImages: "both",
  mediaVideos: "both"
};

function isPublicVisible(item, field) {
  const v = item.visibility?.[field];
  return v === "public" || v === "both";
}

function normalizeAffiliateCategory(value) {
  const normalized = toText(value).toLowerCase();
  if (!normalized || !VALID_CATEGORIES.includes(normalized)) return "affiliate";
  return normalized;
}

function normalizeCollaboratorCategory(value) {
  const normalized = toText(value).toLowerCase();
  if (!normalized || !VALID_CATEGORIES.includes(normalized)) return "collaborator";
  return normalized;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(options || {}), signal: controller.signal });
  } finally {
    clearTimeout(timeout);
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

  return deduped;
}

function normalizeMediaUrls(raw) {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(/\n|,/g);
  return items.map((u) => String(u || "").trim()).filter((u) => isValidHttpUrl(u));
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

function mediaStripMarkup(item) {
  const images = item.mediaImages || [];
  const videos = item.mediaVideos || [];
  if (!images.length && !videos.length) return "";

  const imgTags = images.map((url) =>
    `<img src="${escapeHtml(url)}" alt="Media ${escapeHtml(item.name)}" class="media-strip__img" loading="lazy" onerror="this.classList.add('is-hidden')" />`
  ).join("");

  const vidTags = videos.map((url) =>
    `<video src="${escapeHtml(url)}" class="media-strip__vid" preload="metadata" muted playsinline loop onerror="this.classList.add('is-hidden')"></video>`
  ).join("");

  return `<div class="media-strip">${imgTags}${vidTags}</div>`;
}

function normalizeAffiliateShape(raw, index) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Element ${index + 1}: format invalide`);
  }

  const name = toText(raw.name) || `Affiliation ${index + 1}`;
  const platform = toText(raw.platform) || "x";
  const niche = toText(raw.niche) || "lifestyle";
  const format = toText(raw.format) || "post";
  const tone = toText(raw.tone) || "authority";

  const primaryUrlRaw = toText(raw.primaryUrl || raw.promoUrl || raw.contactUrl);
  const primaryUrl = isValidHttpUrl(primaryUrlRaw) ? primaryUrlRaw : "";
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
    category: normalizeAffiliateCategory(raw.category),
    name,
    platform,
    niche,
    format,
    tone,
    primaryUrl,
    promoCode,
    socialUrl,
    mentions,
    postRequirements,
    specificities,
    logos,
    mediaImages: normalizeMediaUrls(raw.mediaImages),
    mediaVideos: normalizeMediaUrls(raw.mediaVideos),
    visibility: { ...DEFAULT_AFFILIATE_VISIBILITY, ...(raw.visibility || {}) },
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

function normalizeTaggedUrls(raw) {
  if (!Array.isArray(raw)) return [];

  const seen = new Set();
  const out = [];
  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const label = toText(entry.label) || "Link";
    const url = toText(entry.url);
    if (!isValidHttpUrl(url)) return;

    const visibilityRaw = toText(entry.visibility || "private").toLowerCase();
    const visibility = visibilityRaw === "public" || visibilityRaw === "both" ? visibilityRaw : "private";
    const tags = Array.isArray(entry.tags) ? entry.tags.map((tag) => toText(tag)).filter(Boolean) : [];
    const dedupKey = `${url}|${visibility}|${tags.join("|")}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);
    out.push({ label, url, visibility, tags });
  });

  return out;
}

function parseTagTokens(value) {
  return toText(value)
    .split(/[\n,]/g)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getItemTags(item) {
  const seen = new Set();
  const out = [];

  const categoryTag = toText(item.category);
  if (categoryTag) {
    const key = categoryTag.toLowerCase();
    seen.add(key);
    out.push(categoryTag);
  }

  parseTagTokens(item.fr?.tags || "").forEach((tag) => {
    const key = toText(tag).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(tag);
  });

  parseTagTokens(item.en?.tags || "").forEach((tag) => {
    const key = toText(tag).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(tag);
  });

  if (Array.isArray(item.taggedUrls)) {
    item.taggedUrls.forEach((entry) => {
      if (!entry || !Array.isArray(entry.tags)) return;
      entry.tags.forEach((tag) => {
        const clean = toText(tag);
        const key = clean.toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(clean);
      });
    });
  }

  return out;
}

function tagBadgesMarkup(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "";
  return `<div class="tag-badges">${tags.map((tag) => `<button type="button" class="tag-badge" data-action="copy-inline-value" data-copy-value="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>`;
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

function getConflicts(collaborators) {
  const withTs = collaborators
    .map((c) => ({ id: c.id, ts: getBookingTimestamp(c) }))
    .filter((c) => c.ts != null);
  const conflictIds = new Set();
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  for (let i = 0; i < withTs.length; i++) {
    for (let j = i + 1; j < withTs.length; j++) {
      if (Math.abs(withTs[i].ts - withTs[j].ts) < THREE_HOURS) {
        conflictIds.add(withTs[i].id);
        conflictIds.add(withTs[j].id);
      }
    }
  }
  return conflictIds;
}

function shareCollaborator(id, name) {
  const url = `${location.origin}/rv/${encodeURIComponent(id)}`;
  const title = name ? `RV · ${name}` : "Rendez-vous";
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
    return;
  }
  navigator.clipboard.writeText(url).then(() => {
    const feedbackEl = document.getElementById("shareGlobalFeedback");
    if (feedbackEl) {
      feedbackEl.textContent = "Lien copié !";
      setTimeout(() => { feedbackEl.textContent = ""; }, 2500);
    }
  }).catch(() => {});
}

function renderBookingTimeline() {
  const section = document.getElementById("bookingTimeline");
  if (!section) return;
  const container = section.querySelector(".timeline-entries");
  if (!container) return;

  const now = Date.now();
  const collabs = state.collaborators || [];
  const upcoming = collabs
    .map((c) => ({ item: c, ts: getBookingTimestamp(c) }))
    .filter(({ ts }) => ts != null && ts > now)
    .sort((a, b) => a.ts - b.ts);

  if (upcoming.length === 0) {
    section.classList.add("is-hidden");
    return;
  }

  const conflicts = getConflicts(collabs);

  container.innerHTML = upcoming.map(({ item, ts }) => {
    const booking = normalizeBooking(item.booking);
    const dateStr = [booking.dateLabel, booking.timeLabel].filter(Boolean).join(" · ");
    const locationStr = booking.location || "";
    const isConflict = conflicts.has(item.id);
    const d = new Date(ts);
    const diff = ts - now;
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const daysLabel = diffDays === 0 ? "Aujourd'hui" : diffDays === 1 ? "Demain" : `Dans ${diffDays}j`;

    return `
      <div class="timeline-entry${isConflict ? " has-conflict" : ""}" data-collab-id="${escapeHtml(item.id)}">
        <div class="timeline-entry__days">${escapeHtml(daysLabel)}</div>
        <div class="timeline-entry__name">${escapeHtml(item.name)}</div>
        ${dateStr ? `<div class="timeline-entry__date">${escapeHtml(dateStr)}</div>` : ""}
        ${locationStr ? `<div class="timeline-entry__location">${escapeHtml(locationStr)}</div>` : ""}
        ${isConflict ? `<div class="timeline-entry__conflict">⚠ Conflit d'horaire</div>` : ""}
        <button type="button" class="timeline-entry__share" data-action="share-timeline-entry" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}">Partager</button>
      </div>
    `;
  }).join("");

  const feedbackEl = document.createElement("span");
  feedbackEl.id = "shareGlobalFeedback";
  feedbackEl.className = "share-feedback";
  feedbackEl.setAttribute("aria-live", "polite");
  const existing = document.getElementById("shareGlobalFeedback");
  if (!existing) section.appendChild(feedbackEl);

  section.classList.remove("is-hidden");
}

// --- Twitter OAuth card unlock ---

const UNLOCKED_COLLAB_KEY = "unlocked_collab_ids";

function getUnlockedIds() {
  try {
    return JSON.parse(sessionStorage.getItem(UNLOCKED_COLLAB_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function addUnlockedId(id) {
  const ids = getUnlockedIds();
  if (!ids.includes(id)) {
    ids.push(id);
    sessionStorage.setItem(UNLOCKED_COLLAB_KEY, JSON.stringify(ids));
  }
}

function removeUnlockedId(id) {
  const ids = getUnlockedIds().filter((i) => i !== id);
  sessionStorage.setItem(UNLOCKED_COLLAB_KEY, JSON.stringify(ids));
}

let activeCollabWorkspace = null;

function closeCollaboratorWorkspace() {
  if (!activeCollabWorkspace) return;
  activeCollabWorkspace.overlay.remove();
  activeCollabWorkspace = null;
  document.body.classList.remove("collab-workspace-active");
}

function buildWorkspaceCardMarkup(item, isPublic) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = (isPublic ? publicCardMarkup(item, "default") : privateCardMarkup(item)).trim();
  const card = wrapper.firstElementChild;
  if (!card) return "";
  card.classList.add("workspace-preview-card");
  card.querySelector(".card-actions")?.remove();
  card.querySelector(".collab-unlocked-tools")?.remove();
  return card.outerHTML;
}

function sanitizeCollaboratorSelfEditFields(fields) {
  if (!fields || typeof fields !== "object") return {};
  const allowed = new Set([
    "booking",
    "bookingDate",
    "bookingTime",
    "bookingLocation",
    "bookingNote",
    "publicLinks",
    "privateLinks",
    "taggedUrls",
    "contact",
    "email",
    "rates",
    "sourceNotes",
    "visibility",
    "fr",
    "en",
    "tags",
    "specs",
    "caption"
  ]);
  const out = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (allowed.has(key)) out[key] = value;
  });
  return out;
}

function draftFromExtractedCollaborator(baseCollab, fields) {
  if (!fields || typeof fields !== "object") return baseCollab;
  const scopedFields = sanitizeCollaboratorSelfEditFields(fields);
  const draft = { ...baseCollab, ...scopedFields };

  const bookingObject = scopedFields.booking && typeof scopedFields.booking === "object"
    ? scopedFields.booking
    : {
        dateLabel: scopedFields.bookingDate,
        timeLabel: scopedFields.bookingTime,
        location: scopedFields.bookingLocation,
        note: scopedFields.bookingNote
      };

  draft.booking = normalizeBooking({ ...(baseCollab.booking || {}), ...(bookingObject || {}) });

  if (scopedFields.publicLinks != null) draft.publicLinks = normalizePrivateLinks(scopedFields.publicLinks);
  if (scopedFields.privateLinks != null) draft.privateLinks = normalizePrivateLinks(scopedFields.privateLinks);
  if (scopedFields.taggedUrls != null) draft.taggedUrls = normalizeTaggedUrls(scopedFields.taggedUrls);

  if (scopedFields.tags || scopedFields.specs || scopedFields.caption) {
    draft.en = {
      ...(draft.en || {}),
      tags: scopedFields.tags != null ? toText(scopedFields.tags) : toText(draft.en?.tags),
      specs: scopedFields.specs != null ? toText(scopedFields.specs) : toText(draft.en?.specs),
      caption: scopedFields.caption != null ? toText(scopedFields.caption) : toText(draft.en?.caption)
    };
  }

  try {
    return normalizeCollaboratorShape(draft, 0);
  } catch (_) {
    return baseCollab;
  }
}

function upsertCollaboratorWorkspace(collabId, collab) {
  if (!collabId || !collab) return;

  if (activeCollabWorkspace && activeCollabWorkspace.collabId === collabId) {
    activeCollabWorkspace.setDraft(collab);
    return;
  }

  closeCollaboratorWorkspace();

  const overlay = document.createElement("section");
  overlay.className = "collab-workspace";
  overlay.innerHTML = `
    <div class="collab-workspace__backdrop" data-action="close-workspace"></div>
    <div class="collab-workspace__panel" role="dialog" aria-modal="true">
      <div class="collab-workspace__head">
        <h3>HeyHi Workspace</h3>
        <button type="button" class="collab-workspace__close" data-action="close-workspace" aria-label="Close">×</button>
      </div>
      <div class="collab-workspace__layout">
        <section class="collab-workspace__col">
          <h4>Public preview</h4>
          <div class="collab-workspace__preview" data-preview="public"></div>
        </section>
        <section class="collab-workspace__col">
          <h4>Private preview</h4>
          <div class="collab-workspace__preview" data-preview="private"></div>
        </section>
        <section class="collab-workspace__chat">
          <h4>Chat with HeyHi</h4>
          <div class="collab-workspace__thread" data-thread></div>
          <div class="collab-workspace__input-row">
            <textarea rows="2" placeholder="Tell HeyHi what to update..."></textarea>
            <button type="button" class="accent-ai">Send</button>
          </div>
        </section>
      </div>
    </div>
  `;

  const publicPreviewEl = overlay.querySelector("[data-preview='public']");
  const privatePreviewEl = overlay.querySelector("[data-preview='private']");
  const threadEl = overlay.querySelector("[data-thread]");
  const textarea = overlay.querySelector("textarea");
  const sendBtn = overlay.querySelector(".collab-workspace__input-row button");

  let draft = collab;
  let history = [];
  let isBusy = false;

  function appendThread(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `collab-workspace__msg is-${role}`;
    bubble.textContent = text;
    threadEl.appendChild(bubble);
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function renderPreviews() {
    publicPreviewEl.innerHTML = buildWorkspaceCardMarkup(draft, true);
    privatePreviewEl.innerHTML = buildWorkspaceCardMarkup(draft, false);
  }

  function setBusy(nextBusy) {
    isBusy = nextBusy;
    textarea.disabled = nextBusy;
    sendBtn.disabled = nextBusy;
  }

  async function sendToHeyHi(message, isBoot = false) {
    if (isBusy) return;
    if (!isBoot && !toText(message)) return;

    if (!isBoot) {
      history.push({ role: "user", content: message });
      appendThread("user", message);
      textarea.value = "";
    }

    setBusy(true);
    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "intake",
          lang: "en",
          item: draft,
          entities: { affiliates: [], collaborators: [{ id: collabId, name: draft.name }] },
          messages: history
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) throw new Error(payload.error || "HeyHi unavailable");

      const reply = toText(payload.message);
      if (reply) {
        history.push({ role: "assistant", content: reply });
        appendThread("assistant", reply);
      }

      if (payload.extracted?.fields) {
        draft = draftFromExtractedCollaborator(draft, payload.extracted.fields);
        renderPreviews();
      }
    } catch (error) {
      appendThread("assistant", `Error: ${String(error?.message || error)}`);
    } finally {
      setBusy(false);
    }
  }

  overlay.querySelectorAll("[data-action='close-workspace']").forEach((node) => {
    node.addEventListener("click", () => closeCollaboratorWorkspace());
  });

  sendBtn.addEventListener("click", () => sendToHeyHi(textarea.value));
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendToHeyHi(textarea.value);
    }
  });

  document.body.appendChild(overlay);
  document.body.classList.add("collab-workspace-active");
  renderPreviews();
  sendToHeyHi(null, true);

  activeCollabWorkspace = {
    collabId,
    overlay,
    setDraft(nextDraft) {
      draft = nextDraft;
      renderPreviews();
    }
  };
}

async function swapCardToPrivate(collabId) {
  const card = document.querySelector(`[data-collab-id="${CSS.escape(collabId)}"]`);
  if (!card) return;

  let collab = null;
  try {
    const res = await fetch("/api/collaborators/private?id=" + encodeURIComponent(collabId), { credentials: "include" });
    if (!res.ok) throw new Error("unauthorized");
    const data = await res.json();
    collab = data.collaborator || null;
  } catch (_) {}

  if (!collab) {
    // Token absent or expired — remove from sessionStorage and re-show auth overlay
    removeUnlockedId(collabId);
    showAuthOverlay(card, collabId);
    return;
  }

  const privateMarkup = privateCardMarkup(collab);
  const tmp = document.createElement("div");
  tmp.innerHTML = privateMarkup.trim();
  const newCard = tmp.firstElementChild;
  if (newCard) {
    card.replaceWith(newCard);
    enhanceUnlockedCollaboratorCard(newCard, collabId, collab);
    upsertCollaboratorWorkspace(collabId, collab);
    newCard.classList.add("is-shared");
    setTimeout(() => newCard.classList.remove("is-shared"), 2000);
  }
}

function enhanceUnlockedCollaboratorCard(cardEl, collabId, collab) {
  if (!cardEl || !collabId) return;
  cardEl.classList.add("collab-private-unlocked");

  cardEl.querySelectorAll("[data-action='edit'], [data-action='duplicate']").forEach((btn) => btn.remove());

  const actions = cardEl.querySelector(".card-actions");
  if (!actions) return;

  const booking = normalizeBooking(collab.booking || {});
  const taggedUrlDefaults = {
    label: "",
    url: "",
    tags: "",
    visibility: "private"
  };

  const controls = document.createElement("section");
  controls.className = "content-block collab-unlocked-tools";
  controls.innerHTML = `
    <h3>Your card controls</h3>
    <p class="collab-unlocked-tools__hint">Only two editable zones right now.</p>

    <div class="collab-scope collab-scope--private">
      <div class="collab-scope__title">Private</div>
      <div class="collab-scope__desc">Visible to you and admin only.</div>
      <form class="collab-inline-form" data-form="booking">
        <div class="collab-inline-grid">
          <label>Date
            <input name="dateLabel" value="${escapeHtml(booking.dateLabel)}" placeholder="April 25" />
          </label>
          <label>Time
            <input name="timeLabel" value="${escapeHtml(booking.timeLabel)}" placeholder="2pm" />
          </label>
          <label>Location
            <input name="location" value="${escapeHtml(booking.location)}" placeholder="Montreal" />
          </label>
          <label>Note (optional)
            <input name="note" value="${escapeHtml(booking.note)}" placeholder="Optional note" />
          </label>
        </div>
        <button type="submit" class="inline-save-btn">Save private booking</button>
      </form>
    </div>

    <div class="collab-scope collab-scope--public">
      <div class="collab-scope__title">Public link block</div>
      <div class="collab-scope__desc">Add shareable links and choose who can see them.</div>
      <form class="collab-inline-form" data-form="tagged-url">
        <div class="collab-inline-grid">
          <label>Label
            <input name="label" value="${escapeHtml(taggedUrlDefaults.label)}" placeholder="Consent form" />
          </label>
          <label>URL
            <input name="url" value="${escapeHtml(taggedUrlDefaults.url)}" placeholder="https://..." />
          </label>
          <label>Tags
            <input name="tags" value="${escapeHtml(taggedUrlDefaults.tags)}" placeholder="grabbys, april-20-26" />
          </label>
          <label>Visibility
            <select name="visibility">
              <option value="private" selected>private</option>
              <option value="public">public</option>
              <option value="both">both</option>
            </select>
          </label>
        </div>
        <button type="submit" class="inline-save-btn">Add link</button>
      </form>
    </div>
  `;

  actions.insertAdjacentElement("beforebegin", controls);

  const bookingForm = controls.querySelector("form[data-form='booking']");
  bookingForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);
    try {
      const response = await fetch(`/api/collaborators/private?id=${encodeURIComponent(collabId)}&op=update-booking`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking: {
            dateLabel: toText(formData.get("dateLabel")),
            timeLabel: toText(formData.get("timeLabel")),
            location: toText(formData.get("location")),
            note: toText(formData.get("note"))
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Booking save failed");
      if (payload?.warning?.message) {
        setFeedback(cardEl, payload.warning.message, true);
      } else {
        setFeedback(cardEl, "Booking saved");
      }
      await swapCardToPrivate(collabId);
    } catch (error) {
      const message = String(error?.message || "Booking update failed");
      setFeedback(cardEl, message, true);
    }
  });

  const taggedUrlForm = controls.querySelector("form[data-form='tagged-url']");
  taggedUrlForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(taggedUrlForm);
    try {
      const response = await fetch(`/api/collaborators/private?id=${encodeURIComponent(collabId)}&op=add-tagged-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taggedUrl: {
            label: toText(formData.get("label")),
            url: toText(formData.get("url")),
            tags: parseTagTokens(formData.get("tags")),
            visibility: toText(formData.get("visibility"))
          }
        })
      });
      if (!response.ok) throw new Error("Tagged URL save failed");
      setFeedback(cardEl, "Tagged URL added");
      await swapCardToPrivate(collabId);
    } catch (_) {
      setFeedback(cardEl, "Tagged URL failed", true);
    }
  });
}

function showAuthOverlay(card, collabId, errorMsg = null) {
  // Dismiss any existing overlay
  document.querySelectorAll(".collab-auth-overlay").forEach((el) => el.remove());

  // Check sessionStorage — already unlocked?
  if (getUnlockedIds().includes(collabId)) {
    swapCardToPrivate(collabId);
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "collab-auth-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <button type="button" class="collab-auth-overlay__close" aria-label="Fermer">&times;</button>
    ${errorMsg ? `<p class="collab-auth-overlay__error">${errorMsg}</p>` : ""}
    <a
      class="collab-auth-overlay__btn"
      href="/api/auth/twitter/init?id=${encodeURIComponent(collabId)}"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      Continuer avec X
    </a>
  `;

  overlay.querySelector(".collab-auth-overlay__close").addEventListener("click", (e) => {
    e.stopPropagation();
    overlay.remove();
  });

  card.appendChild(overlay);
  card.classList.add("has-auth-overlay");
}

function handleUnlockedParam() {
  const params = new URLSearchParams(location.search);
  const unlockedId = params.get("unlocked");
  const authError = params.get("auth_error");
  const errorId = params.get("id");

  if (!unlockedId && !authError) return;

  history.replaceState(null, "", location.pathname);

  if (unlockedId) {
    addUnlockedId(unlockedId);
    mergeAllItems();
    renderCards();
    applyFilters();
    setTimeout(() => swapCardToPrivate(unlockedId), 400);
    return;
  }

  if (authError && errorId) {
    mergeAllItems();
    renderCards();
    applyFilters();
    setTimeout(() => {
      const card = document.querySelector(`[data-collab-id="${CSS.escape(errorId)}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("auth-shake");
      setTimeout(() => {
        card.classList.remove("auth-shake");
        showAuthOverlay(card, errorId, "Ce compte X ne correspond pas à ce créateur. Connecte-toi avec le bon compte.");
      }, 700);
    }, 300);
  }
}

function handleShareParam() {
  const params = new URLSearchParams(location.search);
  const shareId = params.get("share");
  if (!shareId) return;

  history.replaceState(null, "", location.pathname);

  mergeAllItems();
  renderCards();
  applyFilters();

  setTimeout(() => {
    const card = document.querySelector(`[data-collab-id="${CSS.escape(shareId)}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("is-shared");
    setTimeout(() => card.classList.remove("is-shared"), 3000);
  }, 400);
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
  if (/^(?:t\.me|x\.com|twitter\.com)\//.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function extractUrlCandidates(rawText) {
  const candidates = [];
  const seen = new Set();
  const patterns = [
    /https?:\/\/[^\s<>"]+/gi,
    /\b(?:t\.me|x\.com|twitter\.com)\/[^\s<>"]+/gi
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
      return ["x.com", "twitter.com"].includes(hostname);
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

function extractNameFromUrl(url) {
  if (!url) return "";
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean)[0] || "";
    let name = seg.replace(/^[_@]+/, "");
    name = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
    name = name.replace(/_/g, " ").replace(/\s+x{2,}$/i, "").replace(/\s*\d+$/, "").trim();
    return name.split(/\s+/).filter(Boolean).map((w) => {
      if (w === w.toUpperCase() && w.length > 1) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(" ");
  } catch (e) {
    return "";
  }
}

function normalizeCollaboratorShape(raw, index) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Element ${index + 1}: format invalide`);
  }

  const name = toText(raw.name);
  if (!name) {
    throw new Error(`Element ${index + 1}: name est requis`);
  }

  const primaryUrlRaw = toText(raw.primaryUrl || raw.publicLink || raw.mainLink || raw.link);
  if (!isValidHttpUrl(primaryUrlRaw)) {
    throw new Error(`Element ${index + 1}: primaryUrl invalide`);
  }

  const platform = toText(raw.platform) || "x";
  const niche = toText(raw.niche) || "lifestyle";
  const format = toText(raw.format) || "post";
  const tone = toText(raw.tone) || "authority";
  const fr = raw.fr || {};
  const en = raw.en || {};
  const booking = normalizeBooking(raw.booking);

  return {
    id: raw.id ? String(raw.id).trim() : `${slugify(name) || "collaborator"}-${Date.now()}-${index}`,
    category: normalizeCollaboratorCategory(raw.category),
    name,
    platform,
    niche,
    format,
    tone,
    primaryUrl: primaryUrlRaw,
    publicLinks: normalizePrivateLinks(raw.publicLinks),
    privateLinks: normalizePrivateLinks(raw.privateLinks),
    taggedUrls: normalizeTaggedUrls(raw.taggedUrls),
    contact: toText(raw.contact),
    email: toText(raw.email),
    rates: toText(raw.rates),
    sourceNotes: toText(raw.sourceNotes),
    booking,
    logos: normalizeLogoUrls(raw.logos),
    mediaImages: normalizeMediaUrls(raw.mediaImages),
    mediaVideos: normalizeMediaUrls(raw.mediaVideos),
    visibility: { ...DEFAULT_COLLABORATOR_VISIBILITY, ...(raw.visibility || {}) },
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
  return state.allItems;
}

function mergeAllItems() {
  state.allItems = [...state.affiliates, ...state.collaborators];
}

function publicCardMarkup(item, archetype = "default") {
  const isNarrowViewport = window.matchMedia("(max-width: 720px)").matches;
  const isCollabType = item.category === "collaborator" || item.category === "event";
  const platformLabel = PLATFORM_LABELS[item.platform] || item.platform;
  const borderOpacity = randomBetween(0.14, 0.38).toFixed(2);

  let articleStyle, articleClasses, nameSize;
  if (isCollabType) {
    const nameSizeBase = isNarrowViewport
      ? ({ default: 0.98, featured: 1.16, small: 0.9, editorial: 1.06 }[archetype] || 0.98)
      : ({ default: 1.05, featured: 2.1, small: 0.88, editorial: 1.75 }[archetype] || 1.05);
    nameSize = (nameSizeBase + randomBetween(isNarrowViewport ? -0.06 : -0.15, isNarrowViewport ? 0.06 : 0.15)).toFixed(2);
    const aspectRatioMap = isNarrowViewport
      ? { default: [0.92, 1.1], featured: [0.84, 1.02], small: [1.02, 1.2], editorial: [0.88, 1.06] }
      : { default: [0.88, 1.12], featured: [0.60, 0.82], small: [1.28, 1.68], editorial: [0.72, 0.96] };
    const [arMin, arMax] = aspectRatioMap[archetype] || [0.88, 1.12];
    const aspectRatio = randomBetween(arMin, arMax).toFixed(3);
    articleStyle = `border: 1px solid rgba(200, 145, 26, ${borderOpacity}); aspect-ratio: ${aspectRatio};`;
    articleClasses = `affiliate-card collaborator-card public-card card--${archetype}`;
  } else {
    const nameSizeBase = isNarrowViewport
      ? ({ default: 1.04, featured: 1.22, small: 0.94, editorial: 1.08 }[archetype] || 1.04)
      : ({ default: 1.24, featured: 1.75, small: 1.0, editorial: 1.5 }[archetype] || 1.24);
    nameSize = (nameSizeBase + randomBetween(isNarrowViewport ? -0.05 : -0.1, isNarrowViewport ? 0.05 : 0.1)).toFixed(2);
    const minHeightMap = isNarrowViewport
      ? { default: [180, 220], featured: [220, 280], small: [150, 190], editorial: [190, 250] }
      : { default: [200, 280], featured: [320, 420], small: [160, 220], editorial: [250, 340] };
    const [mhMin, mhMax] = minHeightMap[archetype] || [200, 280];
    const minHeight = Math.round(randomBetween(mhMin, mhMax));
    const gridRow = !isNarrowViewport && archetype === "featured" ? "span 2" : "span 1";
    articleStyle = `border: 1px solid rgba(200, 145, 26, ${borderOpacity}); min-height: ${minHeight}px; grid-row: ${gridRow};`;
    articleClasses = `affiliate-card public-card card--${archetype}`;
  }

  const fontWeight = randomPick([400, 600, 800]);
  const letterSpacing = randomBetween(0, isNarrowViewport ? 0.03 : 0.1).toFixed(3);
  const textTransform = randomPick(["none", "uppercase"]);
  const nameRotation = !isNarrowViewport && archetype === "editorial" ? randomBetween(-8, 8).toFixed(1) : 0;

  const nameStyle = [
    `font-size: ${nameSize}rem`,
    `font-weight: ${fontWeight}`,
    `letter-spacing: ${letterSpacing}em`,
    `text-transform: ${textTransform}`,
    archetype === "editorial" ? `transform: rotate(${nameRotation}deg); display: inline-block;` : ""
  ].filter(Boolean).join("; ");

  const editorialAccent = archetype === "editorial"
    ? `<span class="card--editorial__accent" aria-hidden="true"></span>`
    : "";
  const flippedLabel = "";

  const bookingBadgeText = isCollabType && isPublicVisible(item, "booking") ? bookingSummary(item.booking) : "";
  const bookingBadge = bookingBadgeText ? `<span class="booking-badge">${escapeHtml(bookingBadgeText)}</span>` : "";
  const bookingTs = isCollabType ? getBookingTimestamp(item) : "";
  const tags = parseTagTokens(item.fr?.tags || item.en?.tags || "");
  const publicTagsMarkup = isPublicVisible(item, "tags") ? tagBadgesMarkup(tags) : "";

  let panelContent;
  if (isCollabType) {
    const allLinks = [];
    if (item.primaryUrl && isPublicVisible(item, "primaryUrl")) {
      let display = item.primaryUrl;
      try {
        const u = new URL(item.primaryUrl);
        display = u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
      } catch (_) {}
      allLinks.push({ label: display, url: item.primaryUrl });
    }
    if (isPublicVisible(item, "publicLinks")) {
      (item.publicLinks || []).forEach((pl) => allLinks.push(pl));
    }
    const taggedUrls = isPublicVisible(item, "taggedUrls")
      ? (item.taggedUrls || []).filter((entry) => entry.visibility === "public" || entry.visibility === "both")
      : [];
    const linksMarkup = allLinks
      .map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="collab-panel__link">${escapeHtml(l.label || l.url)}</a>`)
      .join("");
    const taggedUrlMarkup = taggedUrls
      .map((entry) => {
        const tagsMarkup = entry.tags?.length ? `<span class="tagged-url__tags">${entry.tags.map((tag) => `<span class="tagged-url__tag">${escapeHtml(tag)}</span>`).join("")}</span>` : "";
        const copyValue = `${entry.label}: ${entry.url}${entry.tags?.length ? ` [${entry.tags.join(", ")}]` : ""}`;
        return `<button type="button" class="tagged-url-row" data-action="copy-inline-value" data-copy-value="${escapeHtml(copyValue)}"><span class="tagged-url__label">${escapeHtml(entry.label)}</span><span class="tagged-url__url">${escapeHtml(entry.url)}</span>${tagsMarkup}</button>`;
      })
      .join("");
    const contactMarkup = item.contact && isPublicVisible(item, "contact")
      ? `<div class="collab-panel__copy-row" data-action="copy-inline-value" data-copy-value="${escapeHtml(item.contact)}" title="Cliquer pour copier">${escapeHtml(item.contact)}</div>`
      : "";
    const shareBtn = bookingBadgeText && isPublicVisible(item, "booking")
      ? `<button type="button" class="collab-panel__share-btn" data-action="share-collab" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}">SPREAD IT</button>`
      : "";
    panelContent = `
      <div class="collab-panel__name">${escapeHtml(item.name)}</div>
      <div class="collab-panel__links">${linksMarkup}</div>
      ${taggedUrlMarkup ? `<div class="tagged-url-list">${taggedUrlMarkup}</div>` : ""}
      ${contactMarkup}
      ${shareBtn}
    `;
  } else {
    const promoCodeMarkup = item.promoCode && isPublicVisible(item, "promoCode")
      ? `<div class="collab-panel__copy-row" data-action="copy-inline-value" data-copy-value="${escapeHtml(item.promoCode)}" title="Cliquer pour copier le code">Code : ${escapeHtml(item.promoCode)}</div>`
      : "";
    const primaryUrlMarkup = item.primaryUrl && isPublicVisible(item, "primaryUrl")
      ? `<a href="${escapeHtml(item.primaryUrl)}" target="_blank" rel="noopener noreferrer" class="collab-panel__link">${escapeHtml(item.primaryUrl)}</a>`
      : "";
    panelContent = `
      <div class="collab-panel__name">${escapeHtml(item.name)}</div>
      <div class="collab-panel__links">
        ${primaryUrlMarkup}
      </div>
      ${promoCodeMarkup}
    `;
  }

  return `
    <article
      class="${articleClasses}"
      style="${articleStyle}"
      data-id="${escapeHtml(item.id)}"
      data-category="${escapeHtml(item.category || (isCollabType ? "collaborator" : "affiliate"))}"
      data-tags="${escapeHtml(getItemTags(item).map((tag) => toText(tag).toLowerCase()).join("|"))}"
      ${isCollabType ? `data-collab-id="${escapeHtml(item.id)}" data-primary-url="${escapeHtml(item.primaryUrl)}"` : `data-primary-url="${escapeHtml(item.primaryUrl)}" data-promo-code="${escapeHtml(item.promoCode)}" data-social-url="${escapeHtml(item.socialUrl || "")}" data-fallback-url="${escapeHtml(item.socialUrl || "")}"`}
      data-booking-ts="${bookingTs || ""}"
      tabindex="0">
      ${bookingBadge}
      ${editorialAccent}
      ${flippedLabel}
      <div class="collab-bg">
        <div class="collab-bg__fallback" data-preview-fallback="${escapeHtml(item.id)}"></div>
        <img class="collab-bg__img is-hidden" data-preview-image="${escapeHtml(item.id)}" alt="" loading="lazy" onerror="this.classList.add('is-hidden')" />
      </div>
      <div class="collab-overlay">
        ${isPublicVisible(item, "logos") ? logoStripMarkup(item.logos, item.name) : ""}
        ${isPublicVisible(item, "mediaImages") || isPublicVisible(item, "mediaVideos") ? mediaStripMarkup(item) : ""}
        <div class="collab-info">
          ${publicTagsMarkup}
          <h2 style="${nameStyle}">${escapeHtml(item.name)}</h2>
        </div>
      </div>
      <div class="collab-panel">
        ${panelContent}
      </div>
    </article>
  `;
}

function privateCardMarkup(item) {
  const isCollabType = item.category === "collaborator" || item.category === "event";
  const platformLabel = PLATFORM_LABELS[item.platform] || item.platform;
  const nicheLabel = NICHE_LABELS[item.niche] || item.niche;
  const hasValidPrimaryUrl = isValidHttpUrl(item.primaryUrl);
  const primaryUrlLabel = hasValidPrimaryUrl
    ? (() => {
        try {
          const u = new URL(item.primaryUrl);
          return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}` || item.primaryUrl;
        } catch (_) {
          return item.primaryUrl;
        }
      })()
    : "-";

  const socialLink = !isCollabType && item.socialUrl
    ? `<a href="${escapeHtml(item.socialUrl)}" target="_blank" rel="noopener noreferrer" class="contact-link">Profil social</a>`
    : "";

  let kitSection;
  if (isCollabType) {
    const privateLinksText = item.privateLinks?.length
      ? item.privateLinks.map((entry) => `${entry.label}: ${entry.url}`).join("\n")
      : "-";
    const taggedUrlsText = item.taggedUrls?.length
      ? item.taggedUrls.map((entry) => `${entry.label}: ${entry.url}${entry.tags?.length ? ` [${entry.tags.join(", ")}]` : ""} (${entry.visibility || "private"})`).join("\n")
      : "-";
    const bookingText = bookingSummary(item.booking) || "-";
    const bookingTs = getBookingTimestamp(item);
    kitSection = `
      <section class="content-block affiliation-kit">
        <h3>Kit collaboration</h3>
        <div class="kit-row">
          <span class="kit-label">Lien principal</span>
          ${hasValidPrimaryUrl
      ? `<a href="${escapeHtml(item.primaryUrl)}" target="_blank" rel="noopener noreferrer" class="kit-link">${escapeHtml(primaryUrlLabel)}</a>`
      : `<span class="kit-value">-</span>`}
        </div>
        <div class="kit-row">
          <span class="kit-label">Contact</span>
          <span class="kit-value">${escapeHtml(item.contact || "-")}</span>
        </div>
        ${item.email ? `<div class="kit-row"><span class="kit-label">Email</span><span class="kit-value">${escapeHtml(item.email)}</span></div>` : ""}
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
        <div class="kit-row">
          <span class="kit-label">Tagged URLs</span>
          <span class="kit-value">${escapeHtml(taggedUrlsText)}</span>
        </div>
      </section>
    `;
    var cardDataAttrs = `data-collab-id="${escapeHtml(item.id)}"
      data-primary-url="${escapeHtml(item.primaryUrl)}"
      data-private-links="${escapeHtml(JSON.stringify(item.privateLinks || []))}"
      data-contact="${escapeHtml(item.contact)}"
      data-rates="${escapeHtml(item.rates)}"
      data-booking="${escapeHtml(JSON.stringify(item.booking || {}))}"
      data-booking-ts="${bookingTs || ""}"`;
    var cardActions = `
      <button type="button" data-action="copy-primary-url">Copier lien principal</button>
      <button type="button" data-action="copy-contact">Copier contact</button>
      <button type="button" data-action="copy-collaboration-kit">Copier kit collaboration</button>
    `;
  } else {
    kitSection = `
      <section class="content-block affiliation-kit">
        <h3>Kit affiliation</h3>
        <div class="kit-row">
          <span class="kit-label">Promo URL</span>
          ${item.primaryUrl ? `<a href="${escapeHtml(item.primaryUrl)}" target="_blank" rel="noopener noreferrer" class="kit-link">${escapeHtml(item.primaryUrl)}</a>` : `<span class="kit-value">-</span>`}
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
    `;
    var cardDataAttrs = `data-primary-url="${escapeHtml(item.primaryUrl)}"
      data-promo-code="${escapeHtml(item.promoCode)}"
      data-fallback-url="${escapeHtml(item.socialUrl)}"
      data-mentions="${escapeHtml(item.mentions)}"
      data-post-requirements="${escapeHtml(item.postRequirements)}"
      data-specificities="${escapeHtml(item.specificities)}"
      data-social-url="${escapeHtml(item.socialUrl)}"`;
    var cardActions = `
      <button type="button" data-action="copy-primary-url">Copier URL promo</button>
      <button type="button" data-action="copy-promo-code">Copier code</button>
      <button type="button" data-action="copy-affiliation-kit">Copier kit affiliation</button>
      <button type="button" data-action="copy-tags">Copier tags</button>
      <button type="button" data-action="copy-specs">Copier specs</button>
    `;
  }

  return `
    <article
      class="affiliate-card${isCollabType ? " collaborator-card" : ""}"
      data-id="${escapeHtml(item.id)}"
      data-category="${escapeHtml(item.category || (isCollabType ? "collaborator" : "affiliate"))}"
      data-tags="${escapeHtml(getItemTags(item).map((tag) => toText(tag).toLowerCase()).join("|"))}"
      data-platform="${escapeHtml(item.platform)}"
      data-niche="${escapeHtml(item.niche)}"
      data-format="${escapeHtml(item.format)}"
      data-tone="${escapeHtml(item.tone)}"
      ${cardDataAttrs}
      data-logos="${escapeHtml(JSON.stringify(item.logos || []))}">
      <div class="preview-shell" data-preview-shell="${escapeHtml(item.id)}">
        <img class="preview-image is-hidden" data-preview-image="${escapeHtml(item.id)}" alt="Apercu du lien" loading="lazy" />
        <div class="preview-fallback" data-preview-fallback="${escapeHtml(item.id)}">Apercu lien</div>
      </div>
      ${logoStripMarkup(item.logos, item.name)}

      <div class="card-head">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <p class="meta">${escapeHtml(platformLabel)} · ${escapeHtml(nicheLabel)}</p>
        </div>
        <div class="card-head__actions">${socialLink}</div>
      </div>

      ${kitSection}

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
        ${cardActions}
        <button type="button" data-action="edit">Modifier</button>
        <button type="button" data-action="duplicate">Dupliquer bloc</button>
        <button type="button" data-action="ai-assistant" class="accent-ai">✦ HeyHi</button>
        <button type="button" data-action="copy-all" class="accent">Copier tout</button>
        <span class="copy-feedback" aria-live="polite"></span>
      </div>
    </article>
  `;
}

function cardMarkup(item, archetypeMap = new Map()) {
  if (!state.isUnlocked) {
    const archetype = archetypeMap.get(item.id) || "default";
    return publicCardMarkup(item, archetype);
  }
  return privateCardMarkup(item);
}
async function fetchLinkMeta(url) {
  if (!url) return { image: "", title: "", description: "" };
  if (metaCache.has(url)) return metaCache.get(url);

  try {
    const response = await fetch(`/api/link-meta?url=${encodeURIComponent(url)}`);
    const payload = await response.json();
    const value = {
      image: toText(payload.image),
      siteLogo: toText(payload.siteLogo),
      title: toText(payload.title),
      description: toText(payload.description)
    };
    metaCache.set(url, value);
    return value;
  } catch (error) {
    const fallback = { image: "", siteLogo: "", title: "", description: "" };
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
  } catch (error) {
    // ignore
  }
  return "";
}

async function hydrateCardPreviews(cards, urlField, fallbackUrlField = null) {
  await Promise.all(
    cards.map(async (card) => {
      const id = card.dataset.id;
      const url = card.dataset[urlField] || "";
      const isAffiliate = card.dataset.category === "affiliate" || !card.dataset.category;
      if (!id || !url) return;

      const meta = await fetchLinkMeta(url);
      let imageUrl = "";

      if (isAffiliate) {
        imageUrl = meta.image || meta.siteLogo;
      } else {
        imageUrl = meta.image || socialAvatarUrl(url);
      }

      if (!imageUrl && fallbackUrlField) {
        const fallbackUrl = card.dataset[fallbackUrlField] || "";
        if (fallbackUrl) {
          const fallbackMeta = await fetchLinkMeta(fallbackUrl);
          if (isAffiliate) {
            imageUrl = fallbackMeta.image || fallbackMeta.siteLogo;
          } else {
            imageUrl = fallbackMeta.image || socialAvatarUrl(fallbackUrl);
          }
        }
      }

      if (!imageUrl) {
        try {
          const logos = JSON.parse(card.dataset.logos || "[]");
          imageUrl = logos.find((l) => l) || "";
        } catch (_) {}
      }

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

async function hydrateAllPreviews() {
  const cards = Array.from(refs.cardsGrid.querySelectorAll(".affiliate-card"));
  await hydrateCardPreviews(cards, "primaryUrl", "fallbackUrl");
}

function renderCards() {
  const activeItems = shuffleItems(getActiveItems());
  state.debug.renderedCount = activeItems.length;

  const isPublicMode = !state.isUnlocked;
  if (isPublicMode) {
    injectDarkBackground();
  } else {
    removeDarkBackground();
  }

  let archetypeMap = new Map();
  if (isPublicMode) {
    assignCardArchetypes(activeItems).forEach(({ item, archetype }) => {
      archetypeMap.set(item.id, archetype);
    });
  }

  refs.cardsGrid.innerHTML = activeItems.map((item) => cardMarkup(item, archetypeMap)).join("");
  applyCardChaosLayout();
  hydrateAllPreviews();
  updateDebugInfo();
}

function mergeAffiliates() {
  state.affiliates = mergeEntityLists(state.baseAffiliates, state.localAffiliates, affiliateMergeKeys);
}

function mergeCollaborators() {
  state.collaborators = mergeEntityLists(state.baseCollaborators, state.localCollaborators, collaboratorMergeKeys);
}

function normalizeKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

function affiliateMergeKeys(item) {
  const keys = [];
  const id = normalizeKeyPart(item.id);
  if (id) keys.push(`id:${id}`);

  const name = normalizeKeyPart(item.name);
  const platform = normalizeKeyPart(item.platform);
  if (name || platform) keys.push(`np:${name}|${platform}`);

  const primaryUrl = normalizeKeyPart(item.primaryUrl);
  if (primaryUrl) keys.push(`url:${primaryUrl}`);

  return keys;
}

function collaboratorMergeKeys(item) {
  const keys = [];
  const id = normalizeKeyPart(item.id);
  if (id) keys.push(`id:${id}`);

  const primaryUrl = normalizeKeyPart(item.primaryUrl);
  if (primaryUrl) keys.push(`url:${primaryUrl}`);

  const name = normalizeKeyPart(item.name);
  const platform = normalizeKeyPart(item.platform);
  if (name || platform) keys.push(`np:${name}|${platform}`);

  return keys;
}

function mergeEntityLists(baseItems, localItems, keyFn) {
  const keyToIndex = new Map();
  const ordered = [];

  function upsert(item) {
    const keys = keyFn(item);
    let existingIndex = -1;

    for (const key of keys) {
      if (keyToIndex.has(key)) {
        existingIndex = keyToIndex.get(key);
        break;
      }
    }

    const targetIndex = existingIndex >= 0 ? existingIndex : ordered.length;
    ordered[targetIndex] = item;

    for (const key of keys) {
      keyToIndex.set(key, targetIndex);
    }
  }

  (baseItems || []).forEach(upsert);
  (localItems || []).forEach(upsert);
  return ordered.filter(Boolean);
}

function affiliateDedupKey(item) {
  const primaryUrl = String(item.primaryUrl || "").trim().toLowerCase();
  if (primaryUrl) return `url:${primaryUrl}`;
  const name = String(item.name || "").trim().toLowerCase();
  const platform = String(item.platform || "").trim().toLowerCase();
  return `np:${name}|${platform}`;
}

function collaboratorDedupKey(item) {
  const primaryUrl = String(item.primaryUrl || "").trim().toLowerCase();
  if (primaryUrl) return `url:${primaryUrl}`;
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

function setComposerEditMode(item) {
  const isCollab = item?.category === "collaborator" || item?.category === "event";

  if (isCollab) {
    state.editingCollaboratorId = item.id;
    state.editingAffiliateId = null;
    if (refs.composerTitle) refs.composerTitle.textContent = "Modifier un collaborator";
    if (refs.submitAffiliateBtn) refs.submitAffiliateBtn.textContent = "Enregistrer les modifications";
    if (refs.cancelEditBtn) refs.cancelEditBtn.classList.remove("is-hidden");
    return;
  }

  if (item) {
    state.editingAffiliateId = item.id;
    state.editingCollaboratorId = null;
    if (refs.composerTitle) refs.composerTitle.textContent = "Modifier une affiliation";
    if (refs.submitAffiliateBtn) refs.submitAffiliateBtn.textContent = "Enregistrer les modifications";
    if (refs.cancelEditBtn) refs.cancelEditBtn.classList.remove("is-hidden");
    return;
  }

  state.editingAffiliateId = null;
  state.editingCollaboratorId = null;
  if (refs.composerTitle) refs.composerTitle.textContent = "Ajouter une affiliation (V4)";
  if (refs.submitAffiliateBtn) refs.submitAffiliateBtn.textContent = "Ajouter et afficher";
  if (refs.cancelEditBtn) refs.cancelEditBtn.classList.add("is-hidden");
}

function populateFormFromAffiliate(affiliate) {
  const form = refs.affiliateForm;
  form.elements.name.value = affiliate.name || "";
  form.elements.primaryUrl.value = affiliate.primaryUrl || "";
  form.elements.promoCode.value = affiliate.promoCode || "";
  form.elements.socialUrl.value = affiliate.socialUrl || "";
  form.elements.logos.value = (affiliate.logos || []).join("\n");
  form.elements.mentions.value = affiliate.mentions || "";
  form.elements.tags.value = affiliate.fr?.tags || affiliate.en?.tags || "";
  form.elements.specs.value = affiliate.fr?.specs || affiliate.en?.specs || "";
  form.elements.caption.value = affiliate.fr?.caption || affiliate.en?.caption || "";
  form.elements.postRequirements.value = affiliate.postRequirements || "";
  form.elements.specificities.value = affiliate.specificities || "";
  form.elements.mediaImages.value = (affiliate.mediaImages || []).join("\n");
  form.elements.mediaVideos.value = (affiliate.mediaVideos || []).join("\n");
  const fCatEl = document.getElementById("fCategory");
  if (fCatEl) { fCatEl.value = affiliate.category || "affiliate"; applyCategoryToForm(fCatEl.value); }
}

function populateFormFromCollaborator(collaborator) {
  const form = refs.affiliateForm;
  form.elements.name.value = collaborator.name || "";
  form.elements.primaryUrl.value = collaborator.primaryUrl || "";
  form.elements.publicLinks.value = (collaborator.publicLinks || []).map((entry) => entry.url).join("\n");
  form.elements.privateLinks.value = (collaborator.privateLinks || []).map((entry) => entry.url).join("\n");
  form.elements.contact.value = collaborator.contact || "";
  form.elements.email.value = collaborator.email || "";
  form.elements.rates.value = collaborator.rates || "";
  form.elements.sourceNotes.value = collaborator.sourceNotes || "";
  form.elements.bookingDate.value = collaborator.booking?.dateLabel || "";
  form.elements.bookingTime.value = collaborator.booking?.timeLabel || "";
  form.elements.bookingLocation.value = collaborator.booking?.location || "";
  form.elements.logos.value = (collaborator.logos || []).join("\n");
  form.elements.tags.value = collaborator.fr?.tags || collaborator.en?.tags || "";
  form.elements.specs.value = collaborator.fr?.specs || collaborator.en?.specs || "";
  form.elements.caption.value = collaborator.fr?.caption || collaborator.en?.caption || "";
  form.elements.mediaImages.value = (collaborator.mediaImages || []).join("\n");
  form.elements.mediaVideos.value = (collaborator.mediaVideos || []).join("\n");

  form.elements.primaryUrl.value = "";
  form.elements.promoCode.value = "";
  form.elements.socialUrl.value = "";
  form.elements.mentions.value = "";
  form.elements.postRequirements.value = "";
  form.elements.specificities.value = "";
  const fCatEl = document.getElementById("fCategory");
  if (fCatEl) { fCatEl.value = collaborator.category || "collaborator"; applyCategoryToForm(fCatEl.value); }
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
    const filename = `all-${suffix}-autosave-${new Date().toISOString().slice(0, 10)}.json`;
    const payload = isRemotePersistenceEnabled()
      ? getFullDataset()
      : [...state.localAffiliates, ...state.localCollaborators];
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
    const response = await fetchWithTimeout("/api/session", { credentials: "include" }, 8000);
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
    const response = await fetchWithTimeout("/api/affiliates", { cache: "no-store", credentials: "include" }, 10000);
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
    const response = await fetchWithTimeout("/api/collaborators", { cache: "no-store", credentials: "include" }, 10000);
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
    category: toText(formData.get("category")),
    name: toText(formData.get("name")),
    platform: toText(formData.get("platform")),
    niche: toText(formData.get("niche")),
    format: toText(formData.get("format")),
    tone: toText(formData.get("tone")),
    primaryUrl: toText(formData.get("primaryUrl")),
    promoCode: toText(formData.get("promoCode")),
    socialUrl: toText(formData.get("socialUrl")),
    mentions: toText(formData.get("mentions")),
    logos: toText(formData.get("logos")),
    mediaImages: toText(formData.get("mediaImages")),
    mediaVideos: toText(formData.get("mediaVideos")),
    postRequirements: toText(formData.get("postRequirements")),
    specificities: toText(formData.get("specificities")),
    fr: {
      tags: toText(formData.get("tags")),
      specs: toText(formData.get("specs")),
      caption: toText(formData.get("caption"))
    },
    en: {
      tags: toText(formData.get("tags")),
      specs: toText(formData.get("specs")),
      caption: toText(formData.get("caption"))
    },
    visibility: state.pendingVisibility || undefined
  };

  return normalizeAffiliateShape(raw, 0);
}

function detectPlatformFromUrl(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (["x.com", "twitter.com"].includes(hostname)) return "x";
  } catch (e) {}
  return null;
}

function buildCollaboratorFromForm(formData) {
  const sourceNotes = toText(formData.get("sourceNotes"));
  const extracted = extractCollaboratorInsights(sourceNotes);
  const privateLinksRaw = toText(formData.get("privateLinks")) || extracted.privateLinks.map((entry) => entry.url).join("\n");
  const primaryUrl = toText(formData.get("primaryUrl")) || extracted.publicLink;
  const name = toText(formData.get("name")) || extractNameFromUrl(primaryUrl);

  const raw = {
    id: `${slugify(name || "collaborator")}-${Date.now()}`,
    category: toText(formData.get("category")),
    name,
    platform: detectPlatformFromUrl(primaryUrl) || toText(formData.get("platform")),
    niche: toText(formData.get("niche")),
    format: toText(formData.get("format")),
    tone: toText(formData.get("tone")),
    primaryUrl,
    publicLinks: toText(formData.get("publicLinks")),
    privateLinks: privateLinksRaw,
    contact: toText(formData.get("contact")) || extracted.contact,
    email: toText(formData.get("email")),
    rates: toText(formData.get("rates")),
    sourceNotes,
    booking: {
      dateLabel: toText(formData.get("bookingDate")) || extracted.booking.dateLabel,
      timeLabel: toText(formData.get("bookingTime")) || extracted.booking.timeLabel,
      location: toText(formData.get("bookingLocation")) || extracted.booking.location,
      note: extracted.booking.note
    },
    logos: toText(formData.get("logos")),
    mediaImages: toText(formData.get("mediaImages")),
    mediaVideos: toText(formData.get("mediaVideos")),
    fr: {
      tags: toText(formData.get("tags")),
      specs: toText(formData.get("specs")),
      caption: toText(formData.get("caption"))
    },
    en: {
      tags: toText(formData.get("tags")),
      specs: toText(formData.get("specs")),
      caption: toText(formData.get("caption"))
    },
    taggedUrls: state.pendingTaggedUrls || undefined,
    visibility: state.pendingVisibility || undefined
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

function isRemotePersistenceEnabledFor(entity) {
  const persistence = state.persistenceByEntity[entity] || { mode: "local", writable: false };
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

async function remoteDeleteAffiliate(id) {
  await postJson("/api/affiliates-delete", { id });
}

async function remoteDeleteCollaborator(id) {
  await postJson("/api/collaborators-delete", { id });
}

async function syncPendingLocalData() {
  if (!state.isUnlocked) return;
  let syncedCount = 0;

  if (state.persistenceByEntity.affiliates.mode === "remote") {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const pending = JSON.parse(raw);
        if (Array.isArray(pending) && pending.length > 0) {
          await remoteBulkUpsert(pending);
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          await loadAffiliates();
          mergeAffiliates();
          syncedCount += pending.length;
        }
      }
    } catch (e) {
      // Non-blocking — local data stays intact on failure
    }
  }

  if (state.persistenceByEntity.collaborators.mode === "remote") {
    try {
      const raw = localStorage.getItem(COLLABORATOR_LOCAL_STORAGE_KEY);
      if (raw) {
        const pending = JSON.parse(raw);
        if (Array.isArray(pending) && pending.length > 0) {
          await remoteBulkUpsertCollaborators(pending);
          localStorage.removeItem(COLLABORATOR_LOCAL_STORAGE_KEY);
          await loadCollaborators();
          mergeCollaborators();
          syncedCount += pending.length;
        }
      }
    } catch (e) {
      // Non-blocking — local data stays intact on failure
    }
  }

  if (syncedCount > 0) {
    setFormFeedback(`${syncedCount} élément(s) locaux synchronisés avec la base.`);
  }
}

function rerenderAll() {
  mergeAffiliates();
  mergeCollaborators();
  mergeAllItems();
  renderCards();
  applyLanguage();
  applyViewMode();
  applyFilters();
  refreshTagChips();
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
  const isCollab = card.dataset.category !== "affiliate" && card.dataset.category !== undefined;
  if (isCollab) {
    const name = card.querySelector("h2")?.textContent.trim() || "Collaborator";
    const meta = card.querySelector(".meta")?.textContent.trim() || "";
    const [platform = "", niche = ""] = meta.split("·").map((value) => value.trim());
    const primaryUrl = card.dataset.primaryUrl || "";
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

    return { name, platform, niche, primaryUrl, privateLinks, contact, rates, booking, logos };
  }

  const name = card.querySelector("h2")?.textContent.trim() || "Affiliate";
  const meta = card.querySelector(".meta")?.textContent.trim() || "";
  const [platform = "", niche = ""] = meta.split("·").map((value) => value.trim());

  const primaryUrl = card.dataset.primaryUrl || "";
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

  return { name, platform, niche, primaryUrl, promoCode, mentions, postRequirements, specificities, socialUrl, logos };
}

function getAffiliationKitText(card) {
  const isCollab = card.dataset.category !== "affiliate";
  if (isCollab) {
    const meta = getCardMeta(card);
    return [
      `Lien principal: ${meta.primaryUrl}`,
      `Contact: ${meta.contact || "-"}`,
      `Rates: ${meta.rates || "-"}`,
      `Booking: ${bookingSummary(meta.booking) || "-"}`,
      `Liens prives: ${meta.privateLinks?.length ? meta.privateLinks.map((entry) => `${entry.label}: ${entry.url}`).join(" | ") : "-"}`,
      `Logos: ${meta.logos.length ? meta.logos.join(" | ") : "-"}`
    ].join("\n");
  }

  const meta = getCardMeta(card);
  return [
    `Promo URL: ${meta.primaryUrl}`,
    `Code fan: ${meta.promoCode}`,
    `Mentions: ${meta.mentions}`,
    `Logos: ${meta.logos.length ? meta.logos.join(" | ") : "-"}`,
    `Demandes post: ${meta.postRequirements}`,
    `Specificites: ${meta.specificities || "-"}`
  ].join("\n");
}

function getCopyAllText(card) {
  const isCollab = card.dataset.category !== "affiliate";
  if (isCollab) {
    const { name, platform, niche, primaryUrl, privateLinks, contact, rates, booking, logos } = getCardMeta(card);
    const tags = getCopyText(card, "tags");
    const specs = getCopyText(card, "specs");
    const caption = getCopyText(card, "caption");
    const template = refs.copyAllCollaboratorTemplate.textContent;

    return template
      .replace("{{name}}", name)
      .replace("{{platform}}", platform)
      .replace("{{niche}}", niche)
      .replace("{{primaryUrl}}", primaryUrl)
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

  const { name, platform, niche, primaryUrl, promoCode, mentions, postRequirements, specificities, socialUrl, logos } = getCardMeta(card);
  const tags = getCopyText(card, "tags");
  const specs = getCopyText(card, "specs");
  const caption = getCopyText(card, "caption");

  const template = refs.copyAllTemplate.textContent;
  return template
    .replace("{{name}}", name)
    .replace("{{platform}}", platform)
    .replace("{{niche}}", niche)
    .replace("{{primaryUrl}}", primaryUrl)
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
  if (state.isUnlocked) {
    closeCollaboratorWorkspace();
  }
  if (refs.accessStatus) {
    if (state.authMode === "api-unavailable") {
      refs.accessStatus.textContent = "API indisponible: lancer le serveur dev (mode API-only).";
    } else {
      refs.accessStatus.textContent = state.isUnlocked ? "Admin actif" : "";
    }
  }
}

function applyEntityMode() {
  // Legacy — kept for backward compat; new UI uses applyCategoryFilter
  refs.entityButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.entity === state.activeEntity);
  });
}

function applyCategoryToForm(categoryValue) {
  document.querySelectorAll(".form-affiliate-only").forEach((el) => {
    el.classList.remove("is-hidden");
  });
  document.querySelectorAll(".form-collaborator-only").forEach((el) => {
    el.classList.remove("is-hidden");
  });

  const titles = { affiliate: "Ajouter une affiliation", collaborator: "Ajouter un collaborator", event: "Ajouter un événement" };
  if (refs.composerTitle) {
    refs.composerTitle.textContent = titles[categoryValue] || titles.affiliate;
  }
  if (refs.composerSubtitle) {
    refs.composerSubtitle.textContent = "Les ajouts sont sauves localement dans ton navigateur (localStorage).";
  }
}

function refreshTagChips() {
  if (!refs.tagChips) return;

  const tagsMap = new Map();
  state.allItems.forEach((item) => {
    getItemTags(item).forEach((tag) => {
      const key = toText(tag).toLowerCase();
      if (!key || tagsMap.has(key)) return;
      tagsMap.set(key, tag);
    });
  });

  const tags = [...tagsMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, label]) => label);

  refs.tagChips.innerHTML = tags
    .map((tag) => {
      const key = toText(tag).toLowerCase();
      const isActive = state.activeTags.includes(key);
      return `<button type="button" class="cat-btn tag-btn${isActive ? " is-active" : ""}" data-tag="${escapeHtml(key)}">${escapeHtml(tag)}</button>`;
    })
    .join("");

  refs.tagChips.querySelectorAll(".tag-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.tag || "";
      if (!key) return;
      if (state.activeTags.includes(key)) {
        state.activeTags = state.activeTags.filter((tag) => tag !== key);
      } else {
        state.activeTags = [...state.activeTags, key];
      }
      applyTagFilter();
    });
  });
}

function applyTagFilter() {
  if (refs.tagAllBtn) {
    refs.tagAllBtn.classList.toggle("is-active", state.activeTags.length === 0);
  }
  if (refs.tagChips) {
    refs.tagChips.querySelectorAll(".tag-btn").forEach((btn) => {
      btn.classList.toggle("is-active", state.activeTags.includes(btn.dataset.tag || ""));
    });
  }
  applyFilters();
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
  const upcomingOnly = Boolean(refs.upcomingBookingsToggle?.checked);
  const nowTimestamp = Date.now();
  let visibleCount = 0;

  getAllCards().forEach((card) => {
    if (state.activeTags.length > 0) {
      const cardTags = String(card.dataset.tags || "")
        .split("|")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
      const hasAllSelectedTags = state.activeTags.every((selected) => cardTags.includes(selected));
      if (!hasAllSelectedTags) {
        card.style.display = "none";
        return;
      }
    }
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
  } else {
    // Sort cards with upcoming bookings to the top
    const now = Date.now();
    const visibleCards = getAllCards().filter((card) => card.style.display !== "none" && card.dataset.bookingTs);
    if (visibleCards.some((card) => Number(card.dataset.bookingTs || "") > now)) {
      visibleCards
        .sort((cardA, cardB) => {
          const aTs = Number(cardA.dataset.bookingTs || "");
          const bTs = Number(cardB.dataset.bookingTs || "");
          const aFuture = Number.isFinite(aTs) && aTs > now;
          const bFuture = Number.isFinite(bTs) && bTs > now;
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;
          if (aFuture && bFuture) return aTs - bTs;
          return 0;
        })
        .forEach((card) => refs.cardsGrid.append(card));
    }
  }

  refs.emptyState.classList.toggle("is-hidden", visibleCount !== 0);
  state.debug.visibleCount = visibleCount;
  const suffix = upcomingOnly ? " (RDV a venir)" : "";
  refs.resultsInfo.textContent = `${visibleCount} carte${visibleCount > 1 ? "s" : ""} affich\u00e9e${visibleCount > 1 ? "s" : ""}${suffix}`;
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

  const timeline = document.getElementById("bookingTimeline");
  if (timeline) {
    timeline.addEventListener("click", (event) => {
      const shareBtn = event.target.closest("[data-action='share-timeline-entry']");
      if (shareBtn) {
        shareCollaborator(shareBtn.dataset.id, shareBtn.dataset.name);
      }
    });
  }
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

// --- Unified AI Assistant overlay ---
function showAIAssistantOverlay(item, mode) {
    document.querySelectorAll(".ai-overlay").forEach((el) => el.remove());

    const overlay = document.createElement("div");
    overlay.className = "ai-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="ai-overlay__inner">
        <div class="ai-overlay__header">
          <h3 class="ai-overlay__title">✦ HeyHi</h3>
          <div class="ai-overlay__header-right">
            ${mode === "post" ? `
            <div class="ai-overlay__langs">
              <button type="button" class="ai-overlay__lang-btn is-active" data-lang="fr">FR</button>
              <button type="button" class="ai-overlay__lang-btn" data-lang="en">EN</button>
            </div>` : `<span class="ai-overlay__entity-badge is-hidden"></span>`}
            <button type="button" class="ai-overlay__close" aria-label="Fermer">&times;</button>
          </div>
        </div>
        <div class="ai-overlay__thread"></div>
        <div class="ai-overlay__input-row">
          <textarea class="ai-overlay__input" rows="2" placeholder="${mode === "post" ? "Ex: rends-le plus court, ajoute une touche d'humour..." : "Colle un DM, un email, ou décris la fiche à créer..."}"></textarea>
          <button type="button" class="ai-overlay__send accent-ai">Envoyer</button>
        </div>
      </div>
    `;

    let activeLang = "fr";
    let conversationHistory = [];
    let isBusy = false;

    const closeBtn = overlay.querySelector(".ai-overlay__close");
    const langBtns = overlay.querySelectorAll(".ai-overlay__lang-btn");
    const thread = overlay.querySelector(".ai-overlay__thread");
    const input = overlay.querySelector(".ai-overlay__input");
    const sendBtn = overlay.querySelector(".ai-overlay__send");
    const entityBadge = overlay.querySelector(".ai-overlay__entity-badge");

    function appendMessage(role, text) {
      const bubble = document.createElement("div");
      bubble.className = "ai-overlay__msg";
      bubble.dataset.role = role;
      bubble.textContent = text;

      if (role === "assistant" && mode === "post") {
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "ai-overlay__copy-bubble";
        copyBtn.textContent = "Copier";
        copyBtn.addEventListener("click", () => {
          copyText(text).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = "Copié !";
            setTimeout(() => { copyBtn.textContent = orig; }, 1500);
          });
        });
        bubble.appendChild(copyBtn);
      }

      thread.appendChild(bubble);
      thread.scrollTop = thread.scrollHeight;
    }

    function appendExtractedBlock(extracted) {
      const block = document.createElement("div");
      block.className = "ai-overlay__extracted";

      const typeLabel = extracted.entityType === "affiliate" ? "Affilié" : "Collaborateur";
      const editLabel = extracted.editId ? " (modification)" : " (nouveau)";
      const fieldLines = Object.entries(extracted.fields || {})
        .filter(([, v]) => v)
        .map(([k, v]) => `<span class="ai-overlay__extracted-field"><strong>${escapeHtml(k)}</strong>: ${escapeHtml(String(v))}</span>`)
        .join("");

      block.innerHTML = `
        <div class="ai-overlay__extracted-header">${escapeHtml(typeLabel + editLabel)}</div>
        <div class="ai-overlay__extracted-fields">${fieldLines}</div>
        <button type="button" class="ai-overlay__apply-btn accent-ai">Appliquer au formulaire</button>
      `;

      if (entityBadge) {
        entityBadge.textContent = typeLabel;
        entityBadge.classList.remove("is-hidden");
      }

      block.querySelector(".ai-overlay__apply-btn").addEventListener("click", () => {
        overlay.remove();

        // Switch fCategory if needed
        const fCatEl = document.getElementById("fCategory");
        if (fCatEl) {
          fCatEl.value = extracted.entityType === "collaborator" ? "collaborator" : "affiliate";
          applyCategoryToForm(fCatEl.value);
        }

        const existingItem = extracted.editId
          ? (extracted.entityType === "collaborator" ? findCollaboratorById(extracted.editId) : findAffiliateById(extracted.editId))
          : null;

        setComposerEditMode(existingItem || null);

        // Merge extracted fields with existing item if editing
        const fields = existingItem ? { ...existingItem, ...extracted.fields } : extracted.fields;

        // Preserve AI-assigned visibility for form submit
        state.pendingVisibility = fields.visibility || null;
        state.pendingTaggedUrls = Array.isArray(fields.taggedUrls) ? fields.taggedUrls : null;

        if (extracted.entityType === "collaborator") {
          populateFormFromCollaborator(fields);
        } else {
          populateFormFromAffiliate(fields);
        }

        refs.affiliateForm.scrollIntoView({ behavior: "smooth", block: "start" });

        // Show toast
        if (refs.formFeedback) {
          refs.formFeedback.textContent = "Données remplies par l'IA — vérifiez avant de sauvegarder";
          refs.formFeedback.classList.add("is-visible");
          setTimeout(() => refs.formFeedback.classList.remove("is-visible"), 4000);
        }
      });

      thread.appendChild(block);
      thread.scrollTop = thread.scrollHeight;
    }

    function appendDeleteBlock(deleteReq) {
      const block = document.createElement("div");
      block.className = "ai-overlay__extracted";

      const typeLabel = deleteReq.entityType === "affiliate" ? "Affilié" : "Collaborateur";

      block.innerHTML = `
        <div class="ai-overlay__extracted-header">Supprimer ${escapeHtml(typeLabel)}: ${escapeHtml(deleteReq.name || deleteReq.id)}</div>
        <button type="button" class="ai-overlay__apply-btn" style="background:#c0392b;color:#fff;">Confirmer la suppression</button>
      `;

      block.querySelector(".ai-overlay__apply-btn").addEventListener("click", async () => {
        try {
          if (deleteReq.entityType === "collaborator") {
            await remoteDeleteCollaborator(deleteReq.id);
            await loadCollaborators();
          } else {
            await remoteDeleteAffiliate(deleteReq.id);
            await loadAffiliates();
          }
          mergeAllItems();
          renderCards();
          refreshTagChips();
          block.innerHTML = `<div class="ai-overlay__extracted-header">✓ ${escapeHtml(deleteReq.name || deleteReq.id)} supprimé</div>`;
        } catch (err) {
          block.innerHTML = `<div class="ai-overlay__extracted-header">Erreur : ${escapeHtml(err.message)}</div>`;
        }
      });

      thread.appendChild(block);
      thread.scrollTop = thread.scrollHeight;
    }

    function setBusy(busy) {
      isBusy = busy;
      sendBtn.disabled = busy;
      input.disabled = busy;
      if (busy) {
        const loading = document.createElement("div");
        loading.className = "ai-overlay__loading";
        loading.dataset.loading = "1";
        loading.textContent = "…";
        thread.appendChild(loading);
        thread.scrollTop = thread.scrollHeight;
      } else {
        thread.querySelectorAll("[data-loading]").forEach((el) => el.remove());
      }
    }

    async function sendMessage(userMessage, isAuto = false) {
      if (isBusy) return;
      if (!isAuto && !userMessage.trim()) return;

      if (!isAuto) {
        conversationHistory.push({ role: "user", content: userMessage });
        appendMessage("user", userMessage);
      }

      setBusy(true);

      try {
        const body = mode === "post"
          ? { mode: "post", lang: activeLang, item, messages: conversationHistory }
          : {
              mode: "intake",
              lang: activeLang,
              entities: {
                affiliates: state.affiliates.map((a) => ({ id: a.id, name: a.name })),
                collaborators: state.collaborators.map((c) => ({ id: c.id, name: c.name }))
              },
              messages: conversationHistory
            };

        const res = await fetch("/api/ai-assistant", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        setBusy(false);

        if (!data.ok) throw new Error(data.error || "Erreur");

        const replyText = mode === "post" ? data.post : data.message;
        if (replyText) {
          conversationHistory.push({ role: "assistant", content: replyText });
          appendMessage("assistant", replyText);
        }

        if (mode === "intake" && data.extracted) {
          appendExtractedBlock(data.extracted);
        }

        if (mode === "intake" && data.deleteRequest) {
          appendDeleteBlock(data.deleteRequest);
        }
      } catch (err) {
        setBusy(false);
        appendMessage("assistant", "Erreur : " + err.message);
      }
    }

    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    langBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        langBtns.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeLang = btn.dataset.lang;
        conversationHistory = [];
        thread.innerHTML = "";
        sendMessage(null, true);
      });
    });

    sendBtn.addEventListener("click", () => {
      const msg = input.value.trim();
      input.value = "";
      sendMessage(msg);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
    });

    document.body.appendChild(overlay);

    // Auto-trigger on open
    if (mode === "post") {
      sendMessage(null, true); // auto-generate
    } else {
      sendMessage(null, true); // AI greeting
    }
  }

function bindCardActions() {
  refs.cardsGrid.addEventListener("click", async (event) => {
    if (!state.isUnlocked) {
      const copyInlineBtn = event.target.closest("[data-action='copy-inline-value']");
      if (copyInlineBtn) {
        copyText(copyInlineBtn.dataset.copyValue || "").then(() => {
          const orig = copyInlineBtn.textContent;
          copyInlineBtn.textContent = "Copied";
          setTimeout(() => { copyInlineBtn.textContent = orig; }, 1500);
        });
        return;
      }

      const privateUnlockedCard = event.target.closest(".affiliate-card.collaborator-card:not(.public-card)");
      if (privateUnlockedCard) {
        const actionButton = event.target.closest("button[data-action]");
        if (!actionButton) return;
        if (actionButton.dataset.action === "copy-primary-url") {
          await copyText(privateUnlockedCard.dataset.primaryUrl || "");
          setFeedback(privateUnlockedCard, "Primary URL copied");
        } else if (actionButton.dataset.action === "copy-contact") {
          await copyText(privateUnlockedCard.dataset.contact || "");
          setFeedback(privateUnlockedCard, "Contact copied");
        } else if (actionButton.dataset.action === "copy-collaboration-kit") {
          await copyText(getAffiliationKitText(privateUnlockedCard));
          setFeedback(privateUnlockedCard, "Kit copied");
        } else if (actionButton.dataset.action === "copy-all") {
          await copyText(getCopyAllText(privateUnlockedCard));
          setFeedback(privateUnlockedCard, "Card copied");
        } else if (actionButton.dataset.action === "ai-assistant") {
          try {
            const collabId = privateUnlockedCard.dataset.collabId || privateUnlockedCard.dataset.id || "";
            if (!collabId) return;
            const res = await fetch("/api/collaborators/private?id=" + encodeURIComponent(collabId), { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            const collaborator = data?.collaborator || null;
            if (!res.ok || !collaborator) {
              setFeedback(privateUnlockedCard, "AI unavailable", true);
              return;
            }
            showAIAssistantOverlay(collaborator, "post");
          } catch (_) {
            setFeedback(privateUnlockedCard, "AI unavailable", true);
          }
        }
        return;
      }

      const shareBtn = event.target.closest("[data-action='share-collab']");
      if (shareBtn) {
        shareCollaborator(shareBtn.dataset.id, shareBtn.dataset.name);
        return;
      }

      const card = event.target.closest(".collaborator-card.public-card");
      if (card && !event.target.closest(".collab-panel__link") && !event.target.closest(".collab-panel__share-btn")) {
        if (event.target.closest(".collab-auth-overlay")) return;
        const collabId = card.dataset.collabId || card.dataset.id;
        showAuthOverlay(card, collabId);
      }
      return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest(".affiliate-card");
    if (!card) return;

    const action = button.dataset.action;
    const isCollab = card.dataset.category !== "affiliate";

    try {
      if (isCollab) {
        if (action === "copy-primary-url") {
          await copyText(card.dataset.primaryUrl || "");
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

        if (action === "ai-assistant") {
          const collaborator = findCollaboratorById(card.dataset.id || "");
          if (collaborator) showAIAssistantOverlay(collaborator, "post");
          return;
        }

        await copyText(getCopyAllText(card));
        setFeedback(card, "Bloc complet copie");
        return;
      }

      if (action === "copy-primary-url") {
        await copyText(card.dataset.primaryUrl || "");
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

      if (action === "ai-assistant") {
        const affiliate = findAffiliateById(card.dataset.id || "");
        if (affiliate) showAIAssistantOverlay(affiliate, "post");
        return;
      }

      await copyText(getCopyAllText(card));
      setFeedback(card, "Bloc complet copie");
    } catch (error) {
      setFeedback(card, "Action impossible", true);
    }
  });


  refs.cardsGrid.addEventListener("keydown", (event) => {
    if (state.isUnlocked) return;
    const card = event.target.closest(".public-card");
    if (!card) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const isOpen = card.classList.contains("is-panel-open");
      refs.cardsGrid.querySelectorAll(".public-card.is-panel-open").forEach((c) => c.classList.remove("is-panel-open"));
      if (!isOpen) card.classList.add("is-panel-open");
    } else if (event.key === "Escape") {
      card.classList.remove("is-panel-open");
    }
  });

  document.addEventListener("click", (event) => {
    if (state.isUnlocked) return;
    if (event.target.closest(".public-card")) return;
    refs.cardsGrid.querySelectorAll(".public-card.is-panel-open").forEach((c) => c.classList.remove("is-panel-open"));
  });
}

function bindEntityToggle() {
  // Legacy entity buttons (backward compat — kept if elements exist in DOM)
  refs.entityButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextEntity = btn.dataset.entity;
      if (!nextEntity || nextEntity === state.activeEntity) return;
      state.activeEntity = nextEntity;
      applyEntityMode();
      rerenderAll();
    });
  });

  if (refs.tagAllBtn) {
    refs.tagAllBtn.addEventListener("click", () => {
      state.activeTags = [];
      applyTagFilter();
    });
  }
}

function bindCategoryFormSelect() {
  const fCategory = document.getElementById("fCategory");
  if (!fCategory) return;
  fCategory.addEventListener("change", () => {
    applyCategoryToForm(fCategory.value);
  });
}

function bindComposerActions() {
  if (refs.aiAssistantBtn) {
    refs.aiAssistantBtn.addEventListener("click", () => showAIAssistantOverlay(null, "intake"));
  }

  const fSourceNotes = document.getElementById("fSourceNotes");
  if (fSourceNotes) {
    fSourceNotes.addEventListener("blur", () => {
      const fCategory = document.getElementById("fCategory");
      const isCollabForm = fCategory ? fCategory.value === "collaborator" : false;
      if (!isCollabForm) return;
      const source = fSourceNotes.value.trim();
      if (!source) return;
      const extracted = extractCollaboratorInsights(source);

      const fPrimaryUrl = document.getElementById("fPrimaryUrl");
      const fPrivateLinks = document.getElementById("fPrivateLinks");
      const fContact = document.getElementById("fContact");
      const fBookingDate = document.getElementById("fBookingDate");
      const fBookingTime = document.getElementById("fBookingTime");
      const fBookingLocation = document.getElementById("fBookingLocation");

      if (fPrimaryUrl && !fPrimaryUrl.value && extracted.publicLink) fPrimaryUrl.value = extracted.publicLink;
      if (fPrivateLinks && !fPrivateLinks.value && extracted.privateLinks.length) fPrivateLinks.value = extracted.privateLinks.map((e) => e.url).join("\n");
      if (fContact && !fContact.value && extracted.contact) fContact.value = extracted.contact;
      if (fBookingDate && !fBookingDate.value && extracted.booking.dateLabel) fBookingDate.value = extracted.booking.dateLabel;
      if (fBookingTime && !fBookingTime.value && extracted.booking.timeLabel) fBookingTime.value = extracted.booking.timeLabel;
      if (fBookingLocation && !fBookingLocation.value && extracted.booking.location) fBookingLocation.value = extracted.booking.location;
      if (state.quickAddMode) {
        const fName = document.getElementById("fName");
        if (fName && !fName.value && extracted.publicLink) {
          const suggested = extractNameFromUrl(extracted.publicLink);
          if (suggested) fName.value = suggested;
        }
      }
    });
  }

  if (refs.quickAddToggle) {
    refs.quickAddToggle.addEventListener("click", () => {
      state.quickAddMode = !state.quickAddMode;
      refs.affiliateForm.classList.toggle("is-quick-add", state.quickAddMode);
      refs.quickAddToggle.classList.toggle("is-active", state.quickAddMode);
      refs.quickAddToggle.textContent = state.quickAddMode ? "✕ Mode standard" : "⚡ Mode rapide";
    });
  }

  refs.affiliateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.isUnlocked) return;

    try {
      const formData = new FormData(refs.affiliateForm);
      const categoryValue = toText(formData.get("category"));
      const savingAsCollab = state.editingCollaboratorId
        ? true
        : (state.editingAffiliateId ? false : (categoryValue === "collaborator" || categoryValue === "event"));

      if (savingAsCollab) {
        const collaborator = buildCollaboratorFromForm(formData);
        const remoteCollab = isRemotePersistenceEnabledFor("collaborators");

        if (state.editingCollaboratorId) {
          collaborator.id = state.editingCollaboratorId;
          const existing = state.collaborators.find((c) => c.id === state.editingCollaboratorId);
          if (existing?.visibility) collaborator.visibility = { ...collaborator.visibility, ...existing.visibility };
          if (remoteCollab) {
            await remoteUpsertCollaborator(collaborator);
            await loadCollaborators();
          } else {
            upsertLocalCollaborator(collaborator);
            saveLocalCollaborators();
          }
          rerenderAll();
          refs.affiliateForm.reset();
          setComposerEditMode(null);
          setFormFeedback(remoteCollab ? "Collaborateur modifie. Sauve en base." : "Collaborateur modifie. Sauve localement.");
          refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const candidate = mergeUniqueCollaborators(state.collaborators, [collaborator]);
        if (candidate.addedCount === 0) {
          setFormFeedback("Doublon detecte (id ou name+platform).", true);
          return;
        }

        if (remoteCollab) {
          // Strip id so the server deduplicates by publicLink (avoids duplicates on multi-submit)
          await remoteUpsertCollaborator({ ...collaborator, id: "" });
          await loadCollaborators();
        } else {
          state.localCollaborators.push(collaborator);
          saveLocalCollaborators();
        }
        rerenderAll();
        refs.affiliateForm.reset();
        setFormFeedback(remoteCollab ? "Collaborateur ajoute. Sauve en base." : "Collaborateur ajoute. Sauve localement.");
        refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const affiliate = buildAffiliateFromForm(formData);
      const remoteAffiliate = isRemotePersistenceEnabledFor("affiliates");

      if (state.editingAffiliateId) {
        affiliate.id = state.editingAffiliateId;
        const existing = state.affiliates.find((a) => a.id === state.editingAffiliateId);
        if (existing?.visibility) affiliate.visibility = { ...affiliate.visibility, ...existing.visibility };
        if (remoteAffiliate) {
          await remoteUpsertAffiliate(affiliate);
          await loadAffiliates();
        } else {
          upsertLocalAffiliate(affiliate);
          saveLocalAffiliates();
        }
        rerenderAll();
        refs.affiliateForm.reset();
        setComposerEditMode(null);
        setFormFeedback(remoteAffiliate ? "Affiliation modifiee. Sauvee en base." : "Affiliation modifiee. Sauvee localement.");
        refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const candidate = mergeUniqueAffiliates(state.affiliates, [affiliate]);
      if (candidate.addedCount === 0) {
        setFormFeedback("Doublon detecte (id ou name+platform).", true);
        return;
      }

      if (remoteAffiliate) {
        await remoteUpsertAffiliate(affiliate);
        await loadAffiliates();
      } else {
        state.localAffiliates.push(affiliate);
        saveLocalAffiliates();
      }
      rerenderAll();
      refs.affiliateForm.reset();
      setFormFeedback(remoteAffiliate ? "Affiliation ajoutee. Sauvee en base." : "Affiliation ajoutee. Sauvee localement.");
      refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setFormFeedback(error.message || "Impossible d'ajouter cette affiliation.", true);
    } finally {
      state.pendingVisibility = null;
      state.pendingTaggedUrls = null;
    }
  });

  refs.cancelEditBtn.addEventListener("click", () => {
    refs.affiliateForm.reset();
    state.editingAffiliateId = null;
    state.editingCollaboratorId = null;
    state.pendingVisibility = null;
    state.pendingTaggedUrls = null;
    setComposerEditMode(null);
    setFormFeedback("Edition annulee.");
  });
}

async function init() {
  try {
    applyDynamicTheme();
    applyAccessMode();
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
    await syncPendingLocalData();
    applyAccessMode();
    applyEntityMode();
    mergeAffiliates();
    mergeCollaborators();
    mergeAllItems();
    refreshTagChips();
    applyCategoryToForm("affiliate");
    renderCards();
    applyLanguage();
    applyViewMode();
    applyFilters();
    bindEntityToggle();
    bindCategoryFormSelect();
    bindFilters();
    bindLanguageToggle();
    bindViewToggle();
    bindAccessControls();
    bindCardActions();
    bindComposerActions();
    updateDebugInfo();
    handleUnlockedParam();
    handleShareParam();
  } catch (error) {
    state.debug.initError = String(error?.message || error || "unknown init error");
    refs.resultsInfo.textContent = "Erreur: mode API-only. Lance le serveur dev (ex: npx vercel dev).";
    refs.emptyState.classList.add("is-hidden");
    updateDebugInfo();
  }
}

init();
