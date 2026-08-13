<p align="center"><img src="src/assets/brand/kagetarget-mark.svg" width="96" alt="KageTarget logo"></p>

# KageTarget

Fast browser-native web reconnaissance from a Chrome extension. KageTarget provides user-initiated inspection of the active page or an explicitly supplied HTTP(S) target through a compact Action Popup, with an optional Side Panel workspace.

## Preview

| Compact Action Popup | Technology Detection |
|---|---|
| ![KageTarget compact popup with Chakra Petch](docs/images/v34-main-en.png) | ![KageTarget technology detection](docs/images/v32-technology.png) |

![KageTarget Admin Surface Discovery](docs/images/v32-admin-surface.png)

The toolbar mark is optically sized for every supported Chrome icon size:

![KageTarget icon preview](docs/images/icon-preview.png)

## Features

- Quick Snapshot for title, canonical metadata, robots directives, generator, links, scripts, forms, and iframes
- HTTP Headers, Security Headers, and CSP Inspector
- Explicit checks for robots.txt, security.txt, and sitemap.xml
- Links, Resources, Forms, and Advanced Technology Detection
- URL Inspector, tested IPv4 Subnet Calculator, and Admin Surface Discovery
- Compact target workflow and accessible Manual Target modal
- Target Focus Mode that collapses the locked target after successful analysis
- Locally packaged Chakra Petch typography and first-run optional access onboarding
- Optional Side Panel, English/Turkish UI, Clear Session, and Clear All

## Usage

1. Open a normal HTTP(S) website.
2. Click the KageTarget toolbar icon.
3. On first use, enable the optional website access required for direct HTTP(S) reconnaissance, or continue in limited mode.
4. KageTarget detects the active tab.
5. Click **Analyze**.
6. Select Snapshot, Web, Page, or Utils.

**Manual Target** lets a researcher inspect another explicit HTTP(S) target without changing the open tab. Live mode reads bounded metadata from the rendered page. Remote mode makes a credential-free request and parses up to 512 KB of HTML as an inert static document; it is labeled **STATIC HTML**.

After successful analysis, Target Focus Mode converts the expanded target panel into a compact locked-target bar. This exposes more tool content above the fold while preserving expand and Manual Target controls. Its restrained signal transition respects reduced-motion preferences.

## Technology detection

KageTarget combines response headers, page metadata, resource paths, and DOM evidence to identify web technologies. Its independent, local signature engine provides confidence and expandable evidence for every detection; target scripts are never loaded or executed by the extension.

## Admin Surface Discovery

Admin Surface Discovery checks a small predefined set of 24 common administration and login paths after explicit user action. It is same-origin, credential-free, concurrency-bounded, and uses a soft-404 baseline. It does not perform authentication attempts, recursive enumeration, or brute forcing.

## Privacy

KageTarget has no account, analytics, telemetry, advertising, backend service, or persistent scan history. Scan results remain in memory. The language preference is stored locally. User-triggered network checks communicate directly with the selected target and omit credentials.

See the [Privacy Policy](docs/PRIVACY_POLICY.md) and [Permission Rationale](docs/PERMISSIONS.md).

## Install from source

1. Run `npm install` and `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Choose **Load unpacked**.
5. Select the generated `dist/` directory.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run package
```

`npm run package` creates `release/kagetarget-3.4.0.zip` with `manifest.json` at the archive root.

## Architecture

- Chrome Manifest V3 with Action Popup as the primary interface
- Optional Side Panel using the same React application
- Strict TypeScript, React, Vite, Vitest, and a Puppeteer Chrome harness
- In-memory scan state and local-only language preference
- Central target parser, permission boundary, DOM extraction, and network policy
- Explicit direct requests using `credentials: "omit"` and `cache: "no-store"`

## Limitations

- Restricted browser pages cannot be inspected.
- Browser security policies can affect readable network responses.
- Technology detection is heuristic and intentionally conservative.
- Native toolbar interaction may require manual validation because browser automation cannot reliably click Chrome toolbar actions.

## Ethical use

Use KageTarget only on systems you own or are authorized to test.

Chrome Web Store preparation details are documented in [Store Readiness](docs/STORE_READINESS.md). A license has not yet been selected.
