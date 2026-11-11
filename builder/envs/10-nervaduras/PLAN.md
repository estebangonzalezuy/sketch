# PLAN.md — Nervaduras (ficha 017)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `nervaduras` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Sigue el trazo caligráfico' vs. 'la fuente es un contorno': no hay esqueleto de trazo en la TTF. Aproximar con la transformada de distancia/esqueleto de la máscara o con un barrido (de abajo hacia arriba).

## Parte más riesgosa
Rendimiento con 3–8k auxinas y vecinos más cercanos.

## Problema técnico más difícil
**Búsqueda de vecinos (auxina→nodo más cercano) rápida y crecimiento ordenado por el trazo de la letra.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Fuerza bruta O(A·N) | Alta | Lento > 2k | Bajo | Bajo | Bajo |
| B. Grilla espacial uniforme (buckets) + activación de auxinas por un frente que avanza según distancia geodésica desde la raíz dentro de la máscara (BFS en la grilla) | Alta | 8k OK | Medio | Bajo | Bajo |
| C. KD-tree (kdbush) + esqueletización Zhang-Suen | Alta | Rápido | Medio | Medio | Medio |

**Elección:** B. El frente geodésico hace que el crecimiento recorra la letra como un trazo sin necesitar esqueleto.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Las venas nunca salen de la máscara.
- Grosor monótono hacia la raíz.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).

---

## Decisiones de Claude Code (fase 3) — 11/11/2026
- **B confirmada.** Máscara = el glifo rasterizado (Archivo Narrow Bold, escalado para llenar el canvas). Raíz = la celda más baja de la letra más cercana al centro. Frente geodésico = BFS de 8 vecinos en una grilla de 4 px desde la raíz; las auxinas se activan cuando el frente las alcanza. Vecino más cercano por buckets (celda = radio de influencia).
- **Nunca afuera:** un nodo nuevo se acepta solo si él y el punto medio del segmento caen dentro de la máscara. Las auxinas en partes de la letra no conectadas a la raíz (p. ej. el punto de la i) se descartan.
- Grosor = grosorBase · (flujo/flujoRaíz)^(1/exponente), flujo = cantidad de nodos aguas abajo: monótono hacia la raíz.
- Loop: crece en 9 s/velocidad, sostiene 1,5 s y corta (`loop: "cut"`).
- Los radios y el paso están en px a 1080 y escalan con el lado corto.
