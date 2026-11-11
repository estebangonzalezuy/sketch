# ideas.md — Physarum Metro

*Paso 4 de Szymon. Estados: hecha · descartada · después. Tamaño S/M/L.*

| Idea | Nota | Tamaño | Estado |
|---|---|---|---|
| Datos reales OSM por ciudad | `npm run fetch-city -- <ciudad>`, 6 ciudades cacheadas | M | hecha |
| Vista mapa | Satélite Esri + red real + moho | M | hecha (prototipo) |
| Vista canvas | Fondo plano del par, sin mapa | S | hecha (prototipo) |
| Lado a lado / apilado / solo | 2160×1350, 1080×1350 (2×8:5), 1080×1350 | S | hecha (prototipo) |
| Métrica honesta + MST de base | Cobertura/precisión con tolerancia en m, largo por esqueleto, estaciones conectadas | M | hecha (prototipo, sin validar a fondo) |
| Correa (leash) | Agentes lejos de toda estación reaparecen: mata los "rayos" que se van del cuadro. No está en Jones; se declara | S | hecha |
| Reaparición aleatoria | Prob. por paso de volver a una estación; poda ramas sueltas | S | hecha |
| Export MP4 con WebCodecs | Implementado; en el Chrome de la box no hay encoder AVC → fallback cuadro a cuadro + ffmpeg | M | hecha a medias |
| Demos MP4 (BCN lado a lado + otras ciudades) | Quedó para Claude Code por cambio de alcance | M | después |
| Modo Tero (flujo–conductancia) | El modelo matemático del paper, sobre grafo Delaunay de estaciones; red de aristas con grosor. Es la mejor comparación con Tokio | L | después |
| Máscara de tierra | El moho no cruza el mar (BCN, Tokio, BA). Desde OSM `natural=coastline` o agua | M | después |
| Relieve como costo | Collserola, colinas: la luz/pendiente como en Tero (ellos usaban luz para montañas) | M | después |
| Cortes | Quitar una estación o un tramo y ver cómo se reorganiza (tolerancia a fallas, como mide Tero) | M | después |
| Peso por pasajeros | Comida proporcional a la afluencia de cada estación (datos abiertos TMB/Metro de Madrid, verificar) | M | después |
| Bicing / Ecobici como comida | Otra red de puntos de la misma ciudad | S | después |
| Ciudad libre | Pegar un CSV lat/lon o elegir un bbox y bajar de OSM en vivo | M | después |
| Crecimiento en orden histórico | Las estaciones aparecen por año de apertura (tag `start_date` cuando exista) | M | después |
| Loop | De vacío a red y vuelta por decaimiento, para IG | S | después |
| WebGPU compute | Detrás de un flag; millones de agentes | M | después |
| Sonido por densidad | Rumor que sube con la red | S | después |
| Ajustar parámetros hasta que "se parezca" | Convierte la comparación en trampa | S | descartada |
| Afirmar "el moho diseña mejor" | No es medible con esta tool | S | descartada |
| Colores de las líneas reales (OSM `colour`) | Rompe la regla de 2 colores por pieza | S | descartada |
| Glow / neón / degradés | Es lo que se copia en redes; acá 1 bit | S | descartada |
