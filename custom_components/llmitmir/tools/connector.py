"""Werkzeuge des geführten Einrichtungs-Chats eines Konnektors (connectors.py).

Nur in einem Chat, den die Person über „Konnektor einrichten“ gestartet hat (``chat["connector_setup"]``):

- ``konnektor_verbinden`` zeigt das Formular für die Anmeldedaten im Chat. Die Person trägt Passwort oder Token dort
  ein (das Modell sieht sie nie), LLMitMir prüft die Verbindung, danach wählt die Person, wofür der Zugang verwendet
  werden darf. Das Modell bekommt nur das Ergebnis.
- ``konnektor_skill`` legt den Skill der Verbindung an oder ändert ihn – die Person bestätigt die Änderung.
"""
from __future__ import annotations

from .. import changes as CH
from .. import connectors as CN
from .. import credcheck as CK
from .. import manage as M
from . import Tool, obj, register

GROUP = "konnektor"


def _setup(ctx) -> tuple[dict, dict]:
    setup = ctx.chat.get("connector_setup") or {}
    k = CN.by_id(ctx.manager.config.data, setup.get("connector_id"))
    if not k or not k.get("enabled", True):
        raise ValueError("Den Konnektor dieses Einrichtungs-Chats gibt es nicht mehr oder er ist ausgeschaltet.")
    return setup, k


def _connection(ctx, setup: dict, k: dict) -> dict | None:
    c = ctx.store.meta["credentials"].get(setup.get("credential_id") or "")
    return c if c and c.get("connector_id") == k["id"] else None


async def connect_form(ctx, a: dict):
    setup, k = _setup(ctx)
    cred = _connection(ctx, setup, k)
    creds = ctx.store.meta["credentials"]
    name = str(a.get("name") or "").strip()[:80] or (cred or {}).get("name") or CN.unique_name(creds, k["name"])
    form = {"connector_id": k["id"], "credential_id": (cred or {}).get("id"), "name": name,
            "hint": str(a.get("hinweis") or "").strip()[:500]}
    decision = await ctx.manager.ask_permission(ctx.run, {
        "tool": "konnektor_verbinden", "label": f"{k['name']} verbinden", "icon": "mdi:connection", "args": {"name": name},
        "connector_form": form})
    c = ctx.store.meta["credentials"].get(form.get("credential_id") or "")
    if not c:
        return ("Die Person hat das Formular geschlossen, ohne zu verbinden. Frag, ob etwas unklar war, und biete an, "
                "das Formular erneut zu öffnen.")
    setup["credential_id"] = c["id"]
    ctx.refresh_secrets()  # neue Geheimnisse sofort aus allen Ergebnissen schwärzen
    chk = c.get("check")
    state = ("Prüfung erfolgreich" if chk and chk.get("ok") else
             f"Prüfung fehlgeschlagen: {CK.summary(c)}" if chk else "nicht geprüft")
    done = form.get("done") and decision == "once"
    text = (f"Verbunden: Zugang „{c['name']}“ (Konnektor „{k['name']}“). {state}. {CN.options_text(c)}.")
    if not done:
        text += (" Die Person hat den Schritt „Wofür darf der Zugang verwendet werden?“ nicht abgeschlossen – es gelten "
                 "die bisherigen Einstellungen; ändern lässt sich das jederzeit auf der Seite „Plugins → Konnektoren“.")
    if chk and not chk.get("ok"):
        text += " Hilf bei der Fehlersuche und öffne das Formular danach erneut."
    return text


def _skill_plan(ctx, a: dict) -> tuple[dict | None, dict, dict]:
    setup, k = _setup(ctx)
    cred = _connection(ctx, setup, k)
    if not cred:
        raise ValueError("Erst verbinden (`konnektor_verbinden`), dann den Skill anlegen.")
    old = CN.skill_of(ctx.store.meta["skills"], cred["id"])
    name = str(a.get("name") or "").strip() or (old or {}).get("name") or f"{cred['name']} verwenden"
    other = next((s for s in ctx.store.meta["skills"].values()
                  if s["name"].casefold() == name.casefold() and s is not old), None)
    if other is not None:
        raise ValueError(f"Es gibt schon einen Skill „{name}“ – bitte einen anderen Namen wählen.")
    body = str(a.get("anleitung") or "").strip() or (old or {}).get("body") or ""
    if not body:
        raise ValueError("„anleitung“ fehlt.")
    new = {"id": (old or {}).get("id"), "name": name[:80],
           "description": str(a.get("beschreibung") or (old or {}).get("description") or "")[:1024],
           "body": body, "credentials": [cred["id"]], "enabled": True}
    return old, new, cred


async def skill_preview(ctx, a: dict) -> dict:
    old, new, cred = _skill_plan(ctx, a)
    ch = CH.build("skill", new["name"], CH.skill_fields(old, ctx.store.meta), CH.skill_fields(new, ctx.store.meta))
    if not ch["felder"]:
        raise ValueError("Keine Änderung – der Skill ist schon so.")
    ch["hinweis"] = f"Gehört fest zur Verbindung „{cred['name']}“ – ändern später über die Seite „Plugins → Konnektoren“."
    return ch


async def skill_save(ctx, a: dict):
    ch = await skill_preview(ctx, a)
    _, new, cred = _skill_plan(ctx, a)
    await M.save_skill(ctx.manager, ctx.user_id, ctx.store, new, connection=cred)
    return CH.summary(ch)


register(Tool("konnektor_verbinden", GROUP,
              "Zeigt der Person im Chat das Formular, um den Konnektor dieses Einrichtungs-Chats zu verbinden: Sie trägt "
              "dort ihre Anmeldedaten ein (du siehst sie nie), LLMitMir prüft die Verbindung, dann wählt sie, wofür der "
              "Zugang verwendet werden darf. Erst aufrufen, wenn die Person die Anmeldedaten bereit hat. Gibt das Ergebnis "
              "zurück (verbunden, Prüfung, Rechte).",
              obj({"name": {"type": "string", "description": "Vorschlag für den Namen der Verbindung, z. B. „GitLab Projekt X“ "
                                                             "(wichtig, wenn die Person den Konnektor mehrfach verbindet)"},
                   "hinweis": {"type": "string", "description": "Ein Satz über dem Formular, z. B. welcher Token wohin gehört"}}),
              connect_form, label="Konnektor verbinden", icon="mdi:connection"))
register(Tool("konnektor_skill", GROUP,
              "Legt den Skill der eben verbundenen Verbindung an oder ändert ihn: wie LLMitMir diesen Zugang immer verwenden "
              "soll. Der Skill gehört fest zur Verbindung. Die Person sieht die Änderung und muss sie bestätigen.",
              obj({"name": {"type": "string"}, "beschreibung": {"type": "string", "description": "Wann der Skill gilt (≤1024 Zeichen)"},
                   "anleitung": {"type": "string", "description": "Vollständige Anleitung (Markdown); keine Geheimnisse, auf den "
                                                                  "Zugang mit seinem Namen verweisen"}},
                  ["anleitung"]),
              skill_save, write=True, label="Skill des Konnektors speichern", icon="mdi:school-outline", preview=skill_preview))
