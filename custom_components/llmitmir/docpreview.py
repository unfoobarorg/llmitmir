"""DOCX und XLSX als lesbares HTML für den Betrachter (rein, unit-getestet).

Der Betrachter im Panel zeigt Bilder, PDFs, Texte, Ton und Video. Word- und Excel-Dateien landeten
bisher beim Herunterladen. Hier werden sie zu einem schlichten HTML-Ausschnitt: Absätze aus
``word/document.xml``, Tabellen aus den Blatt-XMLs einer Arbeitsmappe.

Sicherheit: Es wird ausschließlich Text ausgegeben, nie Markup aus der Datei. Jeder Wert wird maskiert,
Formeln, Makros und externe Verweise werden nicht übernommen. Die Datei wird nur gelesen, nie geschrieben.
"""
from __future__ import annotations

import io
import re
import zipfile
from html import escape
from xml.etree import ElementTree as ET

MAX_CHARS = 400_000     # so viel HTML höchstens (der Betrachter soll flüssig bleiben)
MAX_ROWS = 500          # je Blatt
MAX_COLS = 40           # je Zeile
MAX_SHEETS = 12

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def _clip(html: str) -> str:
    if len(html) <= MAX_CHARS:
        return html
    return html[:MAX_CHARS] + "\n<p><i>… gekürzt, die Datei ist länger.</i></p>"


def docx_html(data: bytes) -> str:
    """Absätze und Tabellen eines Word-Dokuments als HTML."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    out: list[str] = []
    body = root.find(f"{W}body")
    if body is None:
        return "<p><i>Das Dokument enthält keinen Text.</i></p>"
    for el in body:
        tag = el.tag
        if tag == f"{W}p":
            text = "".join(t.text or "" for t in el.iter(f"{W}t"))
            if text.strip():
                out.append(f"<p>{escape(text)}</p>")
        elif tag == f"{W}tbl":
            rows = []
            for tr in el.findall(f"{W}tr"):
                cells = []
                for tc in tr.findall(f"{W}tc"):
                    cells.append(escape(" ".join("".join(t.text or "" for t in p.iter(f"{W}t"))
                                                 for p in tc.findall(f"{W}p")).strip()))
                rows.append("<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>")
            if rows:
                out.append("<table>" + "".join(rows) + "</table>")
    return _clip("".join(out) or "<p><i>Das Dokument enthält keinen Text.</i></p>")


def _shared_strings(z: zipfile.ZipFile) -> list[str]:
    try:
        xml = z.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(xml)
    out = []
    for si in root.findall(f"{S}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{S}t")))
    return out


def _col_index(ref: str) -> int:
    """„C7“ → 2 (nullbasiert)."""
    letters = re.match(r"([A-Z]+)", ref or "")
    if not letters:
        return 0
    n = 0
    for ch in letters.group(1):
        n = n * 26 + (ord(ch) - 64)
    return max(0, n - 1)


def _sheet_names(z: zipfile.ZipFile) -> list[tuple[str, str]]:
    """(Name, Pfad im Archiv) je Blatt, in der Reihenfolge der Arbeitsmappe."""
    try:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    except (KeyError, ET.ParseError):
        return []
    targets = {r.get("Id"): r.get("Target") or "" for r in rels}
    out = []
    for sh in wb.iter(f"{S}sheet"):
        target = targets.get(sh.get(f"{R}id"), "")
        if not target:
            continue
        path = target.lstrip("/")
        if not path.startswith("xl/"):
            path = "xl/" + path
        out.append((sh.get("name") or "Blatt", path))
    return out


def xlsx_html(data: bytes) -> str:
    """Jedes Blatt einer Arbeitsmappe als HTML-Tabelle."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        strings = _shared_strings(z)
        sheets = _sheet_names(z)
        if not sheets:
            # Ohne Arbeitsmappen-Verzeichnis: die Blätter in der Reihenfolge, wie sie im Archiv liegen
            sheets = [(f"Blatt {i + 1}", n) for i, n in
                      enumerate(sorted(n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)))]
        out: list[str] = []
        for name, path in sheets[:MAX_SHEETS]:
            try:
                root = ET.fromstring(z.read(path))
            except (KeyError, ET.ParseError):
                continue
            rows: list[str] = []
            for row in root.iter(f"{S}row"):
                cells: dict[int, str] = {}
                for c in row.findall(f"{S}c"):
                    t = c.get("t")
                    v = c.find(f"{S}v")
                    if t == "inlineStr":
                        text = "".join(x.text or "" for x in c.iter(f"{S}t"))
                    elif v is None:
                        text = ""
                    elif t == "s":
                        try:
                            text = strings[int(v.text or "0")]
                        except (ValueError, IndexError):
                            text = ""
                    else:
                        text = v.text or ""
                    if text.strip():
                        cells[_col_index(c.get("r") or "")] = text
                if not cells:
                    continue
                width = min(max(cells) + 1, MAX_COLS)
                tds = "".join(f"<td>{escape(cells.get(i, ''))}</td>" for i in range(width))
                rows.append(f"<tr>{tds}</tr>")
                if len(rows) >= MAX_ROWS:
                    rows.append("<tr><td><i>… gekürzt</i></td></tr>")
                    break
            if rows:
                out.append(f"<h3>{escape(name)}</h3><table>{''.join(rows)}</table>")
    return _clip("".join(out) or "<p><i>Die Arbeitsmappe enthält keine Werte.</i></p>")


def to_html(name: str, data: bytes) -> str | None:
    """HTML für eine Word- oder Excel-Datei, sonst None (dann bleibt es beim Herunterladen)."""
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    if ext == "docx":
        return docx_html(data)
    if ext == "xlsx":
        return xlsx_html(data)
    return None
