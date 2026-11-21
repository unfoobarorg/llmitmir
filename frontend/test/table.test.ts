// Tabellen-Kachel: Spaltenfarbe und Zellklassen (Fettdruck, rechtsbündige Zahlen) – Logik ohne Browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cellClass, cellColor } from "../src/tiles/table";

test("nur ein volles #rrggbb wird zur Spaltenfarbe", () => {
  assert.equal(cellColor("#3f8f5b"), "#3f8f5b");
  assert.equal(cellColor(" #3F8F5B "), "#3F8F5B");
  for (const bad of ["#fff", "rot", "red; background:url(x)", "#3f8f5", "#3f8f5b7", "", null, undefined, 42, {}]) {
    assert.equal(cellColor(bad), null, String(bad));
  }
});

test("Zellklassen: Zahl rechtsbündig, starke Spalte fett, Fußzeile zusätzlich", () => {
  assert.equal(cellClass({ type: "number" }), "num");
  assert.equal(cellClass({ type: "text", strong: true }), "strong");
  assert.equal(cellClass({ type: "number", strong: true }, "tf"), "num strong tf");
  assert.equal(cellClass({ type: "text" }), "");
  assert.equal(cellClass({ type: "text", strong: "ja" }), "");   // nur ein echtes true zählt
  assert.equal(cellClass(undefined), "");
});
