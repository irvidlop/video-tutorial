# Grabación: un archivo por capítulo

Cada capítulo de `guion.mjs` se graba con su script, `grabacion/capN.mjs` (N es el `id` del capítulo). El script abre Chrome, recorre la app y marca qué se señala, contra el reloj de la voz. `escena.mjs` y `lib.mjs` son el grabador: no saben nada de ninguna app y no se editan para un video.

```
node hacer.mjs grabar               graba todos y ajusta las pausas del guion a lo que tarda la pantalla
node hacer.mjs grabar --cambiados   solo lo que cambió (guion, voz, pausas o el script del capítulo)
node hacer.mjs grabar 2             solo el capítulo 2
```

Cada capítulo deja `media/capN.mp4` (la app grabada), `media/capN.json` (la bitácora: cursor, clics, señales y su traza, retrasos, lo que vio el vigilante) y `media/capN.sesion.json` (cookies y almacenamiento, para que otro capítulo siga donde quedó este).

## Un capítulo de ejemplo

Para el capítulo de `guion.mjs` de la plantilla, sobre la app de ejemplo de la skill (sus `data-guia` están en `ejemplo/app/MAPA.md`):

```js
// grabacion/cap1.mjs: «Entrar»
import { Escena } from './escena.mjs';

const E = await Escena.abrir(1);
await E.ir();                    // proyecto.json → app.url: el inicio de sesión, con los datos de ejemplo
await E.iniciar();               // aquí empieza el video del capítulo (segundo 0)

// 1.1 «Entras con tu correo y tu contraseña.»
await E.senal('@entrar-correo', 'Tu correo', { desde: ['1.1', 'correo'], hasta: ['1.1', 'contraseña'], zoom: true });
await E.escribir('@entrar-correo', 'ana@ejemplo.com', { en: ['1.1', 'correo'] });
await E.escribir('@entrar-contrasena', 'ejemplo123', { dur: 0.7 });

// 1.2 «Pulsa Entrar, y listo: ya estás dentro.»
await E.frase('1.2', { antes: 0.6 });   // «Entrar» es la segunda palabra: el cursor sale antes de que empiece la frase
await E.apuntar('@entrar-boton', 'Entrar', { desde: ['1.2', 'Entrar'], tipo: 'halo' });
await E.clic('@entrar-boton');
await E.esperarElemento('body[data-pantalla="inicio"]');
E.sonido('exito');
await E.esperar({ frase: '1.2', fin: true, mas: 1 });   // sostiene el inicio un segundo antes de terminar el capítulo
await E.cerrar();
```

Los tres capítulos del ejemplo de la skill (`ejemplo/grabacion/cap1.mjs` a `cap3.mjs`) graban un tutorial completo sin retrasos: son el mejor modelo.

## La API en corto

`@id` es el atajo de `[data-guia="id"]`. Cualquier otro texto es un selector CSS (o de Playwright, como `button:has-text("Enviar")`). También se puede pasar un `Locator` de Playwright (`E.page.getByText('...')`).

| Qué | Para qué |
|---|---|
| `Escena.abrir(n, { sesion })` | Abre Chrome para el capítulo `n`. `sesion: 1` arranca con las cookies y el almacenamiento que dejó el capítulo 1. |
| `E.ir(ruta?)` | Abre la app (`app.url`) o una ruta relativa a ella. Una ruta con `#` conserva los parámetros de `app.url`. |
| `E.iniciar()` | Espera a que se vayan los avisos flotantes, prueba el vigilante y empieza a grabar. |
| `E.frase('1.2', { antes })` | Espera a que empiece la frase. Ponlo al inicio de cada frase: con eso se ajustan las pausas. `antes: 1` da un segundo para preparar la pantalla o para que el cursor salga hacia un clic de la primera palabra. |
| `E.esperar(momento)` | Espera hasta un momento del capítulo (ver abajo). Antes de `E.cerrar()`, sostiene la pantalla para que la última señal se vea. |
| `E.clic(sel, { en })` | Lleva el cursor y da clic; con `en`, el clic cae en ese momento. |
| `E.escribir(sel, texto, { en, dur })` | Clic en el campo, lo vacía, escribe letra por letra con ritmo humano y pulsa Tab al final (`tab: false` para no). |
| `E.pegar(sel, texto)` | El texto aparece de golpe: para textos largos o repetitivos. |
| `E.elegir(sel, valor)` | Elige una opción de un `<select>` por su valor o su texto. |
| `E.tecla('Enter')` | Pulsa una tecla. |
| `E.desplazar(destino, { margen })` | Desplaza con suavidad: un selector (lo deja a `margen` px de arriba, en la página o en una caja con barra propia), un número, `'arriba'` o `'abajo'`. |
| `E.mover(sel)` | Solo lleva el cursor (pasa por encima). |
| `E.senal(sel, etiqueta, opciones)` | Señal medida en el DOM, de `desde` a `hasta`. `tipo`: `'recuadro'` (por omisión), `'halo'` o `'flecha'`. `zoom: true` acerca la cámara antes. |
| `E.apuntar(sel, etiqueta, opciones)` | Igual, y además el cursor llega junto con la señal (la señal se mide primero). |
| `E.esperarElemento(sel)` | Espera a que algo aparezca (una pantalla nueva, un folio). Si no sale, falla con una captura. |
| `E.sonido('exito')` | Un sonido de `assets/sfx/` en este momento. Solo en momentos clave. |
| `E.rapido(2, async () => { ... })` | Lo de adentro va al doble de velocidad (llenar campos repetitivos). |
| `E.cerrar()` | Sostiene la imagen hasta que termina el tiempo del capítulo, arma el MP4 y guarda la bitácora y la sesión. |
| `E.page` | La página de Playwright, para lo que no cubre la API (subir un archivo con `setInputFiles`, por ejemplo). |

Un **momento** es `2.5` (segundo del capítulo), `'1.2'` (cuando empieza la frase), `'1.2:fin'` (cuando termina), `['1.2', 'Entrar']` (cuando la voz dice «Entrar» en la frase 1.2), `['1.2', 'el', 1, -0.2]` (la segunda vez que dice «el», 0.2 s antes) o `{ frase: '1.2', fin: true, mas: 0.6 }` (0.6 s después de que termina). La palabra es la que se **dice** (`voz` en el guion), no la del subtítulo.

## Reglas que ya costaron un video

- **Primero se acomoda la pantalla y después se marca.** Una señal se mide en el momento en que la llamas; si después desplazas la pantalla, su elemento se mueve. El grabador sigue midiendo cada elemento mientras su señal está a la vista y el constructor la dibuja donde de verdad estaba, la recorta si se movió más de 8 px o se detiene si no pudo sostenerla.
- **Registra la señal antes de actuar.** `senal()` mide y regresa enseguida; la señal sale en `desde`. Si escribes primero y marcas después, la palabra ya pasó y la señal llega tarde.
- **Una señal por idea**, con etiqueta de 2 a 4 palabras. Si la voz nombra dos cosas, dos señales seguidas.
- **Halo si algo pasa junto al elemento.** El recuadro oscurece todo lo demás: si se abre un menú o se escribe cerca, usa `tipo: 'halo'`. Si la etiqueta tapa donde sigue la acción, `lado: 'arriba'`.
- **«retrasos: 0» es la meta.** El ajuste de pausas solo arregla lo que pasa entre frases; un retraso dentro de una frase se arregla en el script (`antes`, un viaje más corto con `dur`, o la acción un poco después).
- **Los avisos flotantes** de la app (toasts) se esperan antes de grabar y antes de marcar algo que tapen. Si la app usa otro selector para ellos, cámbialo antes de `iniciar()`: `E.avisos = '.mi-aviso'` (o `null` para no esperar).
- **Después de escribir se pulsa Tab**: en algunas apps el primer clic después de escribir se pierde porque la pantalla se repinta al soltar el foco.
- **Nada de palabras prohibidas en pantalla.** El vigilante revisa el texto visible cada 0.35 s; si sale una de `palabrasProhibidas`, el capítulo se detiene y dice en qué segundo. Antes de grabar se prueba con un control positivo (debe encontrar una palabra sembrada y no confundirse con lo oculto).
- **Contraseñas**: las de prueba de la copia; en pantalla se ven como puntos.
- Mientras graba, no pongas a la computadora a hacer algo pesado: las acciones van en tiempo real contra la voz y el retraso se anota como falla.

Si algo no aparece, el capítulo se detiene con `FALLA en el capítulo N (segundo X)` y deja la pantalla en `tmp/fallo-capN.png`. Detalle completo, la bitácora y cómo se ajustan las pausas: `referencias/grabacion.md` de la skill.
