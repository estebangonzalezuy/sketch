#!/bin/bash
# Instala el helper privilegiado de Foco como LaunchDaemon. Hay que correrlo
# como root: lo hace la app (pide la contraseña una vez) o vos con sudo.
#   sudo ./install-helper.sh /ruta/a/foco-helper
set -euo pipefail

SRC="${1:?missing path to the foco-helper binary}"
LABEL=co.estebangonzalez.foco.helper
DST="/Library/PrivilegedHelperTools/$LABEL"
PLIST="/Library/LaunchDaemons/$LABEL.plist"

[ "$(id -u)" = 0 ] || { echo "run this with sudo" >&2; exit 1; }
[ -f "$SRC" ] || { echo "$SRC does not exist" >&2; exit 1; }

launchctl bootout "system/$LABEL" 2>/dev/null || true

# El binario queda en una carpeta de root: sin sudo no se puede reemplazar.
mkdir -p /Library/PrivilegedHelperTools
install -o root -g wheel -m 755 "$SRC" "$DST"
xattr -d com.apple.quarantine "$DST" 2>/dev/null || true

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$DST</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>/var/log/foco-helper.log</string>
</dict>
</plist>
PLIST
chown root:wheel "$PLIST"
chmod 644 "$PLIST"

launchctl bootstrap system "$PLIST"
echo "helper installed"
