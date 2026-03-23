const state = {
  activeLang: "fr",
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
  copyAllTemplate: document.getElementById("copyAllTemplate"),
  affiliateForm: document.getElementById("affiliateForm"),
  formFeedback: document.getElementById("formFeedback"),
  exportLocalBtn: document.getElementById("exportLocalBtn"),
  clearLocalBtn: document.getElementById("clearLocalBtn"),
  jsonImportInput: document.getElementById("jsonImportInput"),
  importMergeBtn: document.getElementById("importMergeBtn"),
  importReplaceBtn: document.getElementById("importReplaceBtn")
};

const LOCAL_STORAGE_KEY = "affiliateHubLocalAffiliates";

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

function cardMarkup(item) {
  const platformLabel = PLATFORM_LABELS[item.platform] || item.platform;
  const nicheLabel = NICHE_LABELS[item.niche] || item.niche;

  return `
    <article
      class="affiliate-card"
      data-id="${escapeHtml(item.id)}"
      data-platform="${escapeHtml(item.platform)}"
      data-niche="${escapeHtml(item.niche)}"
      data-format="${escapeHtml(item.format || "")}" 
      data-tone="${escapeHtml(item.tone || "")}">
      <div class="card-head">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <p class="meta">${escapeHtml(platformLabel)} · ${escapeHtml(nicheLabel)}</p>
        </div>
        <a href="${escapeHtml(item.contactUrl)}" target="_blank" rel="noopener noreferrer" class="contact-link">Profil</a>
      </div>

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
        <button type="button" data-action="copy-tags">Copier tags</button>
        <button type="button" data-action="copy-specs">Copier specs</button>
        <button type="button" data-action="duplicate">Dupliquer bloc</button>
        <button type="button" data-action="copy-all" class="accent">Copier tout</button>
        <span class="copy-feedback" aria-live="polite"></span>
      </div>
    </article>
  `;
}

function renderCards() {
  refs.cardsGrid.innerHTML = state.affiliates.map(cardMarkup).join("");
}

function mergeAffiliates() {
  state.affiliates = [...state.baseAffiliates, ...state.localAffiliates];
}

function saveLocalAffiliates() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.localAffiliates));
}

function loadLocalAffiliates() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      state.localAffiliates = [];
      return;
    }

    const parsed = JSON.parse(raw);
    state.localAffiliates = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    state.localAffiliates = [];
  }
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
  state.baseAffiliates = payload;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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
  const name = formData.get("name")?.toString().trim() || "";
  const contactUrl = formData.get("contactUrl")?.toString().trim() || "";
  const platform = formData.get("platform")?.toString().trim() || "";
  const niche = formData.get("niche")?.toString().trim() || "";
  const format = formData.get("format")?.toString().trim() || "";
  const tone = formData.get("tone")?.toString().trim() || "";
  const frTags = formData.get("frTags")?.toString().trim() || "";
  const enTags = formData.get("enTags")?.toString().trim() || "";
  const frSpecs = formData.get("frSpecs")?.toString().trim() || "";
  const enSpecs = formData.get("enSpecs")?.toString().trim() || "";
  const frCaption = formData.get("frCaption")?.toString().trim() || "";
  const enCaption = formData.get("enCaption")?.toString().trim() || "";

  if (!name || !contactUrl || !platform || !niche || !format || !tone) {
    throw new Error("Merci de remplir les champs principaux.");
  }

  try {
    const parsed = new URL(contactUrl);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("URL invalide");
    }
  } catch (error) {
    throw new Error("URL profil invalide.");
  }

  if (!frTags || !enTags || !frSpecs || !enSpecs || !frCaption || !enCaption) {
    throw new Error("Merci de remplir les champs FR/EN.");
  }

  return {
    id: `${slugify(name) || "affiliate"}-${Date.now()}`,
    name,
    platform,
    niche,
    format,
    tone,
    contactUrl,
    fr: {
      tags: frTags,
      specs: frSpecs,
      caption: frCaption
    },
    en: {
      tags: enTags,
      specs: enSpecs,
      caption: enCaption
    }
  };
}

function normalizeAffiliateShape(raw, index) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Element ${index + 1}: format invalide`);
  }

  const name = String(raw.name || "").trim();
  const platform = String(raw.platform || "").trim();
  const niche = String(raw.niche || "").trim();
  const format = String(raw.format || "").trim();
  const tone = String(raw.tone || "").trim();
  const contactUrl = String(raw.contactUrl || "").trim();
  const fr = raw.fr || {};
  const en = raw.en || {};

  if (!name || !platform || !niche || !format || !tone || !contactUrl) {
    throw new Error(`Element ${index + 1}: champs principaux manquants`);
  }

  try {
    const parsed = new URL(contactUrl);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("URL invalide");
    }
  } catch (error) {
    throw new Error(`Element ${index + 1}: contactUrl invalide`);
  }

  const frTags = String(fr.tags || "").trim();
  const frSpecs = String(fr.specs || "").trim();
  const frCaption = String(fr.caption || "").trim();
  const enTags = String(en.tags || "").trim();
  const enSpecs = String(en.specs || "").trim();
  const enCaption = String(en.caption || "").trim();

  if (!frTags || !frSpecs || !frCaption || !enTags || !enSpecs || !enCaption) {
    throw new Error(`Element ${index + 1}: champs FR/EN manquants`);
  }

  return {
    id: raw.id ? String(raw.id).trim() : `${slugify(name) || "affiliate"}-${Date.now()}-${index}`,
    name,
    platform,
    niche,
    format,
    tone,
    contactUrl,
    fr: {
      tags: frTags,
      specs: frSpecs,
      caption: frCaption
    },
    en: {
      tags: enTags,
      specs: enSpecs,
      caption: enCaption
    }
  };
}

function parseImportedAffiliates(rawText) {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch (error) {
    throw new Error("JSON invalide.");
  }

  if (!Array.isArray(payload)) {
    throw new Error("Le JSON doit etre un tableau d'affiliates.");
  }

  return payload.map(normalizeAffiliateShape);
}

function rerenderAll() {
  mergeAffiliates();
  renderCards();
  applyLanguage();
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
  return { name, platform, niche };
}

function getCopyAllText(card) {
  const { name, platform, niche } = getCardMeta(card);
  const tags = getCopyText(card, "tags");
  const specs = getCopyText(card, "specs");
  const caption = getCopyText(card, "caption");

  const template = refs.copyAllTemplate.textContent;
  return template
    .replace("{{name}}", name)
    .replace("{{platform}}", platform)
    .replace("{{niche}}", niche)
    .replace("{{tags}}", tags)
    .replace("{{specs}}", specs)
    .replace("{{caption}}", caption)
    .trim();
}

function applyLanguage() {
  refs.langButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === state.activeLang);
  });

  getAllCards().forEach((card) => {
    const panels = card.querySelectorAll(".lang-panel");
    panels.forEach((panel) => {
      const isActive = panel.dataset.lang === state.activeLang;
      panel.classList.toggle("is-hidden", !isActive);
    });
  });
}

function cardMatches(card, searchTerm, platform, niche, format, tone) {
  if (platform !== "all" && card.dataset.platform !== platform) return false;
  if (niche !== "all" && card.dataset.niche !== niche) return false;
  if (format !== "all" && card.dataset.format !== format) return false;
  if (tone !== "all" && card.dataset.tone !== tone) return false;

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
  refs.resultsInfo.textContent = `${visibleCount} affiliate${visibleCount > 1 ? "s" : ""} affiches`;
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

function bindCardActions() {
  refs.cardsGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest(".affiliate-card");
    if (!card) return;

    const action = button.dataset.action;

    try {
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

    try {
      const formData = new FormData(refs.affiliateForm);
      const affiliate = buildAffiliateFromForm(formData);

      state.localAffiliates.push(affiliate);
      saveLocalAffiliates();
      rerenderAll();
      refs.affiliateForm.reset();
      setFormFeedback("Affiliate ajoute. Sauve localement.");
      refs.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setFormFeedback(error.message || "Impossible d'ajouter cet affiliate.", true);
    }
  });

  refs.exportLocalBtn.addEventListener("click", () => {
    const payload = JSON.stringify(state.localAffiliates, null, 2);
    copyText(payload)
      .then(() => setFormFeedback("JSON des ajouts copie dans le presse-papiers."))
      .catch(() => setFormFeedback("Export impossible.", true));
  });

  refs.clearLocalBtn.addEventListener("click", () => {
    if (!state.localAffiliates.length) {
      setFormFeedback("Aucun ajout local a supprimer.");
      return;
    }

    const confirmed = window.confirm("Supprimer tous les affiliates ajoutes localement?");
    if (!confirmed) {
      return;
    }

    state.localAffiliates = [];
    saveLocalAffiliates();
    rerenderAll();
    setFormFeedback("Ajouts locaux supprimes.");
  });

  refs.importMergeBtn.addEventListener("click", () => {
    try {
      const imported = parseImportedAffiliates(refs.jsonImportInput.value.trim());
      state.localAffiliates = [...state.localAffiliates, ...imported];
      saveLocalAffiliates();
      rerenderAll();
      setFormFeedback(`${imported.length} affiliate(s) importe(s) en fusion.`);
      refs.jsonImportInput.value = "";
    } catch (error) {
      setFormFeedback(error.message || "Import fusion impossible.", true);
    }
  });

  refs.importReplaceBtn.addEventListener("click", () => {
    try {
      const imported = parseImportedAffiliates(refs.jsonImportInput.value.trim());
      state.localAffiliates = imported;
      saveLocalAffiliates();
      rerenderAll();
      setFormFeedback(`${imported.length} affiliate(s) importe(s) en remplacement local.`);
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
    mergeAffiliates();
    renderCards();
    applyLanguage();
    applyFilters();
    bindFilters();
    bindLanguageToggle();
    bindCardActions();
    bindComposerActions();
  } catch (error) {
    refs.resultsInfo.textContent = "Erreur: impossible de charger les affiliates";
    refs.emptyState.classList.add("is-hidden");
  }
}

init();
