#!/bin/bash
# Desinstala Foco: el helper, el bloque de /etc/hosts y la app.
# También es la salida de emergencia si algo queda bloqueado.
set -euo pipefail
cd "$(dirname "$0")"

echo "Removing the helper (asks for your Mac password)…"
sudo ./src-tauri/resources/uninstall-helper.sh
pkill -x foco 2>/dev/null || true
rm -rf /Applications/Foco.app

printf "Also delete your settings and history? [y/N] "
read -r answer
case "$answer" in
  y | Y | yes)
    rm -rf "$HOME/Library/Application Support/co.estebangonzalez.foco"
    sudo rm -rf "/Library/Application Support/Foco"
    ;;
esac
echo "Foco uninstalled."
