"""Gemeinsame Einstellungen der Tests ohne Home Assistant."""
import os
import time

# Einige Tests rechnen mit Ortszeit (EWS-Zeitfenster). Fest eingestellt, damit sie nicht davon abhängen, wo und mit
# welcher TZ-Variable sie laufen (lokal, CI-Runner, Container ohne Zeitzone).
os.environ["TZ"] = "Europe/Berlin"
time.tzset()
