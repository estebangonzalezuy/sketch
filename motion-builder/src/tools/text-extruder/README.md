# Text Extruder

Letras 3D extruidas desde un TTF, con una malla por letra.

- **Origen:** copia de `ClaudeCode/text-extruder/src/main.ts`.
- **Entradas:** ninguna.
- **Límites:** TTF local únicamente: KMR Apparat (fuera de git) y Geist Mono. Sin export a GLB, OBJ ni STL. El look `glass` necesita algo detrás en la misma escena: con fondo transparente se ve oscuro.

## Diferencias con el original

- Render a un target lineal con MSAA, y un pase de salida aplica ACES y sRGB. En un render target three no los aplica.
- Fondo transparente por defecto. `fondo opaco` y `backgroundColor` lo devuelven.
- `speed` está en ciclos por segundo. `turntable` da una vuelta por ciclo. A `speed: 0.0955` iguala la velocidad del original en turntable, y a `0.318` en wave, spin y swing.
- En loop, `spin` avanza vueltas enteras para cerrar.
- La cámara son parámetros. Con `autoFrame`, `camX/Y/Z` es la dirección desde el texto y `distance` escala el encuadre del original. Sin `autoFrame` son una posición.
- Se agregan `rotX/Y/Z`. Se eliminan `OrbitControls`, grilla y exports.
