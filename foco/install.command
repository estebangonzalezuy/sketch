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

[ "$(uname -s)" = Darwin ] || die "Foco only runs on macOS."
[ "$(uname -m)" = arm64 ] || echo "Note: Foco is built for Apple Silicon; it is untested on Intel."

step "1/5  Checking requirements"

if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install || true
  die "The Xcode command line tools are missing. Their installer just opened: when it finishes, run this again."
fi

# Rust puede estar instalado sin estar en el PATH de esta ventana.
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
if ! command -v cargo >/dev/null; then
  printf "Rust is missing. Install it now with rustup (rustup.rs)? [y/N] "
  read -r answer
  case "$answer" in
    y | Y | yes) curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && . "$HOME/.cargo/env" ;;
    *) die "Install Rust from https://rustup.rs and run this again." ;;
  esac
fi

command -v npm >/dev/null || die "Node is missing. Install it from https://nodejs.org (or: brew install node) and run this again."
node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)' || die "Node 20 or newer is required. You have $(node -v)."
echo "Xcode, Rust $(rustc -V | cut -d' ' -f2) and Node $(node -v): all good."

step "2/5  Installing dependencies"
npm install --no-fund --no-audit

step "3/5  Building Foco (the first time takes a few minutes)"
npm run app
[ -d "$BUILT" ] || die "The build finished but $BUILT is missing."
[ -x "$BUILT/Contents/MacOS/foco-helper" ] || die "The .app does not contain the helper."

step "4/5  Copying to /Applications"
# Si Foco está abierta, se cierra para poder reemplazarla.
pkill -x foco 2>/dev/null || true
rm -rf "$APP"
ditto "$BUILT" "$APP"

step "5/5  Installing the helper (asks for your Mac password)"
sudo "$APP/Contents/Resources/resources/install-helper.sh" "$APP/Contents/MacOS/foco-helper"

open "$APP"
printf '\n\033[1mDone.\033[0m Foco is in the menu bar, top right.\n'
echo "Click the icon to open the panel, or press ⌥⌘F to start a session."
