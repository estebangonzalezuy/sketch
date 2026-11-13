#!/usr/bin/env bash
# Prueba el helper de punta a punta sin ser root: un /etc/hosts de mentira,
# puertos altos y "minutos" de un segundo. Corre en macOS y en Linux.
set -euo pipefail
cd "$(dirname "$0")/../src-tauri"
cargo build -q -p foco-helper
T=$(mktemp -d); trap 'kill $PID 2>/dev/null; rm -rf "$T"' EXIT
printf '127.0.0.1\tlocalhost\n' > "$T/hosts"
export FOCO_HOSTS="$T/hosts" FOCO_DIR="$T/dir" FOCO_SOCK="$T/s" FOCO_PORTS=18443,18080 FOCO_QUIET_SECS=2 FOCO_UNIT_SECS=1
./target/debug/foco-helper 2>"$T/log" & PID=$!
sleep 0.5

req() { python3 -c 'import socket,sys;s=socket.socket(socket.AF_UNIX);s.connect(sys.argv[1]);s.sendall(sys.argv[2].encode()+b"\n");print(s.makefile().readline(),end="")' "$T/s" "$1"; }
get() { python3 -c 'import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))' "$1"; }
ok() { echo "ok   $1"; }
fail() { echo "FALLA $1"; cat "$T/log"; exit 1; }
check() { [ "$2" = "$3" ] && ok "$1" || fail "$1: esperaba '$3', vino '$2'"; }

check "sin sesión al arrancar" "$(req '{"cmd":"status"}' | get 'd["status"]["session"]')" None
check "rechaza un sitio que inyecta una línea" "$(req '{"cmd":"start","minutes":5,"sites":["a.com\n0.0.0.0 apple.com"]}' | get 'd["ok"]')" False
check "rechaza 0 minutos" "$(req '{"cmd":"start","minutes":0,"sites":["x.com"]}' | get 'd["ok"]')" False
check "arranca" "$(req '{"cmd":"start","minutes":6,"mode":"list","sites":["https://www.X.com/home","youtube.com"],"apps":["com.tinyspeck.slackmacgap"]}' | get 'd["ok"], d["status"]["session"]["sites"]')" "(True, ['x.com', 'youtube.com'])"
grep -q '^127.0.0.1 twitter.com$' "$T/hosts" && grep -q '^::1 www.youtube.com$' "$T/hosts" && ok "/etc/hosts tiene el bloque" || fail "hosts sin bloque"
check "no arranca otra encima" "$(req '{"cmd":"start","minutes":5}' | get 'd["ok"]')" False

sleep 0.4
curl -s --noproxy '*' -m 2 --connect-to x.com:443:127.0.0.1:18443 https://x.com/ >/dev/null || true
sleep 0.3
check "detecta el intento por TLS (SNI)" "$(req '{"cmd":"status"}' | get 'd["status"]["session"]["attempts"], d["status"]["session"]["last_attempt"]["target"], d["status"]["sniffer_ok"]')" "(1, 'x.com', True)"
curl -s --noproxy '*' -m 2 --connect-to www.twitter.com:443:127.0.0.1:18443 https://www.twitter.com/ >/dev/null || true
sleep 0.3
check "una pestaña que insiste no suma intentos" "$(req '{"cmd":"status"}' | get 'd["status"]["session"]["attempts"]')" 1
check "página de bloqueo por HTTP" "$(curl -s --noproxy '*' -m 2 -H 'Host: m.youtube.com' http://127.0.0.1:18080/ | grep -c 'Back to it')" 1
sleep 0.3
check "detecta el intento por HTTP" "$(req '{"cmd":"status"}' | get 'd["status"]["session"]["attempts"], d["status"]["session"]["last_attempt"]["target"]')" "(2, 'youtube.com')"
curl -s --noproxy '*' -m 2 --connect-to example.com:443:127.0.0.1:18443 https://example.com/ >/dev/null || true
sleep 0.3
check "ignora hosts que no están en la lista" "$(req '{"cmd":"status"}' | get 'd["status"]["session"]["attempts"]')" 2

printf '127.0.0.1\tlocalhost\n' > "$T/hosts"; sleep 1.3
grep -q '^127.0.0.1 x.com$' "$T/hosts" && ok "repone el bloque si lo borran" || fail "no repuso el bloque"

check "no corta sin frase ni enfriamiento" "$(req '{"cmd":"cancel"}' | get 'd["ok"]')" False
check "no corta con una frase a medias" "$(req '{"cmd":"cancel","phrase":"I would rather get distracted"}' | get 'd["ok"]')" False
check "arranca el enfriamiento" "$(req '{"cmd":"begin_cooldown"}' | get 'd["status"]["session"]["cooldown_started"] is not None')" True
check "no corta antes de los dos minutos" "$(req '{"cmd":"cancel"}' | get 'd["ok"]')" False

kill $PID; wait $PID 2>/dev/null || true
./target/debug/foco-helper 2>>"$T/log" & PID=$!
sleep 0.5
check "matar el helper no corta la sesión" "$(req '{"cmd":"status"}' | get 'd["status"]["session"]["attempts"]')" 2

sleep 5
check "termina sola a su hora" "$(req '{"cmd":"status"}' | get 'd["status"]["session"], d["status"]["last_finished"]["attempts"], d["status"]["last_finished"]["cancelled"]')" "(None, 2, False)"
check "/etc/hosts vuelve a como estaba" "$(cat "$T/hosts")" "$(printf '127.0.0.1\tlocalhost\n')"
curl -s --noproxy '*' -m 1 http://127.0.0.1:18080/ >/dev/null && fail "el puerto sigue abierto sin sesión" || ok "suelta los puertos al terminar"
check "el historial tiene la sesión" "$(req '{"cmd":"history"}' | get 'len(d["history"]), d["history"][0]["planned_secs"]')" "(1, 6)"
check "confirma el resumen" "$(req '{"cmd":"ack_summary"}' | get 'd["status"]["last_finished"]')" None

req '{"cmd":"start","minutes":60,"mode":"one","one_app":"com.adobe.AfterEffects","sites":["x.com"]}' >/dev/null
check "corta con la frase entera" "$(req '{"cmd":"cancel","phrase":"I would rather get distracted now and finish this later, rushed and in a bad mood."}' | get 'd["ok"], d["status"]["last_finished"]["cancelled"]')" "(True, True)"
check "/etc/hosts limpio después de cortar" "$(grep -c foco "$T/hosts" || true)" 0
echo "todo bien"
