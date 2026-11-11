# ideas.md — Polirritmo (ficha 077)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Paso 4 de Szymon. Todo lo que aparezca fuera de alcance va acá, no al código. Tamaño: S (≤½ día), M (1–2 días), L (3+). Estado: hecha / descartada / después.

| Idea | Nota | Tamaño | Estado |
|---|---|---|---|
| Versión 1 del entorno | Anillos concéntricos con puntos que giran a ratios (3:4:5…). Suena cuando cruzan el eje y cada tanto todos se realinean. Pensado para enchufarse al Motion Instrument. | S | hecha (11/11) |
| Patrón euclídeo por anillo (Bjorklund) |  | S | después |
| Sincronía con BPM del Motion Instrument (leer MI.S.bpm) |  | S | después |
| Grabar MIDI a .mid |  | S | después |
| Audio dentro del MP4 vía OfflineAudioContext |  | M | después |
| Presets curados (3 a 6) | 5 en `src/envs/polirritmo/presets.ts` | S | hecha |
| Audio dentro del MP4 | OfflineAudioContext con los mismos cruces analíticos + AAC en el muxer | M | después (el MP4 v1 sale mudo) |
| Motion Instrument cross-origin | `postMessage` a themotionsocial.club: el listener ya lo acepta, pero no se pudo probar desde este contenedor (dominio bloqueado) | S | después |
