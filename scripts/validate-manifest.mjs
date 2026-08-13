import { readFile, access, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const root = resolve("dist");
const m = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const forbidden = [
  "history",
  "cookies",
  "bookmarks",
  "browsingData",
  "debugger",
  "proxy",
  "management",
  "nativeMessaging",
  "clipboardRead",
];
const fail = [];
const panelSource = await readFile(resolve("src/styles/panel.css"), "utf8");
for (const pattern of [/@keyframes\b/i, /clip-path\s*:/i, /animation\s*:/i])
  if (pattern.test(panelSource)) fail.push(`decorative motion CSS forbidden: ${pattern.source}`);
const panelComponent = await readFile(resolve("src/sidepanel/SidePanel.tsx"), "utf8");
for (const term of ["focus-signal", "glitch", "scanline", "chromatic", "distortion", "jitter", "flicker"])
  if (panelComponent.toLowerCase().includes(term)) fail.push(`decorative effect forbidden: ${term}`);
if (m.manifest_version !== 3) fail.push("manifest_version");
if (!m.side_panel?.default_path) fail.push("side_panel");
if (m.action?.default_popup !== "popup.html")
  fail.push("action.default_popup missing");
if (!m.default_locale) fail.push("default_locale");
if (m.host_permissions?.length)
  fail.push("required host_permissions forbidden");
for (const x of forbidden)
  if (m.permissions?.includes(x)) fail.push(`forbidden permission ${x}`);
for (const x of ["activeTab", "scripting", "sidePanel", "storage"])
  if (!m.permissions?.includes(x)) fail.push(`missing permission ${x}`);
for (const x of ["http://*/*", "https://*/*"])
  if (!m.optional_host_permissions?.includes(x))
    fail.push(`missing optional ${x}`);
const paths = [
  m.background?.service_worker,
  m.side_panel?.default_path,
  m.action?.default_popup,
  ...Object.values(m.icons ?? {}),
  ...Object.values(m.action?.default_icon ?? {}),
];
for (const p of paths)
  try {
    await access(resolve(root, p));
  } catch {
    fail.push(`missing ${p}`);
  }
const popupPath = resolve(root, m.action?.default_popup ?? "popup.html");
try {
  const popup = await readFile(popupPath, "utf8");
  if (!popup.includes('<div id="root"></div>')) fail.push("popup root missing");
  for (const match of popup.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    const asset = match[1].startsWith("/")
      ? resolve(root, `.${match[1]}`)
      : resolve(dirname(popupPath), match[1]);
    try {
      await access(asset);
    } catch {
      fail.push(`missing popup asset ${match[1]}`);
    }
  }
} catch {
  fail.push("popup.html unreadable");
}
const productionText = await Promise.all(
  [m.action?.default_popup, m.side_panel?.default_path, m.background?.service_worker]
    .filter(Boolean)
    .map((path) => readFile(resolve(root, path), "utf8")),
);
if (productionText.some((text) => /localhost:|127\.0\.0\.1:|@vite\/client/.test(text)))
  fail.push("development runtime reference in production build");
const assetNames = await readdir(resolve(root, "assets"));
const fonts = assetNames.filter((name) => name.endsWith(".woff2"));
for (const weight of [400, 500, 600, 700])
  if (!fonts.some((name) => name.includes(`-${weight}-normal`))) fail.push(`missing Chakra Petch ${weight} font`);
for (const name of assetNames) {
  const contents = await readFile(resolve(root, "assets", name));
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com|@import\s+url\(["']?http/.test(contents.toString()))
    fail.push(`remote font reference in ${name}`);
}
if (fail.length) {
  console.error(fail.join("\n"));
  process.exit(1);
}
console.log("Manifest validation: PASS");
