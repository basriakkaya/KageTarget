# Permission rationale

- `activeTab`: analyze the current page after explicit user interaction.
- `scripting`: read bounded, non-sensitive page metadata for user-requested analysis.
- `sidePanel`: display KageTarget beside the active page.
- `storage`: store language preference locally and clear temporary session state. Sync storage is not used.
- Optional `http://*/*` and `https://*/*`: request access at runtime for the single selected origin when the user runs a direct HTTP(S) check.

KageTarget does not request history, cookies, bookmarks, browsing data, downloads, debugger, proxy, management, native messaging, or clipboard-read access.
