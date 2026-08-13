import type { PageData } from "./page";
import type { PageForm, PageLink, PageResource, TargetContext } from "../types";
import { categorizeLink, dedupeLinks } from "./links";
const absolute = (value: string, base: string) => {
  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
};
export function parseRemoteHtml(html: string, target: TargetContext): PageData {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = dedupeLinks(
    [...doc.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .slice(0, 5000)
      .map((a) => {
        const raw = a.getAttribute("href") ?? "";
        return {
          href: absolute(raw, target.normalizedUrl),
          text: (a.textContent ?? "").trim().slice(0, 300),
          category: categorizeLink(raw, target.origin),
        } as PageLink;
      }),
  );
  const resources: PageResource[] = [];
  doc.querySelectorAll<HTMLScriptElement>("script").forEach((x, i) => {
    if (i < 2000)
      resources.push({
        kind: "script",
        url: x.src
          ? absolute(x.getAttribute("src") ?? "", target.normalizedUrl)
          : "[inline script]",
        details: [
          x.type || "classic",
          x.async ? "async" : "",
          x.defer ? "defer" : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
  });
  doc
    .querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')
    .forEach((x) =>
      resources.push({
        kind: "stylesheet",
        url: absolute(x.getAttribute("href") ?? "", target.normalizedUrl),
        details: "stylesheet",
      }),
    );
  doc.querySelectorAll<HTMLImageElement>("img[src]").forEach((x) => {
    if (resources.length < 5000)
      resources.push({
        kind: "image",
        url: absolute(x.getAttribute("src") ?? "", target.normalizedUrl),
        details: x.alt ? "alt text present" : "no alt text",
      });
  });
  doc
    .querySelectorAll<HTMLIFrameElement>("iframe[src]")
    .forEach((x) =>
      resources.push({
        kind: "iframe",
        url: absolute(x.getAttribute("src") ?? "", target.normalizedUrl),
        details: "iframe",
      }),
    );
  const formElements = [...doc.querySelectorAll<HTMLFormElement>("form")];
  const forms: PageForm[] = formElements.slice(0, 1000).map((f) => {
    const types: Record<string, number> = {};
    f.querySelectorAll<HTMLInputElement>("input").forEach((x) => {
      const type = x.type || "text";
      types[type] = (types[type] ?? 0) + 1;
    });
    return {
      method: (f.getAttribute("method") || "get").toUpperCase(),
      action: absolute(
        f.getAttribute("action") || target.normalizedUrl,
        target.normalizedUrl,
      ),
      inputs: f.querySelectorAll("input").length,
      types,
    };
  });
  const meta = (name: string) =>
    doc.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || null;
  return {
    snapshot: {
      url: target.normalizedUrl,
      title: doc.title,
      canonical: doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.href
        ? absolute(
            doc
              .querySelector<HTMLLinkElement>('link[rel="canonical"]')!
              .getAttribute("href")!,
            target.normalizedUrl,
          )
        : null,
      robots: meta("robots"),
      generator: meta("generator"),
      links: doc.querySelectorAll("a[href]").length,
      scripts: doc.querySelectorAll("script").length,
      forms: formElements.length,
      iframes: doc.querySelectorAll("iframe").length,
    },
    links,
    resources: resources.slice(0, 5000),
    forms,
    limited:
      doc.querySelectorAll("a[href]").length > 5000 ||
      resources.length > 5000 ||
      formElements.length > 1000,
  };
}
export async function fetchRemotePage(
  target: TargetContext,
  signal?: AbortSignal,
): Promise<PageData> {
  const r = await fetch(target.normalizedUrl, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    redirect: "follow",
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const reader = r.body?.getReader();
  if (!reader) return parseRemoteHtml("", target);
  const decoder = new TextDecoder();
  let total = 0,
    html = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = 524288 - total;
    if (value.byteLength > remaining) {
      html += decoder.decode(value.slice(0, remaining), { stream: true });
      await reader.cancel();
      break;
    }
    total += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  html += decoder.decode();
  return parseRemoteHtml(html, target);
}
