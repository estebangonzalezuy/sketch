# physarum metro — prototipo

Un moho (modelo de agentes de Jones 2010) conecta las estaciones **reales** de metro de 6 ciudades (OSM) y se compara con la red real. Vistas **mapa** (satélite Esri + gráfica) y **canvas** (fondo plano), lado a lado.

**Estado:** prueba de concepto. La versión buena la arma Claude Code con `CLAUDE-PROMPT.md`.

```bash
npm install
npm run fetch-city -- barcelona     # o: madrid tokyo london cdmx buenosaires | all  (--refresh, --no-sat)
npm run dev                          # http://localhost:5197
node scripts/probe.mjs barcelona 270 out/x.jpg '{"pair":1}'   # render headless de un cuadro + métrica
scripts/stills.sh                    # stills de las 6 ciudades en out/stills/
```

Teclas: espacio play · r reiniciar · c rotar par · i invertir · v vista · b base · l red real · m medir · 1–6 ciudad.

Proceso de Szymon: `refs.md`, `PLAN.md`, `ideas.md`, `PROCESS.md`. Fuentes y conteos: `SOURCES.md`.
