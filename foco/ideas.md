# Ideas para después

Lo que fue surgiendo y quedó afuera a propósito.

## Bloqueo más firme

- **Reloj monotónico.** Hoy la sesión termina por la hora del sistema; adelantar el reloj la corta. El helper podría contar tiempo transcurrido y guardarlo cada tanto.
- **`pf` como segunda capa.** Al arrancar, resolver las IP de los sitios y cortar las conexiones ya abiertas, para que las pestañas abiertas caigan al instante y no al minuto.
- **Comodines de verdad.** `/etc/hosts` no los acepta: hoy cada sitio lleva una lista corta de subdominios conocidos. Un resolvedor DNS local en el helper bloquearía `*.sitio.com` entero.
- **NetworkExtension.** Si algún día hay cuenta de Apple Developer, es la versión sin agujeros: cubre Private Relay, proxies y VPN.
- **Avisar si Private Relay está prendido**, en vez de solo decirlo en el README.
- **Modo estricto**: sin frase ni enfriamiento. La sesión no se corta.
- **Frase distinta cada vez**, para que no se vuelva memoria muscular.
- **Verificar quién le habla al socket** (credenciales del par) y aceptar solo a la app firmada.

## Sesiones

- **Horarios**: foco automático de 9 a 12 los días de semana.
- **Descansos**: ciclos de foco y pausa, con los sitios abiertos en la pausa.
- **Perfiles**: "animación", "edición", "administración", cada uno con su lista y su app.
- **Extender** una sesión que está por terminar con un gesto.
- **Lista blanca**: bloquear todo salvo unos pocos sitios, para trabajar con referencias.
- **Varias apps permitidas** en el modo una cosa (After Effects y el reproductor de referencia).
- **Elegir el atajo** desde el panel.

## Pantalla de bloqueado e ícono

- **Frases propias** y que roten.
- **Una pantalla por monitor**; hoy aparece solo donde está el cursor.
- **El punto que respira** en el ícono de la barra de menú, además del anillo. Quedó afuera porque redibujar el ícono varias veces por segundo no es gratis.
- **Elegir entre minutos y reloj completo** en la barra de menú. Hoy muestra minutos, y segundos solo en el último minuto, para que no sea otra cosa que se mueve.
- **Sonidos propios** en vez del `Glass` del sistema.

## Historial

- **Rachas** y la mejor semana.
- **Qué intentaste abrir más**: el dato ya pasa por el helper, pero el historial guarda solo el conteo.
- **Exportar** a CSV.

## Proyecto

- **Arrancar con la Mac** (ítem de inicio de sesión).
- **Instalar el helper con `SMAppService`** en vez de un script, cuando la app esté firmada con un Developer ID.
- **Actualizaciones** sin recompilar.
- **Probar el control de apps en una Mac** con un test automatizado; hoy es la parte con menos red.
