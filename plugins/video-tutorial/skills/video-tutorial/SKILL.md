---
name: video-tutorial
description: Convierte una herramienta web (un sistema interno, una plataforma, una app) en un video tutorial narrado en español. Graba la herramienta real con Chrome sobre una copia con datos de ejemplo, una voz neuronal explica cada paso y lo que nombra se señala en pantalla, con cursor, subtítulos, una entrada para cada audiencia, tarjeta de contacto y cierre con logo. Sale un MP4 por audiencia, revisado midiendo. Úsalo siempre que alguien pida un video tutorial, un video explicativo, un video de capacitación o de inducción, un onboarding en video, un video de cómo se usa una herramienta, grabar la plataforma o el sistema con voz, o enseñar a usar una app con un video. También para cambiar un video hecho con esta skill (un texto, la voz, una audiencia nueva). Nunca graba producción ni datos reales.
---

# Video tutorial

Convierte una herramienta web en un video que enseña a usarla. La imagen es la herramienta de verdad, grabada sobre una copia de prueba. Una voz en español explica cada paso y lo que nombra se señala en pantalla en ese momento. Sale un MP4 por cada audiencia: el tutorial es el mismo y solo cambia una entrada de unos segundos.

La persona pone la herramienta y decide qué se enseña. Esta skill trae el motor: grabación, voz, montaje, entradas, cierre y revisión. Lo que salió mal en los primeros videos ya viene resuelto en los scripts, y se detienen si vuelve a pasar.

`<skill>` es la carpeta de este archivo. Claude Code la muestra al cargar la skill. No la adivines: con el plugin y con el instalador queda en lugares distintos.

## Antes de empezar

Corre `node <skill>/scripts/revisar-entorno.mjs`. Dice si faltan Node 22 o más nuevo, Python con edge-tts, FFmpeg, Chrome o espacio en disco (renderizar pide unos 5 GB libres). Si falta algo, dile a la persona qué instalar con el comando exacto de `referencias/instalacion.md` y no sigas a medias.

`<skill>/ejemplo/` trae una app de ejemplo (una «Mesa de ayuda» con datos inventados), su proyecto y sus tres capítulos de grabación, listos para correr. Léelo antes de hacer tu primer video: ahí se ve cómo se conecta todo (`<skill>/ejemplo/LEEME.md`). Si la persona quiere probar la skill antes de usar su herramienta, empieza por ahí:

```
node <skill>/scripts/nuevo.mjs <carpeta> --ejemplo
node hacer.mjs todo                      (desde <carpeta>; unos 15 minutos)
```

## Flujo

Hay cinco momentos en que **preguntas y esperas la respuesta** antes de seguir. Los pasos 1 a 4 caben en un solo mensaje. La voz va aparte, porque necesita las muestras.

### 1. Pregunta: la herramienta y su copia de prueba

- Qué herramienta es y qué tiene que saber hacer quien vea el video: las tareas, en el orden en que las haría.
- Dónde hay una **copia de prueba con datos de ejemplo**: su dirección, el comando para arrancarla si hace falta y un usuario de prueba para entrar.

**Nunca producción ni datos reales**, ni para «una toma rápida». Lo que sale en pantalla lo verá mucha gente. Si solo existe producción, detente y dilo: hace falta una copia local o de pruebas con personas y registros inventados. Las contraseñas de prueba salen de los datos de ejemplo de esa copia, en pantalla se ven como puntos y no se escriben en el guion.

Recorre la copia antes de escribir: todo lo que diga la voz tiene que estar en la pantalla. Si ves un defecto de la herramienta, no lo arregles para el video. Anótalo y díselo a la persona al entregar.

### 2. Pregunta: para quién es y qué palabras no deben salir

- **Las audiencias.** Cada una es una versión: `versiones` en `proyecto.json`, con su `id` (sin acentos ni espacios, porque nombra archivos) y la línea de «para quién». Si es para todos, una sola versión `general`.
- **Las palabras que no deben salir en el cuerpo**: puestos, áreas, nombres de equipos. El cuerpo es el mismo para todas las audiencias, así que no nombra a ninguna. Van en `palabrasProhibidas`: cada palabra cuenta también en plural, y `geren*` cubre todo lo que empiece así (gerente, gerencia). La revisión del guion y el grabador se detienen si una aparece. Revisa también que el usuario de prueba no muestre un puesto en su perfil o en el menú.

### 3. Pregunta: nombre, logo y colores

- **Nombre y logo** de quien hace el video, para el cierre: `marca.nombre` y `marca.logo` (un SVG dentro de `marca/`). Sin logo, el cierre sale solo con el nombre.
- **Colores**: un tema en `tema` (`azul`, el de siempre; `verde`, `violeta` o `morado`) o los de su marca en `colores` (`primario`, `acento`, `fondo`, `tinta`, en hex). Los colores se miden: si un par no se lee, el motor se detiene y dice qué color usar. Detalle en `referencias/estilo.md`.

### 4. Pregunta: contacto para dudas y música

- **Contacto** (`contacto`): a quién escribirle si hay dudas (`nombre`), su correo o teléfono (`detalle`) y la `frase` que dice la voz mientras sale la tarjeta, justo antes del cierre (por ejemplo «Si tienes dudas, escríbele al equipo de soporte»). El correo se lee en la tarjeta y no se dice. `null` es sin tarjeta.
- **Música** (`musica`): una pista que la persona tenga permiso de usar. Va baja, debajo de la voz. `null` es sin música.

### 5. Crear el proyecto

```
node <skill>/scripts/nuevo.mjs <carpeta>
```

Copia la plantilla, deja un `.gitignore` y corre `npm install` ahí (la CLI de HyperFrames y lo que maneja Chrome para grabar; unos 180 MB). Si `npm install` falla, córrelo a mano en la carpeta. Pon la carpeta donde trabaja la persona, nunca suelta en la raíz de un repositorio: los MP4 y las grabaciones pesan y no van a git. `--titulo "..."` escribe el título de una vez.

Llena `proyecto.json` con lo que contestó: `titulo`, `nombreArchivo` (corto y sin espacios: nombra los MP4), `app` (`url`, y `arrancar` y `puerto` si la skill la levanta; `direccion`, opcional, es lo que se lee en la barra de la ventana), `versiones`, `palabrasProhibidas`, `marca`, `tema` o `colores`, `contacto` y `musica`. `video` queda en 1920 x 1080 a 30 cuadros: solo acepta 16:9. El detalle de cada campo está en las referencias (colores en `estilo.md`, música en `composicion.md`, voz en `voz.md`, contacto en `guion.md`). Que cada grabación arranque igual: si la herramienta deja fijar la fecha o volver a los datos de ejemplo, úsalo en `app.url` (la app de ejemplo lo hace con `?hoy=` y `?reiniciar=1`).

Todos los pasos se corren desde la carpeta del proyecto: `node hacer.mjs <paso>`. Dentro del proyecto, `node hacer.mjs entorno` hace la misma revisión de antes.

### 6. Pregunta: la voz

```
node hacer.mjs muestras
```

Genera cuatro muestras con el mismo texto, dos voces de mujer y dos de hombre, en `voz/muestras/` (numeradas del 1 al 4). **Tú no puedes escuchar audio**: no elijas por la persona ni digas cómo suenan. Dale la ruta de esa carpeta y espera a que elija. Escribe la elegida con `node hacer.mjs muestras --elegir=N` (o a mano en `proyecto.json` → `voz`: el `id` y el `rate`; `+25%` es una cuarta parte más rápida que la voz normal). Si la quiere más rápida o más lenta, cambia `rate` y vuelve a correr `muestras`: salen a esa velocidad.

### 7. Escribir el guion (`guion.mjs`)

Es la única fuente del texto: de ahí salen la voz, los subtítulos, los tiempos y `GUION.md`. Lee **`referencias/guion.md`** antes de escribir. Lo corto:

- `CAPITULOS`: uno por tarea, con un `rotulo` de una a tres palabras. Cada frase lleva `id`, `sub` (lo que se lee), `voz` solo si se dice distinto, y `ve`, `hace` y `senal` (qué se ve, qué pasa y qué se señala).
- Tono de plática, de tú: «mira», «fíjate», «ojo con esto», «listo». Una idea por frase. Las mismas palabras que la pantalla.
- El cuerpo no nombra puestos ni áreas. La frase de dudas no va en el guion: es `contacto.frase`, y repetirla al final del cuerpo haría que se oyera dos veces.
- `INTROS`: una entrada por cada `versiones[].id`, todas de largo parecido, que saluda a esa audiencia y dice qué va a aprender.
- Si está la skill `no-ai-slop`, pásale todos los textos y quédate con su versión.

La revisión del guion se detiene si falta la entrada de una versión, si un `id` se repite o lleva acentos, si hay guion largo o si una palabra prohibida sale en el cuerpo, en un rótulo o en la tarjeta. Arregla lo que diga.

Si la persona quiere leer el texto antes de grabar, enséñaselo ahora. Cambiarlo después obliga a grabar y renderizar otra vez.

### 8. Generar la voz y grabar

```
node hacer.mjs voz       # la locución, frase por frase, con el tiempo de cada palabra
node hacer.mjs app       # arranca la app (si hay app.arrancar) y espera a que responda
node hacer.mjs grabar    # graba cada capítulo y ajusta las pausas a la voz
```

Cada capítulo tiene su script, `grabacion/capN.mjs`: qué se pulsa, qué se escribe y qué se señala. Cómo escribirlos está en **`referencias/grabacion.md`**, y los tres capítulos del ejemplo (`<skill>/ejemplo/grabacion/`) son un buen modelo. Las señales salen de elementos medidos en la página, nunca de coordenadas a mano, y se marcan después de mover la pantalla. La grabación va contra el reloj de la voz: mientras graba, no pongas a la computadora a hacer nada pesado.

`grabar` termina diciendo «ESTABLE» cuando las pausas ya no cambian. Lee los retrasos que imprime cada capítulo: el ajuste de pausas solo arregla lo que pasa entre frases; un retraso dentro de una frase se arregla en el script (`E.frase(id, { antes })` si el cursor tiene que salir antes de que la frase empiece). `grabar --cambiados` vuelve a grabar solo lo que cambió.

### 9. Armar y renderizar

```
node hacer.mjs construir   # composición del cuerpo, cierre, música apartada de la voz y GUION.md
node hacer.mjs render      # el cuerpo, una sola vez
node hacer.mjs entradas    # una entrada por versión, todas de la misma duración
node hacer.mjs unir        # deja out/<nombreArchivo>-<version>.mp4
```

`render` revisa el disco antes de empezar y se detiene si no alcanza. Renderiza en una carpeta temporal con ruta sin acentos, trae el MP4 y borra la copia y sus cachés: no copies el proyecto a mano. Tarda de 3 a 4 minutos por cada minuto de video (el ejemplo: 4 min 30 s para un cuerpo de 75 s). `entradas --version=a,b` hace solo esas versiones. Detalle del montaje en `referencias/composicion.md`, de las entradas y el empalme en `referencias/versiones.md`.

`index.html`, `compositions/cierre.html` y `GUION.md` se generan: no los edites a mano, porque el siguiente `construir` los vuelve a escribir. Los cambios van en `guion.mjs`, `proyecto.json` y `grabacion/`.

`node hacer.mjs todo` corre todos los pasos en orden. Los pasos sueltos sirven para repetir solo una parte.

### 10. Verificar

```
node hacer.mjs verificar
```

Mide el cuerpo, las entradas y los empalmes: que cada señal caiga sobre su elemento, subtítulos de dos renglones como máximo y dentro del cuadro, ninguna palabra prohibida en pantalla, la voz terminando antes del cierre, la tarjeta de contacto completa al menos 4 segundos, empalmes sin clic ni cuadro negro, volumen y duración. Si algo falla, se detiene y dice qué y dónde: arregla la causa y vuelve a correrlo. Detalle en `referencias/verificacion.md`.

Pasar la revisión no basta. Abre y mira la hoja de cuadros de cada versión (`out/hojas/hoja-<versión>.png`: la entrada, el empalme, cada capítulo a la mitad de su señal más larga, el contacto y el cierre): que todo se lea, que nada se encime, que no haya etiquetas chiquitas encima de un título y que lo señalado sea lo que dice la voz.

Nadie del lado de la computadora puede oír el video. Para revisar la voz sin oírla, `node hacer.mjs voz --comprobar` transcribe cada frase con Whisper y la compara con el guion (usa el mismo Python que la voz); es opcional y necesita `faster-whisper`. Una frase marcada se revisa, no se da por mala: Whisper también se equivoca con la voz rápida y con las siglas. Antes de compartir, pide a la persona que escuche el video completo, sobre todo los nombres propios y las siglas.

### 11. Entregar

- Los MP4 quedan en `out/`, uno por versión. Dile a la persona cuánto dura y cuánto pesa cada uno, y qué no se pudo comprobar (el oído, siempre).
- Un video de 4 a 5 minutos pesa de 100 a 170 MB, según cuánto se mueva la pantalla: sirve para Teams, OneDrive o una carpeta compartida, no para correo. Si lo van a mandar por correo: `node hacer.mjs ligero` deja versiones ligeras en `out/ligero/` (unos 40 MB por cada 4 minutos).
- Si encontraste defectos de la herramienta al grabar, díselos.
- **No publiques ni mandes nada sin permiso**: ni a una plataforma de videos, ni a una carpeta compartida, ni por correo o chat. Entregas los archivos y la persona decide a dónde van.

## Cambiar un video ya hecho

| Qué cambió | Qué correr |
|---|---|
| Un texto del cuerpo | `voz`, `grabar --cambiados`, `construir`, `render`, `entradas`, `unir`, `verificar` |
| Solo una entrada | `voz`, `entradas --version=<id>`, `unir`, `verificar` |
| Una audiencia nueva | agrégala a `versiones` y a `INTROS`; luego `voz`, `entradas --version=<id>`, `unir`, `verificar` |
| La voz | `voz` y todo lo que sigue, porque cambia el tiempo de cada frase |
| Una pantalla de la herramienta | `grabar --cambiados` y todo lo que sigue |

Si una entrada nueva no cabe en la duración de las demás, cambian todas. Lee `referencias/versiones.md` antes.

## Reglas

- **Verifica midiendo.** El defecto peligroso es el que se ve bien: una señal en el aire, un vigilante que nunca encuentra nada. Lo que se puede medir, se mide.
- **Falla ruidoso.** Si un paso se detiene, lee qué dice y arregla la causa. Nunca saltes un chequeo ni sigas en silencio.
- **Nunca producción ni datos reales.**
- **Nunca `wsl --shutdown`**, ni cierres procesos que no abrió la skill: puedes tumbar servidores de otras personas o de otras sesiones. La skill no usa WSL.
- **Revisa el disco** antes de renderizar. Para liberar espacio, pregunta antes de borrar cualquier cosa que no hizo la skill.
- **Rutas con acentos o espacios**: el render ya trabaja solo en una ruta sin acentos. No muevas el proyecto.
- **No publiques nada sin permiso** de la persona.

## Si algo falla

`referencias/problemas.md` junta lo que salió mal haciendo videos así y cómo se resolvió: la voz que nadie puede oír, señales en el aire, avisos pegados en la imagen, el clic en el empalme, la CLI que truena con acentos, el disco lleno y el video que no cabe en un correo. Lo que hay que instalar está en `referencias/instalacion.md`.

Si falla el render o hay que cambiar el montaje, y están instaladas las skills de HyperFrames, lee `hyperframes-cli` y `hyperframes-core` antes de tocar nada.
