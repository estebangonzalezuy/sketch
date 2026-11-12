# ideas.md — Gramática de Plantas (ficha 014)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Paso 4 de Szymon. Todo lo que aparezca fuera de alcance va acá, no al código. Tamaño: S (≤½ día), M (1–2 días), L (3+). Estado: hecha / descartada / después.

| Idea | Nota | Tamaño | Estado |
|---|---|---|---|
| Versión 1 del entorno | L-system donde cada letra de una palabra es una regla de crecimiento. Cada nombre genera una planta única. | M | hecha (11/11) |
| Jardín: varias palabras en fila |  | S | después |
| Viento (flexión por profundidad) |  | S | después |
| Export SVG para plotter |  | S | después |
| Hojas/flores como símbolos tipográficos |  | M | después |
| Presets curados (3 a 6) | 5 en `src/envs/gramatica-de-plantas/presets.ts` | S | hecha |
| Versión 3D en three.js | Entorno aparte `plantas-3d` (09b): misma gramática, filotaxis, tubos con dither 1-bit, cámara orbitando | M | hecha (12/11) |
| El dial `largo` no hace nada | La planta se escala al bounding box, así que el largo del segmento no se ve. Sacarlo (subiendo `version`) o usarlo como proporción tronco/ramas | S | después — decide Esteban |
| 3D: hojas o remates en las puntas | Sin clipart; quizá esferas dither | S | después |
