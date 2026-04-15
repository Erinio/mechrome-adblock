# MeChrome Ad Blocker

A lightweight Manifest V3 Chrome extension focused on practical blocking:

- Network-level blocking via `declarativeNetRequest` rules.
- YouTube DOM/video ad cleanup for page-level ad surfaces.
- Per-site allow/block controls.
- Optional strict tracker blocking mode.
- Per-tab blocked-request badge + lifetime stats.

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

## Project Structure

- `manifest.json` – extension metadata and permissions.
- `background.js` – dynamic rule sync, counters, and badge state.
- `popup.html` / `popup.js` – settings and domain management UI.
- `rules.json` – baseline static block rules.
- `youtube-script.js` / `youtube-ad-blocker.css` – YouTube ad cleanup.

## Notes

- This project intentionally avoids heavy remote list downloads so it can run fully local/offline.
- You can expand strict-mode domains in `background.js` (`STRICT_TRACKER_DOMAINS`).

## License

MIT. See `LICENSE`.
