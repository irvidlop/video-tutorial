# Composición

Cómo se arma el video del cuerpo con HyperFrames y cómo se renderiza. Archivos: `construir.mjs`, `capas.mjs`, `src/estilos.css`, `src/animar.js`, `carve.mjs`, `mezcla-musica.mjs`, `preparar-musica.mjs` y el paso `render` de `hacer.mjs`. Las entradas y el empalme están en `referencias/versiones.md`; los colores, letras y el cierre, en `referencias/estilo.md`.

## Qué hace `node hacer.mjs construir`

1. Si hay música: `mezcla-musica.mjs` arma la pista larga y `preparar-musica.mjs` la parte en dos (ver «Música»).
2. `construir.mjs` lee las grabaciones (`media/capN.mp4` y su bitácora), la voz (`voz/voz.json`), el guion, `proyecto.json` y el tema, y escribe:
   - `index.html`: la composición del cuerpo;
   - `compositions/cierre.html`: el cierre, con `cierre.mjs`;
   - `GUION.md`: el guion escena por escena con la locución exacta y el minuto de cada frase en el video final;
   - `tmp/plan-resumen.json`: todo lo que se planeó (tiempos, señales, subtítulos, voz, cámara), para medir después.
3. Si hay música: `carve.mjs index.html` aparta la música de la voz.

`index.html`, `compositions/cierre.html` y `GUION.md` se generan: no se editan a mano.

`construir` **se detiene** si algo no cuadra (ver «Fallas»). Con `node construir.mjs --seguir` escribe todo de todos modos, para revisar la vista previa, pero `render` no acepta un plan con fallas.

## El lienzo

Todo se diseña a **1920 x 1080**. Si `proyecto.json` → `video` pide otro tamaño 16:9 (1280 x 720, 3840 x 2160), la escena entera se escala con un solo factor y nada se mueve de lugar. Otra proporción (vertical, cuadrada) no está soportada y `construir` lo dice. Los cuadros por segundo salen de `video.fps`.

De arriba abajo, la pantalla tiene: el rótulo del capítulo arriba a la izquierda (hasta y = 82), la **zona libre** para la app y las señales, y desde **y = 905** la zona de los subtítulos.

## Capas, parallax y cámara

Hay cuatro capas, cada una con su factor de parallax (cuánto se mueve cuando la cámara se mueve):

| Capa | Factor | Qué lleva |
|---|---|---|
| `Lbg` | 0.2 | dos manchas de color difusas |
| `Lmid` | 0.5 | rayas redondeadas a los lados |
| `Lworld` | 1.0 | la ventana del navegador con la app grabada, el cursor y las señales |
| `Lflo` | 1.35 | fichas flotantes sin texto y dos puntos |

La cámara es un foco (F) y un acercamiento (z). Cada capa se transforma con `camX()` de `capas.mjs`: la del mundo escala con z y las demás menos, según su factor. Cuando la cámara se acerca más de 1.2, las fichas del frente desaparecen en 0.25 s, antes de que su capa alcance a moverse, y vuelven solo cuando la cámara ya se abrió: su capa es la que más se desplaza y, si seguían a la vista, una cruzaba por el rótulo del capítulo.

**La cámara nunca se congela.** Cada capa tiene un envoltorio interior (`.dr`) con una deriva lenta y finita propia (periodos de 7.9 a 13.7 s y amplitudes de 4 a 20 px); la cámara mueve la capa de afuera, así que la deriva y la cámara no se pisan.

**Cuándo se acerca.** Solo para señales con `zoom: true`. El acercamiento es el que deja el elemento en un 56% del ancho o un 52% del alto libre, con tope de 1.85; si saldría menor de 1.22 no se acerca (no vale la pena). El foco se acomoda para que a los lados y arriba nunca se vea el fondo vacío. La cámara llega **antes** de que aparezca la señal (tarda 1.1 s en acercarse y 1.0 s en abrirse) y se vuelve a abrir cuando la siguiente señal no pide acercamiento, tarda más de 1.9 s o es de otro capítulo. Si dos movimientos de cámara se enciman, `construir` avisa: el segundo pisaría al primero.

## La ventana de la app

La grabación (1366 x 768) va dentro de una ventana de navegador de 1434 px de ancho (escala 1.05), con su barra de puntitos y una barra de dirección. La dirección que se lee es `proyecto.json` → `app.direccion` si existe; si no, el dominio de `app.url`, salvo que sea local (`127.0.0.1`, `localhost`), que deja la barra vacía. Al empezar el cuerpo la ventana entra subiendo (la entrada terminó sin ella) y se va cuando llega la tarjeta de contacto o el cierre.

Cada capítulo es un `<video>` propio, sin sonido, que entra con un fundido de 0.45 s encimado con el anterior.

## Señales

Cada señal sale de la bitácora: la caja que se midió y su traza mientras estuvo a la vista (ver `referencias/grabacion.md`). `construir`:

1. la dibuja donde el elemento estaba cuando empezó a verse y la corta en cuanto se movió más de 8 px o se fue;
2. deja **una señal a la vez** (la anterior se quita antes de que entre la siguiente o de que la cámara se mueva) y ninguna pasa al fundido del capítulo siguiente;
3. la alarga a 0.7 s si quedó más corta, y avisa.

| Tipo | Cómo se ve |
|---|---|
| `recuadro` | borde del color de señal, un brillo suave alrededor y el resto de la app un poco oscurecido |
| `halo` | anillo con brillo, sin oscurecer, que late cada 1.1 s |
| `flecha` | flecha al lado del elemento (donde haya lugar) que entra deslizándose y se mece |

Todas entran con fundido y escala de 0.96 a 1 en 0.42 s y salen en 0.32 s. Van **dentro de la ventana**, así que se mueven y se acercan con ella. La **etiqueta** va encima de todo y no se acerca: abajo del elemento, o arriba si abajo no cabe, o dentro si tampoco; entra 0.14 s después de la señal. Letra de 32 px con el color principal.

## Cursor y clics

El cursor sigue la trayectoria real que se grabó, con un punto cada 45 ms o cada 40 px. Aparece al segundo 1.0 del cuerpo (cuando la ventana ya entró) y a los 0.25 s de cada capítulo, y se va 0.3 s antes del fundido. En cada clic se encoge un instante y sale una onda del color de señal.

## Subtítulos

Cada frase se parte en trozos de **a lo más 2 renglones**:

- primero por oraciones; un trozo de más de 84 letras se parte por la coma, los dos puntos o el punto y coma más cercanos a la mitad (o por un espacio);
- un trozo de más de 44 letras se escribe en dos renglones parejos, partidos a mano, para que no quede una palabra sola abajo;
- un trozo muy corto («¡Hola!», «Listo.») se junta con el siguiente si cabe.

Cada trozo dura lo que la voz tarda en decir sus letras, entre la primera y la última palabra de la frase, y entra 0.05 s antes. Van abajo al centro, letra de 44 px sobre una caja oscura al 90%. `medir.mjs` comprueba con la letra real que ninguno pase de 2 renglones.

## Rótulos de capítulo

Arriba a la izquierda: el número y el `rotulo` del guion, en una pastilla clara. Entra a los 0.6 s del cuerpo en el primer capítulo y a los 0.35 s en los demás, y se va 0.35 s antes del fundido.

## Tarjeta de contacto

Si `proyecto.json` → `contacto` tiene `frase`, al terminar el último capítulo la ventana se va y entra una tarjeta con un ícono, el `nombre` y el `detalle` (el correo o teléfono, en el color principal si se lee bien sobre la tarjeta; si no, en el color de la letra). La voz dice `contacto.frase` (o `contacto.voz`) 0.55 s después y su subtítulo sale abajo. La tarjeta queda completa a la vista **al menos 4.4 s** y hasta que entra el cierre; si la frase es larga, espera a que termine. La letra se achica si el nombre o el dato son largos (de 72 y 60 px hasta 44 y 40). Suena `assets/sfx/aviso` al entrar, si existe.

## Cierre

`construir` llama a `armarCierre()` de `cierre.mjs`, que escribe `compositions/cierre.html` (6 s: logo y nombre de `marca`). Se monta como sub-composición, último hijo del `#root`, encima de todo:

```html
<div id="el-cierre" style="z-index:999" data-composition-id="cierre" data-composition-src="compositions/cierre.html"
     data-start="12.77" data-duration="6" data-track-index="50" data-width="1920" data-height="1080"></div>
```

Entra 0.1 s antes de que termine el último capítulo, o al terminar la tarjeta de contacto. La voz debe terminar al menos 0.3 s antes: `construir` lo comprueba.

## Música

`proyecto.json` → `musica`: `null` (sin música), una ruta (`"musica/tema.mp3"`) o varias (`["musica/a.mp3", "musica/b.mp3"]`), relativas a la carpeta del proyecto. Solo música que la persona tenga permiso de usar.

1. `mezcla-musica.mjs` une las pistas con fundidos de 6 s, las repite si no alcanzan para la entrada más el cuerpo (con 30 s de margen) y nivela todo a **-16 LUFS**, igual que la voz: así el volumen de la música en el video no depende del archivo. Deja `assets/audio/musica.wav`.
2. `preparar-musica.mjs` la parte en dos pedazos exactos a 48 kHz, en la muestra donde termina la entrada (ver `referencias/versiones.md`).
3. En el cuerpo la música entra ya sonando (viene de la entrada) a 0.15 de volumen (unos 16.5 dB bajo la voz), se queda así hasta 1 s después de que entra el cierre y baja a 0 al final.
4. `carve.mjs` la **aparta de la voz**: analiza la locución, encuentra las 6 bandas donde habla y escribe en la pista recortes que siguen a la voz, más una bajada general mientras alguien habla (hasta unos 19 dB). Es el mismo análisis que usa HyperFrames (`@hyperframes/core`, `audio-carve` y `audio-fx`), escrito en los atributos `data-fx-carve`, `data-fx-chain` y `data-automation` del `<audio id="musica">`. Lo que no es del carve (el volumen dibujado) se conserva.

Medido en una prueba: la música quedó 16.3 dB bajo la voz.

## Sonidos

Solo en momentos clave: los que pide un capítulo con `E.sonido('exito')` y el de la tarjeta de contacto. Van en `assets/sfx/` (ogg, wav o mp3) con su licencia en `assets/sfx/LICENCIA.txt`; trae `clic`, `exito`, `aviso` y `pop`, de licencia CC0. Si un capítulo pide uno que no existe, `construir` se detiene y dice cuáles hay.

## Colores y letras

Todos los colores salen de `tema.mjs`: `construir` arma las variables CSS (`--primario`, `--fondo-2`, `--senal`, `--subtitulo-fondo`...) más algunas derivadas de ellas (sombras, el velo de las señales, las manchas del fondo), y `src/estilos.css` solo usa variables, nunca un color suelto. Ojo: el tema escribe `fondo2` como `--fondo-2`. Si la hoja de estilos usa una variable que nadie define, los constructores se detienen: una variable sin definir no da error, sale transparente, y así pasó una vez con el rótulo del capítulo (su fondo desapareció y la letra quedó encima de la barra oscura de la app).

Las letras se toman de `assets/fonts/`: una regla `@font-face` por archivo, con el nombre de la familia sacado del nombre del archivo (`WorkSans-var-latin.woff2` es «Work Sans»). Raleway va en el título de las entradas, el rótulo del capítulo y el nombre del contacto; Work Sans en subtítulos, etiquetas, el dato del contacto y la línea de «para quién».

## Reglas de HyperFrames que se respetan

- Una sola línea de tiempo de GSAP en pausa, registrada en `window.__timelines["main"]` (`src/animar.js` la arma con el plan de `construir`). GSAP se copia de `node_modules` a `assets/gsap.min.js`.
- **Las líneas de tiempo de GSAP son «thenables»** (tienen `.then`): si una evaluación de Playwright devuelve la línea de tiempo (por ejemplo, `tl.time(t)`, que se devuelve a sí misma), Playwright espera a que termine y, como está en pausa, se cuelga para siempre. En `medir` se mueve la línea de tiempo en una función que no devuelve nada.
- Los videos llevan `class="clip"`, `muted` y su propio `data-start`; el envoltorio que se anima no lleva tiempos. Cada grabación trae un cuadro clave por segundo: con cuadros clave cada 6 u 8 s, HyperFrames avisa que la imagen se puede congelar al buscar cuadros. Cada `<audio>` tiene `id`. Las frases de voz llevan `data-audio-group="voz"` y la música `data-audio-group="musica"`: el carve aparta la música de todo lo que diga `voz`.
- `data-layout-allow-overflow` en las capas anchas y `data-layout-ignore` en adornos, etiquetas y subtítulos evitan avisos falsos de la revisión de layout.
- Más de unos 30 elementos con `filter`, `clip-path` o `radial-gradient` dan capturas negras: `construir` avisa desde 25. La sombra del cursor es una segunda flecha desplazada, sin `filter`.
- `#root` y la página miden el 100%: así la composición también se ve si se abre directo en Chrome (HyperFrames le pone su tamaño al renderizar).

## Render: `node hacer.mjs render`

La CLI de HyperFrames truena con rutas con acentos, así que el render nunca corre en la carpeta del proyecto:

1. **Revisa el disco**: hacen falta unos 0.8 GB más 1.15 GB por minuto de video (mínimo 1.5 GB) en la unidad de la copia temporal, y espacio para el MP4 en la del proyecto. Si no alcanza, se detiene y dice cuánto hay y cuánto falta (`--forzar` lo salta, bajo tu riesgo).
2. **Copia solo lo necesario** (`index.html`, `hyperframes.json`, `compositions/`, `assets/` sin la música entera, `media/` y `voz/`) a una carpeta temporal con ruta ASCII: `VIDEO_TUTORIAL_TMP` si existe; en Windows `C:\vt-tmp`; si no, la carpeta temporal del sistema si su ruta real no tiene acentos.
3. Renderiza con la CLI del proyecto, con **3 trabajadores** (más pueden agotar la memoria de Node en un cuerpo largo; `VIDEO_TUTORIAL_WORKERS` lo cambia), `--strict` (un error de lint detiene el render), cuadros de la grabación extraídos en JPG (`--png` para PNG, que pesa mucho más) y la caché de cuadros y los temporales de Chrome **dentro** de la copia.
4. Trae el MP4 a `tmp/partes/cuerpo.mp4` y anota en `tmp/partes/cuerpo.json` cuánto bajó el render el audio para no pasar de -1 dBTP (lo usan las entradas).
5. **Borra la copia**, con todo lo que dejó el render (reintenta unos segundos si Chrome aún no suelta sus archivos), y la carpeta `C:\vt-tmp` si quedó vacía.

En el ejemplo, 75.5 s de cuerpo tardaron 4 min 30 s en renderizarse (32 MB) y el disco quedó igual que antes.

## Fallas que detienen `construir`

- un capítulo se grabó con otra voz u otras pausas (su firma no coincide), o dura más de 0.4 s distinto de lo que pide la voz, o sus cuadros clave están a más de 2 s (HyperFrames podría congelar la imagen);
- la grabación vio una palabra prohibida, o se grabó sin el control positivo del vigilante;
- una señal no se pudo sostener sobre su elemento, o se sale de la zona libre, o su etiqueta se sale o lleva una palabra prohibida;
- un sonido que no existe;
- la tarjeta de contacto se vería menos de 4 s, dos frases de voz se enciman o la voz no termina antes del cierre;
- falta la voz, una grabación, GSAP o el cierre;
- la hoja de estilos usa una variable que el tema no define.

Los avisos (una etiqueta de más de 4 palabras, una señal alargada a 0.7 s, una señal ajustada a lo que se vio, movimientos de cámara encimados) se imprimen pero no detienen.
