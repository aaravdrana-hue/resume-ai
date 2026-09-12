# Resume — Chrome Extension

The capture layer. It watches what you're working on, buffers the signals,
and turns them into a Resume Point via the Next.js app.

## Load it

1. Start the backend: `npm run dev` (must be running — the extension calls it)
2. Open `chrome://extensions`
3. Toggle **Developer mode** (top right)
4. Click **Load unpacked** and select this `extension/` folder

After editing any file here, click the **↻ reload** icon on the extension card.

## What it captures

| Signal | Source |
|---|---|
| Page visits | `chrome.tabs.onUpdated` |
| Tab switches | `chrome.tabs.onActivated` |
| Copied text | `copy` listener in `content.js` |
| Going idle | `chrome.idle` (60s) |

Everything buffers in `chrome.storage.local`. The badge shows how many
signals are banked.

## When a Resume Point is created

**Manually** — click the toolbar icon → **Save Resume Point**.

**Automatically** — when you switch to a site that differs from the one
dominating the current buffer, or when you go idle. Guarded by:

- at least `MIN_ACTIVITIES` (4) signals banked
- at least `COOLDOWN_MS` (90s) since the last one

The badge turns amber when Resume acted on its own. Toggle auto-capture off
from the popup footer.

## Privacy

`config.js → IGNORED_HOSTS` is never captured (banks, password managers,
webmail). Only `http(s)` pages are captured — never `chrome://` or local
files. Nothing is sent anywhere except your own backend.

## Notes

- **No secrets live here.** Extension code is readable by anyone who installs
  it. The Groq and Supabase keys stay server-side in the Next.js app; the
  extension only ever calls `/api/summarize`.
- MV3 service workers are killed after ~30s idle, so all state lives in
  `chrome.storage.local` — never in a module variable.
- Deploying? Change `API_BASE` in `config.js` and add the deployed origin to
  `host_permissions` in `manifest.json`.
