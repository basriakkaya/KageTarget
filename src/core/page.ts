import type { PageForm, PageLink, PageResource, PageSnapshot } from "../types";
export interface PageData {
  snapshot: PageSnapshot;
  links: PageLink[];
  resources: PageResource[];
  forms: PageForm[];
  limited: boolean;
}
export function extractPage(): PageData {
  const origin = location.origin;
  const abs = (v: string) => {
    try {
      return new URL(v, location.href).href;
    } catch {
      return v;
    }
  };
  const categorize = (href: string): PageLink["category"] => {
    if (href.startsWith("#")) return "hash";
    if (/^mailto:/i.test(href)) return "mail";
    if (/^tel:/i.test(href)) return "telephone";
    if (/^javascript:/i.test(href)) return "javascript";
    try {
      const u = new URL(href, location.href);
      return /^https?:$/.test(u.protocol)
        ? u.origin === origin
          ? "internal"
          : "external"
        : "other";
    } catch {
      return "other";
    }
  };
  const seen = new Set<string>();
  const anchors = [
    ...document.querySelectorAll<HTMLAnchorElement>("a[href]"),
  ].slice(0, 5000);
  const links = anchors
    .map((a) => ({
      href: a.getAttribute("href") ?? "",
      text: (a.textContent ?? "").trim().slice(0, 300),
      category: categorize(a.getAttribute("href") ?? ""),
    }))
    .filter((x) => !seen.has(x.href) && (seen.add(x.href), true));
  const resources: PageResource[] = [];
  document.querySelectorAll<HTMLScriptElement>("script").forEach((x, i) => {
    if (i < 2000)
      resources.push({
        kind: "script",
        url: x.src || "[inline script]",
        details: [
          x.type || "classic",
          x.async ? "async" : "",
          x.defer ? "defer" : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
  });
  document
    .querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')
    .forEach((x) =>
      resources.push({
        kind: "stylesheet",
        url: x.href,
        details: "stylesheet",
      }),
    );
  document.querySelectorAll<HTMLImageElement>("img").forEach((x) => {
    if (resources.length < 5000)
      resources.push({
        kind: "image",
        url: x.currentSrc || x.src,
        details: x.alt ? "alt text present" : "no alt text",
      });
  });
  document
    .querySelectorAll<HTMLIFrameElement>("iframe")
    .forEach((x) =>
      resources.push({
        kind: "iframe",
        url: x.src || "[no src]",
        details: "iframe",
      }),
    );
  const forms = [...document.forms].slice(0, 1000).map((f) => {
    const types: Record<string, number> = {};
    const inputs = [...f.querySelectorAll<HTMLInputElement>("input")];
    inputs.forEach((el) => {
      const type = el.type || "text";
      types[type] = (types[type] ?? 0) + 1;
    });
    return {
      method: (f.method || "get").toUpperCase(),
      action: abs(f.getAttribute("action") || location.href),
      inputs: inputs.length,
      types,
    };
  });
  const meta = (name: string) =>
    document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ||
    null;
  return {
    snapshot: {
      url: location.href,
      title: document.title,
      canonical:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
          ?.href || null,
      robots: meta("robots"),
      generator: meta("generator"),
      links: document.links.length,
      scripts: document.scripts.length,
      forms: document.forms.length,
      iframes: document.querySelectorAll("iframe").length,
    },
    links,
    resources: resources.slice(0, 5000),
    forms,
    limited:
      document.links.length > 5000 ||
      resources.length > 5000 ||
      document.forms.length > 1000,
  };
}
export async function readPage(tabId: number): Promise<PageData> {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPage,
  });
  if (!result[0]?.result) throw new Error("No page data was returned.");
  return result[0].result;
}
