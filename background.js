// Riff — background service worker
// Owns: side panel lifecycle, context menus, and on-demand page/media capture.
// No network calls happen here — everything captured is handed to the side
// panel, which is the only place data gets written to storage.

const MENU_SELECTION = "riff-capture-selection";
const MENU_VIDEO = "riff-capture-video";
const MENU_PAGE = "riff-capture-page";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_SELECTION,
    title: "Riff this selection",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: MENU_VIDEO,
    title: "Riff this moment",
    contexts: ["video", "audio"],
  });
  chrome.contextMenus.create({
    id: MENU_PAGE,
    title: "Riff this page",
    contexts: ["page"],
  });

  // Clicking the toolbar icon opens the side panel directly.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-selection") return;
  const tab = await getActiveTab();
  if (!tab) return;
  await captureAndStage(tab, "selection");
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  if (info.menuItemId === MENU_SELECTION) {
    await captureAndStage(tab, "selection", info.selectionText);
  } else if (info.menuItemId === MENU_VIDEO) {
    await captureAndStage(tab, "media");
  } else if (info.menuItemId === MENU_PAGE) {
    await captureAndStage(tab, "page");
  }
});

// Messages from the side panel (e.g. "capture the tab I'm looking at now").
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "RIFF_CAPTURE_ACTIVE_TAB") {
    (async () => {
      const tab = await getActiveTab();
      if (!tab) {
        sendResponse({ ok: false, error: "No active tab." });
        return;
      }
      try {
        const payload = await buildCapturePayload(tab, message.mode || "auto");
        sendResponse({ ok: true, payload });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true; // async response
  }
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function captureAndStage(tab, mode, selectionTextFallback) {
  try {
    const payload = await buildCapturePayload(tab, mode, selectionTextFallback);
    await chrome.storage.session.set({ riffPendingCapture: payload });
    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    }
    chrome.runtime.sendMessage({ type: "RIFF_PENDING_CAPTURE_READY" }).catch(() => {});
  } catch (err) {
    console.warn("Riff capture failed", err);
  }
}

async function buildCapturePayload(tab, mode, selectionTextFallback) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageData,
    args: [mode, selectionTextFallback || null],
  });
  return result;
}

// Injected into the page. Must be fully self-contained (no outer closures).
function extractPageData(mode, selectionTextFallback) {
  function meta(name) {
    const el =
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content") : null;
  }

  function bestFavicon() {
    const link =
      document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]') ||
      document.querySelector('link[rel="apple-touch-icon"]');
    if (link && link.href) return link.href;
    return new URL("/favicon.ico", location.origin).href;
  }

  const source = {
    url: location.href,
    title: meta("og:title") || document.title || location.hostname,
    siteName: meta("og:site_name") || location.hostname.replace(/^www\./, ""),
    favicon: bestFavicon(),
    author: meta("author") || meta("article:author") || null,
  };

  const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname) && location.pathname === "/watch";

  const selection = (window.getSelection ? window.getSelection().toString() : "").trim();
  const chosenSelection = selection || selectionTextFallback || "";

  // Prefer an explicit selection if one exists, regardless of mode —
  // a highlighted passage is always the clearest signal of intent.
  if (chosenSelection && mode !== "media") {
    return {
      kind: "text",
      source,
      quote: chosenSelection.slice(0, 4000),
    };
  }

  const media = document.querySelector("video") || document.querySelector("audio");

  if (media && (mode === "media" || mode === "auto" || isYouTube)) {
    const current = Math.max(0, Math.floor(media.currentTime || 0));
    let mediaTitle = source.title;
    let channel = source.siteName;

    if (isYouTube) {
      const titleEl = document.querySelector(
        "h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string"
      );
      const channelEl = document.querySelector(
        "ytd-channel-name yt-formatted-string a, #channel-name a"
      );
      if (titleEl?.textContent) mediaTitle = titleEl.textContent.trim();
      if (channelEl?.textContent) channel = channelEl.textContent.trim();
    }

    return {
      kind: media.tagName === "VIDEO" ? "video" : "audio",
      source,
      mediaTitle,
      channel,
      startSeconds: current,
      durationCap: 90,
      totalDuration: Math.floor(media.duration || 0) || null,
    };
  }

  // Fallback: capture the page itself (e.g. "Riff this page" with no
  // selection and no media element). Use a short excerpt as the quote seed.
  const bodyText = document.body ? document.body.innerText.trim() : "";
  const excerpt = bodyText.slice(0, 280);

  return {
    kind: "text",
    source,
    quote: excerpt,
  };
}
