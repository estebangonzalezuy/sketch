#!/bin/bash
# Desinstala Foco: el helper, el bloque de /etc/hosts y la app.
# También es la salida de emergencia si algo queda bloqueado.
set -euo pipefail
cd "$(dirname "$0")"

echo "Sacando el helper (pide tu contraseña de la Mac)…"
sudo ./src-tauri/resources/uninstall-helper.sh
pkill -x foco 2>/dev/null || true
rm -rf /Applications/Foco.app

printf "¿Borro también tus ajustes y el historial? [s/N] "
read -r answer
case "$answer" in
  s | S | si | sí)
    rm -rf "$HOME/Library/Application Support/co.estebangonzalez.foco"
    sudo rm -rf "/Library/Application Support/Foco"
    ;;
esac
echo "Foco desinstalada."
