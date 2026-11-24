// Zugriffsprotokoll: Beschriftungen und CSV-Export ohne Browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { agentLabel, outcomeText, targetText, toCsv } from "../src/auditview";

test("Agenten heißen nach Art und Aufgabe oder Projekt, sonst nach gekürzter ID", () => {
  assert.equal(agentLabel("agt-t1", { kind: "task", task: "Morgenbericht" }), "Geplante Aufgabe · Morgenbericht");
  assert.equal(agentLabel("agt-c1234567890", { kind: "cowork", project: "Steuer" }), "Cowork · Steuer");
  assert.equal(agentLabel("agt-c1234567890", { kind: "sub" }), "Teilaufgabe c1234567");
  assert.equal(agentLabel("agt-x", undefined), "Agent x");
});

test("Ziel: Methode, Server mit Pfad, Ordner, Dienst, Entitäten, Empfängerzahl", () => {
  assert.equal(targetText({ target: { method: "GET", host: "api.example.org", path: "/v1" } }), "GET api.example.org/v1");
  assert.equal(targetText({ target: { host: "cloud.example.org", container: "Privat" } }), "cloud.example.org [Privat]");
  assert.equal(targetText({ target: { service: "light.turn_on", entities: ["light.a", "light.b", "light.c", "light.d"] } }),
    "light.turn_on light.a, light.b, light.c +1");
  assert.equal(targetText({ target: { recipients: 2 } }), "2 Empfänger");
  assert.equal(targetText({ kind: "host_approval", host: "fremd.example" }), "fremd.example");
  assert.equal(targetText({}), "");
});

test("Ergebnis nennt, wer entschieden hat", () => {
  assert.equal(outcomeText({ outcome: "ok", decision: "auto" }), "ausgeführt");
  assert.equal(outcomeText({ outcome: "ok", decision: "once" }), "ausgeführt · einmal erlaubt");
  assert.equal(outcomeText({ outcome: "denied", decision: "rule" }), "durch Regel gesperrt");
  assert.equal(outcomeText({ kind: "run" }), "Lauf gestartet");
});

test("CSV: Semikolon, Anführungszeichen und keine Formeln", () => {
  const csv = toCsv([{ ts: 0, user: "u1", agent: "agt-c1", run: "r1", kind: "tool", tool: "http_request", write: true,
    creds: [{ name: "=HYPERLINK(\"x\")" }], target: { host: "a.example", path: "/p;q" }, outcome: "ok", decision: "auto" }],
  { u1: "Niko" }, { "agt-c1": { kind: "chat" } });
  const [head, row] = csv.trim().split("\n");
  assert.ok(head.startsWith("Zeit;Person;Agent"));
  assert.ok(row.includes(";Niko;Chat c1;agt-c1;"));
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.includes(`"a.example/p;q"`));
  assert.ok(row.includes(";ja;"));
});
