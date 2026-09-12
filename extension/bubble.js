// Resume — the return bubble.
//
// The §12 moment. After you've bounced between tabs a couple of times, a
// small mark appears at the right edge. Click it and it expands into the
// Resume Point you left behind, in place, without leaving the page.
//
// Everything lives in a shadow root so the host page's CSS can't reach in
// and ours can't leak out.

(() => {
  const HOST_ID = "__resume_bubble_host__";
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: "closed" });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }

      .wrap {
        position: fixed;
        top: 96px;
        right: 16px;
        z-index: 2147483647;
        display: flex;
        justify-content: flex-end;
      }

      /* --- collapsed: the mark ------------------------------------- */
      .bubble {
        width: 44px; height: 44px;
        border-radius: 999px;
        background: #121614;
        border: 1px solid rgba(243,245,243,0.10);
        box-shadow: 0 12px 32px -12px rgba(0,0,0,.7);
        display: grid; place-items: center;
        cursor: pointer;
        animation: pop 420ms cubic-bezier(0.16,1,0.3,1) both;
        transition: transform 160ms cubic-bezier(0.16,1,0.3,1);
      }
      .bubble:hover { transform: scale(1.06); }
      .bubble:active { transform: scale(0.97); }

      @keyframes pop {
        from { opacity: 0; transform: translateX(12px) scale(0.8); }
        to   { opacity: 1; transform: none; }
      }

      /* Live indicator — the one thing allowed to glow. */
      .dot {
        position: absolute; top: 3px; right: 3px;
        width: 8px; height: 8px; border-radius: 999px;
        background: #3FBF75;
        box-shadow: 0 0 8px rgba(63,191,117,.7);
      }

      /* --- expanded: the panel ------------------------------------- */
      .panel {
        width: 340px;
        background: #121614;
        border: 1px solid rgba(243,245,243,0.08);
        border-radius: 12px;
        box-shadow: 0 12px 32px -12px rgba(0,0,0,.7);
        color: #F3F5F3;
        overflow: hidden;
        animation: grow 420ms cubic-bezier(0.16,1,0.3,1) both;
        position: relative;
      }
      /* the same ambient royal wash as the panel surfaces */
      .panel::before {
        content: ""; position: absolute; inset: 0 0 auto 0; height: 150px;
        pointer-events: none;
        background:
          radial-gradient(120% 100% at 10% 0%, rgba(20,107,58,.32) 0%, rgba(20,107,58,0) 62%),
          radial-gradient(90% 80% at 95% 6%, rgba(63,191,117,.12) 0%, rgba(63,191,117,0) 58%);
      }
      .panel > * { position: relative; }

      @keyframes grow {
        from { opacity: 0; transform: translateX(16px) scale(0.92); filter: blur(4px); }
        to   { opacity: 1; transform: none; filter: blur(0); }
      }

      .head {
        height: 40px; display: flex; align-items: center; gap: 8px;
        padding: 0 12px; border-bottom: 1px solid rgba(243,245,243,0.08);
      }
      .head .name { font-size: 13px; font-weight: 560; letter-spacing: -.01em; }
      .head .close {
        margin-left: auto; width: 26px; height: 26px;
        border: 0; background: transparent; color: #6F8478;
        border-radius: 6px; cursor: pointer; font-size: 15px; line-height: 1;
      }
      .head .close:hover { background: #181D1A; color: #F3F5F3; }

      .content { padding: 14px; }
      .kicker { font-size: 11px; color: #3FBF75; font-weight: 520; margin-bottom: 8px; }
      .title { font-size: 17px; font-weight: 560; letter-spacing: -.02em; margin-bottom: 10px; }
      .label {
        font-size: 11px; color: #B8D8C4; font-weight: 520; margin-bottom: 5px;
      }
      .body { font-size: 13px; line-height: 19px; color: #F3F5F3; margin-bottom: 12px; }
      .next {
        border-top: 1px solid rgba(243,245,243,0.08);
        padding-top: 11px;
      }
      .next .label { color: #3FBF75; }
      .next p { margin: 0; font-size: 13.5px; line-height: 19px; font-weight: 480; }

      .actions { display: flex; gap: 8px; margin-top: 14px; }
      button.act {
        flex: 1; height: 32px; border-radius: 8px; cursor: pointer;
        font-size: 12.5px; font-weight: 520; border: 1px solid transparent;
        transition: transform 100ms ease-out, background-color 120ms ease-out;
      }
      button.act:active { transform: scale(.98); }
      .go { background: #146B3A; color: #F3F5F3; }
      .go:hover { background: #177A43; }
      .later {
        background: #181D1A; color: #B8D8C4;
        border-color: rgba(243,245,243,0.08);
      }
      .later:hover { color: #F3F5F3; }

      [hidden] { display: none !important; }

      @media (prefers-reduced-motion: reduce) {
        .bubble, .panel { animation: none; }
        .bubble { transition: none; }
      }
    </style>

    <div class="wrap">
      <div class="bubble" id="bubble" role="button" tabindex="0" aria-label="Resume: you left something unfinished">
        <span class="dot"></span>
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
          <rect x="2.5" y="5.5" width="12" height="12" rx="3" fill="none" stroke="#6F8478" stroke-width="1.5"/>
          <rect x="5.5" y="2.5" width="12" height="12" rx="3" fill="#146B3A" stroke="#3FBF75" stroke-width="1.25"/>
        </svg>
      </div>

      <div class="panel" id="panel" hidden>
        <div class="head">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
            <rect x="2.5" y="5.5" width="12" height="12" rx="3" fill="none" stroke="#6F8478" stroke-width="1.5"/>
            <rect x="5.5" y="2.5" width="12" height="12" rx="3" fill="#146B3A" stroke="#3FBF75" stroke-width="1.25"/>
          </svg>
          <span class="name">Resume</span>
          <button class="close" id="close" aria-label="Dismiss">&times;</button>
        </div>
        <div class="content" id="content"></div>
      </div>
    </div>`;

  document.documentElement.appendChild(host);

  const $ = (id) => root.getElementById(id);
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

  let point = null;

  function expand() {
    if (!point) return;
    $("content").innerHTML = `
      <div class="kicker">Welcome back</div>
      <div class="title">${esc(point.title ?? "Untitled task")}</div>
      <div class="label">You were working on</div>
      <div class="body">${esc(point.workingOn ?? "")}</div>
      <div class="next">
        <div class="label">Next step</div>
        <p>${esc(point.nextStep ?? "")}</p>
      </div>
      <div class="actions">
        <button class="act go" id="go">Resume</button>
        <button class="act later" id="later">Not now</button>
      </div>`;

    $("bubble").hidden = true;
    $("panel").hidden = false;

    $("go").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "reopen" });
      remove();
    });
    $("later").addEventListener("click", remove);
  }

  function remove() {
    chrome.runtime.sendMessage({ type: "bubbleDismissed" });
    host.remove();
  }

  $("bubble").addEventListener("click", expand);
  $("bubble").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      expand();
    }
  });
  $("close").addEventListener("click", remove);

  // The background worker hands us the Resume Point to show.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "bubbleData") {
      point = msg.point;
      if (!point) host.remove();
    }
  });

  chrome.runtime.sendMessage({ type: "bubbleReady" });
})();
