# Foco

Bloqueador de distracciones para la barra de menú de macOS. Un gesto y todo se apaga.

Tauri 2 (Rust) con React y [DialKit](https://www.dialkit.dev/). Sin cuentas, sin nube, sin Electron.

- Vive en la barra de menú: sin ventana principal ni ícono en el Dock.
- Un clic en el ícono abre el panel. `⌥⌘F` arranca una sesión con lo último que elegiste.
- **Modo lista**: bloquea sitios en todos los navegadores y cierra las apps de la lista.
- **Modo una cosa**: deja una sola app a la vista y oculta el resto cada vez que aparece.
- Para cortar una sesión hay que escribir una frase larga o esperar dos minutos.
- Si intentás abrir algo bloqueado, aparece la pantalla de bloqueado.
- Al terminar suena un aviso y se abre el resumen. El historial muestra el tiempo en foco por día de la semana.
- `⌥` clic en el ícono abre el panel de curvas: los springs y easings de la app, editables en vivo.

## Estado

Esto se escribió en un contenedor Linux, sin una Mac a mano. Qué se probó y qué no:

| Parte | Cómo se verificó |
| --- | --- |
| Núcleo (`/etc/hosts`, lectura de SNI, protocolo) | 9 tests unitarios, pasan |
| Helper privilegiado | Prueba de punta a punta con 23 comprobaciones (`scripts/test-helper.sh`), pasa en Linux |
| App Tauri (bandeja, ventanas, atajo, control de apps) | Chequea tipos contra `aarch64-apple-darwin`. **Nunca se ejecutó** |
| Interfaz | Probada en un navegador con un helper simulado |
| `.app`, `install.command`, `launchd` | **Sin probar**: hay que correrlo en una Mac |

La primera compilación en tu Mac es la prueba real. Lo más probable es que haya detalles para ajustar en lo que nunca corrió: la posición del popover, el nivel de las ventanas y el control de apps.

## Instalar

Hace falta una Mac con Apple Silicon y macOS 14 o más nuevo, y [Node](https://nodejs.org) 20 o más nuevo. El instalador se ocupa del resto.

```bash
cd foco && ./install.command
```

También sirve el doble clic sobre `install.command` en el Finder. Hace cinco cosas: revisa que estén las herramientas de Xcode, Rust y Node (ofrece instalar Rust si falta), instala dependencias, compila `Foco.app`, la copia a `/Applications` e instala el helper. Pide tu contraseña una vez, en el último paso. La primera compilación tarda unos minutos.

Para actualizar después de cambiar el código, corré el instalador de nuevo. Para sacar todo:

```bash
./uninstall.command
```

Foco no arranca sola al encender la Mac: abrila desde `/Applications`, o sumala en Ajustes del Sistema → General → Ítems de inicio.

### Desarrollar

Con recarga en caliente, sin instalar nada en `/Applications`:

```bash
npm install
```

```bash
npm run tauri dev
```

Para generar solo el `.app`, sin instalarlo: `npm run app`. Queda en `src-tauri/target/release/bundle/macos/Foco.app`, firmado ad hoc.

## El helper privilegiado

Bloquear sitios para todo el sistema requiere ser administrador. Eso lo hace un programa aparte, `foco-helper`, que corre como root bajo `launchd`. Va incluido dentro de `Foco.app`.

**Instalarlo.** `install.command` ya lo hace. Si copiaste la app a mano, el panel muestra "Falta un paso" y el botón **Instalar helper** pide tu contraseña una vez. O desde la Terminal:

```bash
sudo /Applications/Foco.app/Contents/Resources/resources/install-helper.sh /Applications/Foco.app/Contents/MacOS/foco-helper
```

Esto instala tres cosas:

| Ruta | Qué es |
| --- | --- |
| `/Library/PrivilegedHelperTools/co.estebangonzalez.foco.helper` | El binario, propiedad de root |
| `/Library/LaunchDaemons/co.estebangonzalez.foco.helper.plist` | Lo arranca al encender la Mac y lo revive si muere |
| `/Library/Application Support/Foco/` | La sesión en curso y el historial |

**Desinstalarlo.** También es la salida de emergencia si algo queda bloqueado:

```bash
sudo /Applications/Foco.app/Contents/Resources/resources/uninstall-helper.sh
```

El registro del helper está en `/var/log/foco-helper.log`.

## Permisos

Foco no debería pedir ninguno. Ocultar y cerrar apps usa `NSRunningApplication`, y el atajo global usa la API de teclas rápidas del sistema; ninguna de las dos necesita Accesibilidad. Si en tu Mac el modo una cosa no oculta las apps, probá darle Accesibilidad en Ajustes del Sistema → Privacidad y seguridad, y anotalo: sería un supuesto mío que no se cumplió.

Para que el bloqueo de sitios funcione en todos lados:

- **Safari**: apagá iCloud Private Relay (Ajustes → tu nombre → iCloud). Con el relay prendido, Safari no consulta `/etc/hosts`.
- **VPN o proxy**: si el navegador sale por un proxy, el nombre se resuelve del otro lado y el bloqueo no aplica.
- **Pestañas ya abiertas**: pueden seguir cargando hasta un minuto, mientras el navegador agota sus conexiones y su caché de DNS.

## Cómo funciona

```
Foco.app (tu usuario)                          foco-helper (root, launchd)
─────────────────────                          ───────────────────────────
ícono, popover, atajo           socket         dueño de la sesión y de la hora de fin
pantalla de bloqueado     ◄──────────────►     escribe y vigila /etc/hosts
oculta y cierra apps      /var/run/foco.sock   escucha en 127.0.0.1:80 y :443
                                               decide si se puede cortar
```

La app es un cliente. No guarda la sesión ni toca `/etc/hosts`: le pide al helper que arranque y le pregunta el estado dos veces por segundo. Por eso cerrar la app no corta nada. Si la cerrás durante una sesión, el helper la vuelve a abrir.

### Lo más difícil: bloquear sitios sin que sea fácil saltearlo

Son dos problemas juntos. El bloqueo tiene que valer para todos los navegadores, así que no puede vivir dentro de uno. Y tiene que sobrevivir a que cierres la app, así que no puede vivir en la app. Las tres opciones:

| | `/etc/hosts` + helper | NetworkExtension (filtro de contenido) | Firewall `pf` |
| --- | --- | --- | --- |
| Cómo bloquea | El nombre resuelve a `127.0.0.1` | El sistema le pregunta a tu extensión por cada conexión | Descarta paquetes hacia ciertas IP |
| Todos los navegadores | Sí | Sí | Sí |
| Precisión | Por nombre de host, sin comodines | Por host y por app | Por IP: x.com y YouTube comparten IP con medio internet |
| Se saltea con | Private Relay, proxy, VPN | Casi nada | DNS no, pero las IP cambian y se desactualiza |
| Requisitos | Un daemon de root | Cuenta de Apple Developer paga, entitlement especial, notarización, extensión en Swift | Un daemon de root |
| Encaja con Tauri y Rust | Sí | No: es un proyecto de Xcode aparte | Sí |
| Sabe qué intentaste abrir | Sí, con un truco (abajo) | Sí | No |

**Elegí `/etc/hosts` con un helper privilegiado.** NetworkExtension es la respuesta más sólida, pero exige una cuenta paga, firmar y notarizar, y escribir media app en Swift: rompe "liviana" y "todo local". `pf` bloquea por IP y los sitios grandes no tienen IP propias. `/etc/hosts` es simple, se puede auditar con `cat`, y sus agujeros son conocidos y acotados.

Sus dos debilidades y cómo quedan resueltas:

- **Editar el archivo a mano.** El helper lo revisa cada segundo y repone el bloque. Para sacarlo hay que desinstalar el helper con `sudo`.
- **No avisa cuando intentás entrar.** Los sitios bloqueados apuntan a `127.0.0.1`, y mientras dura la sesión el helper escucha ahí en los puertos 80 y 443. Cuando el navegador se conecta, el helper lee a qué sitio iba (el SNI del saludo TLS, que viaja sin cifrar, o la cabecera `Host`) y corta. No hace falta certificado ni descifrar nada. Ese aviso es lo que dispara la pantalla de bloqueado.

Una pestaña que quedó abierta sigue insistiendo de fondo. Para que eso no dispare la pantalla cada pocos segundos, una conexión cuenta como intento solo si el sitio venía callado hacía 45 segundos.

### Qué tan difícil es saltearlo

Es fricción, no una cárcel. Durante una sesión:

| Intento | Resultado |
| --- | --- |
| Cerrar o matar la app | El bloqueo sigue; el helper la reabre |
| Borrar las líneas de `/etc/hosts` | Vuelven en un segundo |
| Matar el helper | `launchd` lo revive y retoma la sesión |
| Reiniciar la Mac | La sesión sigue hasta su hora |
| Mandarle "cortar" al socket a mano | El helper exige la frase o el enfriamiento cumplido |
| `sudo uninstall-helper.sh` | Corta todo. Es la salida de emergencia, a propósito |
| Adelantar el reloj del sistema | Termina la sesión antes (ver `ideas.md`) |

## Lo que no debe cambiar

1. **Liviana.** Tauri 2 con frontend React y DialKit. Nada de Electron.
2. **El bloqueo es nativo.** Los sitios y las apps los bloquea Rust (la app y el helper). El frontend solo dibuja y pide.
3. **Todo local.** Cero cuentas, cero nube, cero suscripción, cero telemetría. La app no hace ningún pedido de red.
4. **Un solo gesto.** `⌥⌘F` arranca una sesión sin pasos intermedios.
5. **Cerrar la app no corta la sesión.** La sesión es del helper.
6. **Paleta.** Negro tinta `#0C0C0C`, blanco, y el acento `#E4FC24` reservado para el estado en foco. Nunca `#0000FF` ni `#3D3DEB`. Sin etiquetas en mayúsculas con cuadraditos de color.
7. **DialKit sin disfraz.** Los controles son los componentes de DialKit; solo se les pasa la paleta por sus variables CSS.

## Desarrollo

```
foco/
├── src/                     Frontend (React + DialKit)
│   ├── Panel.tsx            El popover: elige qué vista mostrar
│   ├── Block.tsx            La pantalla de bloqueado
│   ├── views/               Setup, Running, Summary, History, Curves, Install
│   ├── tuning.ts            Curvas de fábrica
│   └── ipc.ts               Puente con Rust y helper simulado para el navegador
├── src-tauri/
│   ├── src/                 La app: bandeja, ventanas, atajo, control de apps
│   ├── core/                Lo compartido: protocolo, /etc/hosts, SNI
│   ├── helper/              El daemon privilegiado
│   └── resources/           Scripts de instalación del helper
└── scripts/
    ├── build-helper.mjs     Compila el helper y lo deja para el bundle
    └── test-helper.sh       Prueba de punta a punta del helper
```

Tests del núcleo:

```bash
npm test
```

Prueba de punta a punta del helper. No necesita root: usa un `/etc/hosts` de mentira y puertos altos.

```bash
./scripts/test-helper.sh
```

Para diseñar la interfaz sin compilar la app, `npm run dev` y abrí `http://localhost:1420` en un navegador. Usa un helper simulado. Con `?mock=session`, `?mock=summary` o `?mock=missing` elegís el estado inicial; `?panel=history` y `?panel=tuning` abren esas vistas; `?view=block&mock=session` muestra la pantalla de bloqueado.

Las ideas que quedaron para después están en [`ideas.md`](ideas.md).
