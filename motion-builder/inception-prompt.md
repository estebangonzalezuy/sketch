# Editor de video interno para Reboot: prompt "inception" para Claude Code

Se usa en dos pasos. El **Paso 1** lo pegás en Claude Code dentro de la carpeta (o repo) donde están las tools. Claude te entrevista y, con tus respuestas, escribe el **Paso 2**: un prompt largo en `docs/editor/BUILD_PROMPT.md`. Ese lo pegás en una sesión nueva y arranca la construcción.

---

## Paso 1: pegar en Claude Code

```
Vamos a diseñar la base de un editor de video interno para Reboot (agencia de motion en Barcelona). Es mi proyecto principal. Todavía NO escribas código de la app. Tu trabajo en esta sesión tiene tres fases: investigar, entrevistarme y escribir el prompt de construcción.

## La idea
Un editor con timeline construido a partir de las tools de visuales que ya venimos haciendo nosotros. Cada tool genera un visual (por ejemplo shaders, tipografía generativa, pixelado o collage). La idea es:
1. que cada tool exponga sus parámetros,
2. que esos parámetros sean editables y animables en un timeline,
3. que se puedan insertar varias tools como clips o capas para armar videos nuevos,
4. y que agregar una tool nueva sea fácil y siga siempre la misma estructura.

Para los controles y la edición de timing quiero usar DialKit (https://dialkit.dev, de Josh Puckett, `npm install dialkit motion`). Da sliders, color, select, toggle, image, pad (2D), springs y easings, folders y acciones con `useDialKit`, y un timeline de clips con `useDialTimeline` y `<DialTimeline />`: cada clip tiene `at`, `duration`, `from`/`to` y `transition`, más play, pause, seek y replay. Leé el README y la guía del timeline antes de proponer nada.

## Fase 1: investigar (sin preguntarme todavía)
- Recorré este repo y encontrá las tools existentes. Para cada una anotá en qué está hecha, cómo renderiza (canvas 2D, WebGL, SVG, DOM o Remotion), qué parámetros tiene hardcodeados, cuáles ya son configurables y si exporta imagen o video.
- Leé la documentación de DialKit. Separá lo que resuelve (UI de parámetros, edición de clips, curvas) de lo que NO resuelve. Por ejemplo, revisá si sirve como timeline de producto o solo para afinar valores en desarrollo (hay un modo `productionEnabled`), si persiste proyectos y si exporta video. No asumas: decime qué verificaste en el código o la doc.
- Escribí `docs/editor/00-research.md` con un inventario de tools (tabla), los límites de DialKit y 2 o 3 riesgos técnicos.

## Fase 2: entrevistarme
Haceme preguntas en tandas de 3 a 5 como máximo, de a una tanda por vez, y esperá mis respuestas. Cuando haya opciones, proponelas con tu recomendación. Cubrí como mínimo:
- Usuarios: quién lo usa (yo, el equipo de motion, otros perfiles de Reboot) y su nivel técnico.
- Output: formatos, resoluciones, fps, duración típica, y si hace falta render a MP4, secuencia PNG o algo en vivo en el navegador.
- Motor de render: si conviene Remotion, un render propio por frames o un híbrido. Atención a que el preview y el render final sean idénticos (determinismo por frame).
- Modelo de tool: qué es una tool (inputs, params, render(t), outputs), cómo se declaran los parámetros (¿un schema que alimente tanto DialKit como el timeline?) y qué params son animables y cuáles fijos.
- Timeline: capas o pistas, clips, keyframes contra tweens from/to, curvas, composición y blend entre tools, y assets (imágenes, video, texto).
- Proyecto: guardar y abrir, versionado, presets por tool y plantillas de marca.
- Stack: framework (React/Next/Vite) y dónde corre (local o desplegado interno).
- Alcance del MVP: qué tiene que funcionar en la primera versión y qué queda afuera. Proponé un MVP chico, por ejemplo 2 tools adaptadas, 1 timeline y export.
- Ejemplos: pedime que te pase 1 o 2 tools concretas como ejemplo canónico de "cómo es una tool" si no quedó claro en la investigación.

## Fase 3: escribir el prompt de construcción
Cuando tengas suficientes respuestas, decímelo y escribí `docs/editor/BUILD_PROMPT.md`: un prompt largo y autocontenido para una sesión nueva de Claude Code. Tiene que incluir:
1. Contexto y objetivo (sin depender de esta conversación).
2. Decisiones tomadas, con el porqué en una línea cada una.
3. Contrato de tool: interfaz TypeScript, schema de parámetros, cómo se mapea a DialKit y al timeline, y una tool de ejemplo completa.
4. Estructura de carpetas, incluida `tools/<nombre>/` para insertar tools nuevas, más una checklist de "cómo agregar una tool".
5. Arquitectura del editor: estado del proyecto, timeline, preview y render/export.
6. Plan por etapas, cada una con su criterio de "listo" verificable:
   a) contrato de tool más 1 tool adaptada,
   b) panel de parámetros con DialKit,
   c) timeline con params animables,
   d) adaptar el resto de las tools,
   e) export.
7. Reglas de trabajo: commits chicos, no romper las tools originales (adaptarlas con un wrapper o una copia) y mostrarme capturas o un render corto al cerrar cada etapa.
8. Preguntas abiertas que quedaron.
Además escribí `docs/editor/01-decisions.md` con mis respuestas resumidas.

Empezá por la Fase 1.
```

---

## Paso 2: qué hacer con el resultado

1. Revisá `docs/editor/00-research.md` y `docs/editor/BUILD_PROMPT.md`. Si algo no te cierra, pedile cambios en la misma sesión.
2. Abrí una sesión nueva de Claude Code y pegá: `Leé docs/editor/BUILD_PROMPT.md y docs/editor/01-decisions.md y arrancá por la etapa (a). No avances de etapa sin mostrarme el resultado.`
3. Si querés, pasame el `BUILD_PROMPT.md` y te lo reviso antes de arrancar.

## Notas
- No sé dónde están las tools de Reboot ni en qué stack están hechas. Por eso el prompt arranca investigando el repo en vez de suponerlo.
- No probé DialKit. Según su web es un afinador de valores y timing que está oculto en producción salvo que actives `productionEnabled`, y su timeline tiene un botón Copy para pasar los valores al código. No vi que exporte video. Por eso el prompt le pide a Claude que verifique si alcanza como timeline del editor o si DialKit queda para los parámetros y el timeline de producto se arma aparte.
