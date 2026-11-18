#!/usr/bin/env bash
# LLMitMir-Werkbank: Sandboxen dürfen nur ins Internet – nicht ins LAN, nicht zur VM selbst, nicht zueinander.
#
# Die Sandboxen hängen an der Docker-Brücke lmwb0 (Netz „llmitmir-sandbox“, legt server.py an). Diese Regeln sperren
# auf der VM jeden neuen Verbindungsaufbau von dort zu privaten, lokalen und reservierten Adressen sowie zur VM selbst
# (Werkbank-API, SSH, Docker). Antworten auf Verbindungen ins Internet bleiben erlaubt; Namen löst Docker über seinen
# eigenen DNS auf (läuft auf der VM, nicht in der Sandbox).
#
# install.sh richtet das als systemd-Dienst ein (llmitmir-werkbank-firewall.service, nach Docker, bei jedem Start).
# Von Hand: als root  bash firewall.sh  (erneut ausführen ist harmlos)  ·  bash firewall.sh --remove  nimmt alles zurück.
set -euo pipefail

BRIDGE="${SANDBOX_BRIDGE:-lmwb0}"
CHAIN="LLMITMIR-SANDBOX"
# RFC 1918, Loopback, Link-Local, CGNAT, „dieses Netz“, Benchmark, Dokumentation/IETF, Multicast, reserviert
BLOCKED="10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 127.0.0.0/8 169.254.0.0/16 100.64.0.0/10 0.0.0.0/8 198.18.0.0/15 192.0.0.0/24 224.0.0.0/4 240.0.0.0/4"

ipt() { iptables -w "$@"; }

remove() {
  while ipt -C DOCKER-USER -i "$BRIDGE" -j "$CHAIN" 2>/dev/null; do ipt -D DOCKER-USER -i "$BRIDGE" -j "$CHAIN"; done
  while ipt -C INPUT -i "$BRIDGE" -j "$CHAIN-IN" 2>/dev/null; do ipt -D INPUT -i "$BRIDGE" -j "$CHAIN-IN"; done
  for c in "$CHAIN" "$CHAIN-IN"; do ipt -F "$c" 2>/dev/null || true; ipt -X "$c" 2>/dev/null || true; done
}

if [ "${1:-}" = "--remove" ]; then remove; echo "Werkbank-Firewall entfernt."; exit 0; fi
command -v iptables >/dev/null || { echo "iptables fehlt" >&2; exit 1; }

# Docker legt DOCKER-USER an; läuft Docker noch nicht, gibt es die Kette noch nicht.
ipt -N DOCKER-USER 2>/dev/null || true

# Weiterleiten (Sandbox -> Netz): private und lokale Ziele sperren, Rest (Internet) erlauben
ipt -N "$CHAIN" 2>/dev/null || ipt -F "$CHAIN"
ipt -A "$CHAIN" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
for net in $BLOCKED; do ipt -A "$CHAIN" -d "$net" -j REJECT --reject-with icmp-net-prohibited; done
ipt -A "$CHAIN" -j RETURN
ipt -C DOCKER-USER -i "$BRIDGE" -j "$CHAIN" 2>/dev/null || ipt -I DOCKER-USER 1 -i "$BRIDGE" -j "$CHAIN"

# Zur VM selbst (Sandbox -> Host): nur Antworten, kein neuer Verbindungsaufbau
ipt -N "$CHAIN-IN" 2>/dev/null || ipt -F "$CHAIN-IN"
ipt -A "$CHAIN-IN" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
ipt -A "$CHAIN-IN" -j REJECT --reject-with icmp-host-prohibited
ipt -C INPUT -i "$BRIDGE" -j "$CHAIN-IN" 2>/dev/null || ipt -I INPUT 1 -i "$BRIDGE" -j "$CHAIN-IN"

# IPv6: das Netz der Sandboxen hat keins (EnableIPv6 false). Falls doch, ebenso sperren.
if command -v ip6tables >/dev/null; then
  ip6tables -w -N DOCKER-USER 2>/dev/null || true
  ip6tables -w -C DOCKER-USER -i "$BRIDGE" -j REJECT 2>/dev/null || ip6tables -w -I DOCKER-USER 1 -i "$BRIDGE" -j REJECT
  ip6tables -w -C INPUT -i "$BRIDGE" -j REJECT 2>/dev/null || ip6tables -w -I INPUT 1 -i "$BRIDGE" -j REJECT
fi
echo "Werkbank-Firewall aktiv: Sandboxen ($BRIDGE) nur ins Internet."
