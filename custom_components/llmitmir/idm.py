"""HA-Nutzerverwaltung mit Active Directory/LDAP (optional, Admin → Nutzerverwaltung).

LLMitMir liest Personen aus dem Verzeichnis (LDAPS, Bind-Konto mit Leserechten) und gleicht die Benutzer von Home
Assistant danach ab – nach Gruppen-Zuordnungen des Admins: Wer in einer zugeordneten Gruppe ist, bekommt einen
HA-Benutzer (Admin, wenn eine Admin-Gruppe passt) und auf Wunsch Zugriff auf LLMitMir. Wer aus allen Gruppen fällt oder
im Verzeichnis gesperrt ist, wird **deaktiviert, nie gelöscht**.

Grundsätze:
- Nur Benutzer, die der Abgleich selbst angelegt hat (``idm.managed``), werden geändert – von Hand angelegte bleiben
  unberührt, auch wenn sie im Verzeichnis stehen.
- Der letzte aktive Admin wird nie deaktiviert oder herabgestuft.
- Zuerst immer ein Probelauf: der Plan zeigt alle Änderungen, angewendet wird erst auf Knopfdruck (oder nachts, wenn
  der Admin den automatischen Abgleich einschaltet).
- Angemeldet wird mit dem Verzeichnis-Passwort über den HA-Anmeldeanbieter ``command_line`` mit einem LDAP-Skript
  (Konfiguration in Home Assistant, z. B. ha-config); MFA richten die Personen wie bisher selbst ein.

Plan und Prüfung sind HA-frei; das Lesen des Verzeichnisses braucht ``ldap3`` (Abhängigkeit im Manifest).
"""
from __future__ import annotations

from typing import Any

UAC_DISABLED = 0x2  # userAccountControl: Konto deaktiviert (Active Directory)
MASK = "•••"


def clean(raw: Any, old: dict | None = None) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    old = old or {}
    server = str(raw.get("server") or "").strip()
    if raw.get("enabled") and not server.startswith("ldaps://"):
        raise ValueError("Der Verzeichnisserver braucht eine ldaps://-Adresse (verschlüsselt).")
    pw = raw.get("bind_password")
    maps = []
    for m in raw.get("mappings") or []:
        if not isinstance(m, dict) or not str(m.get("group") or "").strip():
            continue
        maps.append({"group": str(m["group"]).strip()[:500], "admin": bool(m.get("admin")),
                     "llmitmir": m.get("llmitmir", True) is not False})
    if raw.get("enabled") and not maps:
        raise ValueError("Mindestens eine Gruppen-Zuordnung angeben.")
    out = {"enabled": bool(raw.get("enabled")), "auto": bool(raw.get("auto")), "server": server[:300],
           "bind_dn": str(raw.get("bind_dn") or "").strip()[:500],
           "bind_password": old.get("bind_password", "") if pw == MASK else str(pw or "")[:500],
           "base_dn": str(raw.get("base_dn") or "").strip()[:500],
           "user_filter": str(raw.get("user_filter") or "(&(objectCategory=person)(objectClass=user))").strip()[:1000],
           "attr_username": str(raw.get("attr_username") or "sAMAccountName").strip()[:60],
           "attr_name": str(raw.get("attr_name") or "displayName").strip()[:60],
           "auth_provider": str(raw.get("auth_provider") or "command_line").strip()[:40],
           "mappings": maps, "managed": dict(old.get("managed") or {})}
    if out["enabled"] and not (out["bind_dn"] and out["base_dn"]):
        raise ValueError("Bind-Konto und Basis-DN angeben.")
    return out


def view(cfg: dict) -> dict:
    v = dict(cfg or {})
    if v.get("bind_password"):
        v["bind_password"] = MASK
    return v


def _cf(s: str) -> str:
    return str(s or "").strip().casefold()


def entry_from_ldap(attrs: dict, cfg: dict) -> dict | None:
    """Einen Verzeichniseintrag in eine Person übersetzen (Benutzername, Name, Gruppen, gesperrt)."""
    def one(key):
        v = attrs.get(key)
        if isinstance(v, list):
            v = v[0] if v else ""
        return str(v or "").strip()

    username = one(cfg.get("attr_username") or "sAMAccountName")
    if not username:
        return None
    groups = attrs.get("memberOf") or []
    groups = groups if isinstance(groups, list) else [groups]
    try:
        uac = int(one("userAccountControl") or 0)
    except ValueError:
        uac = 0
    return {"username": username.lower(), "name": one(cfg.get("attr_name") or "displayName") or username,
            "groups": [str(g) for g in groups], "disabled": bool(uac & UAC_DISABLED)}


def wanted(entry: dict, mappings: list[dict]) -> dict | None:
    """Was eine Person laut Gruppen-Zuordnung bekommt – oder None (in keiner Gruppe, gesperrt)."""
    if entry.get("disabled"):
        return None
    groups = {_cf(g) for g in entry.get("groups") or []}
    hit = [m for m in mappings if _cf(m["group"]) in groups]
    if not hit:
        return None
    return {"admin": any(m["admin"] for m in hit), "llmitmir": any(m["llmitmir"] for m in hit)}


def plan(entries: list[dict], cfg: dict, users: list[dict], allowed: list[str]) -> list[dict]:
    """Änderungen für den Abgleich.

    ``users``: HA-Benutzer [{id, name, is_admin, is_active}], ``allowed``: LLMitMir-Freigaben (User-IDs).
    Ergebnis: Aktionen create/update/deactivate/reactivate/allow/disallow, je mit Grund. Unverwaltete Benutzer
    tauchen nie auf; der letzte aktive Admin wird nie deaktiviert oder herabgestuft."""
    managed: dict[str, str] = cfg.get("managed") or {}
    by_id = {u["id"]: u for u in users}
    managed_ids = set(managed.values())
    # Anmeldenamen von Hand angelegter Benutzer: die bleiben unberührt, auch wenn sie im Verzeichnis stehen
    manual = {_cf(n) for u in users if u["id"] not in managed_ids for n in u.get("usernames") or []}
    actions: list[dict] = []
    seen: set[str] = set()
    for e in entries:
        w = wanted(e, cfg.get("mappings") or [])
        uid = managed.get(e["username"])
        u = by_id.get(uid) if uid else None
        seen.add(e["username"])
        if not uid and _cf(e["username"]) in manual:
            if w is not None:
                actions.append({"action": "skip", "username": e["username"], "name": e["name"],
                                "reason": "von Hand angelegt – bleibt unberührt"})
            continue
        if w is None:
            if u and u["is_active"]:
                actions.append({"action": "deactivate", "username": e["username"], "user_id": uid, "name": u["name"],
                                "reason": "im Verzeichnis gesperrt" if e.get("disabled") else "in keiner zugeordneten Gruppe"})
            continue
        if not u:
            actions.append({"action": "create", "username": e["username"], "name": e["name"], "admin": w["admin"],
                            "llmitmir": w["llmitmir"], "reason": "neu in einer zugeordneten Gruppe"})
            continue
        changes = {}
        if not u["is_active"]:
            actions.append({"action": "reactivate", "username": e["username"], "user_id": uid, "name": u["name"],
                            "reason": "wieder in einer zugeordneten Gruppe"})
        if u["is_admin"] != w["admin"]:
            changes["admin"] = w["admin"]
        if e["name"] and u["name"] != e["name"]:
            changes["name"] = e["name"]
        if changes:
            actions.append({"action": "update", "username": e["username"], "user_id": uid, "name": u["name"], **changes,
                            "reason": "Gruppen oder Name geändert"})
        if w["llmitmir"] and uid not in allowed:
            actions.append({"action": "allow", "username": e["username"], "user_id": uid, "name": u["name"],
                            "reason": "Gruppe gibt Zugriff auf LLMitMir"})
        elif not w["llmitmir"] and uid in allowed:
            actions.append({"action": "disallow", "username": e["username"], "user_id": uid, "name": u["name"],
                            "reason": "keine Gruppe gibt Zugriff auf LLMitMir"})
    for username, uid in managed.items():
        u = by_id.get(uid)
        if username not in seen and u and u["is_active"]:
            actions.append({"action": "deactivate", "username": username, "user_id": uid, "name": u["name"],
                            "reason": "nicht mehr im Verzeichnis"})
    return protect_last_admin(actions, users)


def protect_last_admin(actions: list[dict], users: list[dict]) -> list[dict]:
    """Aktionen streichen, nach denen kein aktiver Admin mehr übrig wäre."""
    admins = {u["id"] for u in users if u["is_admin"] and u["is_active"]}
    out = []
    for a in actions:
        losing = a["action"] == "deactivate" or (a["action"] == "update" and a.get("admin") is False)
        if losing and a.get("user_id") in admins:
            if len(admins) <= 1:
                out.append(dict(a, action="skip", reason="letzter aktiver Admin – bleibt unverändert"))
                continue
            admins.discard(a["user_id"])
        out.append(a)
    return out


def read_directory(cfg: dict) -> list[dict]:
    """Personen aus dem Verzeichnis lesen (blockiert – im Executor aufrufen)."""
    try:
        import ldap3
    except ImportError as e:  # pragma: no cover - Abhängigkeit im Manifest
        raise ValueError("Das Python-Paket ldap3 fehlt – Home Assistant neu starten, damit es installiert wird.") from e
    server = ldap3.Server(cfg["server"], use_ssl=True, get_info=ldap3.NONE, connect_timeout=10)
    attrs = [cfg.get("attr_username") or "sAMAccountName", cfg.get("attr_name") or "displayName", "memberOf",
             "userAccountControl"]
    with ldap3.Connection(server, user=cfg["bind_dn"], password=cfg["bind_password"], auto_bind=True, read_only=True,
                          receive_timeout=30) as conn:
        found = conn.extend.standard.paged_search(cfg["base_dn"], cfg["user_filter"], attributes=attrs, paged_size=500,
                                                  generator=True)
        out = []
        for item in found:
            if item.get("type") != "searchResEntry":
                continue
            e = entry_from_ldap(dict(item.get("attributes") or {}), cfg)
            if e:
                out.append(e)
            if len(out) >= 5000:
                break
        return out


async def apply(hass, m, actions: list[dict]) -> dict:
    """Plan anwenden (Home Assistant): anlegen, ändern, deaktivieren, LLMitMir-Zugriff. Gibt Zähler und Fehler zurück."""
    cfg = m.config.data.setdefault("idm", {})
    managed: dict[str, str] = cfg.setdefault("managed", {})
    allowed = list(m.config.data.get("allowed_users") or [])
    ptype = cfg.get("auth_provider") or "command_line"
    provider = next((p for p in hass.auth.auth_providers if p.type == ptype), None)
    if provider is None and any(a["action"] == "create" for a in actions):
        raise ValueError(f"Der Anmeldeanbieter „{ptype}“ ist in Home Assistant nicht eingerichtet – ohne ihn könnten sich "
                         "neue Personen nicht anmelden (siehe Doku: command_line mit LDAP-Skript).")
    counts: dict[str, int] = {}
    errors: list[str] = []
    for a in actions:
        kind = a["action"]
        if kind == "skip":
            continue
        try:
            if kind == "create":
                user = await hass.auth.async_create_user(a["name"], group_ids=["system-admin" if a["admin"] else "system-users"])
                creds = await provider.async_get_or_create_credentials({"username": a["username"]})
                await hass.auth.async_link_user(user, creds)
                managed[a["username"]] = user.id
                if a.get("llmitmir") and user.id not in allowed:
                    allowed.append(user.id)
            else:
                user = await hass.auth.async_get_user(a["user_id"])
                if user is None:
                    managed.pop(a["username"], None)
                    continue
                if kind == "deactivate":
                    await hass.auth.async_deactivate_user(user)
                elif kind == "reactivate":
                    await hass.auth.async_activate_user(user)
                elif kind == "update":
                    kw = {}
                    if "name" in a:
                        kw["name"] = a["name"]
                    if "admin" in a:
                        kw["group_ids"] = ["system-admin" if a["admin"] else "system-users"]
                    await hass.auth.async_update_user(user, **kw)
                elif kind == "allow" and user.id not in allowed:
                    allowed.append(user.id)
                elif kind == "disallow":
                    allowed = [x for x in allowed if x != user.id]
            counts[kind] = counts.get(kind, 0) + 1
        except Exception as e:  # noqa: BLE001 - die übrigen Aktionen trotzdem ausführen
            errors.append(f"{a['username']}: {type(e).__name__}: {e}"[:300])
    m.config.data["allowed_users"] = allowed
    await m.config.async_save()
    return {"counts": counts, "errors": errors}
