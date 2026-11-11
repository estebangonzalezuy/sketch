# ideas.md — Superilla (ficha 038)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Paso 4 de Szymon. Todo lo que aparezca fuera de alcance va acá, no al código. Tamaño: S (≤½ día), M (1–2 días), L (3+). Estado: hecha / descartada / después.

| Idea | Nota | Tamaño | Estado |
|---|---|---|---|
| Versión 1 del entorno | Tráfico celular (Nagel–Schreckenberg) en una red de manzanas tipo Eixample; cerrás calles con un click y ves cómo cambia el flujo. | M | hecha (11/11) |
| Preset 'Superilla Sant Antoni' con el 3×3 cerrado |  | S | después |
| Modo diagrama espacio-tiempo de un tramo |  | S | después |
| Peatones que ocupan el interior cerrado |  | M | después |
| Mapa real del Eixample (OSM) |  | L | después |
| Presets curados (3 a 6) | 5 en `src/envs/superilla/presets.ts` | S | hecha |
| Cierres por click en el preset JSON | Hoy los tramos clickeados viven en el entorno; el preset solo guarda el modo | S | después |
| Test de NaSch en un tramo aislado | Las 4 reglas están en `nasch()`; falta un test unitario que lo verifique | S | después |
