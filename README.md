# MeChrome Ad Blocker

A lightweight Manifest V3 Chrome extension focused on practical blocking:

- Network-level blocking via `declarativeNetRequest` rules.
- YouTube DOM/video ad cleanup for page-level ad surfaces.
- Per-site allow/block controls.
- Optional strict tracker blocking mode.
- Per-tab blocked-request badge + lifetime stats.

## What’s New (v1.3.0)

- Added **Aggressive blocklist mode (beta)**:
  - Ships a second static ruleset (`rules-strict.json`) with broader ad/tracker coverage.
  - Uses a safer anti-breakage posture inspired by uBO "easy mode": third-party focused network filtering and curated lists, rather than blanket first-party blocking.
  - Toggle on/off from popup without reinstalling extension.
- Added **cross-browser packaging manifests**:
  - `manifest.firefox.json` for Firefox (with gecko settings).
  - `manifest.opera.json` for Opera distribution.

## What’s New (v1.2.0)

- Added **temporary per-site compatibility mode**:
  - One-click **Allow 30 min** from popup for quick site-unbreak.
  - Auto-expires and re-enables protection without manual cleanup.
- Added **tracking-link cleanup mode** (enabled by default):
  - Strips common tracking query params (like `utm_*`, `gclid`, `fbclid`) from top-level navigations.
  - Improves privacy while reducing breakage vs hard-blocking.
- Improved strict mode safety:
  - Strict tracker blocks now apply as **third-party only** to reduce false positives.

## What’s New (v1.1.0)

- Reworked background logic to use `declarativeNetRequest.onRuleMatchedDebug` for accurate block counting.
- Added managed dynamic rules that sync from popup settings:
  - **Allow site** -> pauses protection for that site.
  - **Block site** -> hard-blocks requests for that domain.
  - **Strict mode** -> adds an additional tracker-focused rule set.
- Added popup controls for:
  - Global on/off toggle.
  - Strict mode toggle.
  - One-click “Pause on this site / Enable on this site”.
- Rewrote YouTube script to reduce duplicated timers/observers and improve stability on SPA navigation.
- Removed unused permissions from the manifest (`notifications`, `webRequest`).

## Installation

1. Clone/download this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this folder.

### Firefox / Opera

- Firefox: load with `manifest.firefox.json` when packaging/signing.
- Opera: use `manifest.opera.json` (Chromium-compatible build).

## Project Structure

- `manifest.json` – extension metadata and permissions.
- `background.js` – dynamic rule sync, counters, and badge state.
- `popup.html` / `popup.js` – settings and domain management UI.
- `rules.json` – baseline static block rules.
- `rules-strict.json` – optional aggressive static ruleset.
- `scripts/build-aggressive-ruleset.mjs` – ruleset compiler (EasyList/EasyPrivacy/uAssets inputs + local snapshot fallback).
- `youtube-script.js` / `youtube-ad-blocker.css` – YouTube ad cleanup.

## Notes

- This project intentionally avoids heavy remote list downloads so it can run fully local/offline.
- You can expand strict-mode domains in `background.js` (`STRICT_TRACKER_DOMAINS`).
- Safer strategy used by default:
  - Use deterministic network blocks for known ad/tracker domains.
  - Prefer URL cleanup + temporary per-site allow over globally weakening protections.

## Aggressive Ruleset Build

Run this to rebuild `rules-strict.json`:

```bash
node scripts/build-aggressive-ruleset.mjs
```

The script tries these upstream sources first:
- EasyPrivacy
- EasyList ad server rules
- uAssets privacy filters

If network is unavailable, it falls back to `scripts/source-snapshot.txt`.
