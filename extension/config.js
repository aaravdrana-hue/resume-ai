// Shared config for the service worker and the popup.
// Loaded via importScripts() in background.js and a <script> tag in popup.html.

globalThis.RESUME_CONFIG = {
  // Your Next.js app. Change to the deployed URL when you ship.
  API_BASE: "http://localhost:3000",

  // Auto-generation tuning.
  //
  // Tuned for FEWER, RICHER Resume Points. Firing eagerly produces lots of
  // narrow cards ("YouTube Browsing") because each one consumes the buffer.
  // Waiting for real context means a card can span Slack docs + GitHub +
  // Stack Overflow and actually describe a work session.
  MIN_ACTIVITIES: 8, // don't summarize thinner context than this
  COOLDOWN_MS: 5 * 60 * 1000, // min gap between auto Resume Points
  MAX_BUFFER: 80, // cap stored activities

  // Privacy (§32): never capture from these. Matched against the hostname.
  IGNORED_HOSTS: [
    "accounts.google.com",
    "login.microsoftonline.com",
    "1password.com",
    "bitwarden.com",
    "lastpass.com",
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "paypal.com",
    "mail.google.com",
  ],
};
