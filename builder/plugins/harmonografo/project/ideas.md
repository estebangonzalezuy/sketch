# ideas.md — Harmonógrafo

| Idea | Nota | Tamaño | Estado |
|---|---|---|---|
| 2–6 péndulos laterales + mesa rotativa | núcleo | M | hecha |
| Remuestreo por largo de arco | línea pareja | S | hecha |
| Corte por envolvente | evita el empaste final | S | hecha |
| Pluma en tiempo físico / velocidad constante | físico = frena como el instrumento | S | hecha |
| Presets JSON (guardar / cargar) + 6 curados | `presets/*.json` | S | hecha |
| Random curado (enteros 2–6 ± 0,008) | v1 con razones fraccionarias daba garabatos | S | hecha |
| Tecla P rota pares, I invierte, paleta al azar al abrir | | S | hecha |
| SVG de plotter (DP, 200×250 mm) | 10–24 mil puntos por dibujo | S | hecha |
| MP4 WebCodecs + fallback ffmpeg | WebCodecs da yuvj420p | M | hecha |
| Receta tipográfica abajo (nombre, t, números) | la receta es parte de la pieza | S | hecha |
| Modo serie: grilla 3×3 dibujándose a la vez | hecho como script de demo (`scripts/serie.mjs`); en el builder: entorno compuesto | M | hecha (demo) / builder después |
| Grosor por velocidad (más lento = más grueso) | tinta realista; ojo, no romper SVG | M | después |
| Ruido de mesa como dial explícito (0 por defecto) | "gesto" sin mentir | S | después |
| Número editable al lado de cada slider (prototipo) | ajuste fino ±0,001 | S | hecha |
| Frecuencia = razón entera + desafinación (2 diales) | para DialKit | S | después |
| Morph entre dos presets (interpolar recetas) | loop de video entre dibujos | M | después |
| Export multipluma (2 capas SVG para 2 tintas en plotter) | | M | después |
| Sonido: la frecuencia como nota | lindo pero es otra pieza | L | descartada por ahora |
| Glow / gradientes / colores por velocidad | contra las reglas de estética | — | descartada |
| Entorno `Env` del builder (DialKit) | contrato en `../builder/ENV-INTERFACE.md`; prompt listo | L | después (Claude Code) |
