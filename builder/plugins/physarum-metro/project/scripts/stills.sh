#!/bin/bash
# Stills del prototipo (270 cuadros = 810 pasos) para cada ciudad, 2 en paralelo.
cd "$(dirname "$0")/.."
mkdir -p out/stills
run(){ node scripts/probe.mjs $1 270 out/stills/$1-lado.jpg "{\"pair\":$2}" > out/stills/$1.log 2>&1; }
run barcelona 0 & run madrid 1 & wait
run tokyo 2 & run buenosaires 3 & wait
run cdmx 1 & run london 0 & wait
echo done > out/stills/DONE
