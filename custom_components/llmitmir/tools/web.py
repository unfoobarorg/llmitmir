"""Web search (DuckDuckGo HTML or SearXNG) and page fetching."""
from __future__ import annotations

import re
import urllib.parse
from html import unescape
from html.parser import HTMLParser

import aiohttp

from . import Tool, obj, read_body, register

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 LLMitMir"


class _Text(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "head", "template", "iframe"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "header",
             "footer", "table", "ul", "ol", "pre", "blockquote"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0
        self.title = ""
        self._in_title = False
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._link_text = ""

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        if tag == "title":
            self._in_title = True
        if tag in self.BLOCK:
            self.out.append("\n")
        if tag in ("h1", "h2", "h3"):
            self.out.append("#" * int(tag[1]) + " ")
        if tag == "li":
            self.out.append("- ")
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._link_text = ""

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        if tag == "title":
            self._in_title = False
        if tag in self.BLOCK:
            self.out.append("\n")
        if tag == "a" and self._href:
            if self._link_text.strip() and len(self.links) < 60:
                self.links.append((self._link_text.strip()[:80], self._href))
            self._href = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self.skip:
            return
        self.out.append(data)
        if self._href is not None:
            self._link_text += data

    def text(self) -> str:
        t = "".join(self.out)
        t = re.sub(r"[ \t\r\f\v]+", " ", t)
        t = re.sub(r"\n\s*\n\s*\n+", "\n\n", t)
        return t.strip()


def html_to_text(html: str) -> tuple[str, str, list]:
    p = _Text()
    try:
        p.feed(html)
    except Exception:  # noqa: BLE001 - broken HTML should not kill the tool
        pass
    return p.title.strip(), p.text(), p.links


def parse_ddg(html: str, limit: int = 8) -> list[dict]:
    """Parse DuckDuckGo HTML results."""
    results = []
    for m in re.finditer(r'<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>(.*?)(?=<a[^>]+class="result__a"|$)',
                         html, re.S):
        href, title, rest = m.groups()
        if "uddg=" in href:
            href = urllib.parse.unquote(re.search(r"uddg=([^&]+)", href).group(1))
        if href.startswith("//"):
            href = "https:" + href
        if "duckduckgo.com/y.js" in href or "ad_provider" in href:
            continue  # ads
        snip = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', rest, re.S)
        clean = lambda s: unescape(re.sub(r"<[^>]+>", "", s or "")).strip()  # noqa: E731
        results.append({"titel": clean(title), "url": href, "auszug": clean(snip.group(1) if snip else "")})
        if len(results) >= limit:
            break
    return results


def own_ha_hosts(hass) -> set[str]:
    """Hostnames under which this Home Assistant is reachable (HTTP access to it is blocked for the model)."""
    hosts = {"localhost", "127.0.0.1", "homeassistant", "homeassistant.local"}
    for u in (hass.config.internal_url, hass.config.external_url):
        if u:
            hosts.add(urllib.parse.urlparse(u).hostname or "")
    try:
        from homeassistant.helpers.network import get_url

        for kw in ({"prefer_external": True}, {"prefer_external": False}):
            try:
                hosts.add(urllib.parse.urlparse(get_url(hass, **kw)).hostname or "")
            except Exception:  # noqa: BLE001
                pass
    except ImportError:
        pass
    hosts.discard("")
    return hosts


HA_BLOCK = ("Fehler: Diese Home-Assistant-Instanz nicht per HTTP ansprechen – nutze die Werkzeuge ha_states, ha_history, "
            "ha_service und ha_ws (sie laufen mit den Rechten der Person, ohne Token). Fehlversuche per HTTP gelten in HA als "
            "Login-Angriffe und können zur Sperre führen.")


def blocked_url(ctx, url: str) -> str | None:
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    if host in own_ha_hosts(ctx.hass):
        return HA_BLOCK
    return None


async def web_search(ctx, a: dict):
    q = str(a.get("anfrage") or a.get("query") or "").strip()
    if not q:
        return "Fehler: leere Suchanfrage"
    cfg = ctx.manager.config.data.get("search") or {}
    session = ctx.session
    if cfg.get("provider") == "searxng" and cfg.get("searxng_url"):
        url = cfg["searxng_url"].rstrip("/") + "/search"
        async with session.get(url, params={"q": q, "format": "json", "language": a.get("sprache") or "de"},
                               timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json(content_type=None)
        res = [{"titel": x.get("title"), "url": x.get("url"), "auszug": (x.get("content") or "")[:300]}
               for x in (data.get("results") or [])[:8]]
    else:
        async with session.post("https://html.duckduckgo.com/html/", data={"q": q, "kl": "de-de"},
                                headers={"User-Agent": UA, "Referer": "https://html.duckduckgo.com/"},
                                timeout=aiohttp.ClientTimeout(total=30)) as r:
            if r.status != 200:
                return f"Fehler: Suche nicht möglich (HTTP {r.status}). DuckDuckGo begrenzt automatische Anfragen – später erneut versuchen."
            html = await r.text()
        res = parse_ddg(html)
        if not res and "anomaly" in html.lower():
            return "Fehler: DuckDuckGo verlangt gerade eine Bestätigung (zu viele Anfragen). Später erneut versuchen."
    return {"anfrage": q, "ergebnisse": res} if res else f"Keine Ergebnisse für „{q}“."


async def web_fetch(ctx, a: dict):
    url = str(a.get("url") or "").strip()
    if not re.match(r"^https?://", url):
        return "Fehler: nur http(s)-Adressen"
    if "{{cred:" in url:
        return "Fehler: web_fetch setzt keine Zugänge ein – für Adressen mit Zugangsdaten http_request mit „zugang“ oder Platzhalter verwenden."
    if (b := blocked_url(ctx, url)):
        return b
    async with ctx.session.get(url, headers={"User-Agent": UA, "Accept-Language": "de,en;q=0.8"},
                               timeout=aiohttp.ClientTimeout(total=45), max_redirects=8) as r:
        ctype = r.headers.get("content-type", "")
        data, _ = await read_body(r, 15_000_000)
        status = r.status
    if status >= 400:
        return f"Fehler: HTTP {status}"
    from .files import extract_document

    if "html" in ctype or data[:200].lstrip().lower().startswith((b"<!doctype html", b"<html")):
        title, text, links = html_to_text(data.decode(r.charset or "utf-8", "ignore"))
        out = f"# {title}\nURL: {url}\n\n{text}"
        if a.get("links"):
            out += "\n\nLinks:\n" + "\n".join(f"- {t}: {urllib.parse.urljoin(url, h)}" for t, h in links)
        return out
    name = url.rsplit("/", 1)[-1].split("?")[0] or "download"
    return await extract_document(ctx, name, data, ctype, frage=a.get("frage"))


register(Tool("web_search", "web", "Sucht im Web (DuckDuckGo oder SearXNG) und liefert Titel, URL und Auszug der Treffer.",
              obj({"anfrage": {"type": "string"}, "sprache": {"type": "string", "description": "z. B. de"}}, ["anfrage"]),
              web_search, label="Websuche", icon="mdi:magnify"))
register(Tool("web_fetch", "web", "Ruft eine Webseite oder Datei (PDF, Bild, Text) ab und liefert den lesbaren Inhalt.",
              obj({"url": {"type": "string"}, "links": {"type": "boolean", "description": "Links mit ausgeben"},
                   "frage": {"type": "string", "description": "Bei Bildern/Scans: worauf achten"}}, ["url"]),
              web_fetch, label="Seite abrufen", icon="mdi:web"))
