// Läuft im Browser noch eine ältere Oberfläche als auf dem Server? (ohne Browser testbar)
//
// Nach einem Update startet Home Assistant neu, aber eine offene Seite – vor allem die Home-Assistant-App, die
// ihre Ansicht tagelang behält – arbeitet mit dem alten Panel-Skript weiter: Sie verbindet sich neu, lädt das
// Skript aber erst bei einem vollständigen Neuladen. Neue Funktionen fehlen dann scheinbar. Das Panel vergleicht
// deshalb seine eigene Version mit der des Servers und bietet das Neuladen an.

/** Version, mit der dieses Skript ausgeliefert wurde (`…/llmitmir-panel.js?v=0.30.0`), sonst "". */
export function builtVersion(url: string | undefined): string {
  try { return new URL(url || "", "http://x").searchParams.get("v") || ""; } catch { return ""; }
}

/** `built`: Version des Skripts (falls bekannt); `first`: Version des Servers beim ersten Verbinden;
 *  `server`: Version des Servers jetzt. */
export function isStale(built: string, first: string, server: string): boolean {
  const mine = built || first;
  return !!server && !!mine && server !== mine;
}
