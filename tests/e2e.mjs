import { startFixture } from "./fixture-server/server.mjs";
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import assert from "node:assert/strict";
const { server, port } = await startFixture();
const extension = resolve("dist");
await mkdir("artifacts/e2e", { recursive: true });
let browser;
try {
  browser = await puppeteer.launch({
    headless: false,
    executablePath:
      process.env.KAGETARGET_CHROME ||
      join(homedir(), ".cache/puppeteer/chrome/mac_arm-151.0.7922.77/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  const extensionsPage = await browser.newPage();
  await extensionsPage.goto("chrome://extensions/");
  const id = await extensionsPage.evaluate(() => {
    const manager = document.querySelector("extensions-manager");
    const list = manager?.shadowRoot?.querySelector("extensions-item-list");
    const items = list?.shadowRoot?.querySelectorAll("extensions-item") ?? [];
    return [...items].find((item) => item.shadowRoot?.textContent?.includes("KageTarget"))?.getAttribute("id");
  });
  assert.ok(id, "loaded KageTarget extension id");
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  const popup = await browser.newPage();
  await popup.setViewport({ width: 740, height: 570 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await page.bringToFront();
  await popup.reload();
  await popup.waitForSelector(".target-card");
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(await popup.$(".target-card"));
  assert.equal(
    await popup.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
  );
  await popup.screenshot({ path: "artifacts/e2e/popup-overview.png" });
  await popup.$eval(".manual-toggle", (x) => x.click());
  await popup.waitForSelector(".manual-panel", { timeout: 3000 });
  await popup.screenshot({ path: "artifacts/e2e/popup-manual-target.png" });
  await popup.$eval(".categories button:nth-child(2)", (x) => x.click());
  await popup.screenshot({ path: "artifacts/e2e/popup-web.png" });
  await popup.$eval(".categories button:nth-child(3)", (x) => x.click());
  await popup.screenshot({ path: "artifacts/e2e/popup-page.png" });
  await popup.click(".head-actions button:last-child");
  await popup.waitForSelector(".settings");
  await popup.screenshot({ path: "artifacts/e2e/popup-settings.png" });
  await popup.click(".settings .close");
  await popup.click(".head-actions button:first-child");
  await new Promise((resolve) => setTimeout(resolve, 150));
  await popup.screenshot({ path: "artifacts/e2e/popup-turkish.png" });
  console.log("Chrome E2E: PASS");
} finally {
  const chromeProcess = browser?.process();
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  if (chromeProcess && !chromeProcess.killed) chromeProcess.kill("SIGTERM");
  server.close();
}
