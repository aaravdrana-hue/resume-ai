// Shared config for the service worker and the popup.
// Loaded via importScripts() in background.js and a <script> tag in popup.html.

globalThis.RESUME_CONFIG = {
  // Your Next.js app. Change to the deployed URL when you ship.
  API_BASE: "http://localhost:3000",

  // Auto-generation tuning.
  MIN_ACTIVITIES: 4, // don't summarize thinner context than this
  COOLDOWN_MS: 90 * 1000, // min gap between auto Resume Points
  MAX_BUFFER: 60, // cap stored activities

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
