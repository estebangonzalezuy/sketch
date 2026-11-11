# SOURCES.md — Physarum Metro

## Datos de metro — © OpenStreetMap contributors (ODbL 1.0)
- Vía Overpass API (endpoint principal `maps.mail.ru/osm/tools/overpass`; fallback `overpass-api.de`, `overpass.kumi.systems`). Consulta guardada en cada `data/raw/<ciudad>.json` → `_meta.query`.
- Qué se pide: relaciones `route=subway` con geometría (`out geom`) + `nwr[railway=station][station=subway]` + `nwr[public_transport=station][subway=yes]` dentro de un bbox por ciudad (`scripts/cities.json`).
- Atribución obligatoria en toda pieza: "© OpenStreetMap contributors". ODbL: si se redistribuye el dataset derivado (los JSON), va bajo ODbL.

## Conteos verificados (11/11/2026, descarga entre 13:03 y 13:19 hora de Madrid)

| Ciudad | Elementos estación crudos | Tras filtro "cerca de una línea" | Estaciones finales (fusionadas) | Relaciones de línea | Referencia pública | Diferencia / nota |
|---|---|---|---|---|---|---|
| Barcelona | 195 | 190 | **159** | 14 (L9 y L10 vienen partidas N/S → 12 líneas) | 132 TMB (Wikipedia, "List of metro systems", transbordos como una) | Incluye FGC L6, L7, L8, L12 (no están en las 132). Se descartó 1 estación sin línea a < 300 m: "Plaça de Maragall" |
| Madrid | 262 | 262 | **243** | 15 (12 líneas + Ramal + 2 relaciones raras: "Estación de Parque Lisboa", "Estación de Puerta del Sur" — revisar) | 242 (Wikipedia, transbordos como una); 302 contando por línea | Muy cerca |
| Tokio | 292 | 272 | **217** | 14 (Tokyo Metro 9 + Toei 4 + "Al" a revisar) | Tokyo Metro 142 + Toei 99 = 241 (cada sistema por separado) | Los transbordos Metro↔Toei se fusionan → menos. Filtro de red: `^(東京メトロ|都営地下鉄)$` (excluye servicios pasantes de Tokyu/Odakyu y el subte de Yokohama) |
| Londres | 272 | 272 | **271** | 11 | 272 (TfL / Wikipedia) | 1 de diferencia: probablemente una fusión por nombre a < 400 m; no lo verifiqué |
| Ciudad de México | 211 | 209 | **181** | 12 | 163 (transbordos como una); 195 por línea | Algunos transbordos con andenes a > 400 m no se fusionan. Se quitaron 8 relaciones `route=subway` sin vías (mal etiquetadas) |
| Buenos Aires | 91 | 91 | **87** | 6 (A, B, C, D, E, H) | 90 (Wikipedia, sin Premetro); 78 con transbordos como una | Fusión por nombre junta algunos transbordos |

Reglas de limpieza (en `scripts/fetch_city.py`): estación a < 350 m de una vía de una línea del sistema; fusión si mismo nombre a < 400 m o cualquier nombre a < 80 m; se descarta si no queda ninguna línea a < 300 m.

## Base satelital — Esri World Imagery
- Tiles `server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`, recortadas a la región de cada ciudad (`public/cities/<ciudad>-sat.jpg`). Cache de tiles en `data/tiles/`.
- Atribución: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community".
- **Licencia, ojo:** el uso está pensado dentro de los términos de Esri/ArcGIS (cuenta y atribución). Para prototipo personal va; **para publicar en redes hay que revisar los términos de Esri o cambiar a una fuente abierta** (p. ej. Sentinel‑2 cloudless de EOX, CC BY‑NC‑SA para no comercial; o el modo "duotono"/"canvas" que no usa foto). No lo resolví.

## Ciencia
- Tero, A. et al. (2010). Rules for Biologically Inspired Adaptive Network Design. *Science* 327(5964), 439–442. DOI 10.1126/science.1177894.
- Jones, J. (2010). Characteristics of pattern formation and evolution in approximations of Physarum transport networks. *Artificial Life* 16(2), 127–153.
- Jenson, S. (2019). Physarum. sagejenson.com/physarum.

## Tipografía
Archivo Narrow (SIL Open Font License), copiada de `../live-tags/tool/public/fonts/`.
