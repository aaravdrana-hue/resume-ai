// Resume — service worker.
//
// Captures what you're doing, buffers it, and turns it into a Resume Point
// either automatically (on a context switch / going idle) or on demand from
// the popup.
//
// MV3 service workers are killed after ~30s idle, so NOTHING lives in a
// module-scope variable — all state goes through chrome.storage.local.

importScripts("config.js");

const { API_BASE, MIN_ACTIVITIES, COOLDOWN_MS, MAX_BUFFER, IGNORED_HOSTS } =
  globalThis.RESUME_CONFIG;

// --- storage helpers --------------------------------------------------------

async function getState() {
  const defaults = {
    buffer: [],
    lastGeneratedAt: 0,
    lastHost: null,
    deviceId: null,
    lastResumePoint: null,
    autoEnabled: true,
  };
  return { ...defaults, ...(await chrome.storage.local.get(defaults)) };
}

const setState = (patch) => chrome.storage.local.set(patch);

async function getDeviceId() {
  const { deviceId } = await getState();
  if (deviceId) return deviceId;
  const fresh = `device-${crypto.randomUUID().slice(0, 8)}`;
  await setState({ deviceId: fresh });
  return fresh;
}

// --- capture ----------------------------------------------------------------

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isCapturable(url) {
  if (!url || !/^https?:/.test(url)) return false; // skips chrome://, about:, files
  const host = hostOf(url);
  return host ? !IGNORED_HOSTS.some((h) => host.includes(h)) : false;
}

async function record(activity) {
  const { buffer } = await getState();
  const next = [...buffer, { ...activity, at: Date.now() }].slice(-MAX_BUFFER);
  await setState({ buffer: next });
  await refreshBadge(next.length);
}

async function refreshBadge(count) {
  await chrome.action.setBadgeText({ text: count ? String(count) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#7C5CFF" });
}

// --- context-switch detection ----------------------------------------------

// A "context switch" = you moved to a different site than the one that
// dominates the current buffer, with enough context banked to be worth
// summarizing, and not too soon after the last Resume Point.
async function maybeAutoGenerate(newHost) {
  const state = await getState();
  if (!state.autoEnabled) return;
  if (state.buffer.length < MIN_ACTIVITIES) return;
  if (Date.now() - state.lastGeneratedAt < COOLDOWN_MS) return;

  const hosts = state.buffer.map((a) => hostOf(a.url)).filter(Boolean);
  if (!hosts.length) return;

  // Dominant host of the buffered work.
  const tally = hosts.reduce((m, h) => ({ ...m, [h]: (m[h] || 0) + 1 }), {});
  const dominant = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];

  if (newHost && newHost !== dominant) {
    await generateResumePoint("auto:context-switch");
  }
}

// --- the Resume Point -------------------------------------------------------

async function generateResumePoint(source) {
  const state = await getState();
  if (state.buffer.length === 0) {
    return { error: "Nothing captured yet. Browse a little first." };
  }

  try {
    const res = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activities: state.buffer,
        deviceId: await getDeviceId(),
        source,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || "Request failed");

    // Keep a local copy so the popup works even if the DB or network is down.
    await setState({
      lastResumePoint: { ...data, capturedFrom: state.buffer },
      lastGeneratedAt: Date.now(),
      buffer: [],
    });
    await refreshBadge(0);

    // Nudge the user when Resume acted on its own (§12).
    if (source.startsWith("auto")) {
      await chrome.action.setBadgeText({ text: "•" });
      await chrome.action.setBadgeBackgroundColor({ color: "#F5A524" });
    }

    return data;
  } catch (err) {
    console.error("[Resume] generate failed:", err);
    return { error: err.message };
  }
}

// --- event wiring -----------------------------------------------------------

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !isCapturable(tab.url)) return;

  const host = hostOf(tab.url);
  await maybeAutoGenerate(host);
  await record({ type: "tab_switch", title: tab.title, url: tab.url });
  await setState({ lastHost: host });
});

chrome.tabs.onUpdated.addListener(async (_id, info, tab) => {
  if (info.status !== "complete" || !isCapturable(tab.url)) return;
  await record({ type: "page_visit", title: tab.title, url: tab.url });
});

// Walking away is also a context switch.
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState !== "idle") return;
  const { buffer, lastGeneratedAt, autoEnabled } = await getState();
  if (!autoEnabled) return;
  if (buffer.length >= MIN_ACTIVITIES && Date.now() - lastGeneratedAt > COOLDOWN_MS) {
    await generateResumePoint("auto:idle");
  }
});

// Messages from content.js (copies) and popup.js (manual actions).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "copy") {
      if (isCapturable(sender.tab?.url)) {
        await record({
          type: "copy",
          content: msg.content,
          title: sender.tab.title,
          url: sender.tab.url,
        });
      }
      return sendResponse({ ok: true });
    }

    if (msg.type === "generate") {
      return sendResponse(await generateResumePoint("manual:popup"));
    }

    if (msg.type === "state") {
      return sendResponse(await getState());
    }

    if (msg.type === "setAuto") {
      await setState({ autoEnabled: msg.value });
      return sendResponse({ ok: true });
    }

    if (msg.type === "clear") {
      await setState({ buffer: [] });
      await refreshBadge(0);
      return sendResponse({ ok: true });
    }

    sendResponse({ error: "unknown message" });
  })();

  return true; // keep the channel open for the async reply
});
