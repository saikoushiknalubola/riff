// Riff — local data layer
// Everything Riff stores lives in chrome.storage.local, on-device only.
// There is no server in this build; "publish" actions produce a
// self-contained file the user controls, rather than sending data anywhere.

const CLIPS_KEY = "riffClips";
const SETTINGS_KEY = "riffSettings";

const DEFAULT_SETTINGS = {
  theme: "system", // "light" | "dark" | "system"
  accentColor: "indigo", // indigo | violet | emerald | amber | rose
  density: "comfortable", // comfortable | compact
  defaultDurationCap: 90,
  defaultClipLength: 30,
  defaultCommentKind: "text", // text | voice
  hasSeenWelcome: false,
};

function uid() {
  return "rf_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
}

async function getAllClips() {
  const { [CLIPS_KEY]: clips } = await chrome.storage.local.get(CLIPS_KEY);
  return Array.isArray(clips) ? clips : [];
}

async function saveAllClips(clips) {
  await chrome.storage.local.set({ [CLIPS_KEY]: clips });
}

async function createClip(partial) {
  const clips = await getAllClips();
  const clip = {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pinned: false,
    archived: false,
    tags: [],
    kind: "text", // text | video | audio
    source: { url: "", title: "", siteName: "", favicon: "", author: null },
    quote: "",
    mediaTitle: "",
    channel: "",
    startSeconds: 0,
    endSeconds: null,
    totalDuration: null,
    comment: { kind: "text", text: "", audioDataUrl: null, audioDurationSeconds: null },
    ...partial,
  };
  clips.unshift(clip);
  await saveAllClips(clips);
  return clip;
}

async function updateClip(id, patch) {
  const clips = await getAllClips();
  const idx = clips.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  clips[idx] = { ...clips[idx], ...patch, updatedAt: new Date().toISOString() };
  await saveAllClips(clips);
  return clips[idx];
}

async function deleteClip(id) {
  const clips = await getAllClips();
  const next = clips.filter((c) => c.id !== id);
  await saveAllClips(next);
  return next;
}

async function restoreClip(clip) {
  const clips = await getAllClips();
  clips.unshift(clip);
  await saveAllClips(clips);
  return clips;
}

async function togglePin(id) {
  const clips = await getAllClips();
  const clip = clips.find((c) => c.id === id);
  if (!clip) return null;
  clip.pinned = !clip.pinned;
  clip.updatedAt = new Date().toISOString();
  await saveAllClips(clips);
  return clip;
}

async function toggleArchive(id) {
  const clips = await getAllClips();
  const clip = clips.find((c) => c.id === id);
  if (!clip) return null;
  clip.archived = !clip.archived;
  if (clip.archived) clip.pinned = false;
  clip.updatedAt = new Date().toISOString();
  await saveAllClips(clips);
  return clip;
}

async function getSettings() {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

async function getPendingCapture() {
  const { riffPendingCapture } = await chrome.storage.session.get("riffPendingCapture");
  return riffPendingCapture || null;
}

async function clearPendingCapture() {
  await chrome.storage.session.remove("riffPendingCapture");
}

async function usageEstimate() {
  const bytes = await chrome.storage.local.getBytesInUse(CLIPS_KEY);
  return bytes;
}

async function exportAllData() {
  const clips = await getAllClips();
  const settings = await getSettings();
  return { exportedAt: new Date().toISOString(), settings, clips };
}

async function wipeAllClips() {
  await saveAllClips([]);
}

function allTagsWithCounts(clips) {
  const counts = new Map();
  clips.forEach((c) => (c.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

async function renameTagEverywhere(oldTag, newTag) {
  const clips = await getAllClips();
  const clean = newTag.trim();
  if (!clean) return clips;
  clips.forEach((c) => {
    if (!c.tags) return;
    const has = c.tags.includes(oldTag);
    if (!has) return;
    const set = new Set(c.tags.filter((t) => t !== oldTag));
    set.add(clean);
    c.tags = [...set];
  });
  await saveAllClips(clips);
  return clips;
}

async function deleteTagEverywhere(tag) {
  const clips = await getAllClips();
  clips.forEach((c) => {
    if (!c.tags) return;
    c.tags = c.tags.filter((t) => t !== tag);
  });
  await saveAllClips(clips);
  return clips;
}

async function importClips(incomingClips) {
  const existing = await getAllClips();
  const existingIds = new Set(existing.map((c) => c.id));
  let added = 0;
  incomingClips.forEach((c) => {
    if (!c || !c.id || existingIds.has(c.id)) return;
    existing.unshift(c);
    existingIds.add(c.id);
    added += 1;
  });
  await saveAllClips(existing);
  return { clips: existing, added };
}

const DRAFT_KEY = "riffDraftInProgress";

async function saveDraftInProgress(draft) {
  await chrome.storage.local.set({ [DRAFT_KEY]: draft });
}

async function getDraftInProgress() {
  const { [DRAFT_KEY]: draft } = await chrome.storage.local.get(DRAFT_KEY);
  return draft || null;
}

async function clearDraftInProgress() {
  await chrome.storage.local.remove(DRAFT_KEY);
}

export {
  uid,
  getAllClips,
  saveAllClips,
  createClip,
  updateClip,
  deleteClip,
  restoreClip,
  togglePin,
  toggleArchive,
  getSettings,
  saveSettings,
  getPendingCapture,
  clearPendingCapture,
  usageEstimate,
  exportAllData,
  wipeAllClips,
  allTagsWithCounts,
  renameTagEverywhere,
  deleteTagEverywhere,
  importClips,
  saveDraftInProgress,
  getDraftInProgress,
  clearDraftInProgress,
};
