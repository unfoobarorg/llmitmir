#!/usr/bin/env bash
# LLMitMir-Werkbank installieren oder aktualisieren.
# Für eine frische VM mit Debian 12/13 oder Ubuntu 22.04/24.04 (x86_64 oder arm64). Als root ausführen:
#
#   curl -fsSL https://git.unfoobar.org/ha-integrations/llmitmir/-/raw/main/werkbank/install.sh | bash
#
# Erneut ausführen = aktualisieren (der Token in .env bleibt erhalten).
# Optionen als Umgebungsvariablen: REF=<Tag/Branch/Commit> DIR=/opt/llmitmir-werkbank REPO=<git-URL>
set -euo pipefail

REPO="${REPO:-https://git.unfoobar.org/ha-integrations/llmitmir.git}"
REF="${REF:-main}"
DIR="${DIR:-/opt/llmitmir-werkbank}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mFehler: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Bitte als root ausführen (vorher: sudo -i)."
command -v apt-get >/dev/null || die "Dieses Skript ist für Debian/Ubuntu gedacht."

say "Grundpakete installieren"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl git openssl >/dev/null

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  say "Docker installieren (offizielles Skript von get.docker.com)"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

say "Werkbank-Code holen ($REF) nach $DIR"
[ -d "$DIR/.git" ] || git clone -q "$REPO" "$DIR"
git -C "$DIR" fetch -q --tags origin
if git -C "$DIR" rev-parse -q --verify "origin/$REF" >/dev/null; then
  git -C "$DIR" checkout -q --force -B "$REF" "origin/$REF"      # Branch, z. B. main
else
  git -C "$DIR" checkout -q --force "$REF"                       # Tag oder Commit
fi
cd "$DIR/werkbank"

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^WERKBANK_TOKEN=.*/WERKBANK_TOKEN=$(openssl rand -hex 24)/" .env
  chmod 600 .env
fi

# Frühere Versionen nutzten SANDBOX_NETWORK=bridge (Docker-Standardnetz, LAN erreichbar): auf das eigene Netz umstellen
sed -i 's/^SANDBOX_NETWORK=bridge$/SANDBOX_NETWORK=llmitmir-sandbox/' .env

say "Firewall für die Sandboxen einrichten (nur Internet, kein LAN)"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables >/dev/null
install -m 0755 firewall.sh /usr/local/sbin/llmitmir-werkbank-firewall
cat > /etc/systemd/system/llmitmir-werkbank-firewall.service <<'UNIT'
[Unit]
Description=LLMitMir-Werkbank: Sandboxen nur ins Internet
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/llmitmir-werkbank-firewall
ExecStop=/usr/local/sbin/llmitmir-werkbank-firewall --remove

[Install]
WantedBy=multi-user.target docker.service
UNIT
systemctl daemon-reload
systemctl enable --now llmitmir-werkbank-firewall.service >/dev/null
systemctl restart llmitmir-werkbank-firewall.service

say "Sandbox-Image bauen (beim ersten Mal 5–15 Minuten)"
docker build -q -t "$(grep '^SANDBOX_IMAGE=' .env | cut -d= -f2-)" sandbox/ >/dev/null

say "Werkbank starten"
docker compose up -d --build --remove-orphans

TOKEN="$(grep '^WERKBANK_TOKEN=' .env | cut -d= -f2-)"
PORT="$(grep '^WERKBANK_PORT=' .env | cut -d= -f2-)"; PORT="${PORT:-8787}"
IP="$(hostname -I | awk '{print $1}')"
for _ in $(seq 1 20); do
  curl -fsS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/v1/health" >/dev/null 2>&1 && OK=1 && break
  sleep 2
done
[ "${OK:-0}" = 1 ] || die "Die Werkbank antwortet nicht. Log ansehen: cd $DIR/werkbank && docker compose logs"

# Der gemeinsame Cache früherer Versionen: jede Sandbox hat jetzt ihren eigenen
docker volume rm llmitmir-werkbank-cache >/dev/null 2>&1 || true

say "Prüfen: Sandbox erreicht das Internet, aber nicht das LAN"
IMAGE="$(grep '^SANDBOX_IMAGE=' .env | cut -d= -f2-)"
NET="$(grep '^SANDBOX_NETWORK=' .env | cut -d= -f2-)"; NET="${NET:-llmitmir-sandbox}"
GW="$(ip route | awk '/^default/ {print $3; exit}')"
if [ "$NET" != "none" ]; then
  PROBE="$(docker run --rm --network "$NET" --user 1000:1000 "$IMAGE" sh -c "
    curl -s -m 8 -o /dev/null https://example.org && echo INTERNET-OK || echo INTERNET-FEHLT
    curl -s -m 3 -o /dev/null http://$GW/ && echo LAN-OFFEN || echo LAN-GESPERRT
    curl -s -m 3 -o /dev/null http://$IP:$PORT/ && echo VM-OFFEN || echo VM-GESPERRT" 2>&1 || true)"
  echo "$PROBE" | sed 's/^/    /'
  if echo "$PROBE" | grep -q -e LAN-OFFEN -e VM-OFFEN; then
    die "Eine Sandbox erreicht das LAN oder die VM – die Firewall greift nicht (systemctl status llmitmir-werkbank-firewall)."
  fi
fi

cat <<EOT

Fertig – die Werkbank läuft.

Trage in Home Assistant unter  LLMitMir → Admin → Werkbank  ein:

    URL:    http://$IP:$PORT
    Token:  $TOKEN

und klicke auf „Verbindung testen“.

Tipp: Gib der VM im Router eine feste IP-Adresse, damit sich die URL nicht ändert.
Aktualisieren: diesen Befehl einfach noch einmal ausführen.
EOT
