# Grabación

Cómo se graba la herramienta: el grabador (`grabacion/escena.mjs` y `grabacion/lib.mjs`), cómo se escribe un capítulo (`grabacion/capN.mjs`) y qué hace `node hacer.mjs grabar`. En el proyecto hay un resumen con un capítulo de ejemplo: `grabacion/README.md`.

## Qué pasa al grabar

- Se abre el **Chrome instalado** en la computadora, sin ventana, con Playwright (`playwright-core`). Si no hay Chrome se intenta Edge; la variable `CHROME` apunta a otro ejecutable. La página se ve en modo claro y en el idioma de la voz (`es-MX` si la voz es de México).
- La ventana grabada mide **1366 x 768** (una laptop común) con densidad 1.5: Chrome manda cuadros de 2049 x 1152, el video sale a 2050 x 1152 y se ve nítido aunque la cámara se acerque. Ese tamaño está en `grabacion/lib.mjs` (`VP` y `DPR`).
- Chrome se abre con dos opciones que se midieron. `--force-device-scale-factor`: sin ella, Chrome sin ventana manda los cuadros a 1366 x 768 aunque la página tenga densidad 1.5, y el video salía estirado; el grabador mide el primer cuadro y se detiene si llega más chico. `--disable-lcd-text`: el suavizado de subpíxel pintaba bordes de color en el 32% de los píxeles de las letras; con ella, en ninguno.
- Chrome manda un cuadro cada vez que la pantalla cambia (screencast) y el grabador anota a qué segundo llegó. Al cerrar se arma un MP4 a los cuadros por segundo de `proyecto.json` → `video.fps`, sosteniendo cada cuadro hasta el siguiente, con **un cuadro clave por segundo** (HyperFrames busca cuadros sueltos y, si los cuadros clave están separados, la imagen se puede congelar; `construir` lo revisa) y cortado en el final exacto del capítulo. Después se borran los cuadros sueltos.
- El perfil temporal de Chrome va a una carpeta propia que `grabar.mjs` borra al terminar, aunque algo falle.
- Cada capítulo deja tres archivos en `media/`: `capN.mp4`, `capN.json` (la bitácora) y `capN.sesion.json` (cookies y almacenamiento).

## La voz es el reloj

Antes de grabar ya existe la voz (`node hacer.mjs voz`), así que se sabe en qué segundo del capítulo empieza cada frase y cae cada palabra (`tiempos.mjs`). El capítulo se graba **en tiempo real contra ese reloj**: cada acción espera su momento y, si llega tarde, se anota. Por eso, mientras graba, la computadora no debe estar haciendo algo pesado.

`grabar.mjs` hace una pasada y luego `autoajustar.mjs` mira cuándo terminaron las acciones de cada frase:

- si las acciones de la frase 1.1 todavía no terminaban cuando debía empezar la 1.2, la pausa `extra` de 1.1 crece (lo que faltó más 0.35 s de margen);
- si sobró más de 0.9 s, la pausa se acorta (dejando 0.55 s), sin bajar de 0;
- lo mismo con el final del capítulo.

`autoajustar.mjs` escribe esas pausas en `guion.mjs` (cambia solo el número de `extra` de cada frase) y `grabar.mjs` vuelve a grabar los capítulos cuyos tiempos cambiaron, hasta que no cambie nada (máximo 4 vueltas). Cada capítulo guarda una **firma** de sus tiempos: si cambia la voz o una pausa, la firma cambia y `construir` se niega a usar esa grabación vieja.

`grabar --cambiados` da una grabación por **vigente** solo si su firma coincide, su script, `escena.mjs` y `lib.mjs` no cambiaron después, se revisó con las mismas `palabrasProhibidas` y no falló: la que vio una palabra prohibida o no pasó el control del vigilante queda escrita para revisarla, pero siempre se vuelve a grabar.

Para que el ajuste funcione, **cada frase empieza con `E.frase('id')`**. Si una acción dentro de la frase llega tarde, las pausas no lo arreglan: el ajuste solo mueve lo que pasa *entre* frases. Los dos casos que más pasan:

- **La primera acción de la frase.** Un clic que debe caer en la primera o segunda palabra necesita que el cursor salga antes de que la frase empiece (viaja 0.7 s por omisión). Se usa `E.frase('3.4', { antes: 0.9 })`: la espera termina 0.9 s antes y el ajuste mide contra ese momento.
- **La última frase del capítulo.** Una señal que empieza en la última palabra se corta con el final del capítulo. Se sostiene la pantalla con `E.esperar({ frase: '1.3', fin: true, mas: 1.1 })` antes de `E.cerrar()`: esperar más allá del final hace que `grabar` alargue la pausa de esa frase hasta que quepa.

Los retrasos quedan en la bitácora (`tarde`) y en lo que imprime cada capítulo. Un capítulo bien escrito termina con «retrasos: 0».

## Cómo se escribe un capítulo

Un extracto del capítulo 2 del ejemplo (`ejemplo/grabacion/cap2.mjs` de la skill, sobre la app de ejemplo; sus `data-guia` están en `ejemplo/app/MAPA.md`). Se grabó así, sin retrasos:

```js
import { Escena } from './escena.mjs';

const E = await Escena.abrir(2);
await E.ir('?hoy=2026-03-02&reiniciar=1&sesion=1#/inicio');   // datos de ejemplo y ya dentro: no depende del capítulo 1
await E.iniciar();

// 2.1 «Para pedir ayuda, pulsa Nuevo pedido.»
await E.apuntar('@inicio-nuevo', 'Nuevo pedido', { desde: ['2.1', 'pulsa'], tipo: 'halo' });
await E.clic('@inicio-nuevo', { en: ['2.1', 'pedido', 0, 0.35], dur: 0.3 });
await E.esperarElemento('body[data-paso="1"]');

// 2.2 «Ponle un título corto que diga qué pasa.»
await E.frase('2.2', { antes: 0.2 });
await E.senal('@nuevo-titulo', 'Corto y claro', { desde: ['2.2', 'título'] });   // la señal se registra ANTES de escribir
await E.escribir('@nuevo-titulo', 'La impresora no imprime a color', { en: ['2.2', 'título', 0, 0.2], dur: 1.6, tab: false });

// 2.3 «Elige la categoría y la prioridad.»: dos cosas, dos señales seguidas (nunca dos a la vez)
await E.frase('2.3', { antes: 0.3 });
await E.senal('@nuevo-categoria', 'La categoría', { desde: ['2.3', 'categoría'], hasta: ['2.3', 'prioridad', 0, -0.1] });
await E.clic('@nuevo-categoria-impresoras', { en: ['2.3', 'categoría', 0, 0.35] });
await E.senal('@nuevo-prioridad', 'La prioridad', { desde: ['2.3', 'prioridad'] });
await E.clic('@nuevo-prioridad-normal', { en: ['2.3', 'prioridad', 0, 0.45], dur: 0.45 });
await E.clic('@nuevo-siguiente', { en: { frase: '2.3', fin: true, mas: 0.8 }, dur: 0.5 });
await E.esperarElemento('body[data-paso="2"]');

// 2.5 «Si un día no se puede, el calendario te dice por qué.»
await E.frase('2.5', { antes: 0.3 });
await E.clic('@calendario-dia-2026-03-07', { en: ['2.5', 'puede'] });   // el sábado: no se elige y el mensaje explica por qué
E.sonido('pop', { en: ['2.5', 'puede', 0, 0.1] });
await E.senal('@calendario-mensaje', 'Te dice por qué', { desde: ['2.5', 'calendario'], zoom: true });
// ...
await E.cerrar();   // guarda la sesión: el capítulo 3 sigue desde aquí
```

El ejemplo usa `tab: false` porque su app nunca pierde el primer clic después de escribir; en otra herramienta, deja el Tab. Para otra herramienta sirven sus propios atributos estables (`id`, `data-testid`, `name`) o un texto. Si la herramienta es tuya y puedes cambiarla, ponle `data-guia` a lo que el video va a señalar: es lo más firme.

### Selectores

- `'@correo'` es el atajo de `'[data-guia="correo"]'`.
- Cualquier selector CSS: `'#enviar'`, `'.tarjeta:nth-child(2)'`. Se usa el **primer elemento visible** que coincida.
- Selectores de Playwright: `'button:has-text("Enviar")'`, `'text=Guardar'`.
- Un `Locator` de Playwright: `E.page.getByRole('button', { name: 'Enviar' })`.

Si el elemento no aparece visible en 6 segundos, el capítulo se detiene con `FALLA en el capítulo N (segundo X): No encuentro «...» visible en la pantalla` y deja la pantalla en `tmp/fallo-capN.png`.

### Momentos

Todo lo que espera algo recibe un **momento**:

| Momento | Qué es |
|---|---|
| `2.5` | el segundo 2.5 del capítulo |
| `'1.2'` | cuando empieza la frase 1.2 |
| `'1.2:fin'` | cuando termina la frase 1.2 |
| `['1.2', 'Entrar']` | cuando la voz dice «Entrar» en la frase 1.2 |
| `['1.2', 'el', 1, -0.2]` | la segunda vez que dice «el», 0.2 s antes |
| `{ frase: '1.2', palabra: 'Entrar', n: 0, mas: 0.1 }` | lo mismo, con nombres |
| `{ frase: '1.2', fin: true, mas: 0.6 }` | 0.6 s después de que termina la frase 1.2 (la forma de lista no acepta `'1.2:fin'`) |

La palabra es la que **se dice** (el campo `voz` del guion, si existe), sin importar mayúsculas ni acentos. Primero se busca la palabra exacta («ve» no es «verás») y, si no está, la que empieza igual. Si no existe, falla y dice qué palabras tiene la frase.

## La API completa

| Método | Opciones | Qué hace |
|---|---|---|
| `Escena.abrir(n, { sesion })` | `sesion`: número de capítulo o ruta de un archivo de sesión | Abre Chrome para el capítulo `n` del guion. |
| `E.ir(ruta?)` | `espera` (ms, 400) | Abre `app.url` o una ruta relativa a ella y espera a que cargue. |
| `E.iniciar()` | | Espera a que se vayan los avisos flotantes, corre el control positivo del vigilante y empieza a grabar (segundo 0). |
| `E.frase(id, { antes })` | `antes` (s) | Espera el inicio de la frase (o `antes` segundos antes, si la primera acción tiene que arrancar antes). Ancla del ajuste de pausas. |
| `E.esperar(momento)` | | Espera hasta ese momento. Antes de `E.cerrar()`, sostiene la pantalla: si el momento cae después del final, `grabar` alarga la pausa de la última frase. |
| `E.clic(sel, { en, dur, px, py })` | `dur` 0.7 s de viaje; `px`, `py` punto dentro del elemento (0 a 1) | El cursor viaja en curva, hace una micro pausa y da clic. Con `en`, el clic cae en ese momento. Si el elemento se movió mientras el cursor llegaba, corrige. |
| `E.escribir(sel, texto, { en, dur, tab, borrar, clic })` | `dur` (s, por omisión 0.06 por letra, de 0.4 a 4); `tab` true; `borrar` true; `clic` true | Clic en el campo, lo vacía, escribe letra por letra con ritmo irregular y pulsa Tab. |
| `E.pegar(sel, texto, { en, tab })` | | Clic y el texto aparece de golpe. |
| `E.elegir(sel, valor, { en, dur })` | | Elige en un `<select>` por valor o por texto. El menú nativo no sale en el video: se ve el clic y el cambio. |
| `E.tecla(nombre, { en })` | | Pulsa una tecla (`'Enter'`, `'Escape'`). |
| `E.desplazar(destino, { en, dur, margen })` | `dur` 0.9 s; `margen` 120 px | Desplaza con suavidad hasta un elemento (en la página o en la caja con barra que lo contiene), un número, `'arriba'` o `'abajo'`. Dentro de un elemento fijo (un modal) no hace nada. |
| `E.mover(sel, { en, dur })` | | Solo lleva el cursor. |
| `E.senal(sel, etiqueta, opciones)` | ver abajo | Mide el elemento y registra la señal. |
| `E.apuntar(sel, etiqueta, opciones)` | además `dur` del cursor | Mide y registra la señal primero y luego lleva el cursor, que llega junto con la señal (al revés, la medida retrasaba la señal unos 0.3 s). |
| `E.esperarElemento(sel, { espera })` | `espera` 8000 ms | Espera a que algo se vea; si no, falla con captura. |
| `E.caja(sel)` | | La caja `{ x, y, w, h }` del elemento, en píxeles de la ventana grabada. |
| `E.sinAvisos({ espera })` | | Espera a que se vayan los avisos flotantes. |
| `E.sonido(nombre, { en, volumen })` | `volumen` 0.6 | Un sonido de `assets/sfx/<nombre>` (clic, exito, aviso, pop). |
| `E.evento(nombre, datos)` | | Anota algo en la bitácora. |
| `E.rapido(k, fn)` | | Lo de adentro va `k` veces más rápido. |
| `E.pausa(ms)` | | Pausa (respeta `rapido`). |
| `E.cerrar({ guardarSesion })` | | Sostiene la imagen hasta el final del capítulo, arma el MP4 y guarda bitácora y sesión. |
| `E.page`, `E.ctx`, `E.browser` | | Playwright directo, para lo que no cubre la API. |

### Opciones de una señal

| Opción | Por omisión | Qué es |
|---|---|---|
| `desde` | ahora | Momento en que aparece. |
| `hasta` | el final de la frase de `desde` más 0.3 s (o 2.5 s después) | Momento en que se va. Dura al menos 0.8 s. |
| `tipo` | `'recuadro'` | `'recuadro'`: borde y lo demás se oscurece. `'halo'`: anillo que late, sin oscurecer. `'flecha'`: una flecha al lado que apunta. |
| `zoom` | `false` | La cámara se acerca antes de que aparezca (si el elemento es tan grande que el acercamiento sería menor de 1.22, no se acerca). |
| `pad` | 8 | Aire alrededor del elemento, en px. |
| `lado` | `'abajo'` | Dónde va la etiqueta: `'abajo'`, `'arriba'` o `'dentro'`. Si no cabe, cambia sola. |
| `rect` | | Una caja a mano `{ x, y, w, h }`, solo cuando no hay elemento que medir. Esa señal no se sigue midiendo: vale mientras la página no se desplace. |

La etiqueta va de **2 a 4 palabras**. `construir` avisa si pasa de 4 y se detiene si lleva una palabra prohibida.

## Las señales se miden, nunca se ponen a mano

`senal()` deja el elemento a la vista (desplaza si hace falta), espera a que no lo tape un aviso flotante y **mide su caja en el DOM en ese momento**. Mientras la señal va a estar a la vista, el grabador **sigue midiendo** esa caja cada 70 ms (la «traza»). `construir` usa la traza así:

1. La señal empieza cuando el elemento está a la vista y quieto (dos medidas seguidas iguales) y se dibuja **donde de verdad estaba** en ese momento.
2. Termina en cuanto el elemento se mueve más de **8 px** o desaparece (por ejemplo, al pulsar un botón que cambia de pantalla).
3. Si no pudo sostenerse 0.45 s, `construir` se detiene: esa señal habría quedado en el aire.

De ahí salen dos reglas:

- **Primero se acomoda la pantalla y después se marca.** Si marcas y luego desplazas, la señal se corta o se pierde.
- **Registra la señal antes de actuar.** `senal()` regresa enseguida y la señal sale en `desde`. Si escribes primero y marcas después, la palabra ya pasó y la señal llega tarde (queda anotado en `tarde`).

## Avisos flotantes

Los avisos que la app muestra un rato y se van (toasts) se quedan pegados en el video si se graba encima. El grabador espera a que se vayan **antes de empezar** (falla si siguen después de 8 s) y **antes de marcar** algo que tapen (4 s). Si lo que se quiere señalar es el aviso mismo, no se espera.

El selector por omisión es `.toast, .snackbar, [class*="toast" i], [class*="snackbar" i], [data-aviso], [role="alert"]`. Si la app usa otro, se cambia antes de `iniciar()`: `E.avisos = '.mi-aviso'`; con `null` no se espera ninguno.

## El vigilante de palabras prohibidas

El cuerpo es el mismo para todas las audiencias, así que no puede nombrar a ninguna. Cada 0.35 s el vigilante revisa el texto **visible en pantalla**:

- el texto de la página que se ve (no lo oculto, no lo transparente, no lo que queda fuera de la ventana);
- la opción **elegida** de cada `<select>` (las demás no se ven);
- lo escrito en campos de texto y su texto de ejemplo si están vacíos (las contraseñas no: se ven como puntos).

Compara sin mayúsculas ni acentos. Cada palabra de `palabrasProhibidas` atrapa la palabra completa y su plural: «gerente» atrapa «Gerente» y «gerentes», pero no «gerencia». Con asterisco al final atrapa todo lo que empiece igual: «geren*» atrapa «gerente», «gerentes» y «gerencia». Varias palabras juntas también sirven («equipo de ventas»).

**Control positivo.** Un vigilante que nunca encuentra nada se ve igual que uno roto. Antes de grabar, `iniciar()` lo prueba en páginas aparte: cada palabra sembrada como texto, como opción elegida y como campo escrito (debe encontrarla en los tres) y otra página con señuelos que no se ven (oculta, fuera de pantalla, transparente, opción sin elegir, contraseña), donde no debe encontrar nada. Si el control falla, no se graba.

Si una palabra prohibida sale en pantalla, el capítulo termina, guarda la bitácora y **falla** diciendo la palabra y los segundos. Se arregla cambiando los datos de ejemplo (el usuario de prueba, un menú) o el recorrido. El vigilante no ve dentro de `<iframe>`, en *shadow DOM* ni texto dibujado en imágenes: eso hay que revisarlo en la hoja de cuadros.

## Sesiones y datos de ejemplo

Cada grabación debe arrancar igual. Si la herramienta deja fijar la fecha o volver a los datos de ejemplo, va en `app.url` (la app de ejemplo usa `?hoy=2026-03-02&reiniciar=1`). Un capítulo puede seguir donde quedó otro con `Escena.abrir(3, { sesion: 2 })`: carga las cookies y el almacenamiento que guardó el capítulo 2. Los capítulos se graban en el orden del guion. Lo que viva en un servidor (una base de datos) depende de la herramienta: si hace falta, el capítulo puede llamar a su propio mecanismo para dejar los datos listos antes de `iniciar()`.

## La bitácora (`media/capN.json`)

| Campo | Qué guarda |
|---|---|
| `firma`, `total` | firma de los tiempos con que se grabó y duración que pedía la voz |
| `vp`, `dpr`, `fps`, `url` | tamaño de la ventana, densidad, cuadros por segundo y la dirección al empezar |
| `cursor` | `{ t, x, y }` cada 22 ms mientras el cursor se mueve |
| `clics` | `{ t, x, y }` de cada clic (de ahí sale la onda en el video) |
| `marcas` | cada señal: `t0`, `t1`, `rect` (caja medida), `label`, `tipo`, `zoom`, `pad`, `lado`, `sel`, `scrollY` y `traza` (`[t, x, y, w, h]` cada 70 ms; `null` si el elemento no estaba) |
| `scroll` | `{ t, y }`: cuánto estaba desplazada la página |
| `sonidos`, `eventos` | lo que pidió el capítulo con `E.sonido` y `E.evento` |
| `llegadas`, `tarde` | cada espera (objetivo y llegada) y las que llegaron tarde |
| `vigilante`, `prohibidas` | revisiones, errores, el resultado del control positivo, con qué palabras revisó y lo que vio, con su segundo |
| `video` | cuadros, duración, cuadros por segundo reales, tamaño del MP4 y del cuadro que mandó Chrome (`cuadroOriginal`) |

Los segundos son del capítulo (0 = el primer cuadro de su video). Las coordenadas son píxeles CSS de la ventana grabada.

## El cursor y el tecleo

El cursor sigue una curva (Bézier con una desviación al azar), acelera suave y frena largo, y se acomoda un par de píxeles al llegar. Antes del clic hay una micro pausa de 80 a 170 ms y el botón se mantiene presionado de 55 a 100 ms. El tecleo reparte el tiempo entre las letras con pesos irregulares (más largo en espacios y signos). Todo el azar sale de una semilla fija por capítulo: la misma corrida da el mismo movimiento.

## Problemas comunes

| Qué pasa | Por qué | Qué hacer |
|---|---|---|
| `No encuentro «...» visible` | el selector no existe, o está oculto, o la pantalla aún no carga | Mira `tmp/fallo-capN.png`; espera la pantalla con `esperarElemento` antes de usarla. |
| Señal «ajustada a lo que se vio» | el elemento se movió o desapareció mientras se veía | Si fue a propósito (un clic que cambia de pantalla), está bien. Si no, desplaza antes de marcar. |
| Retrasos grandes en una frase | la preparación tarda más que la voz | `E.frase('x', { antes: 1 })`, o prepara al final de la frase anterior, o `E.rapido`. |
| Un clic de la primera palabra llega tarde aunque las pausas ya no cambian | el cursor tarda 0.7 s en llegar y salió cuando la frase ya había empezado | `E.frase('x', { antes: 0.9 })`, o un viaje más corto (`dur: 0.4`) si el elemento está cerca. |
| La señal de la última frase dura muy poco | el capítulo termina justo después | Sostén la pantalla con `E.esperar({ frase: 'x', fin: true, mas: 1 })` antes de `E.cerrar()`. |
| Un menú o lo que se escribe queda bajo el velo oscuro | el recuadro oscurece todo lo que no es su elemento | Usa `tipo: 'halo'`, o termina el recuadro (`hasta`) antes de esa acción. |
| La etiqueta tapa donde sigue la acción | va abajo por omisión | `lado: 'arriba'` (o `'dentro'`). |
| `Chrome manda cuadros de 1366 x 768...` | Chrome se abrió sin `--force-device-scale-factor` | Usa el `grabacion/lib.mjs` de la plantilla, sin cambios. |
| Las pausas siguen cambiando después de 4 vueltas | la máquina está ocupada o una acción tarda distinto cada vez | Cierra programas pesados y vuelve a grabar. |
| Un aviso flotante sigue en pantalla | la app lo deja fijo o el selector atrapa otra cosa | Ciérralo en el script o cambia `E.avisos`. |
| El primer clic después de escribir no hace nada | la app repinta al soltar el foco | Ya se pulsa Tab al terminar de escribir; no pongas `tab: false`. |
