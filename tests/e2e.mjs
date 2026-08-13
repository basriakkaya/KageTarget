import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import assert from "node:assert/strict";

const extension = resolve("dist");
await mkdir("artifacts/e2e", { recursive: true });
const browser = await puppeteer.launch({
  headless: false,
  executablePath:
    process.env.KAGETARGET_CHROME ||
    join(homedir(), ".cache/puppeteer/chrome/mac_arm-151.0.7922.77/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--no-first-run", "--no-default-browser-check"],
});
const chromeProcess = browser.process();
try {
  const extensionsPage = await browser.newPage();
  await extensionsPage.goto("chrome://extensions/");
  const id = await extensionsPage.evaluate(() => {
    const manager = document.querySelector("extensions-manager");
    const list = manager?.shadowRoot?.querySelector("extensions-item-list");
    const items = list?.shadowRoot?.querySelectorAll("extensions-item") ?? [];
    return [...items].find((item) => item.shadowRoot?.textContent?.includes("KageTarget"))?.getAttribute("id");
  });
  assert.ok(id, "loaded KageTarget extension id");
  const popup = await browser.newPage();
  const checkGeometry = async (width, height) => {
    await popup.setViewport({ width, height });
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForSelector(".tool-content");
    return popup.evaluate(() => {
      const header = document.querySelector(".panel > header");
      const target = document.querySelector(".target-card");
      const nav = document.querySelector(".categories");
      const content = document.querySelector(".tool-content");
      if (!header || !target || !nav || !content) throw new Error("layout elements missing");
      const hr = header.getBoundingClientRect(), tr = target.getBoundingClientRect(), nr = nav.getBoundingClientRect(), cr = content.getBoundingClientRect();
      return { headerBottom: hr.bottom, targetTop: tr.top, targetBottom: tr.bottom, navTop: nr.top, navBottom: nr.bottom, contentTop: cr.top, contentBottom: cr.bottom, rootOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, bodyOverflow: document.body.scrollWidth > document.body.clientWidth, contentOverflow: getComputedStyle(content).overflowY };
    });
  };
  for (const [width, height] of [[420, 560], [520, 570], [640, 570], [740, 570], [800, 600], [740, 480]]) {
    const g = await checkGeometry(width, height);
    assert.ok(g.headerBottom <= g.targetTop + 1, `header → target at ${width}`);
    assert.ok(g.targetBottom <= g.navTop + 1, `target → nav at ${width}`);
    assert.ok(g.navBottom <= g.contentTop + 1, `nav → content at ${width}`);
    assert.equal(g.rootOverflow, false);assert.equal(g.bodyOverflow, false);assert.equal(g.contentOverflow, "auto");
  }
  await popup.setViewport({ width: 740, height: 570 });await popup.goto(`chrome-extension://${id}/popup.html`);await popup.waitForSelector(".tool-content");
  await popup.evaluate(() => {const content=document.querySelector(".tool-content");if(!content)return;for(let i=0;i<50;i++){const card=document.createElement("section");card.className="card layout-fixture";card.textContent=`internal security-tools /topics/security-tools/${i}`;content.append(card)}});
  const before=await popup.evaluate(()=>{const nav=document.querySelector(".categories").getBoundingClientRect(),content=document.querySelector(".tool-content"),first=document.querySelector(".layout-fixture").getBoundingClientRect();return{navBottom:nav.bottom,contentTop:content.getBoundingClientRect().top,firstTop:first.top}});assert.ok(before.contentTop>=before.navBottom-1);assert.ok(before.firstTop>=before.contentTop-1);
  await popup.screenshot({path:"artifacts/e2e/layout-page-top.png"});await popup.$eval(".tool-content",x=>x.scrollTop=x.scrollHeight);await popup.screenshot({path:"artifacts/e2e/layout-page-scrolled.png"});
  await popup.$eval(".manual-toggle",x=>x.click());await new Promise(r=>setTimeout(r,160));const expanded=await popup.evaluate(()=>{const target=document.querySelector(".target-card").getBoundingClientRect(),nav=document.querySelector(".categories").getBoundingClientRect(),content=document.querySelector(".tool-content").getBoundingClientRect();return{targetBottom:target.bottom,navTop:nav.top,navBottom:nav.bottom,contentTop:content.top}});assert.ok(expanded.targetBottom<=expanded.navTop+1);assert.ok(expanded.navBottom<=expanded.contentTop+1);await popup.screenshot({path:"artifacts/e2e/layout-manual-expanded.png"});
  await popup.setViewport({width:420,height:560});await popup.$eval(".tool-content",x=>x.scrollTop=0);await popup.screenshot({path:"artifacts/e2e/layout-narrow.png"});console.log("Layout E2E: PASS");
} finally {
  browser.disconnect();
  if (chromeProcess && !chromeProcess.killed) chromeProcess.kill("SIGTERM");
}
