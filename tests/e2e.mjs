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
const hardTimeout = setTimeout(() => {
  console.error("E2E hard timeout exceeded");
  if (chromeProcess && !chromeProcess.killed) chromeProcess.kill("SIGTERM");
  process.exitCode = 1;
}, 60_000);

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

  const onboardingPage = async (language, grant) => {
    const page=await browser.newPage(),requests=[]; page.on("request",request=>requests.push(request.url()));
    await page.evaluateOnNewDocument((language,grant)=>{let attempt=0;Object.defineProperty(globalThis.chrome.permissions,"contains",{value:async()=>false});Object.defineProperty(globalThis.chrome.permissions,"request",{value:async()=>Array.isArray(grant)?grant[Math.min(attempt++,grant.length-1)]:grant});Object.defineProperty(globalThis.chrome.storage.local,"get",{value:async()=>({language,limitedMode:false})});Object.defineProperty(globalThis.chrome.storage.local,"set",{value:async()=>undefined});},language,grant);
    await page.setViewport({width:740,height:570});await page.goto(`chrome-extension://${id}/popup.html`);await page.waitForSelector(".activation-view");await page.evaluate(()=>document.fonts.ready);
    assert.equal(requests.some(url=>/^https?:/.test(url)&&!url.startsWith("http://127.0.0.1")),false,"no remote font request");
    return page;
  };
  const onboardingEn=await onboardingPage("en",true);await onboardingEn.screenshot({path:"artifacts/e2e/v34-onboarding-en.png"});
  const computedFonts=await onboardingEn.evaluate(()=>({body:getComputedStyle(document.body).fontFamily,button:getComputedStyle(document.querySelector(".activation-primary")).fontFamily,heading:getComputedStyle(document.querySelector(".activation-card h1")).fontFamily,wordmark:getComputedStyle(document.querySelector(".brand b")).fontFamily}));
  for(const value of [computedFonts.body,computedFonts.button,computedFonts.heading])assert.ok(value.startsWith('"Chakra Petch"')||value.startsWith("Chakra Petch"));assert.equal(/Chakra Petch/.test(computedFonts.wordmark),false,"wordmark typography preserved");
  for(const [width,height] of [[420,560],[520,570],[640,570],[740,570],[800,600]]){await onboardingEn.setViewport({width,height});const fit=await onboardingEn.evaluate(()=>({button:document.querySelector(".activation-primary").getBoundingClientRect().height,overflow:document.body.scrollWidth>document.body.clientWidth,card:document.querySelector(".activation-card").getBoundingClientRect().width,body:document.body.getBoundingClientRect().width}));assert.ok(fit.button>=40);assert.equal(fit.overflow,false);assert.ok(fit.card<=fit.body)}
  await onboardingEn.setViewport({width:740,height:570});const onboardingClient=await onboardingEn.createCDPSession();await onboardingClient.send("Emulation.setPageScaleFactor",{pageScaleFactor:2});await onboardingEn.$eval(".activation-primary",element=>element.scrollIntoView({block:"center"}));assert.ok(await onboardingEn.$eval(".activation-primary",element=>element.getBoundingClientRect().height>0));await onboardingClient.send("Emulation.setPageScaleFactor",{pageScaleFactor:1});
  await onboardingEn.click(".activation-primary");await onboardingEn.waitForSelector(".activation-view",{hidden:true});
  const onboardingTr=await onboardingPage("tr",[false,true]);await onboardingTr.screenshot({path:"artifacts/e2e/v34-onboarding-tr.png"});await onboardingTr.click(".activation-primary");await onboardingTr.waitForSelector(".access-error");await onboardingTr.screenshot({path:"artifacts/e2e/v34-permission-denied.png"});await onboardingTr.click(".activation-primary");await onboardingTr.waitForSelector(".activation-view",{hidden:true});
  const limitedPage=await onboardingPage("tr",false);await limitedPage.click(".activation-primary");await limitedPage.waitForSelector(".access-error");await limitedPage.click(".activation-skip");await limitedPage.waitForSelector(".activation-view",{hidden:true});await limitedPage.screenshot({path:"artifacts/e2e/v34-limited-mode.png"});

  const layoutPage = await browser.newPage();
  const layoutErrors = [];
  captureFailures(layoutPage, layoutErrors);
  await layoutPage.evaluateOnNewDocument((fixtureOrigin) => {
    const pageData = { snapshot:{url:`${fixtureOrigin}/`,title:"KageTarget Fixture",canonical:`${fixtureOrigin}/canonical`,robots:"index, follow",generator:"WordPress 6.8",links:1,scripts:2,forms:1,iframes:0},links:[],resources:[{kind:"script",url:`${fixtureOrigin}/_next/static/app.js`,details:"classic"},{kind:"script",url:`${fixtureOrigin}/wp-content/plugins/test/app.js`,details:"classic"},{kind:"stylesheet",url:`${fixtureOrigin}/wp-includes/css/test.css`,details:"stylesheet"}],forms:[],markers:["__NEXT_DATA__"],limited:false };
    Object.defineProperty(globalThis.chrome.tabs,"query",{value:async()=>[{id:77,url:`${fixtureOrigin}/`,active:true}]});
    Object.defineProperty(globalThis.chrome.scripting,"executeScript",{value:async()=>[{result:pageData}]});
    Object.defineProperty(globalThis.chrome.permissions,"contains",{value:async()=>true});
    Object.defineProperty(globalThis.chrome.permissions,"request",{value:async()=>true});
    const make=(url,status,body,final=url)=>{const response=new Response(body,{status,headers:{"content-type":"text/html",server:"nginx/1.27.0","cf-ray":"fixture"}});Object.defineProperty(response,"url",{value:final});return response};
    globalThis.fetch=async(input,init)=>{const url=String(input),path=new URL(url).pathname;if(init?.method==="HEAD")return make(url,path.startsWith("/.kagetarget")?404:path.startsWith("/administrator")?403:404,"");if(path.startsWith("/.kagetarget"))return make(url,404,"");if(path==="/admin"||path==="/admin/"||path.startsWith("/admin/login"))return make(url,200,'<title>Administration Login</title><form><input type="password"></form>');if(path.startsWith("/administrator"))return make(url,403,"");if(path==="/login")return make(url,200,"<title>Sign in</title>",`${fixtureOrigin}/auth/signin`);return make(url,404,"")};
  }, `http://127.0.0.1:${port}`);
  await worker.worker().then((context) => context.evaluate(async () => globalThis.chrome.storage.local.set({ language: "en" })));
  await layoutPage.setViewport({width:740,height:570});
  await layoutPage.goto(`chrome-extension://${id}/popup.html`);
  await layoutPage.waitForSelector(".tool-content");
  assert.equal(await layoutPage.$(".activation-view"),null,"already granted users skip onboarding");
  await layoutPage.waitForFunction(() => document.querySelector(".target-card h1")?.textContent?.includes("127.0.0.1"));
  await layoutPage.click(".manual-toggle");await layoutPage.waitForSelector(".manual-dialog input");const inputFont=await layoutPage.$eval(".manual-dialog input",element=>getComputedStyle(element).fontFamily);assert.ok(/Chakra Petch/.test(inputFont));await layoutPage.keyboard.press("Escape");
  await layoutPage.click('.head-actions button[aria-label="Settings"]');await layoutPage.waitForSelector(".settings label");const settingsFont=await layoutPage.$eval(".settings label",element=>getComputedStyle(element).fontFamily);assert.ok(/Chakra Petch/.test(settingsFont));await layoutPage.click(".settings .close");
  const uiFonts=await layoutPage.evaluate(()=>["body",".target-card h1",".categories button",".tool-title h2",".target-card .primary"].map(selector=>getComputedStyle(document.querySelector(selector)).fontFamily));assert.equal(uiFonts.every(value=>/Chakra Petch/.test(value)),true);
  const expandedGeometry = await layoutPage.evaluate(() => { const target=document.querySelector(".target-card").getBoundingClientRect(),nav=document.querySelector(".categories").getBoundingClientRect(),content=document.querySelector(".tool-content").getBoundingClientRect();return{targetHeight:target.height,targetBottom:target.bottom,navTop:nav.top,navBottom:nav.bottom,contentTop:content.top,contentHeight:content.height,overflow:document.body.scrollWidth>document.body.clientWidth}});
  assert.equal(expandedGeometry.overflow,false);
  await layoutPage.screenshot({ path: "artifacts/e2e/v33-expanded.png" });
  await layoutPage.click(".target-card .primary");
  await layoutPage.waitForSelector(".metrics");
  await layoutPage.waitForSelector(".target-focus-bar.collapsed");
  const collapsedGeometry = await layoutPage.evaluate(() => { const target=document.querySelector(".target-focus-bar").getBoundingClientRect(),nav=document.querySelector(".categories").getBoundingClientRect(),content=document.querySelector(".tool-content").getBoundingClientRect();return{targetHeight:target.height,targetBottom:target.bottom,navTop:nav.top,navBottom:nav.bottom,contentTop:content.top,contentHeight:content.height,overflow:document.body.scrollWidth>document.body.clientWidth,aria:document.querySelector(".focus-identity").getAttribute("aria-expanded")}});
  assert.ok(collapsedGeometry.targetHeight<expandedGeometry.targetHeight); assert.ok(collapsedGeometry.contentHeight>expandedGeometry.contentHeight); assert.ok(collapsedGeometry.navTop>=collapsedGeometry.targetBottom-1); assert.ok(collapsedGeometry.contentTop>=collapsedGeometry.navBottom-1); assert.equal(collapsedGeometry.overflow,false); assert.equal(collapsedGeometry.aria,"false");
  await layoutPage.screenshot({ path: "artifacts/e2e/v33-collapsed.png" });
  await layoutPage.hover(".focus-identity"); await layoutPage.waitForSelector(".target-focus-bar.peek");
  const peekGeometry=await layoutPage.$eval(".target-focus-bar",element=>element.getBoundingClientRect().height);assert.equal(peekGeometry,collapsedGeometry.targetHeight);
  await layoutPage.screenshot({ path: "artifacts/e2e/v33-peek.png" });
  await layoutPage.mouse.move(0,0); await layoutPage.waitForSelector(".target-focus-bar.collapsed");
  await layoutPage.click(".focus-action"); await layoutPage.waitForSelector(".target-expanded");
  await layoutPage.keyboard.press("Tab"); assert.ok(await layoutPage.evaluate(()=>document.activeElement instanceof HTMLElement));
  await layoutPage.click(".target-card .primary"); await layoutPage.waitForSelector(".target-focus-bar.collapsed");
  await layoutPage.screenshot({ path: "artifacts/e2e/v33-tools-visible.png" });
  await layoutPage.screenshot({ path: "artifacts/e2e/v34-main-en.png" });
  await layoutPage.screenshot({ path: "artifacts/e2e/v34-focus-mode-font.png" });
  await layoutPage.screenshot({ path: "artifacts/e2e/v32-overview.png" });

  await layoutPage.evaluate(() => document.querySelectorAll(".categories button")[2]?.click());
  await layoutPage.evaluate(() => document.querySelectorAll(".tool-strip button")[3]?.click());
  await layoutPage.waitForSelector(".technology-card");
  assert.ok(await layoutPage.$$eval(".technology-card", (items) => items.length >= 2));
  await layoutPage.screenshot({ path: "artifacts/e2e/v32-technology.png" });

  await layoutPage.evaluate(() => document.querySelectorAll(".categories button")[3]?.click());
  await layoutPage.evaluate(() => document.querySelectorAll(".tool-strip button")[2]?.click());
  await layoutPage.waitForSelector(".admin-intro");
  await layoutPage.click(".admin-intro .run");
  await layoutPage.waitForFunction(() => document.querySelectorAll(".admin-result").length === 24, { timeout: 20_000 });
  const adminClasses = await layoutPage.$$eval(".admin-result .status", (items) => items.map((item) => item.textContent));
  assert.ok(adminClasses.includes("LIKELY")); assert.ok(adminClasses.includes("PROTECTED")); assert.ok(adminClasses.includes("REDIRECT")); assert.ok(adminClasses.includes("NOT_FOUND"));
  await layoutPage.screenshot({ path: "artifacts/e2e/v32-admin-surface.png" });

  const positions = await layoutPage.evaluate(() => ({ nav: document.querySelector(".categories")?.getBoundingClientRect().top, content: document.querySelector(".tool-content")?.getBoundingClientRect().top }));
  await layoutPage.click(".target-focus-bar .focus-action:last-child");
  await layoutPage.waitForSelector(".manual-dialog");
  const modalPositions = await layoutPage.evaluate(() => ({ nav: document.querySelector(".categories")?.getBoundingClientRect().top, content: document.querySelector(".tool-content")?.getBoundingClientRect().top }));
  assert.deepEqual(modalPositions, positions);
  await layoutPage.screenshot({ path: "artifacts/e2e/v32-manual-target.png" });
  await layoutPage.keyboard.press("Escape");
  await layoutPage.waitForSelector(".manual-dialog", { hidden: true });
  await layoutPage.click(".head-actions button");
  await layoutPage.waitForFunction(()=>document.querySelector(".head-actions button")?.textContent?.trim()==="TR");
  await layoutPage.screenshot({ path: "artifacts/e2e/v33-turkish.png" });
  await layoutPage.screenshot({ path: "artifacts/e2e/v34-main-tr.png" });
  await layoutPage.screenshot({ path: "artifacts/e2e/v32-turkish.png" });
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
    const target = document.querySelector(".target-card, .target-focus-bar")?.getBoundingClientRect();
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
  assert.equal(firstFailure(layoutErrors), undefined, firstFailure(layoutErrors));
  for(const [width,height] of [[420,560],[520,570],[640,570],[740,570],[800,600]]) { await layoutPage.setViewport({width,height}); const responsive=await layoutPage.evaluate(()=>{const target=document.querySelector(".target-focus-bar").getBoundingClientRect(),nav=document.querySelector(".categories").getBoundingClientRect();return{overflow:document.body.scrollWidth>document.body.clientWidth,targetBottom:target.bottom,navTop:nav.top,buttons:[...document.querySelectorAll(".target-focus-bar button")].every(item=>item.getBoundingClientRect().width>0)}});assert.equal(responsive.overflow,false,`body horizontal overflow at ${width}`);assert.ok(responsive.navTop>=responsive.targetBottom-1);assert.equal(responsive.buttons,true);}
  await layoutPage.setViewport({width:740,height:570}); await layoutPage.$eval(".tool-content",element=>element.scrollTop=0); await layoutPage.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]); assert.equal(await layoutPage.$eval(".focus-signal",element=>getComputedStyle(element).animationName),"none"); await layoutPage.screenshot({path:"artifacts/e2e/v33-reduced-motion.png"});
  console.log("Layout E2E: PASS");
} finally {
  clearTimeout(hardTimeout);
  await new Promise((resolveServer) => server.close(resolveServer));
  browser.disconnect();
  if (chromeProcess && !chromeProcess.killed) chromeProcess.kill("SIGTERM");
}
