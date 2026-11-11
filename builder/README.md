# builder — paquete para Claude Code

*Armado por Taller para Esteban González el 11/11/2026 (hora de Madrid). Nada publicado. Actualizado el mismo día: se sacó Edad de la Ciudad, se sumó el prompt de introducción y, más tarde, un `CLAUDE-PROMPT.md` por entorno para pegar cuando se construya esa tool.*

Una app de navegador que junta 17 tools generativas como **entornos** con switcher arriba y diales de **DialKit**, más 2 slots para tools que se construyen aparte (Physarum Metro y Harmonógrafo). Este paquete **no trae la app construida**: trae todo para que Claude Code la construya bien, con el proceso de Szymon.

## Empezá por acá
1. Abrí Claude Code en esta carpeta.
2. Pegale primero `00-INTRO-PROMPT.md` entero (introducción global: una sola app, lista de tools, shell, orden de lectura, 6 pasos de Szymon).
3. Claude Code tiene que responder con un plan, no con código. El prompt maestro detallado es `CLAUDE-PROMPT.md` (leelo después de la intro).
4. Va a frenar en 4 paradas para que apruebes (refs, plan, core con 2 entornos testigo, entornos con inputs). Cuando le toque un entorno, pegale su `envs/<slug>/CLAUDE-PROMPT.md` (cada tool tiene el suyo; Live Tags apunta al prompt original en `ports/live-tags/` y lo adapta al builder).

## Contenido
| Ruta | Qué es |
|---|---|
| `00-INTRO-PROMPT.md` | Prompt de introducción global: pegalo primero. Proyecto, lista de tools, shell, mapa, orden de lectura, 6 pasos, orden de construcción |
| `CLAUDE-PROMPT.md` | Prompt maestro detallado (~3.600 palabras): quién sos, 6 pasos de Szymon con paradas, arquitectura, stack verificado, paleta, export, atajos, fases, criterios de hecho, estética, anti-slop |
| `ENV-INTERFACE.md` | Contrato `Env` compartido (Harmonógrafo, Physarum Metro, Live Tags y el resto de entornos; el prompt lo extiende sin romperlo) |
| `refs.md` · `PLAN.md` · `ideas.md` · `PROCESS.md` | Proceso de Szymon a nivel builder |
| `DIALKIT-NOTES.md` | API real de dialkit@2.2.0 |
| `SOURCES.md` | Fuentes de todos los datos, con links y fecha |
| `envs/01…17/` | Por entorno: `CLAUDE-PROMPT.md` (prompt extenso para pegar cuando construyas esa tool; el de Live Tags es más corto y apunta a `ports/live-tags/PROMPT-live-tags.md`), `refs.md`, `PLAN.md` (problema más difícil, 3 soluciones comparadas, elección, invariantes), `ideas.md`, `SPEC.md` (params DialKit, entradas, visual, datos, export, criterios de hecho) |
| `plugins/` | Slots para Physarum Metro y Harmonógrafo |
| `data/` · `data-raw/` | Datos reales procesados y sus originales |
| `corpus/` | Texto semilla para Markov de Notas |
| `ports/live-tags/` | Copia de la tool de live tags para portarla |
| `skeleton/` | Tipos, paleta y registro mínimos, sin compilar (opcional) |
| `refs/szymon-aecyy-tools-ia.md` | Nota de Szymon |
| `_gen/` | Scripts con los que Taller generó las specs (no hacen falta) |

## Entornos
01 Limaduras · 02 Viento Vivo · 03 Órbita Saturada · 04 Huella de Voz · 05 Superilla · 06 Bifurcación · 07 Atractor · 08 Polirritmo · 09 Gramática de Plantas · 10 Nervaduras · 11 Metros por Sueldo · 12 Estratos · 13 Feedback · 14 Markov de Notas · 15 Anagrama · 16 Multi-anagrama · 17 Live Tags · P1 Physarum Metro · P2 Harmonógrafo
