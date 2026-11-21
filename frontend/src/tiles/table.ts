// Zellen einer Tabellen-Kachel: welche Klasse und welche Textfarbe eine Spalte bekommt.
// Rein und ohne Browser, damit es ohne DOM testbar bleibt (frontend/test/table.test.ts).

const COLOR = /^#[0-9a-fA-F]{6}$/;

/** Gültige Spaltenfarbe oder null – nur ein volles #rrggbb, damit im style-Attribut nichts anderes landet. */
export function cellColor(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return COLOR.test(s) ? s : null;
}

/** Klassen einer Zelle: rechtsbündige Zahl, fett gesetzte Spalte, dazu was der Aufrufer mitgibt. */
export function cellClass(col: any, extra = ""): string {
  return [col?.type === "number" ? "num" : "", col?.strong === true ? "strong" : "", extra].filter(Boolean).join(" ");
}
