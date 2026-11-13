#!/bin/bash
# Saca el helper de Foco y limpia /etc/hosts. Es también la salida de
# emergencia si algo queda bloqueado: sudo ./uninstall-helper.sh
set -euo pipefail

LABEL=co.estebangonzalez.foco.helper
[ "$(id -u)" = 0 ] || { echo "run this with sudo" >&2; exit 1; }

launchctl bootout "system/$LABEL" 2>/dev/null || true
rm -f "/Library/LaunchDaemons/$LABEL.plist" "/Library/PrivilegedHelperTools/$LABEL" /var/run/foco.sock

# Borra el bloque de Foco de /etc/hosts y deja el resto intacto.
if grep -q '^# >>> foco' /etc/hosts; then
  sed -i '' '/^# >>> foco/,/^# <<< foco/d' /etc/hosts
  dscacheutil -flushcache
  killall -HUP mDNSResponder 2>/dev/null || true
fi

# El historial queda en /Library/Application Support/Foco; borralo a mano si querés.
rm -f "/Library/Application Support/Foco/state.json"
echo "helper uninstalled"
