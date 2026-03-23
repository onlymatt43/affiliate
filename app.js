const state = {
  activeLang: "fr"
};

const refs = {
  cards: Array.from(document.querySelectorAll(".affiliate-card")),
  searchInput: document.getElementById("searchInput"),
  platformFilter: document.getElementById("platformFilter"),
  nicheFilter: document.getElementById("nicheFilter"),
  resultsInfo: document.getElementById("resultsInfo"),
  langButtons: Array.from(document.querySelectorAll(".lang-btn")),
  copyAllTemplate: document.getElementById("copyAllTemplate")
};

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

  refs.cards.forEach((card) => {
    const panels = card.querySelectorAll(".lang-panel");
    panels.forEach((panel) => {
      const isActive = panel.dataset.lang === state.activeLang;
      panel.classList.toggle("is-hidden", !isActive);
    });
  });
}

function cardMatches(card, searchTerm, platform, niche) {
  if (platform !== "all" && card.dataset.platform !== platform) return false;
  if (niche !== "all" && card.dataset.niche !== niche) return false;

  if (!searchTerm) return true;

  const searchableText = card.textContent.toLowerCase();
  return searchableText.includes(searchTerm);
}

function applyFilters() {
  const searchTerm = refs.searchInput.value.trim().toLowerCase();
  const platform = refs.platformFilter.value;
  const niche = refs.nicheFilter.value;
  let visibleCount = 0;

  refs.cards.forEach((card) => {
    const isVisible = cardMatches(card, searchTerm, platform, niche);
    card.style.display = isVisible ? "grid" : "none";
    if (isVisible) visibleCount += 1;
  });

  refs.resultsInfo.textContent = `${visibleCount} affiliate${visibleCount > 1 ? "s" : ""} affiches`;
}

function bindFilters() {
  [refs.searchInput, refs.platformFilter, refs.nicheFilter].forEach((control) => {
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

function bindCopyActions() {
  refs.cards.forEach((card) => {
    const actions = card.querySelectorAll("button[data-action]");
    actions.forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action;
        try {
          if (action === "copy-tags") {
            const tags = getCopyText(card, "tags");
            await copyText(tags);
            setFeedback(card, "Tags copies");
            return;
          }

          if (action === "copy-specs") {
            const specs = getCopyText(card, "specs");
            await copyText(specs);
            setFeedback(card, "Specs copiees");
            return;
          }

          const full = getCopyAllText(card);
          await copyText(full);
          setFeedback(card, "Bloc complet copie");
        } catch (error) {
          setFeedback(card, "Copie impossible", true);
        }
      });
    });
  });
}

function init() {
  applyLanguage();
  applyFilters();
  bindFilters();
  bindLanguageToggle();
  bindCopyActions();
}

init();
