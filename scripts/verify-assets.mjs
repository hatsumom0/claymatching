import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const htmlFiles = [
  "claymatching/index.html",
  "claymatching/account-deletion/index.html",
  "privacy/index.html",
];
const requiredRuntimeAssets = [
  "apps/noctweave-web-core/noctweave-core-adapter.js",
  "apps/noctweave-web-core/NOTICE.noctweave-js.txt",
  "apps/noctweave-web-core/wasm/dist/noctweave_oqs.js",
  "apps/noctweave-web-core/wasm/dist/noctweave_oqs.wasm",
  "claymatching/sui-dist/sui-wallet.js",
];

const missing = [];
for (const relative of htmlFiles) {
  const html = await readFile(path.join(site, relative), "utf8");
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const reference = match[1].split(/[?#]/, 1)[0];
    if (!reference || /^(?:https?:|mailto:|data:|#)/.test(reference)) continue;
    const normalized = reference === "/"
      ? "/claymatching/index.html"
      : reference.endsWith("/")
        ? `${reference}index.html`
        : reference;
    const destination = path.join(site, normalized.replace(/^\//, ""));
    try { await access(destination); } catch { missing.push(`${relative}: ${reference}`); }
  }
}
for (const relative of requiredRuntimeAssets) {
  try { await access(path.join(site, relative)); } catch { missing.push(`runtime: /${relative}`); }
}
if (missing.length) throw new Error(`Missing Claymatching assets or links:\n${missing.join("\n")}`);
console.log(`Verified ${htmlFiles.length} HTML documents and ${requiredRuntimeAssets.length} runtime assets.`);
