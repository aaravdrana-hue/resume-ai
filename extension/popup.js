// Resume — popup controller.

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

function timeAgo(ts) {
  if (!ts) return "";
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return `${Math.floor(hrs / 24)} day${hrs < 48 ? "" : "s"} ago`;
}

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

function renderPoint(point, generatedAt) {
  const remembers = Array.isArray(point.remembers) ? point.remembers : [];

  // Packet assembly: each section settles 60ms after the one before it,
  // rising 6px with its blur clearing.
  // Returns only the delay, so callers own their own class list (an element
  // with two `class` attributes silently drops the second one).
  let step = 0;
  const delay = () => `style="animation-delay:${step++ * 60}ms"`;

  $("body").innerHTML = `
    <div class="panel">
      <div class="settle" ${delay()}>
        <div class="t-display title">${escapeHtml(point.title ?? "Untitled task")}</div>
        <div class="time t-mono">${timeAgo(generatedAt)}${
          point.saved === false ? " · unsaved" : ""
        }</div>
      </div>

      <section class="settle" ${delay()}>
        <div class="t-label">You were working on</div>
        <div class="working t-body">${escapeHtml(point.workingOn ?? "")}</div>
      </section>

      ${
        remembers.length
          ? `<section class="settle" ${delay()}>
               <div class="t-label">Resume remembers</div>
               <ul class="t-body">${remembers
                 .map((r) => `<li>${escapeHtml(r)}</li>`)
                 .join("")}</ul>
             </section>`
          : ""
      }

      <section class="next settle" ${delay()}>
        <div class="t-label">Next step</div>
        <p>${escapeHtml(point.nextStep ?? "")}</p>
      </section>
    </div>`;

  $("resume").hidden = false;
}

function renderEmpty(bufferCount) {
  $("body").innerHTML = `<div class="empty t-body settle">${
    bufferCount
      ? `Watching your work — ${bufferCount} signal${bufferCount === 1 ? "" : "s"} captured. Save a Resume Point whenever you're about to switch away.`
      : "Nothing captured yet. Browse a few pages and copy something, then come back."
  }</div>`;
  $("resume").hidden = true;
}

// The Save button should only invite a click when there's something new to
// save. After a save the buffer is empty, so we disable it and say why —
// rather than letting the user click into a "Nothing captured yet" error.
function syncSaveButton(bufferCount) {
  const btn = $("generate");
  const { MIN_ACTIVITIES } = globalThis.RESUME_CONFIG;

  if (bufferCount === 0) {
    btn.disabled = true;
    btn.textContent = "Watching for new activity…";
    return;
  }

  btn.disabled = false;
  btn.textContent =
    bufferCount < MIN_ACTIVITIES
      ? `Save Resume Point (${bufferCount})`
      : "Save Resume Point";
}

function showError(msg) {
  $("error").textContent = msg;
  $("error").hidden = false;
}

async function refresh() {
  const state = await send({ type: "state" });
  $("count").textContent = state.buffer.length
    ? `${state.buffer.length} captured`
    : "";
  $("auto").checked = state.autoEnabled;
  $("device").textContent = state.deviceId ?? "";

  if (state.lastResumePoint) {
    renderPoint(state.lastResumePoint, state.lastGeneratedAt);
  } else {
    renderEmpty(state.buffer.length);
  }

  syncSaveButton(state.buffer.length);

  // Clear the "I acted on my own" nudge once it's been seen.
  chrome.action.setBadgeText({ text: state.buffer.length ? String(state.buffer.length) : "" });
}

$("generate").addEventListener("click", async () => {
  const btn = $("generate");
  btn.disabled = true;
  btn.textContent = "Thinking…";
  $("error").hidden = true;

  const result = await send({ type: "generate" });

  if (result?.error) {
    btn.disabled = false;
    btn.textContent = "Save Resume Point";
    showError(result.error);
    return;
  }

  // refresh() repaints the card and puts the button into its
  // "Watching for new activity…" state, since the buffer is now empty.
  await refresh();
});

// Reopen everything you were looking at — the §4 magic moment.
$("resume").addEventListener("click", async () => {
  const { lastResumePoint } = await send({ type: "state" });
  const captured = lastResumePoint?.capturedFrom ?? [];

  const urls = [...new Set(captured.map((a) => a.url).filter(Boolean))].slice(0, 6);
  for (const url of urls) {
    chrome.tabs.create({ url, active: false });
  }
  window.close();
});

$("auto").addEventListener("change", (e) =>
  send({ type: "setAuto", value: e.target.checked })
);

refresh();
