# Permission rationale

| Permission | Why and when used | Data accessed | Persistence |
|---|---|---|---|
| `activeTab` | Inspect the current page after explicit user interaction | Bounded page metadata | Temporary active-tab grant |
| `scripting` | Run the local metadata extractor in the selected active tab | Title, links, resource/form structure, and technology markers | Required API permission; no stored page history |
| `sidePanel` | Open the optional Side Panel workspace | No additional website data | Required API permission |
| `storage` | Save language and limited-mode preferences and clear extension session state | KageTarget-owned preferences only | Local until cleared; session data is temporary |
| Optional `http://*/*`, `https://*/*` | Send direct user-triggered HTTP(S) reconnaissance checks after first-run activation or contextual recovery | Responses from the selected target | Chrome-managed optional host grant; revocable |

KageTarget does not request history, cookies, bookmarks, browsing data, downloads, debugger, proxy, management, native messaging, or clipboard-read access.

KageTarget checks the real Chrome permission state on startup. It does not request optional access during installation or popup mount; the request follows the user's activation CTA. Denial enables limited mode, while network tools retain contextual recovery.
