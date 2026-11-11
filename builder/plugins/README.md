# plugins/ — slots para entornos que se construyen aparte

Dos proyectos hermanos (Physarum Metro y Harmonógrafo) se construyen en paralelo, fuera del builder, con el mismo contrato (`../ENV-INTERFACE.md`). Este directorio define cómo se enchufan. **No los construyas acá**: usá su código cuando esté listo. Edad de la Ciudad no entra: Esteban la descartó.

## Cómo se enchufa un proyecto externo
1. El proyecto expone un módulo `env.ts` que exporta `default` un objeto `Env` (ver `ENV-INTERFACE.md` + agregados opcionales del prompt §5.2).
2. En el builder: `src/envs/external.ts` lista los slots con `{ id, title, num: "P1", load: () => import("<ruta>") }`. Mientras el proyecto no exponga `env.ts`, el slot aparece en el switcher **desactivado** (texto tachado + "en construcción"), sin placeholder visual.
3. Vite: los proyectos viven en carpetas hermanas; usar alias (`@physarum` → `../physarum-metro/src`) o copiarlos a `src/envs/<slug>/` cuando estén cerrados. `server.fs.allow` tiene que incluir la carpeta hermana.
4. Assets/datos pesados: cada slot declara su `load()`; los datos van a `public/data/<slug>/`.
5. La paleta, el export y los atajos son del builder: el adaptador tiene que mapear la paleta propia del proyecto a `ctx.palette` (todos usan los mismos 4 pares).

Cada subcarpeta tiene un `SLOT.md` con lo que encontré en ese proyecto hoy y qué adaptar.
