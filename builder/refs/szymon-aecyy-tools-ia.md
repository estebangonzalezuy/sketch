# Szymon (@aecyydesign, aecyy.com): cómo construye design tools con IA

Guardado por Esteban el 11/11/2026. "Vayamos en este camino": tools propias + exploraciones 3D hechas con esas tools.

## Proceso para construir una tool (post 30/10, https://x.com/aecyydesign/status/2116280246588547272)
1. Referencias primero: una nota corta por ref (qué te gusta, qué ignorar). Pedir a la IA que describa qué ve y qué tienen en común; quedarse con la idea a tomar y dejar los detalles que no hay que copiar. Si las lee mal, corregir enseguida (muchas primeras versiones malas vienen de refs mal leídas).
2. Antes de cualquier código: que la IA piense todo el proyecto: cómo lo construiría, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible.
3. Nombrar el problema técnico más difícil y comparar 2 o 3 soluciones: calidad posible, velocidad, trabajo, riesgo y costo de cambiar después.
4. Features nuevas: la IA propone ideas y quedan en ideas.md dentro del proyecto, cada una con nota corta, tamaño aproximado y estado (hecha, descartada, después).
5. Si un cambio puede afectar otras partes: listar lo que tiene que quedar exactamente igual.
6. Si el mismo problema sobrevive dos arreglos: parar y preguntar si el enfoque está mal. Rehacer una parte suele ser más rápido que un tercer parche.

## Exploraciones 3D con tools propias
- Tool 3D en el browser con three.js: path tracer espectral en WebGPU, denoiser de Intel (OIDN), blue-noise, loops estables, rayones/haze/smudges procedurales, presets para armar escenas rápido. https://x.com/aecyydesign/status/2112623654530138136
- Tool de liquid shapes: React en el browser, path tracer WebGL2 + OIDN en WebGPU, loops 4K seamless. Hecha con Claude Code y Toolcraft. "Antes hacía los visuales; ahora construyo el sistema que los hace." https://x.com/aecyydesign/status/2114825374961897939
- "No Blender, no Cinema 4D", render en el browser: https://x.com/aecyydesign/status/2110016497804263668
- Glass cube, liquid metal 01/02, background generator (Opus + Toolcraft): https://x.com/aecyydesign/status/2110162256852074690 · https://x.com/aecyydesign/status/2114014367578558964 · https://x.com/aecyydesign/status/2108218651409359300
- "More designers should be building their own design tools": con una tool explorás muchas más combinaciones y la IA te hace versiones para elegir. https://x.com/aecyydesign/status/2115122640252010632
