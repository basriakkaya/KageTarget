import { parseTarget } from "./target";
import type { TargetContext } from "../types";

export async function resolveActiveTarget(): Promise<TargetContext | null> {
  const preferred = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const candidates = preferred.length ? preferred : await chrome.tabs.query({ active: true });
  for (const tab of candidates) {
    if (!tab.id || !tab.url) continue;
    try {
      return parseTarget(tab.url, true, tab.id);
    } catch {
      // Restricted extension/browser tabs are not valid reconnaissance targets.
    }
  }
  if (preferred.length) {
    for (const tab of await chrome.tabs.query({ active: true })) {
      if (!tab.id || !tab.url) continue;
      try { return parseTarget(tab.url, true, tab.id); } catch { /* continue */ }
    }
  }
  return null;
}
