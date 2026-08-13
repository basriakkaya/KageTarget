import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import { startFixture } from "./fixture-server/server.mjs";

const extension = resolve("dist");
await mkdir("artifacts/e2e", { recursive: true });
const { server, port } = await startFixture();
const browser = await puppeteer.launch({
  headless: false,
  executablePath:
    process.env.KAGETARGET_CHROME ||
    join(
      homedir(),
      ".cache/puppeteer/chrome/mac_arm-151.0.7922.77/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});
const chromeProcess = browser.process();

const firstFailure = (errors) => errors.find(Boolean);
const captureFailures = (page, errors) => {
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  page.on("requestfailed", (request) =>
    errors.push(
      `requestfailed: ${request.url()} ${request.failure()?.errorText ?? "unknown"}`,
    ),
  );
};

try {
  const extensionsPage = await browser.newPage();
  await extensionsPage.goto("chrome://extensions/");
  const id = await extensionsPage.evaluate(() => {
    const manager = document.querySelector("extensions-manager");
    const list = manager?.shadowRoot?.querySelector("extensions-item-list");
    const items = list?.shadowRoot?.querySelectorAll("extensions-item") ?? [];
    return [...items]
      .find((item) => item.shadowRoot?.textContent?.includes("KageTarget"))
      ?.getAttribute("id");
  });
  assert.ok(id, "loaded KageTarget extension id");

  const fixture = await browser.newPage();
  await fixture.goto(`http://127.0.0.1:${port}/`);
  await fixture.bringToFront();

  const worker = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().startsWith(`chrome-extension://${id}/`),
  );
  const popupTargetPromise = browser.waitForTarget(
    (target) => target.url() === `chrome-extension://${id}/popup.html`,
    { timeout: 10_000 },
  );
  await worker.worker().then((context) =>
    context.evaluate(async () => {
      await globalThis.chrome.action.openPopup();
    }),
  );
  const popupTarget = await popupTargetPromise;
  const popup = await popupTarget.asPage();
  assert.ok(popup, "Chrome action popup target opened");

  const startupErrors = [];
  captureFailures(popup, startupErrors);
  await popup.reload({ waitUntil: "domcontentloaded" });
  await popup.waitForSelector(".brand", { visible: true });

  const boot = await popup.evaluate(() => ({
    rootExists: Boolean(document.querySelector("#root")),
    reactMounted: Boolean(document.querySelector("#root > .panel")),
    wordmark: document.querySelector(".brand")?.textContent?.replace(/\s/g, ""),
    logoVisible: Boolean(document.querySelector(".brand img")?.getBoundingClientRect().width),
    navigation: [...document.querySelectorAll(".categories button")].map((button) =>
      button.textContent?.trim(),
    ),
    body: {
      width: document.body.getBoundingClientRect().width,
      height: document.body.getBoundingClientRect().height,
    },
  }));

  assert.equal(boot.rootExists, true, "popup.html loads and #root exists");
  assert.equal(boot.reactMounted, true, "React mounts");
  assert.equal(boot.wordmark, "KageTarget", "KageTarget wordmark is visible");
  assert.equal(boot.logoVisible, true, "KageTarget logo is visible");
  assert.equal(boot.navigation.length, 4, "Snapshot/Web/Page/Utils navigation exists");
  assert.deepEqual(boot.body, { width: 740, height: 570 });
  assert.equal(firstFailure(startupErrors), undefined, firstFailure(startupErrors));
  await popup.screenshot({ path: "artifacts/e2e/popup-boot.png" });
  console.log('popup boots and renders KageTarget: PASS');

  const layoutPage = await browser.newPage();
  const layoutErrors = [];
  captureFailures(layoutPage, layoutErrors);
  await layoutPage.setViewport({ width: 740, height: 570 });
  await layoutPage.goto(`chrome-extension://${id}/popup.html`);
  await layoutPage.waitForSelector(".tool-content");
  await layoutPage.evaluate(() => {
    const content = document.querySelector(".tool-content");
    if (!content) return;
    for (let i = 0; i < 50; i++) {
      const card = document.createElement("section");
      card.className = "card layout-fixture";
      card.textContent = `internal security-tools /topics/security-tools/${i}`;
      content.append(card);
    }
  });
  const geometry = await layoutPage.evaluate(() => {
    const target = document.querySelector(".target-card")?.getBoundingClientRect();
    const nav = document.querySelector(".categories")?.getBoundingClientRect();
    const content = document.querySelector(".tool-content")?.getBoundingClientRect();
    const first = document.querySelector(".layout-fixture")?.getBoundingClientRect();
    if (!target || !nav || !content || !first) throw new Error("layout elements missing");
    return {
      targetBottom: target.bottom,
      navTop: nav.top,
      navBottom: nav.bottom,
      contentTop: content.top,
      firstTop: first.top,
      contentOverflow: getComputedStyle(document.querySelector(".tool-content")).overflowY,
    };
  });
  assert.ok(geometry.targetBottom <= geometry.navTop + 1);
  assert.ok(geometry.navBottom <= geometry.contentTop + 1);
  assert.ok(geometry.firstTop >= geometry.contentTop - 1);
  assert.equal(geometry.contentOverflow, "auto");
  await layoutPage.screenshot({ path: "artifacts/e2e/layout-page-top.png" });
  await layoutPage.$eval(".tool-content", (element) => {
    element.scrollTop = element.scrollHeight;
  });
  await layoutPage.screenshot({ path: "artifacts/e2e/layout-page-scrolled.png" });
  await layoutPage.$eval(".manual-toggle", (element) => element.click());
  await layoutPage.waitForSelector(".manual-panel");
  const expanded = await layoutPage.evaluate(() => {
    const target = document.querySelector(".target-card")?.getBoundingClientRect();
    const nav = document.querySelector(".categories")?.getBoundingClientRect();
    const content = document.querySelector(".tool-content")?.getBoundingClientRect();
    if (!target || !nav || !content) throw new Error("expanded layout elements missing");
    return {
      targetBottom: target.bottom,
      navTop: nav.top,
      navBottom: nav.bottom,
      contentTop: content.top,
    };
  });
  assert.ok(expanded.targetBottom <= expanded.navTop + 1);
  assert.ok(expanded.navBottom <= expanded.contentTop + 1);
  await layoutPage.screenshot({ path: "artifacts/e2e/layout-manual-expanded.png" });
  assert.equal(firstFailure(layoutErrors), undefined, firstFailure(layoutErrors));
  console.log("Layout E2E: PASS");
} finally {
  await new Promise((resolveServer) => server.close(resolveServer));
  browser.disconnect();
  if (chromeProcess && !chromeProcess.killed) chromeProcess.kill("SIGTERM");
}
