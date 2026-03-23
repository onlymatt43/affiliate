const ACCESS_PASSWORD = "onlymatt-affiliate";

const state = {
  activeLang: "fr",
  viewMode: "full",
  isUnlocked: false,
  affiliates: [],
  baseAffiliates: [],
  localAffiliates: []
};

const refs = {
  cardsGrid: document.getElementById("cardsGrid"),
  searchInput: document.getElementById("searchInput"),
  platformFilter: document.getElementById("platformFilter"),
  nicheFilter: document.getElementById("nicheFilter"),
  formatFilter: document.getElementById("formatFilter"),
  toneFilter: document.getElementById("toneFilter"),
  resultsInfo: document.getElementById("resultsInfo"),
  emptyState: document.getElementById("emptyState"),
  langButtons: Array.from(document.querySelectorAll(".lang-btn")),
  viewButtons: Array.from(document.querySelectorAll(".view-btn")),
  copyAllTemplate: document.getElementById("copyAllTemplate"),
  affiliateForm: document.getElementById("affiliateForm"),
  formFeedback: document.getElementById("formFeedback"),
  exportLocalBtn: document.getElementById("exportLocalBtn"),
  exportFullBtn: document.getElementById("exportFullBtn"),
  downloadFullBtn: document.getElementById("downloadFullBtn"),
  clearLocalBtn: document.getElementById("clearLocalBtn"),
  jsonImportInput: document.getElementById("jsonImportInput"),
  importMergeBtn: document.getElementById("importMergeBtn"),
  importReplaceBtn: document.getElementById("importReplaceBtn"),
  unlockInput: document.getElementById("unlockInput"),
  unlockBtn: document.getElementById("unlockBtn"),
  lockBtn: document.getElementById("lockBtn"),
  accessStatus: document.getElementById("accessStatus")
};

const LOCAL_STORAGE_KEY = "affiliateHubLocalAffiliates";
const VIEW_MODE_STORAGE_KEY = "affiliateHubViewMode";
const ACCESS_STORAGE_KEY = "affiliateHubAccess";

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

function publicCardMarkup(item, platformLabel, nicheLabel) {
  return `
    <article class="affiliate-card public-card" data-id="${escapeHtml(item.id)}" data-promo-url="${escapeHtml(item.promoUrl)}" data-promo-code="${escapeHtml(item.promoCode)}">
      <div class="card-head">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <p class="meta">${escapeHtml(platformLabel)} · ${escapeHtml(nicheLabel)}</p>
        </div>
      </div>

      <section class="content-block affiliation-kit">
        <h3>Meta lien affiliate</h3>
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
      data-social-url="${escapeHtml(item.socialUrl)}">
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

  if (!state.isUnlocked) {
    return publicCardMarkup(item, platformLabel, nicheLabel);
  }

  return privateCardMarkup(item, platformLabel, nicheLabel);
}

function renderCards() {
  refs.cardsGrid.innerHTML = state.affiliates.map(cardMarkup).join("");
}

function mergeAffiliates() {
  state.affiliates = [...state.baseAffiliates, ...state.localAffiliates];
}

function affiliateDedupKey(item) {
  const idKey = String(item.id || "").trim().toLowerCase();
  if (idKey) return `id:${idKey}`;
  const name = String(item.name || "").trim().toLowerCase();
  const platform = String(item.platform || "").trim().toLowerCase();
  return `np:${name}|${platform}`;
}

function mergeUniqueAffiliates(existing, incoming) {
  const seen = new Set(existing.map(affiliateDedupKey));
  const merged = [...existing];
  let addedCount = 0;
  let skippedCount = 0;

  incoming.forEach((item) => {
    const key = affiliateDedupKey(item);
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

function getFullDataset() {
  return [...state.baseAffiliates, ...state.localAffiliates];
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

function saveViewMode() {
  localStorage.setItem(VIEW_MODE_STORAGE_KEY, state.viewMode);
}

function saveAccessState() {
  sessionStorage.setItem(ACCESS_STORAGE_KEY, state.isUnlocked ? "unlocked" : "locked");
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

function loadViewMode() {
  const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  state.viewMode = stored === "compact" ? "compact" : "full";
}

function loadAccessState() {
  const stored = sessionStorage.getItem(ACCESS_STORAGE_KEY);
  state.isUnlocked = stored === "unlocked";
}

async function loadAffiliates() {
  const response = await fetch("./data/affiliates.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load affiliates data");
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Affiliates payload must be an array");
  }

  state.baseAffiliates = payload.map((item, index) => normalizeAffiliateShape(item, index));
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

function rerenderAll() {
  mergeAffiliates();
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
  const name = card.querySelector("h2")?.textContent.trim() || "Affiliate";
  const meta = card.querySelector(".meta")?.textContent.trim() || "";
  const [platform = "", niche = ""] = meta.split("·").map((value) => value.trim());

  const promoUrl = card.dataset.promoUrl || "";
  const promoCode = card.dataset.promoCode || "";
  const mentions = card.dataset.mentions || "";
  const postRequirements = card.dataset.postRequirements || "";
  const specificities = card.dataset.specificities || "";
  const socialUrl = card.dataset.socialUrl || "";

  return { name, platform, niche, promoUrl, promoCode, mentions, postRequirements, specificities, socialUrl };
}

function getAffiliationKitText(card) {
  const meta = getCardMeta(card);
  return [
    `Promo URL: ${meta.promoUrl}`,
    `Code fan: ${meta.promoCode}`,
    `Mentions: ${meta.mentions}`,
    `Demandes post: ${meta.postRequirements}`,
    `Specificites: ${meta.specificities || "-"}`
  ].join("\n");
}

function getCopyAllText(card) {
  const { name, platform, niche, promoUrl, promoCode, mentions, postRequirements, specificities, socialUrl } = getCardMeta(card);
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

  if (!state.isUnlocked) {
    return;
  }

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
  refs.accessStatus.textContent = state.isUnlocked ? "Mode admin deverrouille" : "Mode public";
}

function cardMatches(card, searchTerm, platform, niche, format, tone) {
  if (state.isUnlocked) {
    if (platform !== "all" && card.dataset.platform !== platform) return false;
    if (niche !== "all" && card.dataset.niche !== niche) return false;
    if (format !== "all" && card.dataset.format !== format) return false;
    if (tone !== "all" && card.dataset.tone !== tone) return false;
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
  let visibleCount = 0;

  getAllCards().forEach((card) => {
    const isVisible = cardMatches(card, searchTerm, platform, niche, format, tone);
    card.style.display = isVisible ? "grid" : "none";
    if (isVisible) visibleCount += 1;
  });

  refs.emptyState.classList.toggle("is-hidden", visibleCount !== 0);
  refs.resultsInfo.textContent = `${visibleCount} affiliation${visibleCount > 1 ? "s" : ""} affichee${visibleCount > 1 ? "s" : ""}`;
}

function duplicateCard(card) {
  const clone = card.cloneNode(true);
  const nameNode = clone.querySelector("h2");
  if (nameNode) {
    nameNode.textContent = `${nameNode.textContent} Copy`;
  }

  const sourceId = card.dataset.id || "affiliate";
  const copyCount = getAllCards().filter((item) => (item.dataset.id || "").startsWith(`${sourceId}-copy`)).length;
  clone.dataset.id = `${sourceId}-copy-${copyCount + 1}`;

  refs.cardsGrid.append(clone);
  applyLanguage();
  applyFilters();
  clone.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindFilters() {
  [refs.searchInput, refs.platformFilter, refs.nicheFilter, refs.formatFilter, refs.toneFilter].forEach((control) => {
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

function bindAccessControls() {
  refs.unlockBtn.addEventListener("click", () => {
    if (refs.unlockInput.value === ACCESS_PASSWORD) {
      state.isUnlocked = true;
      refs.unlockInput.value = "";
      saveAccessState();
      applyAccessMode();
      rerenderAll();
      setFormFeedback("Mode admin active.");
      return;
    }

    refs.accessStatus.textContent = "Mot de passe incorrect";
  });

  refs.unlockInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      refs.unlockBtn.click();
    }
  });

  refs.lockBtn.addEventListener("click", () => {
    state.isUnlocked = false;
    saveAccessState();
    applyAccessMode();
    rerenderAll();
  });
}

function bindCardActions() {
  refs.cardsGrid.addEventListener("click", async (event) => {
    if (!state.isUnlocked) {
      return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest(".affiliate-card");
    if (!card) return;

    const action = button.dataset.action;

    try {
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
}

function bindComposerActions() {
  refs.affiliateForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!state.isUnlocked) {
      return;
    }

    try {
      const formData = new FormData(refs.affiliateForm);
      const affiliate = buildAffiliateFromForm(formData);

      const candidate = mergeUniqueAffiliates(state.affiliates, [affiliate]);
      if (candidate.addedCount === 0) {
        setFormFeedback("Doublon detecte (id ou name+platform).", true);
        return;
      }

      state.localAffiliates.push(affiliate);
      saveLocalAffiliates();
      rerenderAll();
      refs.affiliateForm.reset();
      setFormFeedback("Affiliation ajoutee. Sauvee localement.");
      refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setFormFeedback(error.message || "Impossible d'ajouter cette affiliation.", true);
    }
  });

  refs.exportLocalBtn.addEventListener("click", () => {
    if (!state.isUnlocked) return;
    const payload = JSON.stringify(state.localAffiliates, null, 2);
    copyText(payload)
      .then(() => setFormFeedback("JSON des ajouts locaux copie dans le presse-papiers."))
      .catch(() => setFormFeedback("Export impossible.", true));
  });

  refs.exportFullBtn.addEventListener("click", () => {
    if (!state.isUnlocked) return;
    const payload = JSON.stringify(getFullDataset(), null, 2);
    copyText(payload)
      .then(() => setFormFeedback("JSON complet (base + local) copie."))
      .catch(() => setFormFeedback("Export complet impossible.", true));
  });

  refs.downloadFullBtn.addEventListener("click", () => {
    if (!state.isUnlocked) return;
    try {
      const filename = `affiliations-export-${new Date().toISOString().slice(0, 10)}.json`;
      downloadJsonFile(filename, getFullDataset());
      setFormFeedback("Fichier JSON telecharge.");
    } catch (error) {
      setFormFeedback("Telechargement impossible.", true);
    }
  });

  refs.clearLocalBtn.addEventListener("click", () => {
    if (!state.isUnlocked) return;
    if (!state.localAffiliates.length) {
      setFormFeedback("Aucun ajout local a supprimer.");
      return;
    }

    const confirmed = window.confirm("Supprimer toutes les affiliations ajoutees localement?");
    if (!confirmed) {
      return;
    }

    state.localAffiliates = [];
    saveLocalAffiliates();
    rerenderAll();
    setFormFeedback("Ajouts locaux supprimes.");
  });

  refs.importMergeBtn.addEventListener("click", () => {
    if (!state.isUnlocked) return;
    try {
      const imported = parseImportedAffiliates(refs.jsonImportInput.value.trim());
      const deduped = mergeUniqueAffiliates(state.affiliates, imported);
      const additions = deduped.merged.slice(state.affiliates.length);
      state.localAffiliates = [...state.localAffiliates, ...additions];
      saveLocalAffiliates();
      rerenderAll();
      setFormFeedback(`${deduped.addedCount} ajoutee(s), ${deduped.skippedCount} doublon(s) ignores.`);
      refs.jsonImportInput.value = "";
    } catch (error) {
      setFormFeedback(error.message || "Import fusion impossible.", true);
    }
  });

  refs.importReplaceBtn.addEventListener("click", () => {
    if (!state.isUnlocked) return;
    try {
      const imported = parseImportedAffiliates(refs.jsonImportInput.value.trim());
      const deduped = mergeUniqueAffiliates(state.baseAffiliates, imported);
      const keptLocal = deduped.merged.slice(state.baseAffiliates.length);
      state.localAffiliates = keptLocal;
      saveLocalAffiliates();
      rerenderAll();
      setFormFeedback(`${keptLocal.length} local(s) gardes, ${deduped.skippedCount} doublon(s) ignores.`);
      refs.jsonImportInput.value = "";
    } catch (error) {
      setFormFeedback(error.message || "Import remplacement impossible.", true);
    }
  });
}

async function init() {
  try {
    await loadAffiliates();
    loadLocalAffiliates();
    loadViewMode();
    loadAccessState();
    applyAccessMode();
    mergeAffiliates();
    renderCards();
    applyLanguage();
    applyViewMode();
    applyFilters();
    bindFilters();
    bindLanguageToggle();
    bindViewToggle();
    bindAccessControls();
    bindCardActions();
    bindComposerActions();
  } catch (error) {
    refs.resultsInfo.textContent = "Erreur: impossible de charger les affiliations";
    refs.emptyState.classList.add("is-hidden");
  }
}

init();
