#!/bin/bash
# Instalador de Foco. Compila la app en esta Mac, la copia a /Applications,
# instala el helper privilegiado y la abre.
#
# Doble clic en el Finder, o desde la Terminal:  ./install.command
set -euo pipefail
cd "$(dirname "$0")"

APP=/Applications/Foco.app
BUILT=src-tauri/target/release/bundle/macos/Foco.app

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
die() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

[ "$(uname -s)" = Darwin ] || die "Foco solo corre en macOS."
[ "$(uname -m)" = arm64 ] || echo "Aviso: Foco está pensada para Apple Silicon; en Intel no se probó."

step "1/5  Revisando lo que hace falta"

if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install || true
  die "Faltan las herramientas de Xcode. Se abrió su instalador: cuando termine, corré esto de nuevo."
fi

# Rust puede estar instalado sin estar en el PATH de esta ventana.
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
if ! command -v cargo >/dev/null; then
  printf "Falta Rust. ¿Lo instalo ahora con rustup (rustup.rs)? [s/N] "
  read -r answer
  case "$answer" in
    s | S | si | sí) curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && . "$HOME/.cargo/env" ;;
    *) die "Instalá Rust desde https://rustup.rs y corré esto de nuevo." ;;
  esac
fi

command -v npm >/dev/null || die "Falta Node. Instalalo desde https://nodejs.org (o con: brew install node) y corré esto de nuevo."
node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)' || die "Hace falta Node 20 o más nuevo. Tenés $(node -v)."
echo "Xcode, Rust $(rustc -V | cut -d' ' -f2) y Node $(node -v): bien."

step "2/5  Instalando dependencias"
npm install --no-fund --no-audit

step "3/5  Compilando Foco (la primera vez tarda unos minutos)"
npm run app
[ -d "$BUILT" ] || die "La compilación terminó pero no encuentro $BUILT."
[ -x "$BUILT/Contents/MacOS/foco-helper" ] || die "El .app no trae el helper adentro."

step "4/5  Copiando a /Applications"
# Si Foco está abierta, se cierra para poder reemplazarla.
pkill -x foco 2>/dev/null || true
rm -rf "$APP"
ditto "$BUILT" "$APP"

step "5/5  Instalando el helper (pide tu contraseña de la Mac)"
sudo "$APP/Contents/Resources/resources/install-helper.sh" "$APP/Contents/MacOS/foco-helper"

open "$APP"
printf '\n\033[1mListo.\033[0m Foco está en la barra de menú, arriba a la derecha.\n'
echo "Clic en el ícono para abrir el panel, o ⌥⌘F para empezar una sesión."
