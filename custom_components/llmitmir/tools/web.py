"""Web search (DuckDuckGo HTML or SearXNG) and page fetching."""
from __future__ import annotations

import asyncio
import ipaddress
import re
import time
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


def _ip(host: str):
    try:
        return ipaddress.ip_address(str(host or "").strip("[]"))
    except ValueError:
        return None


_OWN_IPS: dict = {"at": 0.0, "key": None, "ips": frozenset()}


async def _own_ips(hosts: set[str]) -> frozenset:
    """Die IP-Adressen, unter denen diese Home-Assistant-Instanz erreichbar ist (zehn Minuten gemerkt)."""
    key = tuple(sorted(hosts))
    if _OWN_IPS["key"] == key and time.monotonic() - _OWN_IPS["at"] < 600:
        return _OWN_IPS["ips"]
    loop = asyncio.get_running_loop()
    ips = set()
    for h in hosts:
        if (ip := _ip(h)) is not None:
            ips.add(ip)
            continue
        try:
            infos = await asyncio.wait_for(loop.getaddrinfo(h, None), timeout=2)
        except (OSError, asyncio.TimeoutError, UnicodeError):
            continue
        ips |= {ip for *_x, sa in infos if (ip := _ip(sa[0])) is not None}
    _OWN_IPS.update(at=time.monotonic(), key=key, ips=frozenset(ips))
    return _OWN_IPS["ips"]


async def blocked(ctx, url: str) -> str | None:
    """Wie blocked_url, zusätzlich für IP-Adressen: Loopback und die Adressen dieser Instanz selbst."""
    if (b := blocked_url(ctx, url)):
        return b
    ip = _ip(urllib.parse.urlparse(url).hostname or "")
    if ip is None:
        return None
    if ip.is_loopback or ip.is_unspecified or ip in await _own_ips(own_ha_hosts(ctx.hass)):
        return HA_BLOCK
    return None


REDIRECTS = (301, 302, 303, 307, 308)


async def fetch(ctx, method: str, url: str, *, limit: int, credentialed: bool = False, max_redirects: int = 8,
                **kw) -> dict:
    """Eine Anfrage, Weiterleitungen Schritt für Schritt: jedes Ziel wird geprüft (diese Instanz bleibt gesperrt),
    und mit Zugangsdaten wird keiner Weiterleitung auf einen anderen Server gefolgt – sonst gingen eigene Header
    (API-Schlüssel) dorthin mit. Ergebnis: status, data, cut, ctype, charset, url – oder error."""
    for _hop in range(max_redirects + 1):
        if (b := await blocked(ctx, url)):
            return {"error": b}
        async with ctx.session.request(method, url, allow_redirects=False, **kw) as r:
            loc = r.headers.get("Location") or r.headers.get("location")
            if r.status in REDIRECTS and loc:
                nxt = urllib.parse.urljoin(url, loc)
                if credentialed and (urllib.parse.urlparse(nxt).hostname or "").lower() != \
                        (urllib.parse.urlparse(url).hostname or "").lower():
                    data, cut = await read_body(r, limit)
                    return {"status": r.status, "data": data, "cut": cut, "ctype": r.headers.get("content-type", ""),
                            "charset": getattr(r, "charset", None), "url": url, "redirect_not_followed": nxt}
                if r.status == 303 or (r.status in (301, 302) and method.upper() not in ("GET", "HEAD")):
                    method = "GET"
                    kw.pop("data", None)
                url = nxt
                continue
            data, cut = await read_body(r, limit)
            return {"status": r.status, "data": data, "cut": cut, "ctype": r.headers.get("content-type", ""),
                    "charset": getattr(r, "charset", None), "url": url}
    return {"error": f"Fehler: mehr als {max_redirects} Weiterleitungen"}


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
    res = await fetch(ctx, "GET", url, limit=15_000_000, headers={"User-Agent": UA, "Accept-Language": "de,en;q=0.8"},
                      timeout=aiohttp.ClientTimeout(total=45))
    if res.get("error"):
        return res["error"]
    ctype, data, status, url = res["ctype"], res["data"], res["status"], res["url"]
    if status >= 400:
        return f"Fehler: HTTP {status}"
    from .files import extract_document

    if "html" in ctype or data[:200].lstrip().lower().startswith((b"<!doctype html", b"<html")):
        title, text, links = html_to_text(data.decode(res.get("charset") or "utf-8", "ignore"))
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
