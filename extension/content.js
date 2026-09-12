// Resume — content script.
//
// Runs in every page. Its only job is ContextClip (§8): when you copy
// something, tell the service worker what was copied and where from.
// The worker adds the URL/title and decides whether to keep it.

const MAX_COPY_LENGTH = 2000;

document.addEventListener("copy", () => {
  // Read from the selection rather than the clipboard API — no permission
  // prompt, and it's exactly what the user highlighted.
  const content = (window.getSelection()?.toString() ?? "").trim();
  if (!content) return;

  chrome.runtime.sendMessage({
    type: "copy",
    content: content.slice(0, MAX_COPY_LENGTH),
  });
});
