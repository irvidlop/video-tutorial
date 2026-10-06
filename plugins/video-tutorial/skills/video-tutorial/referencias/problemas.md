# Problemas y soluciones

Lo que salió mal haciendo videos así y cómo quedó resuelto. Casi todo ya lo hace la skill sola. Está aquí para quien se atore, o para quien vaya a cambiar el motor y necesite saber por qué es como es.

Cada caso dice qué se ve, por qué pasa y qué hacer.

## La voz

### Nadie puede oír el video desde la computadora

**Qué se ve.** Nada. Claude trabaja con archivos y no puede escuchar audio. Una voz que suena rara, una palabra mal dicha o una música muy alta pasan sin que ningún paso falle.

**Qué hacer.**
- Para elegir la voz, `node hacer.mjs muestras` genera cuatro muestras con el mismo texto (dos voces de mujer y dos de hombre). La persona las escucha y elige.
- Para revisar la locución completa, `node hacer.mjs voz --comprobar` transcribe cada frase con Whisper (un programa que convierte voz en texto, en la computadora y sin internet) y la compara con el guion. Es opcional: necesita `pip install faster-whisper`, y la primera vez baja un modelo de unos 500 MB. Whisper también se equivoca con la voz rápida y con las siglas, así que una frase marcada se revisa, no se da por mala.
- Antes de compartir, la persona escucha el video entero.

### Un nombre propio sale mal pronunciado

**Qué se ve.** La transcripción escribe otra cosa: un nombre poco común sale como dos palabras que no tienen nada que ver. Al oírlo, suena raro. Solo se nota así.

**Qué hacer.** Escribe el nombre en `voz` como suena (si está en la frase de contacto, en `contacto.voz`), genera la voz otra vez y vuelve a transcribir. Si sigue raro, cámbialo por algo que se diga bien («escríbele al equipo de soporte»).

### Silencios largos entre frases

**Por qué pasa.** edge-tts deja casi un segundo de silencio al final de cada frase. Frase tras frase, el video se siente lento y las señales caen tarde.

**Qué hace la skill.** El paso `voz` recorta ese silencio. Las pausas que quedan son las del guion (`pre` y `extra`) y las que ajusta `grabar`.

### Unas frases suenan más fuerte que otras

**Por qué pasa.** Cada frase sale de edge-tts con su propio volumen.

**Qué hace la skill.** Normaliza cada frase a -16 LUFS antes de armar. LUFS es la medida de qué tan fuerte se oye algo; mientras más cerca de cero, más fuerte. El video completo queda alrededor de -15 LUFS, con la música por debajo de la voz.

### Las señales no caen cuando la voz nombra la cosa

**Por qué pasa.** Si el momento de cada señal se calcula contando palabras, se va desfasando.

**Qué hace la skill.** edge-tts dice en qué momento cae cada palabra. Con eso, la grabación y las señales se acomodan a la voz: la voz es el reloj.

### La voz suena rígida

**Por qué pasa.** Casi siempre es el texto: frases largas, sin conectores, escritas como folleto. La voz que trae HyperFrames sonó rígida en las primeras pruebas; las voces neuronales de edge-tts suenan más cálidas y además dan el tiempo de cada palabra. Por eso la skill usa edge-tts.

**Qué hacer.** Reescribe con `referencias/guion.md` (plática, una idea por frase). Si aun así no convence, genera otra vez las muestras para elegir otra voz, o cambia `rate` en `proyecto.json`.

### La voz no se genera

**Por qué pasa.** edge-tts usa el servicio de voz de Microsoft y necesita internet. Algunas redes de oficina lo bloquean y falla con un error de conexión.

**Qué hacer.** Prueba desde otra red. Si dice que no encuentra edge-tts, ve `referencias/instalacion.md` (casi siempre hay dos Python y la voz quedó en el otro).

## La grabación

### Una señal queda flotando en el aire

**Qué se ve.** El recuadro aparece donde estaba el botón, no donde está ahora. Nada marca error.

**Por qué pasa.** La señal se marcó y luego la página se movió debajo: un scroll, un menú que se abrió, una lista que creció.

**Qué hace la skill.** Las señales salen de cajas medidas en el DOM (la estructura de la página que lee el navegador), nunca de coordenadas a mano, y se marcan **después** del scroll. `verificar` comprueba que cada señal caiga sobre su elemento, con 8 px de tolerancia.

**Qué hacer.** En `grabacion/capN.mjs`, primero acomoda la pantalla y después señala.

### Un aviso flotante se queda pegado en el video

**Qué se ve.** Un aviso de la app («Guardado», «Listo») tapa justo lo que la voz está explicando.

**Por qué pasa.** Muchas apps muestran avisos que se van solos a los pocos segundos. Si la captura o la señal llega antes, el aviso queda en la imagen.

**Qué hacer.** Antes de cada captura, espera a que se vayan los avisos flotantes de la app.

### El primer clic después de escribir no hace nada

**Qué se ve.** El cursor pulsa un botón y no pasa nada.

**Por qué pasa.** En algunas apps, al salir de un campo la pantalla se vuelve a dibujar, y el clic que llega en ese momento se pierde.

**Qué hace la skill.** El grabador pulsa Tab al terminar de escribir, así la pantalla se redibuja antes del clic.

**Qué hacer.** Si lo ves en la herramienta, es un defecto real que también le pasa a quien la usa. Díselo a la persona.

### El video sale borroso cuando la cámara se acerca

**Qué se ve.** De lejos, nada raro. Al acercarse, las letras de la herramienta se ven suaves, como estiradas.

**Por qué pasa.** Chrome sin ventana ignoraba la densidad pedida en la grabación: mandaba cuadros de 1366 x 768 en lugar de 2049 x 1152, y se estiraban. Nada fallaba.

**Qué hace la skill.** Abre Chrome con `--force-device-scale-factor`, mide el primer cuadro y se detiene si llega más chico. También apaga el suavizado de subpíxel (`--disable-lcd-text`), que pintaba bordes de color en las letras.

### Un clic al principio de una frase llega tarde

**Qué se ve.** El cursor apenas va saliendo cuando la voz ya nombró el botón. `grabar` dice «ESTABLE» pero el capítulo imprime retrasos.

**Por qué pasa.** El ajuste de pausas solo mueve lo que pasa entre frases. El cursor tarda 0.7 s en llegar: si el clic cae en la primera palabra, tenía que salir antes de que la frase empezara.

**Qué hacer.** `E.frase('3.4', { antes: 0.9 })` en el capítulo. La meta es que cada capítulo diga «retrasos: 0».

### Las acciones llegan tarde contra la voz

**Por qué pasa.** La grabación va en tiempo real. Si la computadora está ocupada (otro render, muchas ventanas abiertas), las acciones se atrasan y las pausas se ajustan mal.

**Qué hacer.** Mientras graba, no pongas a la computadora a hacer nada pesado. Si cambió un solo capítulo, `node hacer.mjs grabar --cambiados` graba solo ese.

### Una palabra prohibida aparece en pantalla

**Qué se ve.** El grabador se detiene y dice qué palabra apareció y dónde.

**Por qué pasa.** El cuerpo sirve para todas las audiencias. Si en pantalla se lee un puesto, la versión para otra audiencia queda rara.

**Qué hacer.** Cambia los datos de ejemplo o el camino de la grabación para que esa palabra no salga. No la quites de `palabrasProhibidas` para que pase.

Un vigilante que nunca encuentra nada se ve igual que uno que no funciona. Por eso la revisión siembra una palabra a propósito y comprueba que sí la detecta.

## El montaje con HyperFrames

### La CLI de HyperFrames truena con la ruta del proyecto

**Por qué pasa.** La CLI falla con rutas que llevan acentos, por ejemplo una carpeta de usuario que se llama «José» o «Peña».

**Qué hace la skill.** El paso `render` copia solo lo necesario a una carpeta temporal con ruta sin acentos, renderiza ahí, trae el MP4 de vuelta y borra la copia. No hace falta mover el proyecto.

**Qué hacer.** Si corres la CLI a mano (`npx hyperframes check`, por ejemplo), hazlo desde una ruta sin acentos.

### Crear el proyecto se detiene sin decir nada

**Por qué pasa.** En Windows, con Node 22, la función de Node que copia carpetas (`fs.cpSync`) truena en silencio al copiar desde una ruta con acentos a una carpeta que ya existe en una ruta sin acentos. Le pasaba a `nuevo.mjs` cuando la skill vivía bajo una carpeta de usuario con acento y el proyecto iba a, por ejemplo, `C:\videos`.

**Qué hace la skill.** `nuevo.mjs` y la copia del render usan su propia función de copia, que no tiene ese problema. Si escribes un script que copie carpetas, no uses `fs.cpSync`.

### Avisos falsos al revisar la composición

**Qué se ve.** La revisión de la CLI se queja de capas más anchas que el video o de adornos que se salen del cuadro, aunque así deben ser.

**Qué hacer.** `data-layout-allow-overflow` en las capas anchas y `data-layout-ignore` en los adornos.

### Cuadros negros en el video

**Por qué pasa.** Con más de unos 30 elementos que usan `filter`, `clip-path` o `radial-gradient`, algunas capturas del render salen negras.

**Qué hacer.** Pocos efectos de ese tipo. Si agregas adornos, cuenta cuántos llevan esas propiedades.

### La imagen de la herramienta se congela en el render

**Por qué pasa.** HyperFrames busca cuadros sueltos dentro de cada grabación. Con cuadros clave cada 6 u 8 s (lo que deja x264 por omisión cuando la pantalla casi no cambia) avisa que la imagen se puede congelar.

**Qué hace la skill.** El grabador pone un cuadro clave por segundo y `construir` se detiene si una grabación los trae a más de 2 s.

### Una ficha del fondo pasa por encima del rótulo

**Qué se ve.** Durante un acercamiento de la cámara, una de las fichas del frente cruza por el rótulo del capítulo y desaparece. Dura un cuarto de segundo.

**Por qué pasa.** La capa de las fichas es la que más se mueve con la cámara. Si siguen a la vista mientras la cámara se mueve, se pasean por la pantalla.

**Qué hace la skill.** Las fichas desaparecen en 0.25 s al empezar a acercarse y vuelven cuando la cámara ya se abrió. `verificar` revisa los adornos cada 0.1 s mientras la cámara se mueve: revisando cada medio segundo, el cruce se vio en una construcción y en otra no.

### La cámara se queda quieta o brinca

**Por qué pasa.** Dos movimientos de cámara que se traslapan en el tiempo se pisan, y uno de los dos no se ve. No marca error.

**Qué hace la skill.** `construir` avisa cuando dos movimientos de cámara se traslapan. Corrige lo que dice el aviso antes de renderizar.

## El empalme entre la entrada y el cuerpo

### Se oye un clic o un brinco de volumen donde termina la entrada

**Por qué pasa.** La entrada y el cuerpo se renderizan por separado y luego se unen. Cuatro cosas delatan la unión:
- la música, si cada render la convierte por su cuenta y los dos pedazos ya no empatan;
- el audio comprimido: unir dos pedazos ya comprimidos deja un hueco de unos 20 milisegundos;
- el volumen, si un lado bajó todo para no saturar y el otro no;
- el «carve», lo que baja la música mientras habla la voz. Suelta la música despacio: si la entrada termina con la música todavía abajo, el cuerpo la sube de golpe.

**Qué hace la skill.**
- Parte la música en dos pedazos exactos, a 48 kHz, antes de usarla.
- Une el audio sin comprimir (PCM) y lo codifica una sola vez.
- Les da la misma ganancia a los dos lados.
- Suelta el carve antes del empalme.

`verificar` mide cada empalme: sin cuadro negro, sin clic, música continua, mismos parámetros de video y duración exacta.

## La computadora

### El disco se llenó a medio render

**Por qué pasa.** Renderizar un cuerpo de 4 minutos pidió unos 5 GB libres entre cuadros temporales y memoria. Con el disco casi lleno, el render se cae o la computadora se pone lenta.

**Qué hace la skill.** `render` revisa el espacio antes de empezar y se detiene con un mensaje claro si no alcanza. Al terminar, borra los cachés temporales que dejó.

**Qué hacer.** Libera espacio con lo que sea tuyo (la papelera, descargas viejas). Pregunta antes de borrar cualquier cosa que no hizo la skill.

### Apagar WSL tumbó servidores de otras personas

**Por qué pasa.** `wsl --shutdown` libera memoria, pero apaga todo lo que corre en WSL, también los servidores de otras sesiones o de otras personas.

**Qué hacer.** Nunca `wsl --shutdown`, ni cerrar procesos que no abrió la skill. La skill no necesita WSL. Si falta memoria, cierra lo que tú abriste.

## La entrega

### El video no cabe en un correo

**Por qué pasa.** Un video de 4 a 5 minutos en 1080p pesa de 100 a 170 MB (el ejemplo: 34 MB por 1 min 25 s). Sirve para Teams, OneDrive o una carpeta compartida, pero un correo no lo acepta.

**Qué hacer.** `node hacer.mjs ligero` deja versiones ligeras en `out/ligero/`, de unos 40 MB por cada 4 minutos.
