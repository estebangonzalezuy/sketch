# ASCII

Convierte una entrada en texto con scramble. Es un efecto: sin entrada no dibuja, salvo el patrón.

- **Origen:** `docs/editor/sources/AsciiTextBackground.tsx`, componente de Framer de Reboot.
- **Entradas:** `source`, requerida.
- **Fuente:** KMR Apparat por defecto. El original usa IBM Plex Mono, disponible en `family`: con una fuente proporcional las letras no llenan la celda igual.
- **Límites:** dibuja en canvas 2D con un `fillText` por carácter. Sin video como asset, igual que el resto del MVP.

## Diferencias con el original

- `fontSize` se mide a un lado corto de 1080: 1080p y 4K tienen la misma grilla.
- La entrada se reduce en la GPU y se lee con `readRenderTargetPixels`. Viene premultiplicada y se divide por alfa.
- Los valores fijos ahora son parámetros: `contrast`, `saturationBoost`, `luminanceThreshold`, `lightnessAdjust`, `lightnessOffset`, `scrambleSpeed`, `letterSpacing`, `lineHeight` y `fit`. La `saturation` fija en 1 se elimina.
- El scramble no guarda estado: cada celda camina hacia atrás hasta el último step que la cambió, con tope en un período de onda.
- En loop, la onda da vueltas enteras y los steps se repiten: el loop cierra.
- La caché de color del original se quita, porque cuantizaba y dependía del orden de dibujo.
- Se elimina todo lo de Framer y layout web, incluido `maxWidth`.
