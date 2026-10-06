# Diseño de la skill `video-tutorial`

Para quien quiera mejorar la skill, persona o agente. Explica cómo está hecha, qué promete cada pieza a las demás (los contratos) y por qué es así. El código manda: si este documento y el código no dicen lo mismo, gana el código y se corrige aquí.

## Qué hace

Convierte una herramienta web (un sistema interno, una plataforma, una app) en un **video tutorial narrado** que enseña a usarla paso a paso:

- La imagen es **la herramienta real**, grabada con Chrome (Playwright) sobre una copia local o de pruebas con **datos de ejemplo**. Nunca producción, nunca datos reales.
- Una **voz neuronal** en español (edge-tts) narra. **La voz es el reloj:** cada frase se genera aparte, se sabe cuánto dura y en qué momento cae cada palabra, y la grabación y las señales se acomodan a eso.
- El montaje es una composición de **HyperFrames**: la grabación va dentro de una ventana de navegador, con capas en **parallax**, una cámara que nunca se congela, **señales** (halo, recuadro, flecha, acercamiento) que caen cuando la voz nombra la cosa, un **cursor humano**, subtítulos y rótulos de capítulo.
- **Un cuerpo y varias entradas:** el tutorial (cuerpo) se renderiza una vez y no nombra áreas ni puestos. Cada audiencia tiene su **entrada** corta, todas de la misma duración, que se une al cuerpo sin que se note. Salen tantos MP4 como audiencias.
- Cierra con una **tarjeta de contacto** opcional y un **cierre con el logo** de quien hace el video.
- Todo se **verifica midiendo**: señales sobre su elemento, subtítulos que caben, empalme sin clic, ninguna palabra prohibida en pantalla, volumen, duración.

## Reglas para todas las piezas

1. **Hoja en blanco.** Nada de nombres de empresas, marcas, productos, personas reales, dominios reales ni rutas de la computadora de quien la hizo. Los ejemplos usan la app de ejemplo y personas inventadas («Ana Ejemplo», «Luis Muestra»). Colores: los temas `azul` (por omisión), `verde`, `violeta` y `morado`.
2. **Español** en todo lo que lee una persona: documentación, mensajes de los scripts, comentarios. Frases cortas, sin jerga; si hace falta una palabra técnica, se explica.
3. **Sin guion largo (la raya)** en ningún texto. Se usan dos puntos o punto. La revisión del guion lo detiene.
4. **Funciona con acentos o espacios en la ruta.** La CLI de HyperFrames truena con acentos: `render` y `verificar` copian solo lo necesario a una carpeta temporal con ruta ASCII, trabajan ahí y la borran. Nada copia carpetas con `fs.cpSync` (en Windows truena en silencio con acentos), y los comandos que llevan una ruta con espacios van entre comillas.
5. **Revisa el disco antes de renderizar** y se detiene con un mensaje claro si no alcanza. Al terminar borra lo que dejó el render.
6. **Nunca `wsl --shutdown`** ni nada que apague procesos que no abrió la skill. La app que prende la skill se apaga comprobando que el proceso siga siendo el mismo comando.
7. **Determinista:** la misma entrada da el mismo video. Lo que parece azar (cursor, tecleo, respiraciones entre frases, deriva) sale de semillas fijas.
8. **Falla ruidoso.** Si una señal no encuentra su elemento, si una palabra prohibida aparece, si el empalme brinca: el paso se detiene y dice qué y dónde.
9. **Deja el chequeo, no solo el arreglo.** Cada defecto que apareció tiene una revisión que lo atrapa si vuelve, y cada revisión que podría estar ciega tiene su control positivo (se le da algo que sí debe encontrar).
10. Sin dependencias pesadas nuevas: Node 22+, Python 3 con `edge-tts`, FFmpeg, Chrome. La CLI de HyperFrames, `@hyperframes/core`, `playwright-core` y GSAP se instalan en cada proyecto.

## Forma del repositorio

```
video-tutorial/
  .claude-plugin/marketplace.json            marketplace «videos-tutoriales»
  ejemplo/                                   el video de muestra que enseña el README (720p) y su portada
  plugins/video-tutorial/
    .claude-plugin/plugin.json               plugin «video-tutorial»
    skills/video-tutorial/
      SKILL.md                               lo que sigue Claude, paso a paso
      referencias/                           guion, grabacion, voz, composicion, estilo, versiones, verificacion, problemas, instalacion
      plantilla/                             el esqueleto de un proyecto de video (lo copia scripts/nuevo.mjs)
      ejemplo/                               app de ejemplo (app/), su proyecto (proyecto.json, guion.mjs) y sus capítulos (grabacion/)
      scripts/                               nuevo.mjs (crear un proyecto), revisar-entorno.mjs (qué falta instalar)
  README.md  DISEÑO.md  INSTALAR.bat  LICENSE  .gitignore  .gitattributes
```

## El recorrido de un video

```
proyecto.json + guion.mjs
   │
   ├─ voz        voz/voz.py: una frase a la vez con edge-tts → voz/<id>.wav (48 kHz, -16 LUFS, sin silencio en las orillas)
   │             y voz/voz.json (duración real y tiempo de cada palabra). tiempos.mjs calcula cuándo habla cada frase.
   ├─ app        arranca la copia de prueba (app.arrancar) y espera a que responda
   ├─ grabar     grabacion/capN.mjs contra el reloj de la voz → media/capN.mp4 + capN.json (bitácora) + capN.sesion.json;
   │             autoajustar.mjs corrige las pausas (extra) del guion y se vuelve a grabar lo que cambió, hasta que no cambie nada
   ├─ construir  index.html (cuerpo), compositions/cierre.html, GUION.md, tmp/plan-resumen.json; con música: la parte y le hace «carve»
   ├─ render     el cuerpo, una vez, en una copia ASCII → tmp/partes/cuerpo.mp4
   ├─ entradas   tmp/entradas/<versión>/index.html, todas de la misma duración → tmp/partes/entrada-<versión>.mp4
   ├─ unir       video sin recodificar, audio unido en PCM y codificado una vez → out/<nombreArchivo>-<versión>.mp4
   ├─ verificar  hyperframes check + medir.mjs + medir-entrada.mjs + verificar-union.mjs → out/hojas/hoja-<versión>.png
   └─ ligero     out/ligero/ (720p, unos 10 MB por minuto)
```

## Contrato 1: `proyecto.json`

```json
{
  "titulo": "Cómo usar la Mesa de ayuda, paso a paso",
  "nombreArchivo": "mesa-de-ayuda",
  "app": { "url": "http://127.0.0.1:8810/?hoy=2026-03-02&reiniciar=1", "arrancar": "node ../app/servidor.mjs --puerto 8810", "puerto": 8810 },
  "voz": { "id": "es-MX-JorgeNeural", "rate": "+25%" },
  "tema": "azul",
  "colores": null,
  "marca": { "nombre": "Tu organización", "logo": "marca/logo.svg" },
  "contacto": { "nombre": "Equipo de soporte", "detalle": "soporte@ejemplo.com", "frase": "Si tienes dudas, escríbele al equipo de soporte." },
  "musica": null,
  "versiones": [ { "id": "general", "para": "Para todo el equipo" }, { "id": "ventas", "para": "Para el equipo de Ventas" } ],
  "palabrasProhibidas": ["ventas", "vended*"],
  "video": { "ancho": 1920, "alto": 1080, "fps": 30 }
}
```

| Campo | Qué es |
|---|---|
| `titulo` | El título; las entradas usan `TITULO` de `guion.mjs` y este solo si falta (si no son iguales, avisa). |
| `nombreArchivo` | Nombra los MP4: `out/<nombreArchivo>-<versión>.mp4`. Corto y sin espacios. |
| `app.url` | La copia de prueba. Si la herramienta deja fijar la fecha o volver a los datos de ejemplo, va aquí. Obligatorio. |
| `app.arrancar` | Opcional: comando que la levanta, corrido desde la carpeta del proyecto. `null` si ya corre en otra parte. |
| `app.puerto` | Informativo (`nuevo.mjs --ejemplo` lo usa para armar `arrancar`). |
| `app.direccion` | Opcional: lo que se lee en la barra de la ventana del video. Si falta, el dominio de `app.url`, o nada si es local. |
| `voz.id`, `voz.rate`, `voz.pitch` | La voz de edge-tts, su velocidad (`+25%`) y tono opcional (`+0Hz`). |
| `tema` | `azul`, `verde`, `violeta` o `morado`. |
| `colores` | `null` o cualquiera de los 11 colores del tema en hex (`primario`, `acento`, `fondo`, `tinta`...). Lo que no se da se calcula y se mide. |
| `marca.nombre`, `marca.logo` | Para el cierre. El logo es un SVG (mejor) o PNG dentro del proyecto; `null` = solo el nombre. |
| `contacto` | `null` (sin tarjeta) o `{ nombre, detalle, frase, voz? }`. Sin `frase` no hay tarjeta. `voz` es la frase como se dice, si difiere. |
| `musica` | `null`, una ruta o una lista de rutas, relativas al proyecto. |
| `versiones` | Una por audiencia: `id` (sin acentos ni espacios) y la línea `para`. |
| `palabrasProhibidas` | No pueden salir en pantalla durante el cuerpo. Cada una cuenta en plural; `geren*` cubre lo que empiece así. |
| `video` | Solo 16:9 (1920 x 1080 por omisión; 1280 x 720 o 3840 x 2160 escalan todo con un factor) y de 12 a 60 cuadros por segundo. |

## Contrato 2: `guion.mjs` (fuente única del texto)

De aquí salen la voz, los subtítulos, los tiempos y `GUION.md` (que no se edita a mano).

```js
export const TITULO = 'Cómo usar la Mesa de ayuda, paso a paso';
export const CAPITULOS = [
  { id: 1, rotulo: 'Entrar', frases: [
    { id: '1.1', sub: 'Para entrar, escribe tu correo.',          // lo que se lee (y lo que se dice, si no hay voz)
      // voz: '...',                                              // solo si se dice distinto: números, siglas
      ve: 'Pantalla de Entrar', hace: 'Escribe el correo',         // columnas del guion
      senal: 'Recuadro en el correo: «Tu correo»',
      pre: 0, extra: 0 },                                         // silencio antes; pausa después (la ajusta grabar)
  ] },
];
export const INTROS = {                                           // una entrada por versiones[].id
  general: [ { id: 'i-general-1', sub: '¡Hola! Este video es para todo el equipo.' } ],
  ventas:  [ { id: 'i-ventas-1',  sub: '¡Hola! Si estás en Ventas, este video es para ti.' } ],
};
```

La frase de dudas no va aquí: es `contacto.frase` (id de voz `contacto`). `revisarGuion()` de `tiempos.mjs` se detiene si falta una entrada, un id se repite o lleva acentos, hay raya, o una palabra prohibida sale en el cuerpo, un rótulo o la tarjeta.

## Contrato 3: los pasos (`node hacer.mjs <paso> [opciones]`)

| Paso | Qué hace | Opciones |
|---|---|---|
| `entorno` | Node, Python con edge-tts (y Whisper, opcional), FFmpeg completo, Chrome, dependencias del proyecto, disco. | |
| `muestras` | Cuatro muestras de voz con el mismo texto (dos de mujer, dos de hombre) en `voz/muestras/`. | `--elegir=N` escribe la voz N en `proyecto.json` |
| `voz` | Revisa el guion y genera la locución; solo rehace lo que cambió. | `--todo` rehace todas · `--comprobar` transcribe con Whisper (`--modelo=medium`) |
| `app` | Arranca la app (si hay `app.arrancar`) y espera; sola, la deja prendida para `grabar`. | `--apagar` apaga la que prendió la skill |
| `grabar` | Graba cada capítulo y ajusta las pausas hasta que no cambien (máximo 4 vueltas). Apaga la app al terminar. | `--cambiados` · `grabar 2 3` solo esos |
| `construir` | Música (si hay), `index.html`, cierre, carve y `GUION.md`. Se detiene si algo no cuadra. | `--seguir` escribe aunque haya fallas |
| `render` | El cuerpo, una vez, en una copia ASCII, revisando el disco. | `--forzar` · `--png` · `--seguir` |
| `entradas` | Arma y renderiza una entrada por versión. | `--version=a,b` |
| `unir` | Entrada + cuerpo → `out/`. | `--version=a,b` |
| `verificar` | `hyperframes check` de cuerpo y entradas, `medir`, `medir-entrada`, `verificar-union` y hojas de cuadros. | `--version=a,b` |
| `ligero` | Versiones de 720p para correo en `out/ligero/`. | `--version=a,b` · `--mb-por-minuto=N` |
| `todo` | Todos menos `muestras`, en orden. | |

Varios pasos a la vez corren en el orden de la tabla: `node hacer.mjs construir render entradas unir`.

**Variables de entorno**

| Variable | Para qué |
|---|---|
| `PYTHON` | El Python que tiene edge-tts, si no es el de `python`, `python3` o `py -3`. |
| `CHROME` | El ejecutable de Chrome, si no está en su lugar de siempre (grabar y medir lo usan). |
| `FFMPEG`, `FFPROBE` | FFmpeg y ffprobe, si no están en el PATH. |
| `VIDEO_TUTORIAL_TMP` | Carpeta temporal con ruta ASCII para el render (en Windows, por omisión `C:\vt-tmp`). |
| `VIDEO_TUTORIAL_WORKERS` | Trabajadores del render (3 por omisión: más pueden agotar la memoria en un cuerpo largo). |
| `VIDEO_TUTORIAL_SKILL` | La carpeta de la skill, si `hacer.mjs entorno` no encuentra `revisar-entorno.mjs`. |

## Contrato 4: la grabación (`grabacion/capN.mjs`)

Un archivo por capítulo. `escena.mjs` y `lib.mjs` son el grabador y no saben nada de ninguna app. La API completa y sus reglas están en `referencias/grabacion.md`; lo esencial:

- `const E = await Escena.abrir(n, { sesion })` · `E.ir(ruta?)` · `E.iniciar()` · `E.frase(id, { antes })` · `E.clic(sel, { en })` · `E.escribir(sel, texto, { en, dur, tab })` · `E.senal(sel, etiqueta, { desde, hasta, tipo, zoom, lado })` · `E.apuntar(...)` · `E.esperarElemento(sel)` · `E.sonido(nombre)` · `E.esperar(momento)` · `E.cerrar()`.
- `@id` es `[data-guia="id"]`. Un momento es un segundo, `'1.2'`, `'1.2:fin'`, `['1.2', 'palabra', n, mas]` o `{ frase, palabra, fin, mas }`.
- La ventana grabada mide 1366 x 768 a densidad 1.5 (cuadros de 2049 x 1152), fija en `lib.mjs`.
- La bitácora `media/capN.json` guarda cursor, clics, señales con su traza (la caja medida cada 70 ms), llegadas, retrasos, sonidos, lo que vio el vigilante y con qué palabras, y el video (cuadros, duración, tamaño del cuadro original).

## Contrato 5: el cierre (`cierre.mjs` → `compositions/cierre.html`)

- Sub-composición de HyperFrames, `data-composition-id="cierre"`, del tamaño del video, **6 s**. Exporta `armarCierre(carpeta)`, `ID`, `DURACION = 6`, `QUIETO_DESDE = 4.5`, `FUNDIDO = 0.4` y `SALIDA`.
- Logo (`marca.logo`) y nombre (`marca.nombre`) con los colores del tema; sin logo, solo el nombre. La letra y el logo van incrustados.
- El logo entra con un rebote pequeño, el nombre aparece suave, y de 4.5 a 6 s todo queda quieto. Seek-safe: una línea de tiempo en pausa, nada de animaciones CSS infinitas.
- Es un archivo generado: no vive en la plantilla ni va a git.

## Contrato 6: los colores (`tema.mjs`)

- `TEMAS = { azul, verde, violeta, morado }`. `tema(proyecto)` devuelve `{ primario, primarioTinta, acento, fondo, fondo2, tinta, tintaSuave, linea, senal, subtituloFondo, subtituloTinta }` en hex, del tema y lo que dé `colores`; lo demás se deriva. Todo par letra/fondo pasa 4.5:1 y la señal 3:1; si no, se detiene y dice qué color usar.
- El motor y el cierre toman sus colores **solo** de aquí. `src/estilos.css` usa variables; si usa una que el tema no define, `construir` se detiene (una variable sin definir sale transparente y «se ve bien»).
- Prueba: `node tema.prueba.mjs` (30 casos, con 400 combinaciones al azar de semilla fija).

## Contrato 7: la app de ejemplo (`ejemplo/app/`)

- `node ejemplo/app/servidor.mjs --puerto 8810` sirve tres archivos, solo en 127.0.0.1, sin dependencias.
- Una «Mesa de ayuda» inventada: entrar, inicio, nuevo pedido en cuatro pasos con un calendario de días hábiles que explica por qué un día no se puede, confirmación con folio, lista con estatus y detalle con conversación.
- `?hoy=AAAA-MM-DD` congela la fecha (reloj en las 10:00), `?reiniciar=1` vuelve a los siete pedidos de ejemplo, `?sesion=1` entra directo. El primer pedido enviado es siempre el MA-1048.
- Cada cosa que se puede señalar lleva `data-guia`, listado en `ejemplo/app/MAPA.md`. `node ejemplo/app/revisar-mapa.mjs` comprueba el mapa, que funcione y que se vea bien.
- Sus capítulos (`ejemplo/grabacion/cap1.mjs` a `cap3.mjs`) entran al proyecto con `node scripts/nuevo.mjs <carpeta> --ejemplo`.

## Contrato 8: qué se verifica

| Dónde | Qué |
|---|---|
| `grabar` | Control positivo del vigilante antes de cada capítulo; palabras prohibidas en pantalla cada 0.35 s; tamaño del cuadro que manda Chrome; selectores que no aparecen; avisos flotantes. |
| `construir` | Firma de tiempos de cada grabación; duración contra la voz (0.4 s); cuadros clave cada 1 s; cada señal sostenida sobre su elemento (8 px) y dentro de la zona libre; tarjeta de contacto 4 s o más; voz antes del cierre; variables de color definidas. |
| `verificar` | `hyperframes check`; señales sobre su elemento y una a la vez; subtítulos de 2 renglones como máximo y con contraste AA; texto encima con fondo propio; adornos que no tapan texto (cada 0.5 s y cada 0.1 s mientras la cámara se mueve); entradas de la misma duración con la voz terminando 0.9 s antes; empalme sin clic, sin hueco, sin cuadro negro, SSIM 0.9 o más; cuadros exactos; -15 LUFS aprox., pico bajo -1 dBTP; voz igual a los dos lados; música 10 dB o más bajo la voz. |
| A ojo | La hoja de cuadros de cada versión. Y escuchar el video completo: nadie del lado de la computadora puede oírlo. |

## Lo que genera un proyecto (nada va a git)

| Dónde | Qué |
|---|---|
| `voz/` | `<id>.wav`, `voz.json`, `frases.json`, `muestras/`, `comprobacion.json` |
| `media/` | `capN.mp4`, `capN.json` (bitácora), `capN.sesion.json` |
| raíz | `index.html`, `compositions/cierre.html`, `GUION.md`, `assets/gsap.min.js`, `assets/audio/` (música) |
| `tmp/` | `plan-resumen.json`, `partes/`, `entradas/<versión>/`, mediciones, `app.json` y `app.log`, `fallo-capN.png` |
| `out/` | los MP4, `hojas/` y `ligero/` |

`nuevo.mjs` deja un `.gitignore` en cada proyecto con todo esto.

## Cómo probar un cambio

1. `node scripts/nuevo.mjs ejemplo/video --ejemplo` y, desde `ejemplo/video/`, `node hacer.mjs todo` (unos 12 minutos con el render). La carpeta `ejemplo/video/` no va a git. Si tocaste `nuevo.mjs` o la copia del render, prueba también una carpeta fuera del repositorio, con espacios y sin acentos (por ejemplo `C:\vt prueba`).
2. Si tocaste la grabación: que `grabar` diga «ESTABLE» y no queden retrasos dentro de las frases.
3. Si tocaste una revisión: rómpela a propósito y comprueba que falla (control positivo). Así se comprobaron el vigilante (una palabra sembrada que sí sale en pantalla), los adornos sobre el rótulo y `--cambiados` con una grabación fallida.
4. Mira las hojas de cuadros y escucha el video.
5. `node tema.prueba.mjs` si tocaste colores; `node ejemplo/app/revisar-mapa.mjs` si tocaste la app.

## Lo aprendido haciendo videos así

- **Nadie del lado de la computadora puede oír.** Para elegir voz se mandan muestras con el mismo texto; para revisar la locución se transcribe con Whisper y se compara con el guion. Las voces «Multilingual» leen palabras sueltas en inglés («¡Listo!» salió «Let's go»).
- **edge-tts da el tiempo de cada palabra**: con eso las señales caen exactas. Cada frase trae casi 1 s de silencio al final que hay que recortar, y se normaliza a -16 LUFS.
- **Las señales salen de cajas medidas** en el DOM, se marcan después de desplazar y se siguen midiendo mientras se ven: si la página se mueve debajo, la señal se recorta en lugar de quedar en el aire.
- **El ajuste de pausas solo arregla lo que pasa entre frases.** Si la primera acción de una frase necesita que el cursor salga antes de que la frase empiece, se usa `E.frase(id, { antes })`; si una señal de la última frase se corta con el final del capítulo, se sostiene la pantalla con `E.esperar({ frase, fin: true, mas })`.
- **`apuntar()` mide primero y mueve después.** Al revés, la medida (unos 0.3 s) hacía que la señal saliera tarde.
- **El video de cada capítulo se corta en el final exacto.** Antes se cortaba después de esperar a los lazos de medición y salía hasta 0.45 s más largo; `construir` se detiene a los 0.4 s.
- **Chrome sin ventana ignora la densidad en el screencast** si no se le pasa `--force-device-scale-factor`: mandaba 1366 x 768 y el video salía estirado. El grabador mide el primer cuadro y se detiene si es más chico.
- **`--disable-lcd-text`**: el suavizado de subpíxel pintaba bordes de color en el 32% de los píxeles de las letras; con la opción, 0%.
- **Un cuadro clave por segundo** en cada grabación: con los de x264 por omisión (cada 6 a 8 s en una pantalla quieta) HyperFrames avisa que la imagen se puede congelar. `construir` lo revisa.
- **Las fichas del frente se apartan mientras la cámara se mueve.** Su capa es la que más se desplaza y una cruzaba el rótulo del capítulo; la revisión cada medio segundo lo vio una vez y otra no, por eso ahora se revisa cada 0.1 s durante cada movimiento.
- **Halo o recuadro.** El recuadro oscurece todo lo demás: si junto al elemento se abre un menú o se escribe, va un halo. La etiqueta va arriba (`lado: 'arriba'`) si abajo tapa donde sigue la acción.
- **Copiar sin `fs.cpSync`.** En Windows, con Node 22, `cpSync` truena sin decir nada (sale con código 127) al copiar una carpeta desde una ruta con acentos a una carpeta que ya existe en una ruta sin acentos: le pasaba a `nuevo.mjs` al crear un proyecto en `C:\videos\...` con la skill bajo una carpeta de usuario con acento. `nuevo.mjs` y la copia del render usan una copia propia (`copiarTodo`).
- **Una grabación que falló no es vigente.** La que vio una palabra prohibida queda escrita para revisarla, pero `grabar --cambiados` la vuelve a grabar, igual que si cambiaron las palabras prohibidas.
- **Avisos flotantes**: se espera a que se vayan antes de grabar y antes de marcar algo que tapen.
- **El primer clic después de escribir** se pierde en algunas apps (se repintan al soltar el foco): el grabador pulsa Tab al terminar de escribir, salvo `tab: false`.
- **Empalme sin clic**: música partida en dos pedazos exactos a 48 kHz, audio unido en PCM y codificado una vez, misma ganancia a los dos lados, y el carve soltado antes del corte.
- **HyperFrames**: `data-layout-allow-overflow` en capas anchas y `data-layout-ignore` en adornos evitan avisos falsos; más de unos 30 elementos con `filter`, `clip-path` o `radial-gradient` dan capturas negras; las líneas de tiempo de GSAP son «thenables» y nunca se devuelven desde una evaluación de Playwright.
- **Peso**: en 1080p, de 24 a 40 MB por minuto según cuánto se mueva la pantalla (el ejemplo: 34 MB por 1 min 25 s); `ligero` baja a unos 10 MB por minuto en 720p (el ejemplo: 13.4 MB, o 6.4 MB con `--mb-por-minuto=5`).

## Dónde vive cada cosa

| Pieza | Archivos |
|---|---|
| Pasos y orquestación | `plantilla/hacer.mjs`, `scripts/nuevo.mjs`, `scripts/revisar-entorno.mjs` |
| Voz y tiempos | `plantilla/voz/*.py`, `plantilla/tiempos.mjs` |
| Grabación | `plantilla/grabacion/escena.mjs`, `lib.mjs`, `README.md`; `plantilla/grabar.mjs`, `autoajustar.mjs` |
| Montaje del cuerpo | `plantilla/construir.mjs`, `capas.mjs`, `src/estilos.css`, `src/animar.js` |
| Música | `plantilla/mezcla-musica.mjs`, `preparar-musica.mjs`, `carve.mjs` |
| Entradas y unión | `plantilla/entradas.mjs`, `construir-entrada.mjs`, `unir.mjs` |
| Verificación | `plantilla/medir.mjs`, `medir-entrada.mjs`, `verificar-union.mjs` |
| Colores, cierre y letras | `plantilla/tema.mjs`, `tema.prueba.mjs`, `cierre.mjs`, `marca/`, `assets/fonts/`, `assets/sfx/` |
| Ejemplo | `ejemplo/` de la skill (app, proyecto y capítulos) y `ejemplo/` de la raíz (el video de muestra) |
| Documentación | `SKILL.md`, `referencias/*.md`, `README.md`, este archivo |

## Límites conocidos

- Solo video 16:9. La ventana grabada es fija (1366 x 768); cambiarla es cambiar `VP` en `lib.mjs` y volver a grabar todo.
- El vigilante no ve texto dentro de `<iframe>`, *shadow DOM* ni imágenes: eso se revisa en la hoja de cuadros.
- Nadie del lado de la computadora puede oír: la voz y la mezcla se miden, no se escuchan.
- La voz necesita internet (edge-tts) y el render tarda: un cuerpo de 75 s tardó 4 min 30 s con 3 trabajadores, y el ejemplo completo, de cero, 12 minutos.
- El ejemplo no trae música (no hay una pista que se pueda redistribuir): el camino con música (`mezcla-musica`, `preparar-musica`, `carve`, el escalón en el empalme) se probó aparte, con una pista de 19.9 s (`referencias/verificacion.md`).
