import { beforeAll, describe, expect, it, vi } from "vitest";
import { DOMParser } from "linkedom";
import { parseTarget } from "./target";
import { fetchRemotePage, parseRemoteHtml } from "./remote-page";

beforeAll(() => vi.stubGlobal("DOMParser", DOMParser));

const html = `<!doctype html><html><head><title>Kage Fixture</title><link rel="canonical" href="/canonical"><meta name="robots" content="index, follow"><meta name="generator" content="WordPress 6.6"><link rel="stylesheet" href="/wp-content/theme.css"></head><body><a href="/internal">Internal</a><a href="https://external.example/test">External</a><a href="mailto:test@example.com">Mail</a><a href="tel:+123456">Telephone</a><a href="#section">Hash</a><script src="/fixture-script.js"></script><img src="/image.png"><iframe src="/frame"></iframe><form action="/login" method="post"><input type="email"><input type="password"><input type="hidden"><button type="submit">Login</button></form></body></html>`;
const target = parseTarget("https://fixture.test/");
const page = () => parseRemoteHtml(html, target);

describe("regression-critical static page tools", () => {
  it("extracts and classifies exact links", () => {
    const parsed = page();
    expect(parsed.links).toHaveLength(5);
    expect(
      Object.fromEntries(
        ["internal", "external", "mail", "telephone", "hash"].map((kind) => [
          kind,
          parsed.links.filter((link) => link.category === kind).length,
        ]),
      ),
    ).toEqual({ internal: 1, external: 1, mail: 1, telephone: 1, hash: 1 });
  });

  it("extracts normalized resources", () => {
    const parsed = page();
    expect(parsed.resources.filter((item) => item.kind === "script")).toHaveLength(1);
    expect(parsed.resources.filter((item) => item.kind === "stylesheet")).toHaveLength(1);
    expect(parsed.resources.filter((item) => item.kind === "image")).toHaveLength(1);
    expect(parsed.resources.filter((item) => item.kind === "iframe")).toHaveLength(1);
  });

  it("reports a target script as metadata without requesting it", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(html, { status: 200 }));

    const parsed = await fetchRemotePage(target);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://fixture.test/",
      expect.objectContaining({ method: "GET" }),
    );
    expect(parsed.resources).toContainEqual(
      expect.objectContaining({
        kind: "script",
        url: "https://fixture.test/fixture-script.js",
      }),
    );
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/fixture-script.js")),
    ).toBe(false);
    fetchMock.mockRestore();
  });

  it("extracts structural form metadata without values", () =>
    expect(page().forms[0]).toMatchObject({
      method: "POST",
      action: "https://fixture.test/login",
      inputs: 3,
      types: { email: 1, password: 1, hidden: 1 },
    }));

  it("provides technology evidence inputs", () => {
    const parsed = page();
    expect(parsed.snapshot.generator).toBe("WordPress 6.6");
    expect(parsed.resources.some((item) => item.url.includes("/wp-content/"))).toBe(true);
  });
});
