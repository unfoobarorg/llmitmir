// Sprachgespräch: Text zum Vorlesen aufbereiten und in Sätze teilen (ohne Browser testbar).

/** Markdown und alles, was sich nicht vorlesen lässt, entfernen. */
export function speakable(md: string): string {
  let s = md || "";
  s = s.replace(/```[\s\S]*?(```|$)/g, " ");                       // Code-Blöcke: nicht vorlesen
  s = s.replace(/<think>[\s\S]*?(<\/think>|$)/g, " ");
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");                  // Bilder
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");                   // Links: nur der Text
  s = s.replace(/https?:\/\/(?:www\.)?([^\s/)>\]]+)[^\s)>\]]*/g, "$1");   // nackte Adressen: nur der Name der Seite
  s = s.replace(/<[^>]{1,80}>/g, " ");
  s = s.replace(/^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/gm, " ");     // Trennzeile einer Tabelle
  s = s.replace(/[ \t]*\|[ \t]*/g, ", ");                               // Tabellenzellen
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");                        // Überschriften
  s = s.replace(/^\s{0,3}>\s?/gm, "");                             // Zitate
  s = s.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, "");                // Aufzählungszeichen
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, " ");                       // Trennlinien
  s = s.replace(/(\*\*|__|~~|`)/g, "");
  s = s.replace(/(^|[\s(„"])[*_]([^*_\n]+)[*_](?=$|[\s).,;:!?“"])/g, "$1$2");
  s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "");   // Emojis
  // Zeilenenden werden zu Satzgrenzen, damit Listenpunkte nicht ineinanderlaufen
  s = s.split(/\n+/).map(l => l.trim().replace(/^[,\s]+|[,\s]+$/g, "")).filter(Boolean)
    .map(l => (/[.!?…:;,]$/.test(l) ? l : l + ".")).join(" ");
  return s.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

// Punkt nach diesen Wörtern beendet keinen Satz
const ABBR = /(?:^|[\s(.])(?:\p{L}|bzw|ca|etc|ggf|inkl|evtl|usw|vgl|nr|tel|str|dr|prof|min|max|mind|sog|bspw|zzgl|abs|e\.g|i\.e|vs|mr|mrs|ms|no|st)\.$/iu;

/** Liefert aus einem wachsenden Text (Streaming) nach und nach vorlesbare Stücke: ganze Sätze, kurze
 *  zusammengefasst, das erste Stück möglichst früh, damit die Antwort schnell beginnt. */
export class SentenceFeed {
  private offset = 0;
  private first = true;
  closed = false;

  /** Erst ab hier vorlesen: Was davor steht, ist schon gelesen (ein laufender Chat wird ins Gespräch übernommen).
   *  Beginnt am nächsten Satzanfang, damit nicht mitten im Satz eingesetzt wird. */
  startAt(text: string): this {
    const tail = text.search(/[.!?…]\s+\S*$/);
    this.offset = tail >= 0 ? tail + 1 : text.length;
    this.first = false;
    return this;
  }

  push(text: string, final: boolean): string[] {
    if (this.closed) return [];
    const out: string[] = [];
    for (;;) {
      const rest = text.slice(this.offset);
      const cut = final ? this.cut(rest) ?? rest.length : this.cut(rest);
      if (!cut) break;
      const piece = speakable(rest.slice(0, cut));
      this.offset += cut;
      if (piece && /[\p{L}\p{N}]/u.test(piece)) { out.push(piece); this.first = false; }
      if (this.offset >= text.length) break;
    }
    if (final) this.closed = true;
    return out;
  }

  /** Ende des nächsten Stücks in `rest` (Index hinter der Satzgrenze) oder null, wenn noch keins vollständig ist. */
  private cut(rest: string): number | null {
    const min = this.first ? 14 : 48;
    const re = /([.!?…]["”“»)\]]*)(\s+)|(:)(\s*\n)|\n{1,}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      const end = m.index + m[0].length;
      const head = rest.slice(0, m.index + (m[1] || m[3] || "").length);
      if ((head.match(/```/g) || []).length % 2) continue;                       // mitten in einem Code-Block
      if (m[1] === ".") {
        if (/\d\.$/.test(head) && !/\n/.test(m[2] || "")) continue;                 // „14. November“, „3. Schritt“
        if (ABBR.test(head)) continue;
      }
      if (head.trim().length < min) continue;
      return end;
    }
    // sehr langer Satz ohne Ende: an einem Komma oder Leerzeichen teilen, damit es nicht stockt
    if (rest.length > 320 && !((rest.match(/```/g) || []).length % 2)) {
      const part = rest.slice(0, 300);
      const at = Math.max(part.lastIndexOf(", "), part.lastIndexOf("; "), part.lastIndexOf(" – "));
      return (at > 80 ? at + 1 : part.lastIndexOf(" ")) + 1;
    }
    return null;
  }
}

/** Was die Spracherkennung aus Stille oder Rauschen gern erfindet – das ist keine Nachricht. */
export function isNoise(text: string): boolean {
  const s = (text || "").trim();
  if (!/[\p{L}\p{N}]/u.test(s)) return true;
  if (/^[\[(♪*].*[\])♪*]$/.test(s)) return true;                                   // [Musik], (Applaus), * räuspert sich *
  return /untertitel|amara\.org|copyright\s+(wdr|zdf|swr|ard)|im auftrag des (zdf|wdr|swr)|subtitles? by|thanks? for watching|vielen dank f(ü|ue)rs zuschauen/i.test(s);
}

/** Aus einem Chat ins Gespräch gewechselt: die letzte Antwort kurz anteasern, damit klar ist, wo es weitergeht.
 *  Nur die ersten Sätze – eine lange Antwort komplett vorzulesen, bevor man selbst zu Wort kommt, nervt. */
export function resumeText(md: string, maxSentences = 2, maxChars = 320): string {
  // Tausenderpunkte (1.234,56) sind keine Satzenden – sonst bliebe „Betrag: 1.“ übrig
  const text = speakable(md).replace(/(\d)\.(\d{3})/g, "$1\u0001$2").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const parts = text.match(/[^.!?…]+[.!?…]+["“”»)\]]*|[^.!?…]+$/g) || [text];
  let out = "";
  for (const part of parts.slice(0, maxSentences)) {
    if (out && (out + part).length > maxChars) break;
    out += part;
  }
  out = out.trim().replace(/\u0001/g, ".");
  if (out.length > maxChars) out = out.slice(0, maxChars).replace(/\s+\S*$/, "") + " …";
  return out;
}
