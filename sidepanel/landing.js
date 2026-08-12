// Riff — landing page generator
// Produces a single self-contained HTML file per clip: the local stand-in
// for the "public landing page" described in the product spec. It never
// re-hosts source video/audio — for YouTube it cues the platform's own
// official embed at the clipped timestamp; everything else links back to
// the source with a plain-text timestamp. Downscaling/re-hosting a ripped
// file is deliberately out of scope for the same reason it's flagged as a
// risk in the product brief.

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrlForExport(url) {
  if (!url) return "#";
  try {
    const parsed = new URL(url, "https://example.invalid/");
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch {
    return "#";
  }
  return "#";
}

function fmt(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function youTubeIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    return null;
  }
  return null;
}

function buildLandingPageHTML(clip) {
  const isYouTube = clip.kind === "video" && /youtube\.com|youtu\.be/.test(clip.source?.url || "");
  const videoId = isYouTube ? youTubeIdFromUrl(clip.source.url) : null;

  let mediaBlock = "";
  if (clip.kind === "text") {
    mediaBlock = `<blockquote class="quote">&ldquo;${esc(clip.quote)}&rdquo;</blockquote>`;
  } else if (videoId) {
    mediaBlock = `
      <div class="embed">
        <iframe
          src="https://www.youtube.com/embed/${esc(videoId)}?start=${Math.floor(clip.startSeconds || 0)}&rel=0"
          title="${esc(clip.mediaTitle)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      <p class="media-caption">${esc(clip.mediaTitle)} &middot; ${fmt(clip.startSeconds)}&ndash;${fmt(clip.endSeconds)}${clip.channel ? ` &middot; ${esc(clip.channel)}` : ""}</p>
    `;
  } else {
    mediaBlock = `
      <a class="media-link" href="${esc(safeUrlForExport(clip.source.url))}" target="_blank" rel="noopener noreferrer">
        <span class="media-link-icon">&#9654;</span>
        <span>
          <strong>${esc(clip.mediaTitle || "Listen to the clipped moment")}</strong>
          <small>${fmt(clip.startSeconds)}&ndash;${fmt(clip.endSeconds)} on ${esc(clip.source.siteName || "the original source")}</small>
        </span>
      </a>
    `;
  }

  const commentBlock =
    clip.comment?.kind === "voice" && clip.comment.audioDataUrl
      ? `<div class="comment"><audio controls src="${esc(clip.comment.audioDataUrl)}"></audio></div>`
      : clip.comment?.text
        ? `<p class="comment-text">${esc(clip.comment.text)}</p>`
        : "";

  const tags = (clip.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(clip.mediaTitle || clip.quote?.slice(0, 60) || "A riff")} — Riff</title>
<meta name="robots" content="noindex" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#12141c; --paper:#f7f7f4; --card:#ffffff; --line:#e7e6e1;
    --muted:#6b6f76; --signal:#2451ff; --video:#7c5cff; --audio:#e08a2c;
  }
  *{box-sizing:border-box;}
  body{
    margin:0; background:var(--paper); color:var(--ink);
    font-family:"Plus Jakarta Sans", system-ui, sans-serif;
    display:flex; justify-content:center; padding:48px 20px;
    line-height:1.5;
  }
  .page{ width:100%; max-width:640px; }
  .brand{ display:flex; align-items:center; gap:8px; margin-bottom:32px; font-weight:800; letter-spacing:-0.02em; color:var(--ink); text-decoration:none; }
  .brand-mark{ width:22px; height:22px; border-radius:6.5px; background:linear-gradient(165deg,#2451ff,#1a35c4); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-style:italic; font-size:12px; }
  .card{ background:var(--card); border:1px solid var(--line); border-radius:20px; padding:32px; }
  .source-row{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); margin-bottom:18px; }
  .source-row img{ width:16px; height:16px; border-radius:4px; }
  .source-row a{ color:var(--muted); text-decoration:none; border-bottom:1px solid var(--line); }
  .quote{ font-size:22px; font-weight:600; line-height:1.45; margin:0 0 20px; padding-left:18px; border-left:3px solid var(--signal); }
  .embed{ position:relative; padding-top:56.25%; border-radius:12px; overflow:hidden; background:#000; margin-bottom:10px; }
  .embed iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; }
  .media-caption{ font-size:13px; color:var(--muted); margin:0 0 20px; }
  .media-link{ display:flex; align-items:center; gap:14px; padding:16px; border:1px solid var(--line); border-radius:14px; text-decoration:none; color:var(--ink); margin-bottom:20px; }
  .media-link-icon{ width:36px; height:36px; border-radius:50%; background:var(--audio); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .media-link strong{ display:block; font-size:15px; }
  .media-link small{ color:var(--muted); font-family:"IBM Plex Mono", monospace; font-size:12px; }
  .comment-text{ font-size:16px; color:var(--ink); background:#f2f3fb; border-radius:12px; padding:16px 18px; margin:0 0 18px; }
  .comment audio{ width:100%; margin-bottom:18px; }
  .tags{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:22px; }
  .tag{ font-size:12px; color:var(--muted); background:var(--paper); border:1px solid var(--line); padding:4px 10px; border-radius:999px; }
  .cta-row{ display:flex; gap:10px; flex-wrap:wrap; }
  .btn{ font-family:inherit; font-size:14px; font-weight:600; border-radius:10px; padding:10px 16px; text-decoration:none; display:inline-flex; align-items:center; gap:8px; }
  .btn-primary{ background:var(--ink); color:#fff; }
  .btn-ghost{ background:transparent; color:var(--muted); border:1px solid var(--line); }
  .footer{ text-align:center; margin-top:28px; font-size:12px; color:var(--muted); }
  .footer a{ color:var(--muted); }
  @media (prefers-color-scheme: dark){
    :root{ --ink:#f2f2f0; --paper:#0f1116; --card:#171923; --line:#282b36; --muted:#8b8f9a; }
    .embed{ background:#000; }
  }
</style>
</head>
<body>
  <div class="page">
    <span class="brand">
      <span class="brand-mark">R</span>
      riff
    </span>

    <div class="card">
      <div class="source-row">
        ${clip.source?.favicon ? `<img src="${esc(clip.source.favicon)}" alt="" />` : ""}
        <span>${esc(clip.source?.siteName || "")}</span>
        <span>&middot;</span>
        <a href="${esc(safeUrlForExport(clip.source?.url))}" target="_blank" rel="noopener noreferrer">View original</a>
      </div>

      ${mediaBlock}
      ${commentBlock}

      ${tags ? `<div class="tags">${tags}</div>` : ""}

      <div class="cta-row">
        <a class="btn btn-primary" href="${esc(safeUrlForExport(clip.source?.url))}" target="_blank" rel="noopener noreferrer">Open the source</a>
        <a class="btn btn-ghost" href="mailto:?subject=${encodeURIComponent("Takedown request: " + (clip.mediaTitle || clip.quote || "a riff"))}">File a claim</a>
      </div>
    </div>

    <p class="footer">Exported from Riff &middot; every clip links back to where it came from</p>
  </div>
</body>
</html>`;
}

export { buildLandingPageHTML };
