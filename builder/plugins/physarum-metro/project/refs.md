# refs.md — Physarum Metro

*Paso 1 del proceso de Szymon. 11/11/2026. Base: `../100-tools/top/06-physarum-bcn/refs.md`. Lo marcado "(confirmar Esteban)" es mi lectura, no algo que dijiste.*

## Tero et al. 2010 — "Rules for Biologically Inspired Adaptive Network Design", *Science* 327(5964):439–442
- **Qué es:** pusieron avena en las posiciones de 36 ciudades alrededor de Tokio sobre una placa; el *Physarum polycephalum* armó en ~26 h una red comparable a la ferroviaria real del Gran Tokio en costo, eficiencia y tolerancia a fallas. De ahí sacaron un modelo matemático de flujo y conductancia (tubos que se engrosan con el flujo y se afinan sin uso). DOI 10.1126/science.1177894.
- **Me gusta (lectura mía):** la pregunta: una red que se arma sola al lado de una diseñada, con los mismos puntos.
- **Ignorar:** el tono de nota científica de divulgación; la iluminación usada para simular montañas y lagos.
- **Ojo:** el experimento fue con el **ferrocarril** del Gran Tokio (JR y privados), no con el subte. Acá en Tokio usamos Tokyo Metro + Toei: es un homenaje, no una réplica.

## Jeff Jones 2010 — "Characteristics of pattern formation and evolution in approximations of Physarum transport networks", *Artificial Life* 16(2):127–153
- **Qué es:** el modelo de agentes: cada partícula tiene 3 sensores (izq., centro, der.), gira hacia donde hay más rastro, avanza y deposita; el mapa de rastro se difunde y decae. Con fuentes de comida fijas aparecen redes tipo Steiner.
- **Me gusta:** que es simple, local y se ve crecer.
- **Ignorar:** las variantes de forma/contracción (no hacen falta).

## Sage Jenson — "Physarum" (sagejenson.com/physarum, 2019)
- **Qué es:** la versión GPU más difundida del modelo de Jones, con miles de miles de agentes y parámetros por especie.
- **Me gusta:** la densidad y la textura del trazo cuando hay millones de agentes; la idea de que los parámetros son el instrumento.
- **Ignorar:** los degradés neón/iridiscentes y el glow (lo que más se copia en redes). Acá: 1 bit, dos tintas.

## Live Tags tool (tuya, `../live-tags/tool/`)
- **Me gusta:** las dos vistas lado a lado (footage | canvas) con los mismos datos; diales reales; el export MP4 4:5.
- **Tomar:** "mapa" = foto satelital + gráfica; "canvas" = fondo plano, solo la gráfica. Misma simulación en las dos.

## Hex / swipe.hex.inc
- **Me gusta:** sobriedad, "la textura como encoding, no como filtro".
- **Ignorar:** azules de algunos pines (prohibidos #0000FF y #3D3DEB).

## Qué tienen en común
Un sistema simple que se organiza solo produce algo que parece diseñado; el gancho es ponerlo al lado de lo real con los mismos puntos.

## La idea a tomar
La red del moho crece desde las estaciones reales y se compara —a la vista y con un número honesto— con la red real de metro.

## Lo que no se copia
Glow, neón, degradés; afirmar que "el moho diseña mejor"; ajustar parámetros hasta que "se parezca" sin decirlo.
