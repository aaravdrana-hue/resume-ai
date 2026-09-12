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

  $("body").innerHTML = `
    <div class="card">
      <div class="title">${escapeHtml(point.title ?? "Untitled task")}</div>
      <div class="time">${timeAgo(generatedAt)}${point.saved === false ? " · not saved to DB" : ""}</div>

      <div class="label">You were working on</div>
      <div class="working">${escapeHtml(point.workingOn ?? "")}</div>

      ${
        remembers.length
          ? `<div class="label">Resume remembers</div>
             <ul>${remembers.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
          : ""
      }

      <div class="next">
        <div class="label">Next step</div>
        <p>${escapeHtml(point.nextStep ?? "")}</p>
      </div>
    </div>`;

  $("resume").hidden = false;
}

function renderEmpty(bufferCount) {
  $("body").innerHTML = `<div class="empty">${
    bufferCount
      ? `Watching your work — ${bufferCount} signal${bufferCount === 1 ? "" : "s"} captured. Save a Resume Point whenever you're about to switch away.`
      : "Nothing captured yet. Browse a few pages and copy something, then come back."
  }</div>`;
  $("resume").hidden = true;
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

  // Clear the "I acted on my own" nudge once it's been seen.
  chrome.action.setBadgeText({ text: state.buffer.length ? String(state.buffer.length) : "" });
}

$("generate").addEventListener("click", async () => {
  const btn = $("generate");
  btn.disabled = true;
  btn.textContent = "Thinking…";
  $("error").hidden = true;

  const result = await send({ type: "generate" });

  btn.disabled = false;
  btn.textContent = "Save Resume Point";

  if (result?.error) {
    showError(result.error);
    return;
  }
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
