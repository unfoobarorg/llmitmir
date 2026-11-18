"""Integrationstests gegen ein echtes Home Assistant (pytest-homeassistant-custom-component).

Laufen getrennt von ``tests/`` (dort ohne Home Assistant): ``pytest tests_ha`` in einer Umgebung mit
``pip install -r requirements_test_ha.txt``.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

# Vor Home Assistant importieren: pytest-homeassistant-custom-component bringt ein eigenes, reguläres Paket
# custom_components mit. Importiert HA zuerst, überdeckt es den Namensraum dieses Repos und LLMitMir fehlt.
import custom_components  # noqa: F401  (PYTHONPATH=. – das Repo-Verzeichnis)
import pytest
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

DOMAIN = "llmitmir"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.fixture(autouse=True, scope="session")
def start_pycares_shutdown_thread():
    """pycares (DNS für aiohttp) startet beim ersten Schließen einer Client-Session einen Hintergrund-Thread, der bis
    zum Prozessende läuft. Ältere Harness-Versionen (HA 2025.1) halten ihn für einen liegengebliebenen Thread des
    Tests – einmal vorab gestartet, gehört er zum Ausgangszustand."""
    try:
        import pycares

        pycares._shutdown_manager.start()
    except (ImportError, AttributeError):
        pass
    yield


@pytest.fixture(autouse=True)
def fake_panel_dependencies(hass):
    """Das Frontend-Paket von Home Assistant fehlt in Tests, der Recorder wird nicht gebraucht: als geladen markieren.
    Das Panel wird nur zum Schein registriert (siehe ``llmitmir``)."""
    for dep in ("frontend", "panel_custom", "recorder"):
        hass.config.components.add(dep)
    # Ältere HA-Versionen (2025.1) starten einen echten HTTP-Server, sobald „frontend“ geladen ist; die Tests
    # sprechen die Endpunkte über den Test-Client des Harness an.
    with patch("homeassistant.components.http.HomeAssistantHTTP.start", AsyncMock()):
        yield


@pytest.fixture
def expected_lingering_timers() -> bool:
    """T3: UserStore.schedule_save legt eigene call_later-Timer an, die beim Entladen liegen bleiben (und beim
    Herunterfahren nicht mehr feuern). Bis das behoben ist, hier ausdrücklich erlaubt."""
    return True


@pytest.fixture
async def llmitmir(hass, hass_admin_user):
    """LLMitMir eingerichtet wie nach dem Einrichtungsdialog (SAIA, ein gemeinsamer Schlüssel, noch keiner gesetzt).

    Das Panel selbst braucht das Frontend-Paket von Home Assistant, das in Tests fehlt – registriert wird es hier
    nur zum Schein. Alles andere (Websocket-Befehle, HTTP-Endpunkte, Speicher) läuft echt.
    """
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "websocket_api", {})
    entry = MockConfigEntry(domain=DOMAIN, title="SAIA (GWDG / KISSKI)",
                            data={"preset": "saia", "base_url": "https://chat-ai.academiccloud.de/v1",
                                  "key_mode": "shared", "api_key": ""})
    entry.add_to_hass(hass)
    with patch("homeassistant.components.panel_custom.async_register_panel", AsyncMock()) as reg, \
            patch("homeassistant.components.frontend.async_remove_panel"):
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        yield {"entry": entry, "register_panel": reg, "manager": hass.data[DOMAIN]["manager"]}
        assert await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()
