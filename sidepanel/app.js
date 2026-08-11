import { icon } from "./icons.js";
import * as db from "./db.js";
import { buildLandingPageHTML } from "./landing.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  view: "feed", // feed | compose | settings
  clips: [],
  settings: null,
  filter: "all", // all | text | video | audio | pinned
  sort: "newest", // newest | oldest | az
  tagFilter: null,
  search: "",
  searchOpen: false,
  filtersOpen: false,
  selectMode: false,
  activeCardId: null,
  selectedIds: new Set(),
  editingId: null, // clip id being edited, or null for a new clip
  draft: null, // working copy of the clip being composed
  detailId: null, // clip id currently open in the detail view
  openMenuId: null, // id ("detail" for the detail view) of the open kebab menu
  recorder: {
    active: false,
    mediaRecorder: null,
    chunks: [],
    startedAt: null,
    timerHandle: null,
    elapsedSeconds: 0,
  },
  toast: null,
};

const KIND_META = {
  text: { label: "Text", icon: "fileText", color: "var(--kind-text)" },
  video: { label: "Video", icon: "video", color: "var(--kind-video)" },
  audio: { label: "Audio", icon: "headphones", color: "var(--kind-audio)" },
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const root = document.getElementById("view-root");
const headerTools = document.getElementById("header-tools");
const searchRow = document.getElementById("search-row");
const chipRow = document.getElementById("chip-row");
const tabBar = document.getElementById("tab-bar");
const toastHost = document.getElementById("toast-host");

async function boot() {
  state.settings = await db.getSettings();
  applyTheme(state.settings.theme);
  applyAccent(state.settings.accentColor);
  applyDensity(state.settings.density);
  state.clips = await db.getAllClips();

  const pending = await db.getPendingCapture();
  if (pending) {
    openComposerFromCapture(pending);
    await db.clearPendingCapture();
  }

  render();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "RIFF_PENDING_CAPTURE_READY") {
    db.getPendingCapture().then((pending) => {
      if (!pending) return;
      openComposerFromCapture(pending);
      db.clearPendingCapture();
      render();
    });
  }
});

boot();

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

function applyTheme(pref) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const resolved = pref === "system" ? (mql.matches ? "dark" : "light") : pref;
  document.documentElement.setAttribute("data-theme", resolved);
}

const ACCENTS = {
  indigo: { light: "#2342f5", dark: "#5b7fff" },
  violet: { light: "#7c3aed", dark: "#a78bfa" },
  emerald: { light: "#0f9d63", dark: "#34d399" },
  amber: { light: "#c2760c", dark: "#f0a94e" },
  rose: { light: "#e11d5e", dark: "#fb7299" },
};

function applyAccent(key) {
  const accent = ACCENTS[key] || ACCENTS.indigo;
  const root = document.documentElement;
  root.style.setProperty("--signal", accent.light);
  root.style.setProperty("--kind-text", accent.light);
  root.dataset.accent = key;
  // Dark-theme override lives in an injected style tag so it only applies
  // under [data-theme="dark"], matching how the base tokens are structured.
  let tag = document.getElementById("accent-dark-override");
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "accent-dark-override";
    document.head.appendChild(tag);
  }
  tag.textContent = `html[data-theme="dark"]{ --signal:${accent.dark}; --kind-text:${accent.dark}; }`;
}

function applyDensity(value) {
  document.documentElement.setAttribute("data-density", value === "compact" ? "compact" : "comfortable");
}

// ---------------------------------------------------------------------------
// Render: shell chrome (tab bar, search, chips)
// ---------------------------------------------------------------------------

function render() {
  renderTabBar();
  renderHeaderTools();
  renderSearchRow();
  renderChipRow();
  renderView();
  renderToast();
}

function renderTabBar() {
  const tabs = [
    { id: "feed", label: "Feed", icon: "feed" },
    { id: "compose", label: "New", icon: "compose" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  tabBar.innerHTML = tabs
    .map(
      (t) => `
      <button class="tab-btn ${state.view === t.id ? "is-active" : ""}" data-tab="${t.id}">
        ${icon(t.icon, { size: 20 })}
        <span>${t.label}</span>
      </button>`
    )
    .join("");
}

function renderHeaderTools() {
  if (state.view === "feed" && state.detailId) {
    const clip = state.clips.find((c) => c.id === state.detailId);
    headerTools.innerHTML = `
      <button class="icon-btn" id="btn-detail-back" title="Back" aria-label="Back">${icon("arrowLeft", { size: 18 })}</button>
      <div class="menu-wrap">
        <button class="icon-btn" id="btn-detail-menu" title="More" aria-label="More actions">${icon("moreVertical", { size: 18 })}</button>
        ${state.openMenuId === "detail" && clip ? cardMenu(clip.id) : ""}
      </div>
    `;
    return;
  }

  if (state.view === "feed" && state.selectMode) {
    headerTools.innerHTML = `
      <span class="select-count">${state.selectedIds.size} selected</span>
      <button class="icon-btn" id="btn-exit-select" title="Cancel" aria-label="Cancel selection">${icon("x", { size: 18 })}</button>
    `;
    return;
  }

  if (state.view !== "feed") {
    headerTools.innerHTML = "";
    return;
  }

  const sortLabels = { newest: "Newest", oldest: "Oldest", az: "A\u2013Z" };
  headerTools.innerHTML = `
    <div class="menu-wrap">
      <button class="icon-btn ${state.openMenuId === "sort" ? "is-active" : ""}" id="btn-toggle-sort" title="Sort: ${sortLabels[state.sort]}" aria-label="Sort riffs">
        ${icon("sort", { size: 18 })}
      </button>
      ${state.openMenuId === "sort" ? sortMenu() : ""}
    </div>
    <button class="icon-btn ${state.selectMode ? "is-active" : ""}" id="btn-toggle-select" title="Select" aria-label="Select multiple riffs">
      ${icon("checkSquare", { size: 18 })}
    </button>
    <button class="icon-btn ${state.searchOpen ? "is-active" : ""}" id="btn-toggle-search" title="Search" aria-label="Search riffs">
      ${icon("search", { size: 18 })}
    </button>
    <button class="icon-btn ${state.filtersOpen ? "is-active" : ""}" id="btn-toggle-filters" title="Filter" aria-label="Filter riffs">
      ${icon("filter", { size: 18 })}
    </button>
  `;
}

function sortMenu() {
  const options = [
    { id: "newest", label: "Newest first" },
    { id: "oldest", label: "Oldest first" },
    { id: "az", label: "A\u2013Z" },
  ];
  return `
    <div class="dropdown-menu dropdown-menu-left">
      ${options
        .map(
          (o) => `
        <button class="dropdown-item" data-sort="${o.id}">
          ${icon("check", { size: 14, className: state.sort === o.id ? "" : "icon-invisible" })}
          <span>${o.label}</span>
        </button>`
        )
        .join("")}
    </div>
  `;
}

function renderSearchRow() {
  if (state.view !== "feed" || !state.searchOpen || state.detailId || state.selectMode) {
    searchRow.hidden = true;
    searchRow.innerHTML = "";
    return;
  }
  searchRow.hidden = false;
  searchRow.innerHTML = `
    <div class="search-field">
      ${icon("search", { size: 16, className: "search-field-icon" })}
      <input id="search-input" type="text" placeholder="Search your riffs" value="${escapeAttr(state.search)}" autocomplete="off" />
    </div>
  `;
  const input = document.getElementById("search-input");
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function renderChipRow() {
  if (state.view !== "feed" || state.detailId || state.selectMode || (!state.filtersOpen && !state.tagFilter)) {
    chipRow.hidden = true;
    chipRow.innerHTML = "";
    return;
  }
  chipRow.hidden = false;

  let html = "";
  if (state.tagFilter) {
    html += `<button class="chip chip-tag-active" data-clear-tag="1">${icon("hash", { size: 12 })}${escapeHtml(state.tagFilter)}${icon("x", { size: 12 })}</button>`;
  }
  if (state.filtersOpen) {
    const chips = [
      { id: "all", label: "All" },
      { id: "pinned", label: "Pinned" },
      { id: "text", label: "Text" },
      { id: "video", label: "Video" },
      { id: "audio", label: "Audio" },
    ];
    if (state.clips.some((c) => c.archived)) chips.push({ id: "archived", label: "Archived" });
    html += chips
      .map(
        (c) =>
          `<button class="chip ${state.filter === c.id ? "is-active" : ""}" data-filter="${c.id}">${c.label}</button>`
      )
      .join("");
  }
  chipRow.innerHTML = html;
}

function renderToast() {
  if (!state.toast) {
    toastHost.innerHTML = "";
    return;
  }
  const { msg, actionLabel } = state.toast;
  toastHost.innerHTML = `
    <div class="toast">
      ${icon("check", { size: 14 })}<span>${escapeHtml(msg)}</span>
      ${actionLabel ? `<button class="toast-action" id="toast-action-btn">${escapeHtml(actionLabel)}</button>` : ""}
    </div>
  `;
  if (actionLabel) {
    document.getElementById("toast-action-btn")?.addEventListener("click", () => {
      clearTimeout(showToast._t);
      const onAction = state.toast?.onAction;
      state.toast = null;
      renderToast();
      onAction?.();
    });
  }
}

function showToast(msg, opts = {}) {
  clearTimeout(showToast._t);
  state.toast = { msg, actionLabel: opts.actionLabel, onAction: opts.onAction };
  renderToast();
  showToast._t = setTimeout(() => {
    state.toast = null;
    renderToast();
  }, opts.duration || 2200);
}

// ---------------------------------------------------------------------------
// Render: views
// ---------------------------------------------------------------------------

function renderView() {
  let html;
  if (state.view === "feed" && state.detailId) {
    const clip = state.clips.find((c) => c.id === state.detailId);
    html = clip ? detailView(clip) : (state.detailId = null) || feedView();
  } else if (state.view === "feed") html = feedView();
  else if (state.view === "compose") html = composeView();
  else if (state.view === "settings") html = settingsView();

  root.innerHTML = `<div class="view-fade">${html}</div>`;
  root.scrollTop = 0;
  afterRenderHooks();
}

function afterRenderHooks() {
  // Swap broken remote favicons for a local fallback glyph without inline
  // event-handler attributes (disallowed by the extension CSP).
  root.querySelectorAll("img.js-favicon").forEach((img) => {
    img.addEventListener("error", () => {
      img.replaceWith(iconNode("globe", 14, "favicon-fallback"));
    });
  });
}

function iconNode(name, size, className) {
  const span = document.createElement("span");
  span.className = `favicon-fallback-wrap ${className || ""}`;
  span.innerHTML = icon(name, { size });
  return span;
}

// --- Feed --------------------------------------------------------------

function filteredClips() {
  let list = [...state.clips];

  if (state.filter === "archived") {
    list = list.filter((c) => c.archived);
  } else {
    list = list.filter((c) => !c.archived);
    if (state.filter === "pinned") list = list.filter((c) => c.pinned);
    else if (state.filter !== "all") list = list.filter((c) => c.kind === state.filter);
  }

  if (state.tagFilter) {
    list = list.filter((c) => (c.tags || []).includes(state.tagFilter));
  }

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter((c) => {
      const hay = [
        c.quote,
        c.mediaTitle,
        c.channel,
        c.source?.title,
        c.source?.siteName,
        c.comment?.text,
        (c.tags || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (state.sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (state.sort === "az") {
      const at = (a.mediaTitle || a.quote || a.source?.title || "").toLowerCase();
      const bt = (b.mediaTitle || b.quote || b.source?.title || "").toLowerCase();
      return at.localeCompare(bt);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return list;
}

function feedView() {
  const list = filteredClips();
  const welcome = state.settings && !state.settings.hasSeenWelcome ? welcomeBanner() : "";

  if (state.clips.length === 0) {
    return welcome + emptyState({
      icon: "scissors",
      title: "Your archive starts here",
      body: "Highlight a passage, right-click a video, or capture the tab you're on. Every riff keeps its source attached, permanently.",
      actionLabel: "Capture something",
      actionTab: "compose",
    });
  }

  if (list.length === 0) {
    return welcome + emptyState({
      icon: "search",
      title: "Nothing matches",
      body: "Try a different search term or clear your filters.",
    });
  }

  return `
    ${welcome}
    <div class="feed-list">
      ${list.map((c) => clipCard(c)).join("")}
    </div>
    ${state.selectMode ? bulkBar() : ""}
  `;
}

function bulkBar() {
  const n = state.selectedIds.size;
  return `
    <div class="bulk-bar">
      <button class="btn btn-outline btn-sm" id="btn-select-all">${icon("checkSquare", { size: 13 })}<span>${n === filteredClips().length && n > 0 ? "Clear all" : "Select all"}</span></button>
      <div class="bulk-bar-spacer"></div>
      <button class="btn btn-outline btn-sm" id="btn-bulk-tag" ${n === 0 ? "disabled" : ""}>${icon("hash", { size: 13 })}<span>Tag</span></button>
      <button class="btn btn-outline btn-sm" id="btn-bulk-archive" ${n === 0 ? "disabled" : ""}>${icon("archive", { size: 13 })}<span>Archive</span></button>
      <button class="btn btn-outline btn-sm" id="btn-bulk-copy" ${n === 0 ? "disabled" : ""}>${icon("copy", { size: 13 })}<span>Copy</span></button>
      <button class="btn btn-outline btn-sm btn-danger-outline" id="btn-bulk-delete" ${n === 0 ? "disabled" : ""}>${icon("trash", { size: 13 })}<span>Delete</span></button>
    </div>
  `;
}

function welcomeBanner() {
  return `
    <div class="welcome-banner">
      <div class="welcome-banner-mark">R</div>
      <div class="welcome-banner-text">
        <strong>Welcome to Riff</strong>
        <p>Highlight text or right-click a video anywhere on the web, then hit <kbd>Ctrl/Cmd+Shift+K</kbd> to riff it. Everything you save stays on this device.</p>
      </div>
      <button class="welcome-banner-dismiss" data-action="dismiss-welcome" aria-label="Dismiss welcome message">${icon("x", { size: 15 })}</button>
    </div>
  `;
}

function emptyState({ icon: iconName, title, body, actionLabel, actionTab }) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon(iconName, { size: 26, strokeWidth: 1.5 })}</div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      ${actionLabel ? `<button class="btn btn-primary" data-tab="${actionTab}">${escapeHtml(actionLabel)}</button>` : ""}
    </div>
  `;
}

function clipCard(c) {
  const meta = KIND_META[c.kind] || KIND_META.text;
  const timeLabel = timeAgo(c.createdAt);
  const favicon = c.source?.favicon;

  let bodyHtml = "";
  if (c.kind === "text") {
    bodyHtml = `<blockquote class="clip-quote">${escapeHtml(truncate(c.quote, 220))}</blockquote>`;
  } else {
    const range = formatRange(c.startSeconds, c.endSeconds);
    bodyHtml = `
      <div class="clip-media-row">
        <span class="clip-media-badge" style="--accent:${meta.color}">${icon(c.kind === "video" ? "video" : "headphones", { size: 13 })}${range}</span>
        <span class="clip-media-title">${escapeHtml(truncate(c.mediaTitle || c.source?.title || "Untitled", 80))}</span>
      </div>
      ${c.channel ? `<div class="clip-media-channel">${escapeHtml(c.channel)}</div>` : ""}
    `;
  }

  let commentHtml = "";
  if (c.comment?.kind === "voice" && c.comment.audioDataUrl) {
    commentHtml = `
      <div class="comment-row comment-voice" data-audio-src="${escapeAttr(c.comment.audioDataUrl)}">
        <button class="mini-play" data-action="play-audio" data-id="${c.id}" aria-label="Play voice note">${icon("play", { size: 13 })}</button>
        <div class="voice-wave" aria-hidden="true">${voiceBars()}</div>
        <span class="voice-duration">${formatDuration(c.comment.audioDurationSeconds || 0)}</span>
      </div>
    `;
  } else if (c.comment?.text) {
    commentHtml = `<p class="comment-text">${escapeHtml(truncate(c.comment.text, 200))}</p>`;
  }

  const tagsHtml = (c.tags || []).length
    ? `<div class="clip-tags">${c.tags
        .map(
          (t) =>
            `<button class="tag-chip ${state.tagFilter === t ? "tag-chip-active" : ""}" data-action="filter-tag" data-tag="${escapeAttr(t)}">${icon("hash", { size: 10 })}${escapeHtml(t)}</button>`
        )
        .join("")}</div>`
    : "";

  const selected = state.selectedIds.has(c.id);
  const bodyAction = state.selectMode ? "toggle-select" : "open-detail";

  return `
    <article class="clip-card ${state.selectMode ? "is-selectable" : ""} ${selected ? "is-selected" : ""} ${state.activeCardId === c.id ? "is-keyboard-active" : ""}" data-id="${c.id}">
      <div class="clip-card-inner">
        <header class="clip-card-header">
          <button class="clip-source" data-action="${bodyAction}" data-id="${c.id}">
            ${
              state.selectMode
                ? `<span class="select-check ${selected ? "is-checked" : ""}">${selected ? icon("check", { size: 11 }) : ""}</span>`
                : favicon
                  ? `<img class="js-favicon" src="${escapeAttr(favicon)}" alt="" width="14" height="14" />`
                  : iconNode("globe", 14).outerHTML
            }
            <span class="clip-site">${escapeHtml(c.source?.siteName || "Unknown source")}</span>
            <span class="kind-dot" style="background:${meta.color}" title="${meta.label}"></span>
            <span class="clip-time">${timeLabel}</span>
            ${c.archived ? `<span class="archived-badge">${icon("archive", { size: 10 })}Archived</span>` : ""}
          </button>
          ${
            state.selectMode
              ? ""
              : `<div class="menu-wrap">
            <button class="icon-btn-sm" data-action="toggle-menu" data-id="${c.id}" title="More" aria-label="More actions">${icon("moreVertical", { size: 15 })}</button>
            ${state.openMenuId === c.id ? cardMenu(c.id) : ""}
          </div>`
          }
        </header>

        <div class="clip-body" data-action="${bodyAction}" data-id="${c.id}">
          ${bodyHtml}
          ${commentHtml}
        </div>
        ${tagsHtml}

        ${
          state.selectMode
            ? ""
            : `<footer class="clip-card-footer">
          <button class="footer-btn ${c.pinned ? "is-active" : ""}" data-action="pin" data-id="${c.id}" title="${c.pinned ? "Unpin" : "Pin"}">
            ${icon("pin", { size: 14 })}${c.pinned ? "<span>Pinned</span>" : ""}
          </button>
          <a class="footer-link" href="${escapeAttr(c.source?.url || "#")}" target="_blank" rel="noopener noreferrer" title="Open source">
            ${icon("externalLink", { size: 14 })}<span>Source</span>
          </a>
        </footer>`
        }
      </div>
    </article>
  `;
}

function cardMenu(id) {
  const clip = state.clips.find((c) => c.id === id);
  const archived = clip?.archived;
  return `
    <div class="dropdown-menu" data-menu-for="${id}">
      <button class="dropdown-item" data-action="edit" data-id="${id}">${icon("edit", { size: 14 })}<span>Edit</span></button>
      <button class="dropdown-item" data-action="export" data-id="${id}">${icon("share", { size: 14 })}<span>Export landing page</span></button>
      <button class="dropdown-item" data-action="copy" data-id="${id}">${icon("copy", { size: 14 })}<span>Copy as text</span></button>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item" data-action="${archived ? "unarchive" : "archive"}" data-id="${id}">${icon("archive", { size: 14 })}<span>${archived ? "Unarchive" : "Archive"}</span></button>
      <button class="dropdown-item dropdown-item-danger" data-action="delete" data-id="${id}">${icon("trash", { size: 14 })}<span>Delete</span></button>
    </div>
  `;
}

function detailView(c) {
  const meta = KIND_META[c.kind] || KIND_META.text;

  let mediaHtml = "";
  if (c.kind === "text") {
    mediaHtml = `<blockquote class="detail-quote">${escapeHtml(c.quote)}</blockquote>`;
  } else {
    mediaHtml = `
      <a class="detail-media" href="${escapeAttr(c.source?.url)}" target="_blank" rel="noopener noreferrer">
        <span class="detail-media-icon">${icon(c.kind === "video" ? "video" : "headphones", { size: 18 })}</span>
        <span class="detail-media-text">
          <strong>${escapeHtml(c.mediaTitle || "Untitled")}</strong>
          <span>${formatRange(c.startSeconds, c.endSeconds)}${c.channel ? ` \u00b7 ${escapeHtml(c.channel)}` : ""}</span>
        </span>
        ${icon("arrowUpRight", { size: 15, className: "detail-media-go" })}
      </a>
    `;
  }

  let commentHtml = "";
  if (c.comment?.kind === "voice" && c.comment.audioDataUrl) {
    commentHtml = `
      <div class="comment-row comment-voice">
        <button class="mini-play" data-action="play-audio" data-id="${c.id}" aria-label="Play voice note">${icon("play", { size: 14 })}</button>
        <div class="voice-wave" aria-hidden="true">${voiceBars()}</div>
        <span class="voice-duration">${formatDuration(c.comment.audioDurationSeconds || 0)}</span>
      </div>
    `;
  } else if (c.comment?.text) {
    commentHtml = `<p class="comment-text detail-comment-text">${escapeHtml(c.comment.text)}</p>`;
  }

  const tagsHtml = (c.tags || []).length
    ? `<div class="clip-tags">${c.tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>`
    : "";

  return `
    <div class="detail-view">
      <div class="detail-source">
        ${c.source?.favicon ? `<img class="js-favicon" src="${escapeAttr(c.source.favicon)}" alt="" width="18" height="18" />` : iconNode("globe", 18).outerHTML}
        <div class="detail-source-text">
          <strong>${escapeHtml(c.source?.title || c.source?.siteName || "Untitled source")}</strong>
          <span>${escapeHtml(c.source?.siteName || "")}${c.source?.author ? ` \u00b7 ${escapeHtml(c.source.author)}` : ""}</span>
        </div>
        <span class="kind-dot" style="background:${meta.color}" title="${meta.label}"></span>
        <button class="footer-btn ${c.pinned ? "is-active" : ""}" data-action="pin" data-id="${c.id}" title="${c.pinned ? "Unpin" : "Pin"}">
          ${icon("pin", { size: 15 })}
        </button>
      </div>

      ${mediaHtml}
      ${commentHtml ? `<h3 class="detail-label">Your take</h3>${commentHtml}` : ""}
      ${tagsHtml}
      ${relatedClipsHtml(c)}

      <div class="detail-meta">
        <span>${icon("clock", { size: 13 })} ${escapeHtml(timeAgo(c.createdAt))}</span>
        <a href="${escapeAttr(c.source?.url || "#")}" target="_blank" rel="noopener noreferrer">${icon("externalLink", { size: 13 })} Open source</a>
      </div>
    </div>
  `;
}

function relatedClipsHtml(c) {
  const related = state.clips.filter((other) => other.id !== c.id && !other.archived && sameSource(c, other)).slice(0, 4);
  if (related.length === 0) return "";
  return `
    <h3 class="detail-label">More from ${escapeHtml(c.source?.siteName || "this source")}</h3>
    <div class="related-list">
      ${related
        .map((r) => {
          const rMeta = KIND_META[r.kind] || KIND_META.text;
          const label = r.kind === "text" ? truncate(r.quote, 70) : truncate(r.mediaTitle || r.source?.title || "Untitled", 70);
          return `
          <button class="related-row" data-action="open-detail" data-id="${r.id}">
            <span class="kind-dot" style="background:${rMeta.color}"></span>
            <span class="related-row-text">${escapeHtml(label)}</span>
            <span class="related-row-time">${escapeHtml(timeAgo(r.createdAt))}</span>
          </button>`;
        })
        .join("")}
    </div>
  `;
}

function sameSource(a, b) {
  if (a.source?.url && b.source?.url && a.source.url === b.source.url) return true;
  const ah = hostnameOf(a.source?.url);
  const bh = hostnameOf(b.source?.url);
  if (ah && bh && ah === bh) return true;
  return !!(a.source?.siteName && b.source?.siteName && a.source.siteName.toLowerCase() === b.source.siteName.toLowerCase());
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function voiceBars() {
  const heights = [5, 9, 13, 8, 15, 6, 11, 7, 10, 5];
  return heights.map((h) => `<span style="height:${h}px"></span>`).join("");
}

// --- Compose -------------------------------------------------------------

function openComposerFromCapture(payload) {
  state.editingId = null;
  state.draft = draftFromCapture(payload);
  state.view = "compose";
}

function draftFromCapture(payload) {
  const base = {
    kind: payload.kind,
    source: payload.source,
    quote: payload.quote || "",
    mediaTitle: payload.mediaTitle || "",
    channel: payload.channel || "",
    startSeconds: payload.startSeconds || 0,
    endSeconds: null,
    totalDuration: payload.totalDuration || null,
    comment: { kind: "text", text: "", audioDataUrl: null, audioDurationSeconds: null },
    tags: [],
  };
  if (payload.kind !== "text") {
    const cap = Math.min(90, payload.durationCap || 90);
    const remaining = base.totalDuration ? Math.max(1, base.totalDuration - base.startSeconds) : cap;
    base.clipLength = Math.min(cap, remaining || cap, 60);
    base.endSeconds = base.startSeconds + base.clipLength;
  }
  return base;
}

function blankDraft() {
  const s = state.settings || {};
  return {
    kind: "text",
    source: { url: "", title: "", siteName: "", favicon: "", author: null },
    quote: "",
    mediaTitle: "",
    channel: "",
    startSeconds: 0,
    endSeconds: null,
    clipLength: s.defaultClipLength || 30,
    totalDuration: null,
    comment: { kind: s.defaultCommentKind || "text", text: "", audioDataUrl: null, audioDurationSeconds: null },
    tags: [],
  };
}

function composeView() {
  if (!state.draft) state.draft = blankDraft();
  const d = state.draft;
  const isEdit = !!state.editingId;
  const meta = KIND_META[d.kind] || KIND_META.text;

  const hasSource = !!d.source?.url;

  return `
    <div class="composer">
      <div class="composer-heading">
        <h2>${isEdit ? "Edit riff" : "New riff"}</h2>
        ${!isEdit ? `<button class="btn btn-ghost btn-sm" id="btn-capture-tab">${icon("scissors", { size: 14 })}<span>Capture this tab</span></button>` : ""}
      </div>

      ${
        hasSource
          ? `
        <div class="source-pill">
          ${d.source.favicon ? `<img class="js-favicon" src="${escapeAttr(d.source.favicon)}" width="16" height="16" alt="" />` : iconNode("globe", 16).outerHTML}
          <div class="source-pill-text">
            <strong>${escapeHtml(truncate(d.source.title || d.source.siteName, 60))}</strong>
            <span>${escapeHtml(d.source.siteName || "")}</span>
          </div>
        </div>
      `
          : `
        <div class="field-group">
          <label>Source URL</label>
          <input type="text" id="input-source-url" placeholder="https://" value="${escapeAttr(d.source.url)}" />
        </div>
        <div class="field-group">
          <label>Source title</label>
          <input type="text" id="input-source-title" placeholder="What is this from?" value="${escapeAttr(d.source.title)}" />
        </div>
      `
      }

      ${duplicateSourceNotice(d)}

      <div class="segmented" id="kind-segmented">
        ${["text", "video", "audio"]
          .map(
            (k) => `<button class="segmented-btn ${d.kind === k ? "is-active" : ""}" data-kind="${k}">
              ${icon(KIND_META[k].icon, { size: 14 })}<span>${KIND_META[k].label}</span>
            </button>`
          )
          .join("")}
      </div>

      ${d.kind === "text" ? textFields(d) : mediaFields(d)}

      <div class="field-group">
        <label>Your take</label>
        <div class="comment-toggle">
          <button class="pill-btn ${d.comment.kind === "text" ? "is-active" : ""}" data-comment-kind="text">${icon("edit", { size: 13 })}<span>Write</span></button>
          <button class="pill-btn ${d.comment.kind === "voice" ? "is-active" : ""}" data-comment-kind="voice">${icon("mic", { size: 13 })}<span>Record</span></button>
        </div>
        ${d.comment.kind === "text" ? commentTextField(d) : commentVoiceField(d)}
      </div>

      <div class="field-group">
        <label>Tags</label>
        <input type="text" id="input-tags" placeholder="comma, separated, tags" value="${escapeAttr((d.tags || []).join(", "))}" autocomplete="off" />
        <div id="tag-suggestions" class="tag-suggestions"></div>
      </div>

      <div class="composer-actions">
        ${isEdit ? `<button class="btn btn-ghost" id="btn-cancel-edit">Cancel</button>` : ""}
        <button class="btn btn-primary" id="btn-save-clip">${icon("check", { size: 15 })}<span>${isEdit ? "Save changes" : "Save riff"}</span></button>
      </div>
    </div>
  `;
}

function duplicateSourceNotice(d) {
  if (!d.source?.url) return "";
  const matches = state.clips.filter((c) => c.id !== state.editingId && c.source?.url === d.source.url);
  if (matches.length === 0) return "";
  return `
    <div class="dup-notice">
      ${icon("alert", { size: 14 })}
      <span>You've already riffed this source ${matches.length} time${matches.length === 1 ? "" : "s"}.</span>
    </div>
  `;
}

function textFields(d) {
  return `
    <div class="field-group">
      <label>Quoted passage</label>
      <textarea id="input-quote" rows="5" placeholder="Paste or type the passage you're riffing on&hellip;">${escapeHtml(d.quote)}</textarea>
    </div>
  `;
}

function mediaFields(d) {
  const start = d.startSeconds || 0;
  const length = d.clipLength || Math.max(1, (d.endSeconds || start + 30) - start);
  const maxLen = d.totalDuration ? Math.min(90, Math.max(1, d.totalDuration - start)) : 90;
  return `
    <div class="field-group">
      <label>${d.kind === "video" ? "Video" : "Episode"} title</label>
      <input type="text" id="input-media-title" placeholder="Title" value="${escapeAttr(d.mediaTitle)}" />
    </div>
    <div class="field-group">
      <label>Creator / channel</label>
      <input type="text" id="input-media-channel" placeholder="Optional" value="${escapeAttr(d.channel)}" />
    </div>
    <div class="field-group field-group-row">
      <div>
        <label>Start</label>
        <input type="text" id="input-start" value="${formatDuration(start)}" placeholder="0:00" />
      </div>
      <div>
        <label>Length (sec, max 90)</label>
        <input type="number" id="input-length" min="1" max="${maxLen}" value="${length}" />
      </div>
    </div>
    <p class="hint-text">Clip plays ${formatDuration(start)} &rarr; ${formatDuration(start + length)}. The landing page links back to the original at this timestamp &mdash; Riff never re-hosts the source file.</p>
  `;
}

function commentTextField(d) {
  return `<textarea id="input-comment-text" rows="4" placeholder="What's your take?">${escapeHtml(d.comment.text || "")}</textarea>`;
}

function commentVoiceField(d) {
  const rec = state.recorder;
  if (rec.active) {
    return `
      <div class="voice-recorder is-recording">
        <span class="rec-dot"></span>
        <span class="rec-timer">${formatDuration(rec.elapsedSeconds)}</span>
        <button class="btn btn-danger btn-sm" id="btn-stop-recording">${icon("pause", { size: 13 })}<span>Stop</span></button>
      </div>
    `;
  }
  if (d.comment.audioDataUrl) {
    return `
      <div class="voice-recorder has-audio">
        <button class="mini-play" id="btn-preview-audio" aria-label="Preview recording">${icon("play", { size: 14 })}</button>
        <div class="voice-wave" aria-hidden="true">${voiceBars()}</div>
        <span class="voice-duration">${formatDuration(d.comment.audioDurationSeconds || 0)}</span>
        <button class="footer-btn footer-btn-danger" id="btn-discard-audio" title="Re-record">${icon("trash", { size: 13 })}</button>
      </div>
    `;
  }
  return `
    <div class="voice-recorder">
      <button class="btn btn-outline btn-sm" id="btn-start-recording">${icon("mic", { size: 14 })}<span>Record a voice note</span></button>
    </div>
  `;
}

// --- Settings --------------------------------------------------------------

function settingsView() {
  const s = state.settings;
  const tags = db.allTagsWithCounts(state.clips);
  const stats = computeStats();

  return `
    <div class="settings">
      <section class="settings-section">
        <h3>Appearance</h3>
        <div class="segmented" id="theme-segmented">
          ${["light", "dark", "system"]
            .map(
              (t) =>
                `<button class="segmented-btn ${s.theme === t ? "is-active" : ""}" data-theme="${t}">
                  ${icon(t === "light" ? "sun" : t === "dark" ? "moon" : "square", { size: 13 })}
                  <span>${t[0].toUpperCase() + t.slice(1)}</span>
                </button>`
            )
            .join("")}
        </div>
        <label class="settings-sublabel">Accent color</label>
        <div class="swatch-row" id="accent-swatches">
          ${Object.entries(ACCENTS)
            .map(
              ([key, val]) =>
                `<button class="swatch ${s.accentColor === key ? "is-active" : ""}" data-accent="${key}" style="background:${val.light}" title="${key[0].toUpperCase() + key.slice(1)}" aria-label="${key[0].toUpperCase() + key.slice(1)} accent color${s.accentColor === key ? ", selected" : ""}">${s.accentColor === key ? icon("check", { size: 12 }) : ""}</button>`
            )
            .join("")}
        </div>
        <label class="settings-sublabel">Density</label>
        <div class="segmented" id="density-segmented">
          ${["comfortable", "compact"]
            .map(
              (d) =>
                `<button class="segmented-btn ${s.density === d ? "is-active" : ""}" data-density="${d}">
                  ${icon("sliders", { size: 13 })}<span>${d[0].toUpperCase() + d.slice(1)}</span>
                </button>`
            )
            .join("")}
        </div>
      </section>

      <section class="settings-section">
        <h3>Capture defaults</h3>
        <div class="field-group field-group-row">
          <div>
            <label>Default clip length (sec)</label>
            <input type="number" id="input-default-length" min="5" max="90" value="${s.defaultClipLength}" />
          </div>
          <div>
            <label>Default comment</label>
            <div class="segmented" id="default-comment-segmented">
              <button class="segmented-btn ${s.defaultCommentKind === "text" ? "is-active" : ""}" data-default-comment="text">${icon("edit", { size: 13 })}<span>Write</span></button>
              <button class="segmented-btn ${s.defaultCommentKind === "voice" ? "is-active" : ""}" data-default-comment="voice">${icon("mic", { size: 13 })}<span>Record</span></button>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h3>Your archive</h3>
        <div class="stat-grid">
          <div class="stat-cell"><strong>${stats.total}</strong><span>Total riffs</span></div>
          <div class="stat-cell"><strong>${stats.text}</strong><span>Text</span></div>
          <div class="stat-cell"><strong>${stats.video}</strong><span>Video</span></div>
          <div class="stat-cell"><strong>${stats.audio}</strong><span>Audio</span></div>
          <div class="stat-cell"><strong>${stats.pinned}</strong><span>Pinned</span></div>
          <div class="stat-cell"><strong>${tags.length}</strong><span>Tags</span></div>
        </div>
        ${stats.oldest ? `<p class="settings-body">First riff ${escapeHtml(timeAgo(stats.oldest))}.</p>` : ""}
      </section>

      ${
        tags.length
          ? `
      <section class="settings-section">
        <h3>Tags</h3>
        <div class="tag-manage-list">
          ${tags
            .map(
              (t) => `
            <div class="tag-manage-row">
              <button class="tag-chip" data-action="filter-tag-settings" data-tag="${escapeAttr(t.tag)}">${icon("hash", { size: 10 })}${escapeHtml(t.tag)}</button>
              <span class="tag-count">${t.count}</span>
              <button class="icon-btn-sm" data-action="rename-tag" data-tag="${escapeAttr(t.tag)}" title="Rename" aria-label="Rename tag">${icon("edit", { size: 13 })}</button>
              <button class="icon-btn-sm" data-action="delete-tag" data-tag="${escapeAttr(t.tag)}" title="Delete" aria-label="Delete tag">${icon("trash", { size: 13 })}</button>
            </div>`
            )
            .join("")}
        </div>
      </section>`
          : ""
      }

      <section class="settings-section">
        <h3>Your data</h3>
        <p class="settings-body">${state.clips.length} riff${state.clips.length === 1 ? "" : "s"} stored on this device, using ${formatBytes(stats.bytes)}. Riff has no server in this build &mdash; nothing you capture leaves your browser unless you export it.</p>
        <div class="settings-row-actions">
          <button class="btn btn-outline btn-sm" id="btn-export-data">${icon("download", { size: 13 })}<span>Export as JSON</span></button>
          <button class="btn btn-outline btn-sm" id="btn-import-data">${icon("upload", { size: 13 })}<span>Import JSON</span></button>
          <input type="file" id="input-import-file" accept="application/json" hidden />
          <button class="btn btn-outline btn-sm btn-danger-outline" id="btn-clear-data">${icon("trash", { size: 13 })}<span>Clear all riffs</span></button>
        </div>
      </section>

      <section class="settings-section">
        <h3>Attribution &amp; takedowns</h3>
        <p class="settings-body">Every riff keeps its source link and, for video, links back to the original timestamp rather than re-hosting the file. If you're a rights holder and want a riff of your work removed, use the "Open source" link on any card to reach the original, or clear it from this device via the card's delete action.</p>
      </section>

      <section class="settings-section">
        <h3>Shortcuts</h3>
        <div class="shortcut-row"><span>Open Riff</span><kbd>Ctrl/Cmd + Shift + R</kbd></div>
        <div class="shortcut-row"><span>Riff the selection</span><kbd>Ctrl/Cmd + Shift + K</kbd></div>
        <div class="shortcut-row"><span>Focus search</span><kbd>/</kbd></div>
        <div class="shortcut-row"><span>New riff</span><kbd>N</kbd></div>
        <div class="shortcut-row"><span>Close menu / detail</span><kbd>Esc</kbd></div>
      </section>

      <section class="settings-section settings-about">
        <div class="about-mark">R</div>
        <p>Riff &mdash; version 1.2.0</p>
        <p class="settings-muted">Clip, quote, comment. Attribution welded in, not bolted on.</p>
      </section>
    </div>
  `;
}

function computeStats() {
  const clips = state.clips;
  const stats = {
    total: clips.length,
    text: clips.filter((c) => c.kind === "text").length,
    video: clips.filter((c) => c.kind === "video").length,
    audio: clips.filter((c) => c.kind === "audio").length,
    pinned: clips.filter((c) => c.pinned).length,
    oldest: clips.length ? clips.reduce((a, b) => (new Date(a.createdAt) < new Date(b.createdAt) ? a : b)).createdAt : null,
    bytes: new Blob([JSON.stringify(clips)]).size,
  };
  return stats;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

document.addEventListener("click", onGlobalClick);
document.addEventListener("input", onGlobalInput);
document.addEventListener("change", onGlobalChange);
document.addEventListener("keydown", onGlobalKeydown);
document.addEventListener("focusout", (e) => {
  if (e.target.id !== "input-tags") return;
  setTimeout(() => {
    if (!document.activeElement?.closest?.(".tag-suggestions")) renderTagSuggestions("");
  }, 120);
});

function onGlobalKeydown(e) {
  const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);

  if (e.key === "Escape") {
    if (state.openMenuId) {
      state.openMenuId = null;
      renderView();
      renderHeaderTools();
      return;
    }
    if (state.detailId) {
      state.detailId = null;
      render();
      return;
    }
    if (typing) document.activeElement.blur();
    return;
  }

  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === "/") {
    e.preventDefault();
    if (state.view !== "feed") goToTab("feed");
    state.searchOpen = true;
    render();
    return;
  }
  if (e.key.toLowerCase() === "n") {
    e.preventDefault();
    goToTab("compose");
    return;
  }

  if (state.view === "feed" && !state.detailId && !state.selectMode && !state.openMenuId) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const list = filteredClips();
      if (list.length === 0) return;
      const curIdx = list.findIndex((c) => c.id === state.activeCardId);
      let nextIdx;
      if (curIdx === -1) nextIdx = 0;
      else nextIdx = e.key === "ArrowDown" ? Math.min(list.length - 1, curIdx + 1) : Math.max(0, curIdx - 1);
      state.activeCardId = list[nextIdx].id;
      renderView();
      document.querySelector(`.clip-card[data-id="${state.activeCardId}"]`)?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (e.key === "Enter" && state.activeCardId) {
      e.preventDefault();
      state.detailId = state.activeCardId;
      render();
      return;
    }
  }
}

function onGlobalClick(e) {
  const menuTrigger = e.target.closest('[data-action="toggle-menu"]');
  if (menuTrigger) {
    const id = menuTrigger.dataset.id;
    state.openMenuId = state.openMenuId === id ? null : id;
    renderView();
    return;
  }
  if (e.target.closest("#btn-detail-menu")) {
    state.openMenuId = state.openMenuId === "detail" ? null : "detail";
    renderHeaderTools();
    return;
  }
  if (e.target.closest("#btn-toggle-sort")) {
    state.openMenuId = state.openMenuId === "sort" ? null : "sort";
    renderHeaderTools();
    return;
  }
  const sortOption = e.target.closest("[data-sort]");
  if (sortOption) {
    state.sort = sortOption.dataset.sort;
    state.openMenuId = null;
    render();
    return;
  }
  if (e.target.closest("#btn-detail-back")) {
    state.detailId = null;
    state.openMenuId = null;
    render();
    return;
  }
  if (state.openMenuId && !e.target.closest(".menu-wrap")) {
    state.openMenuId = null;
    renderView();
    renderHeaderTools();
  }

  if (e.target.closest('[data-action="dismiss-welcome"]')) {
    db.saveSettings({ hasSeenWelcome: true }).then((s) => {
      state.settings = s;
      renderView();
    });
    return;
  }

  const tagFilterBtn = e.target.closest('[data-action="filter-tag"]');
  if (tagFilterBtn) {
    const tag = tagFilterBtn.dataset.tag;
    state.tagFilter = state.tagFilter === tag ? null : tag;
    state.filtersOpen = true;
    render();
    return;
  }
  if (e.target.closest("[data-clear-tag]")) {
    state.tagFilter = null;
    render();
    return;
  }

  if (e.target.closest("#btn-toggle-select")) {
    state.selectMode = !state.selectMode;
    state.selectedIds.clear();
    render();
    return;
  }
  if (e.target.closest("#btn-exit-select")) {
    state.selectMode = false;
    state.selectedIds.clear();
    render();
    return;
  }
  if (e.target.closest("#btn-select-all")) {
    const ids = filteredClips().map((c) => c.id);
    const allSelected = ids.length > 0 && ids.every((id) => state.selectedIds.has(id));
    if (allSelected) state.selectedIds.clear();
    else ids.forEach((id) => state.selectedIds.add(id));
    render();
    return;
  }
  if (e.target.closest("#btn-bulk-delete")) {
    bulkDelete();
    return;
  }
  if (e.target.closest("#btn-bulk-copy")) {
    bulkCopy();
    return;
  }
  if (e.target.closest("#btn-bulk-tag")) {
    bulkAddTag();
    return;
  }
  if (e.target.closest("#btn-bulk-archive")) {
    bulkArchive();
    return;
  }

  const selectTrigger = e.target.closest('[data-action="toggle-select"]');
  if (selectTrigger) {
    const id = selectTrigger.dataset.id;
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    render();
    return;
  }

  const playBtn = e.target.closest('[data-action="play-audio"]');
  if (playBtn) {
    const clip = state.clips.find((c) => c.id === playBtn.dataset.id) || (state.draft?.comment?.audioDataUrl ? state.draft : null);
    playInlineAudio(clip?.comment?.audioDataUrl, playBtn);
    return;
  }

  const detailTrigger = e.target.closest('[data-action="open-detail"]');
  if (detailTrigger) {
    state.detailId = detailTrigger.dataset.id;
    state.openMenuId = null;
    render();
    return;
  }

  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn) {
    goToTab(tabBtn.dataset.tab);
    return;
  }

  if (e.target.closest("#btn-toggle-search")) {
    state.searchOpen = !state.searchOpen;
    if (!state.searchOpen) state.search = "";
    render();
    return;
  }
  if (e.target.closest("#btn-toggle-filters")) {
    state.filtersOpen = !state.filtersOpen;
    render();
    return;
  }
  const chip = e.target.closest("[data-filter]");
  if (chip) {
    state.filter = chip.dataset.filter;
    renderView();
    renderChipRow();
    return;
  }

  const kindBtn = e.target.closest("#kind-segmented [data-kind]");
  if (kindBtn) {
    state.draft.kind = kindBtn.dataset.kind;
    renderView();
    return;
  }

  const themeBtn = e.target.closest("#theme-segmented [data-theme]");
  if (themeBtn) {
    setTheme(themeBtn.dataset.theme);
    return;
  }

  const commentKindBtn = e.target.closest("[data-comment-kind]");
  if (commentKindBtn) {
    state.draft.comment.kind = commentKindBtn.dataset.commentKind;
    renderView();
    return;
  }

  if (e.target.closest("#btn-capture-tab")) {
    captureActiveTab();
    return;
  }
  if (e.target.closest("#btn-cancel-edit")) {
    state.editingId = null;
    state.draft = null;
    goToTab("feed");
    return;
  }
  if (e.target.closest("#btn-save-clip")) {
    saveDraft();
    return;
  }
  if (e.target.closest("#btn-start-recording")) {
    startRecording();
    return;
  }
  if (e.target.closest("#btn-stop-recording")) {
    stopRecording();
    return;
  }
  if (e.target.closest("#btn-discard-audio")) {
    state.draft.comment.audioDataUrl = null;
    state.draft.comment.audioDurationSeconds = null;
    renderView();
    return;
  }
  if (e.target.closest("#btn-preview-audio")) {
    playInlineAudio(state.draft.comment.audioDataUrl, e.target.closest("#btn-preview-audio"));
    return;
  }

  if (e.target.closest("#btn-export-data")) {
    exportAllDataFile();
    return;
  }
  if (e.target.closest("#btn-clear-data")) {
    clearAllData();
    return;
  }
  if (e.target.closest("#btn-import-data")) {
    document.getElementById("input-import-file")?.click();
    return;
  }

  const tagSuggestion = e.target.closest('[data-action="apply-tag-suggestion"]');
  if (tagSuggestion) {
    const input = document.getElementById("input-tags");
    if (input) {
      const segments = input.value.split(",");
      segments[segments.length - 1] = " " + tagSuggestion.dataset.tag;
      const nextValue = segments.map((s) => s.trim()).filter(Boolean).join(", ") + ", ";
      input.value = nextValue;
      state.draft.tags = commitTagsFromValue(nextValue);
      renderTagSuggestions("");
      input.focus();
      scheduleDraftAutosave();
    }
    return;
  }

  const accentSwatch = e.target.closest("[data-accent]");
  if (accentSwatch) {
    setAccent(accentSwatch.dataset.accent);
    return;
  }
  const densityBtn = e.target.closest("[data-density]");
  if (densityBtn) {
    setDensity(densityBtn.dataset.density);
    return;
  }
  const defaultCommentBtn = e.target.closest("[data-default-comment]");
  if (defaultCommentBtn) {
    db.saveSettings({ defaultCommentKind: defaultCommentBtn.dataset.defaultComment }).then((s) => {
      state.settings = s;
      renderView();
    });
    return;
  }

  const tagSettingsFilter = e.target.closest('[data-action="filter-tag-settings"]');
  if (tagSettingsFilter) {
    state.tagFilter = tagSettingsFilter.dataset.tag;
    state.filtersOpen = true;
    goToTab("feed");
    return;
  }
  const renameTagBtn = e.target.closest('[data-action="rename-tag"]');
  if (renameTagBtn) {
    renameTagFlow(renameTagBtn.dataset.tag);
    return;
  }
  const deleteTagBtn = e.target.closest('[data-action="delete-tag"]');
  if (deleteTagBtn) {
    deleteTagFlow(deleteTagBtn.dataset.tag);
    return;
  }

  const cardAction = e.target.closest("[data-action]");
  if (cardAction) {
    handleCardAction(cardAction.dataset.action, cardAction.dataset.id, cardAction);
  }
}

function onGlobalInput(e) {
  if (e.target.id === "search-input") {
    state.search = e.target.value;
    renderView();
    return;
  }
  if (!state.draft) return;
  const d = state.draft;
  const id = e.target.id;
  if (id === "input-tags") {
    d.tags = commitTagsFromValue(e.target.value);
    renderTagSuggestions(e.target.value);
    scheduleDraftAutosave();
    return;
  }
  if (id === "input-source-url") d.source.url = e.target.value;
  else if (id === "input-source-title") d.source.title = e.target.value;
  else if (id === "input-quote") d.quote = e.target.value;
  else if (id === "input-media-title") d.mediaTitle = e.target.value;
  else if (id === "input-media-channel") d.channel = e.target.value;
  else if (id === "input-comment-text") d.comment.text = e.target.value;
  else if (id === "input-length") {
    const len = clamp(parseInt(e.target.value || "1", 10), 1, 90);
    d.clipLength = len;
    d.endSeconds = (d.startSeconds || 0) + len;
  } else if (id === "input-start") {
    const secs = parseDurationInput(e.target.value);
    if (secs != null) {
      d.startSeconds = secs;
      d.endSeconds = secs + (d.clipLength || 30);
    }
  } else {
    return;
  }
  scheduleDraftAutosave();
}

function commitTagsFromValue(value) {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function renderTagSuggestions(value) {
  const host = document.getElementById("tag-suggestions");
  if (!host) return;
  const segments = value.split(",");
  const query = (segments[segments.length - 1] || "").trim().toLowerCase();
  const already = new Set(commitTagsFromValue(segments.slice(0, -1).join(",")));

  if (!query) {
    host.innerHTML = "";
    return;
  }
  const matches = db
    .allTagsWithCounts(state.clips)
    .filter((t) => t.tag.toLowerCase().includes(query) && t.tag.toLowerCase() !== query && !already.has(t.tag))
    .slice(0, 5);
  if (matches.length === 0) {
    host.innerHTML = "";
    return;
  }
  host.innerHTML = matches
    .map(
      (t) =>
        `<button type="button" class="tag-suggestion" data-action="apply-tag-suggestion" data-tag="${escapeAttr(t.tag)}">${icon("hash", { size: 10 })}${escapeHtml(t.tag)}<span>${t.count}</span></button>`
    )
    .join("");
}

function onGlobalChange(e) {
  if (e.target.id === "input-default-length") {
    const len = clamp(parseInt(e.target.value || "30", 10), 5, 90);
    db.saveSettings({ defaultClipLength: len }).then((s) => {
      state.settings = s;
    });
    return;
  }
  if (e.target.id === "input-import-file") {
    handleImportFile(e.target.files?.[0]);
    return;
  }
}

function isDraftMeaningful(d) {
  if (!d) return false;
  return !!(
    (d.quote && d.quote.trim()) ||
    (d.mediaTitle && d.mediaTitle.trim()) ||
    (d.comment?.text && d.comment.text.trim()) ||
    d.comment?.audioDataUrl ||
    (d.source?.url && d.source.url.trim())
  );
}

function scheduleDraftAutosave() {
  if (state.editingId || !state.draft) return;
  clearTimeout(scheduleDraftAutosave._t);
  scheduleDraftAutosave._t = setTimeout(() => {
    if (isDraftMeaningful(state.draft)) db.saveDraftInProgress(state.draft);
  }, 600);
}

async function maybeRestoreDraft() {
  const saved = await db.getDraftInProgress();
  if (!saved || !isDraftMeaningful(saved)) return;
  if (state.view !== "compose" || state.editingId || isDraftMeaningful(state.draft)) return;
  state.draft = saved;
  renderView();
  showToast("Restored your last unsaved draft");
}

function goToTab(tab) {
  state.detailId = null;
  state.openMenuId = null;
  if (tab === "compose" && state.view !== "compose") {
    state.editingId = null;
    state.draft = blankDraft();
    state.view = tab;
    render();
    maybeRestoreDraft();
    return;
  }
  if (tab !== "compose" && state.recorder.active) {
    stopRecording(true);
  }
  state.view = tab;
  render();
}

function setTheme(theme) {
  state.settings.theme = theme;
  db.saveSettings({ theme });
  applyTheme(theme);
  renderView();
}

function setAccent(key) {
  state.settings.accentColor = key;
  db.saveSettings({ accentColor: key });
  applyAccent(key);
  renderView();
}

function setDensity(value) {
  state.settings.density = value;
  db.saveSettings({ density: value });
  applyDensity(value);
  renderView();
}

async function renameTagFlow(tag) {
  const input = prompt(`Rename tag "${tag}" to:`, tag);
  const next = (input || "").trim();
  if (!next || next === tag) return;
  state.clips = await db.renameTagEverywhere(tag, next);
  if (state.tagFilter === tag) state.tagFilter = next;
  renderView();
  showToast("Tag renamed");
}

async function deleteTagFlow(tag) {
  if (!confirm(`Remove the tag "${tag}" from all riffs?`)) return;
  state.clips = await db.deleteTagEverywhere(tag);
  if (state.tagFilter === tag) state.tagFilter = null;
  renderView();
  showToast("Tag removed");
}

async function handleImportFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const incoming = Array.isArray(data) ? data : Array.isArray(data.clips) ? data.clips : null;
    if (!incoming) throw new Error("Unrecognized file format");
    const { clips, added } = await db.importClips(incoming);
    state.clips = clips;
    renderView();
    showToast(added > 0 ? `Imported ${added} riff${added === 1 ? "" : "s"}` : "Nothing new to import");
  } catch (err) {
    showToast("Could not read that file");
  }
}

// --- Capture / composer actions --------------------------------------------

async function captureActiveTab() {
  const btn = document.getElementById("btn-capture-tab");
  if (btn) btn.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "RIFF_CAPTURE_ACTIVE_TAB", mode: "auto" });
    if (response?.ok) {
      state.draft = draftFromCapture(response.payload);
      renderView();
      showToast("Captured from this tab");
    } else {
      showToast(response?.error || "Could not read this tab");
    }
  } catch (err) {
    showToast("Could not read this tab");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveDraft() {
  const d = state.draft;
  if (d.kind === "text" && !d.quote.trim()) {
    showToast("Add a passage to quote");
    return;
  }
  if (d.kind !== "text" && !d.mediaTitle.trim()) {
    showToast("Give the clip a title");
    return;
  }
  if (!d.source.url.trim()) {
    showToast("Add a source URL");
    return;
  }

  const payload = {
    kind: d.kind,
    source: d.source,
    quote: d.quote,
    mediaTitle: d.mediaTitle,
    channel: d.channel,
    startSeconds: d.startSeconds || 0,
    endSeconds: d.endSeconds,
    totalDuration: d.totalDuration,
    comment: d.comment,
    tags: d.tags || [],
  };

  if (state.editingId) {
    await db.updateClip(state.editingId, payload);
    showToast("Riff updated");
  } else {
    await db.createClip(payload);
    await db.clearDraftInProgress();
    showToast("Riff saved");
  }

  state.clips = await db.getAllClips();
  state.editingId = null;
  state.draft = null;
  goToTab("feed");
}

// --- Voice recording ---------------------------------------------------

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    state.recorder.mediaRecorder = mr;
    state.recorder.chunks = [];
    state.recorder.active = true;
    state.recorder.elapsedSeconds = 0;
    state.recorder.startedAt = Date.now();

    mr.ondataavailable = (ev) => {
      if (ev.data.size > 0) state.recorder.chunks.push(ev.data);
    };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(state.recorder.chunks, { type: "audio/webm" });
      const dataUrl = await blobToDataUrl(blob);
      state.draft.comment.audioDataUrl = dataUrl;
      state.draft.comment.audioDurationSeconds = state.recorder.elapsedSeconds;
      state.recorder.active = false;
      clearInterval(state.recorder.timerHandle);
      renderView();
    };

    mr.start();
    state.recorder.timerHandle = setInterval(() => {
      state.recorder.elapsedSeconds = Math.floor((Date.now() - state.recorder.startedAt) / 1000);
      const timerEl = document.querySelector(".rec-timer");
      if (timerEl) timerEl.textContent = formatDuration(state.recorder.elapsedSeconds);
      if (state.recorder.elapsedSeconds >= 90) stopRecording();
    }, 250);

    renderView();
  } catch (err) {
    showToast("Microphone access denied");
  }
}

function stopRecording(silent) {
  const mr = state.recorder.mediaRecorder;
  if (mr && mr.state !== "inactive") {
    mr.stop();
  } else {
    state.recorder.active = false;
    clearInterval(state.recorder.timerHandle);
  }
  if (!silent) return;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

let activeAudioEl = null;
function playInlineAudio(src, btn) {
  if (!src) return;
  if (activeAudioEl) {
    activeAudioEl.pause();
    activeAudioEl = null;
  }
  const audio = new Audio(src);
  activeAudioEl = audio;
  audio.play();
  if (btn) {
    btn.innerHTML = icon("pause", { size: 14 });
    audio.onended = () => {
      btn.innerHTML = icon("play", { size: 14 });
    };
  }
}

// --- Card actions --------------------------------------------------------

async function handleCardAction(action, id, el) {
  const clip = state.clips.find((c) => c.id === id);
  if (!clip) return;

  if (action === "pin") {
    await db.togglePin(id);
    state.clips = await db.getAllClips();
    renderView();
    return;
  }

  state.openMenuId = null;

  if (action === "edit") {
    state.editingId = id;
    state.detailId = null;
    state.draft = {
      ...clip,
      clipLength: clip.endSeconds != null ? Math.max(1, clip.endSeconds - clip.startSeconds) : 30,
      tags: [...(clip.tags || [])],
      comment: { ...clip.comment },
      source: { ...clip.source },
    };
    state.view = "compose";
    render();
    return;
  }

  if (action === "delete") {
    await deleteClipFlow(clip);
    return;
  }

  if (action === "archive" || action === "unarchive") {
    const updated = await db.toggleArchive(id);
    state.clips = await db.getAllClips();
    if (updated?.archived && state.detailId === id) state.detailId = null;
    render();
    showToast(action === "archive" ? "Riff archived" : "Riff unarchived", {
      actionLabel: "Undo",
      duration: 4000,
      onAction: async () => {
        await db.toggleArchive(id);
        state.clips = await db.getAllClips();
        render();
      },
    });
    return;
  }

  if (action === "copy") {
    const text = clipToPlainText(clip);
    await navigator.clipboard.writeText(text);
    render();
    showToast("Copied to clipboard");
    return;
  }

  if (action === "export") {
    const html = buildLandingPageHTML(clip);
    downloadFile(`${slugify(clip.mediaTitle || clip.quote || "riff")}.html`, html, "text/html");
    render();
    showToast("Landing page downloaded");
    return;
  }

  if (action === "play-audio") {
    playInlineAudio(clip.comment.audioDataUrl, el);
    return;
  }
}

async function deleteClipFlow(clip) {
  state.clips = await db.deleteClip(clip.id);
  if (state.detailId === clip.id) state.detailId = null;
  render();
  showToast("Riff deleted", {
    actionLabel: "Undo",
    duration: 5000,
    onAction: async () => {
      state.clips = await db.restoreClip(clip);
      render();
      showToast("Riff restored");
    },
  });
}

async function bulkDelete() {
  const ids = [...state.selectedIds];
  if (ids.length === 0) return;
  const removed = state.clips.filter((c) => ids.includes(c.id));
  let clips = await db.getAllClips();
  clips = clips.filter((c) => !ids.includes(c.id));
  await db.saveAllClips(clips);
  state.clips = clips;
  state.selectMode = false;
  state.selectedIds = new Set();
  render();
  showToast(`${removed.length} riff${removed.length === 1 ? "" : "s"} deleted`, {
    actionLabel: "Undo",
    duration: 5000,
    onAction: async () => {
      let current = await db.getAllClips();
      current = [...removed, ...current];
      await db.saveAllClips(current);
      state.clips = current;
      render();
      showToast("Restored");
    },
  });
}

async function bulkCopy() {
  const ids = [...state.selectedIds];
  if (ids.length === 0) return;
  const clips = state.clips.filter((c) => ids.includes(c.id));
  const text = clips.map(clipToPlainText).join("\n\n---\n\n");
  await navigator.clipboard.writeText(text);
  showToast(`Copied ${clips.length} riff${clips.length === 1 ? "" : "s"}`);
}

async function bulkAddTag() {
  const ids = [...state.selectedIds];
  if (ids.length === 0) return;
  const input = prompt("Add a tag to the selected riffs:");
  const tag = (input || "").trim();
  if (!tag) return;
  const clips = await db.getAllClips();
  clips.forEach((c) => {
    if (!ids.includes(c.id)) return;
    const set = new Set(c.tags || []);
    set.add(tag);
    c.tags = [...set];
  });
  await db.saveAllClips(clips);
  state.clips = clips;
  render();
  showToast(`Tagged ${ids.length} riff${ids.length === 1 ? "" : "s"}`);
}

async function bulkArchive() {
  const ids = [...state.selectedIds];
  if (ids.length === 0) return;
  const clips = await db.getAllClips();
  clips.forEach((c) => {
    if (!ids.includes(c.id)) return;
    c.archived = true;
    c.pinned = false;
  });
  await db.saveAllClips(clips);
  state.clips = clips;
  state.selectMode = false;
  state.selectedIds = new Set();
  render();
  showToast(`Archived ${ids.length} riff${ids.length === 1 ? "" : "s"}`, {
    actionLabel: "Undo",
    duration: 4000,
    onAction: async () => {
      let current = await db.getAllClips();
      current.forEach((c) => {
        if (ids.includes(c.id)) c.archived = false;
      });
      await db.saveAllClips(current);
      state.clips = current;
      render();
    },
  });
}

function clipToPlainText(c) {
  const lines = [];
  if (c.kind === "text") {
    lines.push(`"${c.quote}"`);
  } else {
    lines.push(`${c.mediaTitle} (${formatRange(c.startSeconds, c.endSeconds)})`);
  }
  if (c.comment?.text) lines.push("", c.comment.text);
  lines.push("", `via ${c.source?.siteName || c.source?.url}`, c.source?.url || "");
  lines.push("", "Clipped with Riff");
  return lines.join("\n");
}

// --- Settings actions ------------------------------------------------------

async function exportAllDataFile() {
  const data = await db.exportAllData();
  downloadFile("riff-export.json", JSON.stringify(data, null, 2), "application/json");
  showToast("Export downloaded");
}

function clearAllData() {
  if (!confirm("Delete all riffs on this device? This can't be undone.")) return;
  db.wipeAllClips().then(async () => {
    state.clips = await db.getAllClips();
    renderView();
    showToast("All riffs cleared");
  });
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatRange(start, end) {
  if (end == null) return formatDuration(start);
  return `${formatDuration(start)}\u2013${formatDuration(end)}`;
}

function parseDurationInput(value) {
  const m = /^(\d+):(\d{1,2})$/.exec(value.trim());
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  if (/^\d+$/.test(value.trim())) return parseInt(value.trim(), 10);
  return null;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1).trimEnd() + "\u2026" : str;
}

function slugify(str) {
  return (str || "riff")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "riff";
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}
