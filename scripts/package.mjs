import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import pkg from "../package.json" with { type: "json" };
await mkdir("release", { recursive: true });
const out = `release/kagetarget-${pkg.version}.zip`;
await rm(out, { force: true });
const x = spawnSync("zip", ["-qr", `../${out}`, "."], {
  cwd: "dist",
  stdio: "inherit",
});
if (x.status !== 0) process.exit(x.status ?? 1);
console.log(out);
