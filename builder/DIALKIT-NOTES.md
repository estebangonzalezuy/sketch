# DialKit — notas de API (verificadas)

*Leído por Taller el 11/11/2026 del README y los tipos (`dist/index.d.ts`) de **dialkit@2.2.0** instalado desde npm (última modificación del paquete: 07/11/2026). Repo: https://github.com/joshpuckett/dialkit · sitio: dialkit.dev · autor: Josh Puckett · licencia MIT. Claude Code: verificá contra la versión que instales.*

## Instalación (React)
```
npm install dialkit motion
```
`motion` es peer dependency del adaptador React. Peer deps declaradas: react ≥18, react-dom ≥18, motion ≥11.

```tsx
import { DialRoot, useDialKit, useDialKitController } from "dialkit";
import "dialkit/styles.css";
```

## Panel
```ts
useDialKit(name, config, options?)            // → valores (ResolvedValues<T>)
useDialKitController(name, config, options?)  // → { values, setValue, setValues, resetValues, setOpen, getOpen, getValues }
```
Opciones (`UseDialOptions`): `id` (id estable del panel; conserva valores entre montajes), `persist` (localStorage; por defecto false), `defaultCollapsed`, `onAction(path)` (recibe el path del botón `{type:"action"}`), `shortcuts` (por path: `{ key: "r", mode: "fine" }`).

## Controles (config → valor)
| Control | Config | Valor |
|---|---|---|
| Slider | `radio: [24, 0, 64]` | number |
| Slider con paso | `radio: [24, 0, 64, 2]` | number |
| Slider inferido | `escala: 1.2` | number |
| Toggle | `visible: true` | boolean |
| Texto | `titulo: "Hola"` | string |
| Color | `acento: "#a78bfa"` | string (**no usar: paleta global**) |
| Select | `{ type: "select", options: ["a", "b"] }` | string |
| Imagen | `{ type: "image", options: ["/x.jpg"] }` | URL o data URL (subida local ≤ 10 MB) |
| XY pad | `{ type: "pad" }` | `{ x, y }` |
| Spring | `{ type: "spring", visualDuration: 0.3, bounce: 0.2 }` | TransitionConfig |
| Easing | `{ type: "easing", duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }` | TransitionConfig |
| Acción | `{ type: "action" }` | llama `onAction(path)` |
| Carpeta | `{ blur: [12, 0, 40], _collapsed: true }` | valores anidados |

**Ojo con strings:** un string que parece color (`"#..."`) se interpreta como control de color. Los textos de los entornos no empiezan con `#`.

## Root
```tsx
<DialRoot mode="inline" theme="dark" productionEnabled versions="menu" />
```
- `mode`: `"popover"` (flotante, arrastrable) o `"inline"` (llena su contenedor) → usar inline en la columna derecha.
- `position`, `theme` (`system`/`light`/`dark`), `defaultOpen`, `onOpenChange`, `versions` (`thumbnails` captura la página como miniatura; `menu` es la lista clásica).
- **Los roots de React se ocultan en builds de producción salvo `productionEnabled`.** El builder lo necesita en `true`.
- Varios paneles registrados aparecen como secciones de un mismo root. En el builder: un panel por entorno activo (montado con `key={env.id}`), más uno chico "salida" (formato, duración) si hace falta.

## Atajos y teclado de DialKit
Shortcuts por control (mantener tecla + scroll en sliders, tecla para toggles). Se pausan cuando hay foco en inputs. Tab + flechas para navegar sliders; Enter para editar el número. **Conflicto posible con atajos globales del builder (R, C, E, I, S…):** no asignar shortcuts DialKit a esas teclas; y los atajos globales tienen que ignorar eventos con foco dentro del root de DialKit.

## Versiones / presets propios de DialKit
"Save version" guarda valores + miniatura; "Copy" copia valores + instrucción. Con `persist: true` van a localStorage (`dialkit:<id>`). El builder usa además su JSON de presets (formato de intercambio, render headless).

## Otros
- Timeline (`useDialTimeline`, `<DialTimeline />`): clips con keyframes. No hace falta en v1; anotado en `ideas.md` (automatizar diales en el tiempo).
- Adaptador vanilla (`dialkit/vanilla`): `createDialKit`, `createDialRoot`, `kit.subscribe`. Útil si algún entorno externo (plugins) quiere su panel sin React.
