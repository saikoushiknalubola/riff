<div align="center">

<img src="store-assets/icon-512.png" width="96" height="96" alt="Riff logo" />

# riff

**Clip a passage, a video moment, or a podcast beat. Add your take. Keep the source attached.**

A Chrome side-panel extension for commenting on other people's work without stealing it.

[Install](#install) · [Features](#features) · [Architecture](#architecture) · [Privacy](#privacy--permissions) · [Roadmap](#roadmap)

</div>

---

## Why

Commentary on other people's work is one of the internet's biggest content categories, and it still runs on screenshots and screen recordings — a crop tool, a caption app, and no attribution. Riff makes the honest version faster than the dishonest one: clip, quote, comment, and the source link travels with it permanently.

## Features

- **Clip from anywhere** — highlight text on any page, or right-click a video/audio element to grab up to 90 seconds at the current timestamp
- **YouTube-aware** — reads the real video title, channel, and playhead position automatically
- **Text or voice commentary** — write your take or record a voice note (up to 90s) right in the panel
- **A real local archive** — search, sort (newest/oldest/A–Z), filter by kind or pin, and a clickable tag system with a full tag manager (rename/delete across your whole archive)
- **Bulk actions** — multi-select mode for bulk tagging, copying, or deleting (with undo)
- **Detail view** — tap any card to read the full quote/comment instead of a truncated preview
- **Undo everywhere** — deletes (single or bulk) show a 5-second undo toast instead of a hard confirm
- **Exportable landing pages** — turn any clip into a real, self-contained HTML page; YouTube clips embed the platform's own official player at your timestamp rather than re-hosting anything
- **Draft autosave** — an in-progress capture is never lost if you navigate away before saving
- **Deep settings** — theme, 5 accent colors, compact/comfortable density, capture defaults, JSON import/export, and archive stats
- **Keyboard-first** — global shortcut to open the panel, a shortcut to riff the current selection, and in-panel shortcuts (`/` to search, `N` for a new riff, `Esc` to back out)

## Install

### From source (Developer mode)

1. Clone or download this repo
2. Open `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select the `riff/` folder
5. Pin it from the extensions toolbar menu

No build step — it's a plain Manifest V3 extension, zero dependencies, zero bundler.

### From the Chrome Web Store

_Not yet published — see the [publishing checklist](#publishing-checklist) below._

## Using it

| Action | How |
|---|---|
| Riff a passage | Highlight text → right-click → **Riff this selection** (or `Ctrl/Cmd+Shift+K`) |
| Riff a video/podcast moment | Right-click the player → **Riff this moment** |
| Riff the current tab | Open the panel → **New** → **Capture this tab** |
| Add commentary | Write it, or record a voice note, in the composer |
| Organize | Tag clips, click any tag to filter, pin the ones that matter |
| Bulk-manage | Feed → select icon → multi-select → tag/copy/delete |
| Publish a clip | Card menu → **Export landing page** → downloads a real, shareable HTML file |

## Architecture

```
riff/
├── manifest.json          MV3 manifest — side panel, context menus, commands
├── background.js          Service worker: menus, capture, side-panel wiring
├── icons/                 Extension icons (16/32/48/128)
└── sidepanel/
    ├── index.html          Shell: header, search, filters, tab bar
    ├── styles.css           Design tokens + every component style
    ├── app.js               View state, rendering, all event handling
    ├── db.js                chrome.storage.local data layer
    ├── icons.js              Local hand-authored SVG icon set
    └── landing.js            Exportable landing-page HTML generator
```

**Capture pipeline.** `background.js` injects a small, self-contained function into the active tab via `chrome.scripting.executeScript` on demand — there is no always-on content script. It reads the current selection, or a `<video>`/`<audio>` element's playhead, plus `og:` metadata and the favicon, and hands it to the side panel as a "pending capture."

**Storage.** Everything — clips, settings, voice-note audio as base64, in-progress drafts — lives in `chrome.storage.local`, on-device, under the `unlimitedStorage` permission. Nothing is uploaded anywhere; this build has no server.

**Copyright posture.** Exported landing pages never re-host media. YouTube clips cue the platform's own official `<iframe>` embed at the clipped timestamp; everything else links back to the source with a plain-text timestamp.

## Privacy & permissions

| Permission | Why |
|---|---|
| `sidePanel` | The core UI surface |
| `storage`, `unlimitedStorage` | Your local archive, including voice notes |
| `scripting`, `activeTab`, `host_permissions: <all_urls>` | Read the page you're capturing from (title, favicon, selection, media playhead) — only runs when you trigger a capture |
| `contextMenus` | The right-click "Riff this…" actions |
| `tabs` | Find the active tab to capture from |

No accounts, no analytics, no network calls of any kind. Clear your archive any time from **Settings → Clear all riffs**.

## Publishing checklist

See the full pre-submission checklist in-repo at [`PUBLISHING_CHECKLIST.md`](./PUBLISHING_CHECKLIST.md) before uploading to the Chrome Web Store — it covers manifest requirements, store listing assets, the privacy practices tab, and a functional smoke test.

## Roadmap

- Real backend: accounts, hosted public landing pages, a cross-user feed (this build intentionally ships the client only — see the extension's in-app Settings for the reasoning)
- On-device or server-side transcription for searchable video/audio clips
- Collections/folders as a structural layer above tags

## License

MIT — see [`LICENSE`](./LICENSE).

## Contributing

Issues and PRs welcome. This is a plain-JS, zero-build codebase on purpose — please keep new code framework-free and dependency-free unless there's a strong reason otherwise.
