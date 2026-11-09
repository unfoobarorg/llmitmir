// Writes the license texts of all npm packages bundled into llmitmir-panel.js next to the bundle.
// Part of `npm run build`; fails if a bundled package has no license file.
import { build } from "esbuild";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = "custom_components/llmitmir/frontend/THIRD_PARTY_LICENSES.txt";
const { metafile } = await build({
  entryPoints: ["frontend/src/main.ts"], bundle: true, format: "esm", target: "es2021",
  loader: { ".md": "text" }, metafile: true, write: false, logLevel: "silent",
});
const pkgs = [...new Set(Object.keys(metafile.inputs)
  .map((p) => p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1])
  .filter(Boolean))].sort();

let text = "Third-party software bundled in llmitmir-panel.js\n"
  + "==================================================\n";
for (const name of pkgs) {
  const dir = join("node_modules", name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`Keine Lizenzdatei für ${name}`);
  text += `\n\n${pkg.name} ${pkg.version} (${pkg.license})\n${"-".repeat(60)}\n\n`
    + readFileSync(join(dir, file), "utf8").trim() + "\n";
}
writeFileSync(out, text);
