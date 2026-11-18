// Vorlesetext, Zahlen und Achsen der Kacheln, Versionsvergleich – Logik ohne Browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isNoise, speakable, SentenceFeed } from "../src/voicetext";
import { fmtNumber, niceTicks, barPath } from "../src/tiles/svg";
import { builtVersion, isStale } from "../src/version";

test("speakable liest kein Markdown, keinen Code und keine Adressen vor", () => {
  const s = speakable("## Titel\n\n**Fett** und `code`\n\n```js\nalert(1)\n```\n- Punkt [Link](https://example.org/x?y=1)\n![Bild](https://evil.example/p.png)");
  assert.ok(!/[#*`]/.test(s), s);
  assert.ok(!s.includes("alert"), s);
  assert.ok(!s.includes("https://"), s);
  assert.ok(s.includes("Titel") && s.includes("Fett") && s.includes("Link"), s);
});

test("speakable trennt Listenpunkte als Sätze", () => {
  assert.equal(speakable("- eins\n- zwei"), "eins. zwei.");
});

test("Gedankengänge des Modells werden nicht vorgelesen", () => {
  assert.equal(speakable("<think>geheime Überlegung</think>Antwort"), "Antwort.");
});

test("SentenceFeed liefert jeden Text genau einmal", () => {
  const feed = new SentenceFeed();
  const text = "Das ist der erste Satz. Hier kommt der zweite Satz! Und der dritte";
  const parts = [...feed.push(text.slice(0, 30), false), ...feed.push(text, true)];
  const joined = parts.join(" ");
  for (const w of ["erste", "zweite", "dritte"]) assert.equal(joined.split(w).length - 1, 1, joined);
  assert.deepEqual(feed.push(text + " Nachzügler.", true), []);
});

test("isNoise erkennt leere Erkennungen", () => {
  assert.ok(isNoise(""));
  assert.ok(!isNoise("Schalte bitte das Licht im Flur an"));
});

test("niceTicks deckt den Bereich ab und steigt", () => {
  for (const [lo, hi] of [[0, 7], [-3.2, 18.9], [5, 5], [0.001, 0.009], [1200, 98000]]) {
    const t = niceTicks(lo, hi);
    assert.ok(t.length >= 2, `${lo}-${hi}`);
    assert.ok(t[0] <= lo && t[t.length - 1] >= hi, `${lo}-${hi}: ${t}`);
    assert.ok(t.every((v, i) => i === 0 || v > t[i - 1]));
  }
  assert.deepEqual(niceTicks(NaN, 1), []);
});

test("fmtNumber schreibt deutsch und fängt Unsinn ab", () => {
  assert.equal(fmtNumber(1234.5), "1.235");
  assert.equal(fmtNumber(3.14159), "3,14");
  assert.equal(fmtNumber(NaN), "–");
  assert.equal(fmtNumber(2_500_000), "2,5 Mio.");
  assert.equal(barPath(0, 0, 10, 0), "");
});

test("Versionsvergleich bietet nur bei echter Abweichung das Neuladen an", () => {
  assert.equal(builtVersion("/llmitmir_static/llmitmir-panel.js?v=1.0.0"), "1.0.0");
  assert.equal(builtVersion(undefined), "");
  assert.ok(isStale("0.41.0", "", "1.0.0"));
  assert.ok(!isStale("1.0.0", "", "1.0.0"));
  assert.ok(!isStale("", "", "1.0.0"));
  assert.ok(isStale("", "0.41.0", "1.0.0"));
});
