# KageTarget contributor guide

KageTarget is a Chrome Manifest V3 reconnaissance extension. **PRIMARY UI = ACTION POPUP.** Never switch the primary action back to Side Panel. Side Panel is optional. Never open primary UI in a normal browser tab, and never redesign the approved theme without explicit instruction.

Keep target parsing, active-tab resolution, network policy, storage cleanup, and DOM extraction in `src/core`. Keep scan state in memory; `chrome.storage.local` may contain only user preferences, and sync storage is forbidden. Maintain English/Turkish dictionary parity.

Never add a backend, telemetry, analytics, remote executable code/fonts/CDNs, persistent scan history, cookies, credentials, browsing-data access, broad required host access, or unrelated scanning/exploitation tools. Treat target data as untrusted text and never render raw HTML.

Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npm run package`. Preserve Chrome Web Store compatibility, side-panel behavior, 320–800 px usability, strict CSP, minimal permissions, manifest validation, and release ZIP cleanliness.
