# ideas.md — Atractor (ficha 048)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Paso 4 de Szymon. Todo lo que aparezca fuera de alcance va acá, no al código. Tamaño: S (≤½ día), M (1–2 días), L (3+). Estado: hecha / descartada / después.

| Idea | Nota | Tamaño | Estado |
|---|---|---|---|
| Versión 1 del entorno | Atractores de Clifford y De Jong con millones de puntos; morph continuo entre parámetros. | S | hecha (11/11, testigo de la fase 2) |
| Lazo de morph editable con la XY pad de DialKit |  | S | después |
| Atractores 3D (Lorenz) proyectados |  | M | después |
| Export PNG 4K |  | S | después |
| Presets curados (3 a 6) | 5 en `src/envs/atractor/presets.ts` (teclas 1–5) | S | hecha |
| Worker o WebGL2 aditivo (opción C del PLAN) | 2 M puntos ≈ 190 ms/frame en el contenedor (sin GPU): la preview no llega a 30 fps. El export no se afecta | M | después — medir primero en la Mac |
| Normalizar por percentil del frame | Saltaba entre 11 y 168 de un frame al siguiente: exposición parpadeando | — | descartada (reemplazada por exposición de referencia) |
