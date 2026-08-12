<div align="center">

<img src="assets/logo.png" width="96" height="96" alt="Riff logo" />

# riff

**Clip a passage, a video moment, or a podcast beat. Add your take. Keep the source attached.**

A Chrome side-panel extension for commenting on other people's work without stealing it.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-2342f5.svg)](./manifest.json)
[![No dependencies](https://img.shields.io/badge/dependencies-zero-1f9d63.svg)](#architecture)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-d97e1f.svg)](./CONTRIBUTING.md)

[Install](#install) · [Features](#features) · [Architecture](#architecture) · [Privacy](#privacy--permissions) · [Contributing](#contributing) · [Roadmap](#roadmap)

</div>

---

## Why

Commentary on other people's work is one of the internet's biggest content categories, and it still runs on screenshots and screen recordings — a crop tool, a caption app, and no attribution. Riff makes the honest version faster than the dishonest one: clip, quote, comment, and the source link travels with it permanently.

## Features

**Capture**
- Highlight text on any page, or right-click a video/audio element to grab up to 90 seconds at the current timestamp
- YouTube-aware — reads the real video title, channel, and playhead position automatically
- Text or voice commentary, recorded right in the panel
- Duplicate-source detection warns you if you've already riffed a URL before

**Organize**
- Search, sort (newest/oldest/A–Z), filter by kind or pin
- A real tag system — click any tag to filter, rename or delete a tag across your whole archive from Settings, with live autocomplete while typing
- **Archive** — soft-hide a riff without deleting it; nothing is ever destructive without an undo
- Bulk actions — multi-select mode for bulk tagging, archiving, copying, or deleting
- Related clips — the detail view surfaces other riffs from the same source
- Keyboard navigation — arrow keys move through the feed, Enter opens the highlighted card

**Share**
- Every clip exports to a real, self-contained HTML landing page — YouTube clips embed the platform's own official player at your timestamp rather than re-hosting anything
- Copy any riff (or a whole selection) as plain text

**Everything else**
- Draft autosave — an in-progress capture is never lost if you navigate away before saving
- Deep settings — theme, 5 accent colors, compact/comfortable density, capture defaults, JSON import/export, archive stats, tag management
- A one-time welcome banner on first run, dismissible, never nagging again
- Full keyboard control: global shortcut to open the panel, a shortcut to riff the current selection, and in-panel shortcuts (`/` search, `N` new riff, arrows to navigate, `Esc` to back out)
- Accessible by construction — every icon-only control carries a real `aria-label`, not just a tooltip

## Install

### From source (Developer mode)

1. Clone this repo
2. Open `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select the repo folder
5. Pin it from the extensions toolbar menu

No build step — it's a plain Manifest V3 extension, zero dependencies, zero bundler.

### From the Chrome Web Store

_Not yet published — see [`PUBLISHING_CHECKLIST.md`](./PUBLISHING_CHECKLIST.md) for the pre-submission checklist._

## Using it

| Action | How |
|---|---|
| Riff a passage | Highlight text → right-click → **Riff this selection** (or `Ctrl/Cmd+Shift+K`) |
| Riff a video/podcast moment | Right-click the player → **Riff this moment** |
| Riff the current tab | Open the panel → **New** → **Capture this tab** |
| Add commentary | Write it, or record a voice note, in the composer |
| Organize | Tag clips, click any tag to filter, pin the ones that matter |
| Declutter without deleting | Card menu → **Archive** |
| Bulk-manage | Feed → select icon → multi-select → tag/archive/copy/delete |
| Publish a clip | Card menu → **Export landing page** → downloads a real, shareable HTML file |
| Move fast | `/` to search, `N` for new, arrows + Enter to browse the feed |

## Architecture

<img src="docs/architecture.svg" alt="Riff architecture: a web page feeds a capture through background.js into the side panel, which reads and writes chrome.storage.local and can export a self-contained HTML landing page" width="100%" />

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

**Why zero dependencies.** No framework, no bundler, no npm packages. Every file loads directly in the browser as-is. This keeps the entire codebase auditable in one sitting and makes "load unpacked" always work with no build step — a deliberate trade-off for a small, security-sensitive browser extension.

## Privacy & permissions

| Permission | Why |
|---|---|
| `sidePanel` | The core UI surface |
| `storage`, `unlimitedStorage` | Your local archive, including voice notes |
| `scripting`, `activeTab`, `host_permissions: <all_urls>` | Read the page you're capturing from (title, favicon, selection, media playhead) — only runs when you trigger a capture |
| `contextMenus` | The right-click "Riff this…" actions |
| `tabs` | Find the active tab to capture from |

No accounts, no analytics, no network calls of any kind. Clear your archive any time from **Settings → Clear all riffs**.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to get set up (there's nothing to install), coding conventions, and how to submit a PR. Please also read the [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

Found a security issue? Please follow [`SECURITY.md`](./SECURITY.md) instead of opening a public issue.

## Publishing checklist

See [`PUBLISHING_CHECKLIST.md`](./PUBLISHING_CHECKLIST.md) before uploading a new version to the Chrome Web Store — manifest requirements, store listing assets, the privacy practices tab, and a full manual smoke test.

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md) for release history.

## Roadmap

- Real backend: accounts, hosted public landing pages, a cross-user feed (this build intentionally ships the client only)
- On-device or server-side transcription for searchable video/audio clips
- Collections/folders as a structural layer above tags

## License

MIT — see [`LICENSE`](./LICENSE).
