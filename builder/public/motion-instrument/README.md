# motion instrument (copia)

Copia de `estebangonzalezuy/tmsc` → `public/motion-instrument/index.html` (commit `62afcbf`, 06/11/2026), traída al builder para que el Polirritmo le hable desde el mismo origen (`window.MI` y `BroadcastChannel` no cruzan dominios). Lo único agregado es el `<script>` del final: escucha `{ type: "note", voice, when, delay }` y llama `MI.trigger` / `MI.playNote`. Estética y modos sin cambios. Fuente: Archivo Narrow embebida (OFL, `OFL.txt`).
