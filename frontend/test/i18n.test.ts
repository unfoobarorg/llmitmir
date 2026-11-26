// Zweisprachigkeit: Jeder Text der Oberfläche läuft über t()/tb() und hat eine englische Übersetzung.
// Liest die Quellen mit dem TypeScript-Parser. Ausnahmen markiert ein Kommentar „i18n-ok“ in derselben oder der
// Zeile davor (z. B. Kennungen, Wortlisten der Spracherkennung), ganze Dateien „i18n-ok-file“.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import en from "../../custom_components/llmitmir/locales/en.json";
import { compile, lang, resolveLang, setLang, t, tb } from "../src/i18n";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const SRC = join(process.cwd(), "frontend", "src");
const EN = en as Record<string, string>;

const files: string[] = [];
(function walk(d: string) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts") && !p.endsWith("i18n.ts")) files.push(p);
  }
})(SRC);

const TFN = new Set(["t", "tb", "tr", "trb"]);
const GERMAN = /[äöüÄÖÜß„“]|\b(und|oder|nicht|der|die|das|ist|mit|für|von|auf|wird|kein|keine|noch|bitte|jetzt|nur|wenn|hier|dein|deine|sich|wie|zu|im|am|bei|nach|gibt|soll|kann|darf)\b/;

function scan() {
  const missing: string[] = [];   // t("…") ohne Übersetzung
  const raw: string[] = [];       // deutscher Text außerhalb von t()
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (src.includes("i18n-ok-file")) continue;
    const lines = src.split("\n");
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
    const rel = relative(SRC, f);
    const ok = (pos: number) => { const l = sf.getLineAndCharacterOfPosition(pos).line; return /i18n-ok/.test(lines[l]) || /i18n-ok/.test(lines[l - 1] || ""); };
    const inCss = (n: any) => { for (let p = n.parent; p; p = p.parent) if (ts.isTaggedTemplateExpression(p)) return ts.isIdentifier(p.tag) && p.tag.text === "css"; return false; };
    (function visit(n: any) {
      const lit = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
      if (lit || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
        const p = n.parent;
        const tArg = lit && p && ts.isCallExpression(p) && p.arguments[0] === n && ts.isIdentifier(p.expression) && TFN.has(p.expression.text);
        const line = `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
        if (tArg) {
          if (["t", "tr"].includes(p.expression.text) && !(n.text in EN)) missing.push(`${line} ${JSON.stringify(n.text)}`);
        } else if (!inCss(n) && !ok(n.getStart()) && !(n.text in EN) && !(p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)))) {
          // sichtbarer Text: ohne Tags und Attribute
          const vis = n.text.replace(/<[^>]*>/g, " ").replace(/\b[\w-]+=("[^"]*"|'[^']*')/g, " ").replace(/^[^<]*>|<[^>]*$/g, " ");
          if (GERMAN.test(vis) && /[A-Za-zÄÖÜäöüß]{3,}\s+[A-Za-zÄÖÜäöüß]{2,}/.test(vis)) raw.push(`${line} ${JSON.stringify(n.text.slice(0, 120))}`);
        }
      }
      ts.forEachChild(n, visit);
    })(sf);
  }
  return { missing, raw };
}

test("jeder Text in t() hat eine englische Übersetzung", () => {
  const { missing } = scan();
  assert.deepEqual(missing, [], `Ohne Übersetzung in locales/en.json:\n${missing.join("\n")}`);
});

test("kein deutscher Text der Oberfläche steht außerhalb von t()", () => {
  const { raw } = scan();
  assert.deepEqual(raw, [], `Nicht übersetzbar (t() fehlt oder „i18n-ok“):\n${raw.join("\n")}`);
});

test("Übersetzungen nutzen nur Platzhalter des deutschen Textes", () => {
  // weglassen ist erlaubt (deutsche Endungen wie „Minute{p1}“), erfinden nicht
  const bad: string[] = [];
  const ph = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]));
  for (const [k, v] of Object.entries(EN)) {
    if (/\{\{/.test(k)) continue;  // {{cred:…}} und Jinja sind keine Platzhalter
    const known = ph(k);
    if ([...ph(v)].some(x => !known.has(x))) bad.push(`${JSON.stringify(k)} → ${JSON.stringify(v)}`);
  }
  assert.deepEqual(bad, []);
});

test("Sprache: gespeicherte Wahl, sonst Home Assistant, unbekannte Sprachen werden Englisch", () => {
  assert.equal(resolveLang("de", "en-US"), "de");
  assert.equal(resolveLang("en", "de-DE"), "en");
  assert.equal(resolveLang("auto", "en-GB"), "en");
  assert.equal(resolveLang("auto", "de"), "de");
  assert.equal(resolveLang("auto", "fr"), "en");
  assert.equal(resolveLang(undefined, ""), "de");
});

test("t() und tb() übersetzen, auch Servertexte mit Platzhaltern", () => {
  setLang("en", "en-GB");
  try {
    assert.equal(lang(), "en");
    assert.equal(t("Speichern"), "Save");
    assert.equal(t("{n} Tage", { n: 3 }), "3 days");
    assert.equal(tb("Zugang „Mail“ nicht verfügbar"), "Credential “Mail” not available");
    assert.equal(tb("montags, freitags um 07:00"), "Mondays, Fridays at 07:00");
    assert.equal(tb("ganz unbekannter Text"), "ganz unbekannter Text");
  } finally { setLang("de", ""); }
  assert.equal(t("Speichern"), "Speichern");
  assert.equal(tb("Zugang „Mail“ nicht verfügbar"), "Zugang „Mail“ nicht verfügbar");
});

test("Muster: genauere zuerst", () => {
  const p = compile({ "{a} und {b}": "x", "Zugang {n} und {m} fehlt": "y" });
  assert.equal(p[0][1], "Zugang {n} und {m} fehlt");
});
