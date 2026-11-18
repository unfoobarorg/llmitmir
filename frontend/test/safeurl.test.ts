// Was das Panel ohne Klick laden darf: Bilder in Antworten dürfen keine Daten nach draußen tragen (S3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { blockedImageLabel, linkable, loadsSafely } from "../src/safeurl";

const HA = "https://ha.example.org";

test("fremde Bilder lädt das Panel nicht von selbst", () => {
  for (const src of ["https://evil.example/p.png?d=geheim", "http://evil.example/x", "//evil.example/x.png",
                     "https://ha.example.org.evil.io/x.png", "javascript:alert(1)", "", "   "]) {
    assert.equal(loadsSafely(src, HA), false, src);
  }
});

test("eigene API-Adressen bleiben gesperrt – sie würden ohne Token als Fehlanmeldung zählen", () => {
  for (const src of ["/api/states", "/api/llmitmir/file/chat/c1/x.png", "/auth/token", "https://ha.example.org/API/x"]) {
    assert.equal(loadsSafely(src, HA), false, src);
  }
});

test("eingebettete Bilder, Blobs und /local sind erlaubt", () => {
  for (const src of ["data:image/png;base64,iVBORw0KGgo=", "data:image/svg+xml,%3Csvg%3E", "blob:https://ha.example.org/123",
                     "/local/bild.png", "https://ha.example.org/local/x.jpg"]) {
    assert.equal(loadsSafely(src, HA), true, src);
  }
  assert.equal(loadsSafely("data:text/html,<script>", HA), false);
});

test("an die Stelle des Bildes tritt ein Link mit Server, nur für http(s)", () => {
  assert.equal(blockedImageLabel("Diagramm", "https://evil.example/p.png"), "🖼 Diagramm (evil.example, nicht geladen)");
  assert.equal(blockedImageLabel("", "kaputt"), "🖼 Bild (nicht geladen)");
  assert.ok(linkable("https://x.example/a.png") && !linkable("javascript:alert(1)") && !linkable("data:image/png;base64,x"));
});
