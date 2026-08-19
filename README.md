<div align="center">

<!--
  Before publishing: this file has two placeholder URLs to update —
  the Validate badge below, and GITHUB_URL near the bottom of site/index.html.
  Search this repo for "YOUR-USERNAME" to find both.
-->

<img src="assets/logo.png" width="96" height="96" alt="Riff logo" />

# riff

**Clip a passage, a video moment, or a podcast beat. Add your take. Keep the source attached.**

A Chrome side-panel extension for commenting on other people's work without stealing it.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.3.1-2342f5.svg)](./CHANGELOG.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-2342f5.svg)](./manifest.json)
[![No dependencies](https://img.shields.io/badge/dependencies-zero-1f9d63.svg)](#architecture)
[![Validate](https://github.com/YOUR-USERNAME/riff/actions/workflows/validate.yml/badge.svg)](./.github/workflows/validate.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-d97e1f.svg)](./CONTRIBUTING.md)

[Install](#install) · [Features](#features) · [Architecture](#architecture) · [Privacy](#privacy--permissions) · [Contributing](#contributing) · [Roadmap](#roadmap) · [Landing page](./site/index.html)

</div>

---

## Contents

- [Why](#why)
- [Screenshots](#screenshots)
- [Features](#features)
- [Install](#install)
- [Using it](#using-it)
- [How it compares](#how-it-compares)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Privacy & permissions](#privacy--permissions)
- [Browser support](#browser-support)
- [FAQ](#faq)
- [Contributing](#contributing)
- [Publishing checklist](#publishing-checklist)
- [Changelog](#changelog)
- [Roadmap](#roadmap)
- [License](#license)

## Why

Commentary on other people's work is one of the internet's biggest content categories, and it still runs on screenshots and screen recordings — a crop tool, a caption app, and no attribution. Riff makes the honest version faster than the dishonest one: clip, quote, comment, and the source link travels with it permanently.

## Screenshots

<img src="assets/screenshot-feed.png" alt="Riff's Feed view: a pinned text riff from The Atlantic, a YouTube clip with a timestamp badge, and an Overcast podcast clip, each with a comment and tags" width="360" />

The Feed — pinned riffs float to the top, each card shows its kind (text, video, audio) by a small color dot, and comments sit right under the source. See it running for real in the [interactive demo](#install) or the [landing page](./site/index.html).

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

## How it compares

Riff sits in a specific gap. Worth being straight about where it overlaps with existing tools and where it doesn't:

| | Clips other people's content | Attribution travels with it | Cross-medium (text + video + audio) | Lives in your browser, no account |
|---|:---:|:---:|:---:|:---:|
| **Riff** | ✅ | ✅ | ✅ | ✅ |
| Genius | ✅ (text only, historically) | Only inside Genius | ❌ | ❌ (accounts, hosted) |
| OpusClip / Descript | ❌ (repurposes *your own* content) | — | Video-focused | ❌ (accounts, hosted) |
| Readwise / Hypothesis | ✅ | ✅ | Text-focused | ❌ (accounts, hosted) |
| X quote posts / Community Notes | ✅ | Only inside X | ❌ | Requires the platform |

The honest summary: Genius proved people want to annotate the web and lost the distribution fight because annotations only ever lived on Genius. Riff is a browser extension on purpose — no server means no platform to lose the fight for, but it also means no public feed (yet — see [Roadmap](#roadmap)).

## Architecture

<img src="docs/architecture.svg" alt="Riff architecture: a web page feeds a capture through background.js into the side panel, which reads and writes chrome.storage.local and can export a self-contained HTML landing page" width="100%" />

```
riff/
├── manifest.json          MV3 manifest — side panel, context menus, commands
├── background.js          Service worker: menus, capture, side-panel wiring
├── icons/                 Extension icons (16/32/48/128) — the runtime package
├── sidepanel/
│   ├── index.html          Shell: header, search, filters, tab bar
│   ├── styles.css           Design tokens + every component style
│   ├── app.js                View state, rendering, all event handling
│   ├── db.js                 chrome.storage.local data layer
│   ├── icons.js               Local hand-authored SVG icon set
│   └── landing.js              Exportable landing-page HTML generator
│
├── site/                  Marketing landing page (not part of the extension package)
├── docs/                   architecture.svg — the diagram above
├── assets/                 Logo + README screenshots
├── store-assets/           Chrome Web Store listing images
└── .github/                Issue/PR templates, CI workflow
```

Only `manifest.json`, `background.js`, `icons/`, and `sidepanel/` ship inside the actual extension zip — everything else is repo-only tooling and marketing, and is excluded when packaging for the Chrome Web Store (see [`PUBLISHING_CHECKLIST.md`](./PUBLISHING_CHECKLIST.md)).

**Capture pipeline.** `background.js` injects a small, self-contained function into the active tab via `chrome.scripting.executeScript` on demand — there is no always-on content script. It reads the current selection, or a `<video>`/`<audio>` element's playhead, plus `og:` metadata and the favicon, and hands it to the side panel as a "pending capture."

**Storage.** Everything — clips, settings, voice-note audio as base64, in-progress drafts — lives in `chrome.storage.local`, on-device, under the `unlimitedStorage` permission. Nothing is uploaded anywhere; this build has no server.

**Copyright posture.** Exported landing pages never re-host media. YouTube clips cue the platform's own official `<iframe>` embed at the clipped timestamp; everything else links back to the source with a plain-text timestamp.

**Why zero dependencies.** No framework, no bundler, no npm packages. Every file loads directly in the browser as-is. This keeps the entire codebase auditable in one sitting and makes "load unpacked" always work with no build step — a deliberate trade-off for a small, security-sensitive browser extension.

## Data model

Every riff is one JSON object in the array stored under `chrome.storage.local`'s `riffClips` key (see `sidepanel/db.js`). Roughly:

```js
{
  id: "rf_m3x9k2_a1b2c3d",       // generated, not sequential
  kind: "text" | "video" | "audio",
  createdAt: "2026-08-14T09:12:00.000Z",
  updatedAt: "2026-08-14T09:12:00.000Z",
  pinned: false,
  archived: false,
  tags: ["media", "attribution"],

  source: {
    url: "https://example.com/article",
    title: "Article title",
    siteName: "Example",
    favicon: "https://example.com/favicon.ico",
    author: null,               // when the page exposes one
  },

  // text clips:
  quote: "The quoted passage.",

  // video/audio clips:
  mediaTitle: "Video or episode title",
  channel: "Creator or channel name",
  startSeconds: 1452,
  endSeconds: 1497,             // capped to a 90-second span
  totalDuration: 5820,          // null if unknown

  comment: {
    kind: "text" | "voice",
    text: "Your take, if written",
    audioDataUrl: null,          // base64 data: URL if recorded
    audioDurationSeconds: null,
  },
}
```

No formal migration system exists yet — new boolean fields (like `archived`, added in 1.2.0) rely on `undefined` being falsy, so older stored clips without the field behave correctly without a migration step (`!clip.archived` is `true` when the field was never set). That works for simple flags; it won't work for fields that need a real default value, so if you add one of those, backfill it explicitly rather than assuming.

## Privacy & permissions

| Permission | Why |
|---|---|
| `sidePanel` | The core UI surface |
| `storage`, `unlimitedStorage` | Your local archive, including voice notes |
| `scripting`, `activeTab`, `host_permissions: <all_urls>` | Read the page you're capturing from (title, favicon, selection, media playhead) — only runs when you trigger a capture |
| `contextMenus` | The right-click "Riff this…" actions |
| `tabs` | Find the active tab to capture from |

No accounts, no analytics, no network calls of any kind. Clear your archive any time from **Settings → Clear all riffs**.

## Browser support

Built and tested against Chrome (Manifest V3, side panel API — needs Chrome 114+). It should load fine in any Chromium-based browser with side panel support (Edge, Brave, Opera) since there's nothing Chrome-specific beyond standard `chrome.*` extension APIs, but only Chrome is actively tested. Firefox and Safari use different extension APIs entirely and aren't supported.

## FAQ

**Does my data leave my browser?**
No. There's no server in this build. Everything — clips, tags, settings, voice-note audio — lives in `chrome.storage.local` on your device. See [Privacy & permissions](#privacy--permissions).

**What happens to my riffs if I uninstall the extension?**
Chrome deletes the extension's storage along with it. Export your archive first (Settings → Export as JSON) if you want to keep it — you can re-import that file after reinstalling.

**Can other people see what I riff?**
No. There's no account and no public feed in this build. The only way a riff leaves your device is if you explicitly export it (a landing page HTML file, a JSON backup, or copied text).

**Does exporting a clip download or re-host the video?**
No. YouTube clips embed YouTube's own official player at your timestamp. Nothing is downloaded or re-hosted — see [Copyright posture](#architecture).

**Why isn't this on the Chrome Web Store yet?**
It's a checklist away — see [`PUBLISHING_CHECKLIST.md`](./PUBLISHING_CHECKLIST.md) for exactly what's left (mainly: real screenshots and a hosted privacy policy).

**Why no npm packages at all, not even something small?**
It's a deliberate constraint, not an oversight — see [Why zero dependencies](#architecture). Load-unpacked-and-it-just-works is worth more here than convenience during development.

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
