// Frontend-Tests: jede frontend/test/*.test.ts mit esbuild bündeln und mit dem Test-Runner von Node ausführen.
// Getestet wird Logik ohne Browser (Raster, Vorlesetext, Achsen, Versionsvergleich) – keine zusätzlichen Pakete nötig.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tests = readdirSync(here).filter(f => f.endsWith(".test.ts"));
const out = mkdtempSync(join(tmpdir(), "llmitmir-test-"));
try {
  await build({
    entryPoints: tests.map(f => join(here, f)), outdir: out, bundle: true, platform: "node", format: "esm",
    target: "node20", outExtension: { ".js": ".mjs" }, logLevel: "warning",
    external: ["typescript"],  // i18n.test.ts liest die Quellen mit dem TypeScript-Parser
    loader: { ".md": "text" },
  });
  const files = readdirSync(out).filter(f => f.endsWith(".mjs")).map(f => join(out, f));
  const res = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", env: { ...process.env, TZ: "Europe/Berlin" } });
  process.exitCode = res.status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
