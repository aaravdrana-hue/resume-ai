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
    switchCount: 0, // tab switches since the bubble was last shown/dismissed
    bubbleMutedUntil: 0,
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

// --- the return bubble ------------------------------------------------------

const SWITCHES_BEFORE_BUBBLE = 2;
const BUBBLE_MUTE_MS = 3 * 60 * 1000; // after a dismiss, stay quiet a while

// Count tab switches. Once you've bounced a couple of times AND we have
// something worth handing back, surface the bubble on the page you landed on.
async function maybeShowBubble(tabId) {
  const state = await getState();
  if (!state.lastResumePoint) return;
  if (Date.now() < state.bubbleMutedUntil) return;

  const switchCount = state.switchCount + 1;
  await setState({ switchCount });
  if (switchCount < SWITCHES_BEFORE_BUBBLE) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["bubble.js"],
    });
    // The script announces itself with `bubbleReady`; we answer with the point.
    await chrome.tabs.sendMessage(tabId, {
      type: "bubbleData",
      point: state.lastResumePoint,
    });
    await setState({ switchCount: 0 });
  } catch {
    // Restricted page (chrome://, the Web Store, a PDF viewer). Nothing to do.
  }
}

// Reopen the tabs captured alongside the displayed Resume Point.
async function reopenCaptured() {
  const { lastResumePoint } = await getState();
  const captured = lastResumePoint?.capturedFrom ?? [];
  const urls = [...new Set(captured.map((a) => a.url).filter(Boolean))].slice(0, 6);
  for (const url of urls) await chrome.tabs.create({ url, active: false });
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

// Clicking the toolbar icon opens the side panel instead of a popup.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.error("[Resume] sidePanel setup failed:", e));
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !isCapturable(tab.url)) return;

  const host = hostOf(tab.url);
  await maybeAutoGenerate(host);
  await record({ type: "tab_switch", title: tab.title, url: tab.url });
  await setState({ lastHost: host });
  await maybeShowBubble(tabId);
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

    if (msg.type === "bubbleReady") {
      const { lastResumePoint } = await getState();
      if (sender.tab?.id) {
        chrome.tabs
          .sendMessage(sender.tab.id, { type: "bubbleData", point: lastResumePoint })
          .catch(() => {});
      }
      return sendResponse({ ok: true });
    }

    if (msg.type === "bubbleDismissed") {
      await setState({ switchCount: 0, bubbleMutedUntil: Date.now() + BUBBLE_MUTE_MS });
      return sendResponse({ ok: true });
    }

    if (msg.type === "reopen") {
      await reopenCaptured();
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
