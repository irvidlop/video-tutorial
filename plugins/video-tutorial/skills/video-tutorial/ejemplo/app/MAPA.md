# Mapa de la Mesa de ayuda

Todo lo que un video puede señalar en la app de ejemplo, pantalla por pantalla. Cada cosa lleva un atributo `data-guia="<id>"` que no cambia. En los scripts de grabación se escribe `@<id>`, que es el atajo de `[data-guia="<id>"]`.

Cómo leerlo:

- Un id es **único en su pantalla**. Algunos se repiten entre pantallas a propósito porque son el mismo botón (por ejemplo `nuevo-siguiente` en los pasos 1 a 3).
- Los id con `{fecha}`, `{folio}` o `{n}` son una familia: `{fecha}` es AAAA-MM-DD, `{folio}` es el folio en minúsculas (`ma-1046`) y `{n}` es un número que empieza en 1.
- Los ejemplos de este mapa salen con `?hoy=2026-03-02&reiniciar=1`. Con otra fecha cambian los días del calendario y las fechas de los pedidos; los id fijos no cambian.
- Cada sección termina con su clave entre comillas invertidas (`entrar`, `inicio`...). `revisar-mapa.mjs` usa esas claves: recorre la app, revisa que cada id de la sección se vea en esa pantalla una sola vez, y falla si en pantalla aparece un `data-guia` que no está en este mapa. Si agregas uno a la app, agrégalo aquí.

## Pistas para el grabador

Además de `data-guia`, la página deja estos datos para saber dónde está sin mirar la imagen:

| Dónde | Atributo | Valores |
|---|---|---|
| `<body>` | `data-pantalla` | `entrar`, `inicio`, `nuevo`, `listo`, `pedidos`, `detalle`, `no-encontrado`, `error`. Cambia cuando la pantalla ya está pintada: sirve para esperar. |
| `<body>` | `data-paso` | `1` a `4`, solo en `nuevo`. |
| `<body>` | `data-sesion` | `1` con sesión, `0` sin sesión. |
| Días del calendario | `data-estado` | `disponible`, `bloqueado` o `elegido`. |
| Días del calendario | `data-motivo` | Vacío si se puede; si no: `pasado`, `hoy`, `fin-de-semana` o `muy-pronto`. |
| Días del calendario | `data-hoy` | `1` solo en el día de hoy. |
| Chips de estatus | `data-estatus` | `recibido`, `en-revision`, `requiere-respuesta`, `en-proceso`, `resuelto`, `cancelado`. |
| Mensajes de la conversación | `data-autor` | `yo`, `soporte` o `sistema`. La pregunta pendiente lleva además `data-pregunta="1"`. |
| Mensaje del calendario | `data-tipo` | `info`, `aviso` (un día que no se puede) u `ok` (día elegido). |

## Barra de arriba, en todas las pantallas con sesión · `comunes`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `menu-marca` | Logo y nombre «Mesa de ayuda». | Lleva al inicio. |
| `menu` | El menú con Inicio y Mis pedidos. | Contiene a los dos de abajo. |
| `menu-inicio` | Enlace «Inicio». | Lleva al inicio. Subrayado cuando estás ahí. |
| `menu-pedidos` | Enlace «Mis pedidos». | Lleva a la lista de pedidos. Subrayado en la lista y en el detalle. |
| `menu-usuario` | Avatar con iniciales y nombre de quien entró («AE Ana Ejemplo»). | Nada: solo informa. |
| `menu-salir` | Botón «Salir». | Cierra la sesión y vuelve a Entrar. |

## Inicio de sesión · `entrar`

Cómo llegar: `/?hoy=2026-03-02&reiniciar=1`.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `entrar-tarjeta` | La tarjeta completa de inicio de sesión. | Sirve para señalar la pantalla entera. |
| `entrar-correo` | Campo «Correo». | Recibe el correo. El de la persona de ejemplo es `ana@ejemplo.com`; cualquier correo con @ entra. |
| `entrar-contrasena` | Campo «Contraseña». | Se ven puntos. Cualquier contraseña sirve. |
| `entrar-boton` | Botón «Entrar». | Revisa los dos campos y entra al inicio. |
| `entrar-ayuda` | Texto «¿No puedes entrar? Escribe a soporte@ejemplo.com». | Nada: solo informa. |

### Con errores · `entrar-errores`

Aparecen al pulsar Entrar con un campo vacío o con un correo sin @. Se van solos en cuanto escribes en ese campo.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `entrar-correo-error` | «Escribe tu correo.» o «Revisa tu correo: debe verse como nombre@ejemplo.com.» | Explica qué falta en el correo. |
| `entrar-contrasena-error` | «Escribe tu contraseña.» | Explica qué falta en la contraseña. |

## Inicio · `inicio`

Cómo llegar: entrar con cualquier contraseña, o directo con `/?hoy=2026-03-02&reiniciar=1&sesion=1#/inicio`.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `inicio-saludo` | Título «Hola, Ana». | Nada: saluda. |
| `inicio-fecha` | La fecha de hoy debajo del saludo («Lunes 2 de marzo de 2026»). | Sale de `?hoy`. |
| `inicio-nuevo` | Botón «Nuevo pedido». | Abre el formulario en el paso 1. |
| `inicio-aviso` | Aviso ámbar «Un pedido requiere tu respuesta». | Solo sale si algún pedido espera tu respuesta (con los datos de ejemplo, MA-1046). Al responder ese pedido, desaparece. |
| `inicio-aviso-boton` | Botón «Responder» del aviso. | Abre el detalle del pedido que espera respuesta. |
| `inicio-resumen` | Las tres tarjetas con números. | Contiene a las tres de abajo. |
| `inicio-resumen-abiertos` | «4 Pedidos abiertos». | Cuenta los pedidos que no están resueltos ni cancelados. |
| `inicio-resumen-respuesta` | «1 Espera tu respuesta». | Cuenta los que requieren tu respuesta. |
| `inicio-resumen-resueltos` | «2 Resueltos». | Cuenta los resueltos. |
| `inicio-recientes` | Tarjeta «Pedidos recientes». | Muestra los cuatro pedidos más nuevos. |
| `inicio-ver-todos` | Botón «Ver todos». | Lleva a Mis pedidos. |
| `inicio-pedido-{folio}` | Cada fila de pedidos recientes. Con los datos de ejemplo: `inicio-pedido-ma-1047` a `inicio-pedido-ma-1044` (o desde `ma-1048` si ya enviaste uno). | Abre el detalle de ese pedido. |
| `inicio-estatus-{folio}` | El chip de estatus de esa fila. | Nada: informa el estatus. |

## Nuevo pedido, en los cuatro pasos · `nuevo`

Cómo llegar: botón Nuevo pedido, o directo con `/?hoy=2026-03-02&reiniciar=1&sesion=1#/nuevo`. Siempre empieza vacío en el paso 1. El formulario cambia de paso sin cambiar de pantalla: espera `body[data-paso="2"]`, `"3"` o `"4"`.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `nuevo-cancelar` | Botón «Cancelar». | Vuelve al inicio y descarta lo escrito. |
| `nuevo-pasos` | La barra de pasos (1 Qué necesitas, 2 Fecha, 3 Detalles, 4 Revisar). | Muestra en qué paso vas. |
| `nuevo-paso-1` | Paso «Qué necesitas» en la barra de pasos. | Nada: informa. Lleva `data-estado` `actual`, `hecho` o `pendiente`. |
| `nuevo-paso-2` | Paso «Fecha». | Igual. |
| `nuevo-paso-3` | Paso «Detalles». | Igual. |
| `nuevo-paso-4` | Paso «Revisar». | Igual. |
| `nuevo-formulario` | La tarjeta blanca del formulario. | Contiene el paso actual y sus botones. |

### Paso 1: Qué necesitas · `nuevo-1`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `nuevo-titulo` | Campo «Título». | Recibe un título corto (mínimo 5 letras). |
| `nuevo-categoria` | El bloque «Categoría» con sus seis fichas. | Sirve para señalar todas las opciones juntas. |
| `nuevo-categoria-equipo` | Ficha «Equipo de cómputo». | La elige (queda azul, con palomita). |
| `nuevo-categoria-accesos` | Ficha «Accesos y contraseñas». | La elige. |
| `nuevo-categoria-programas` | Ficha «Programas». | La elige. |
| `nuevo-categoria-impresoras` | Ficha «Impresoras». | La elige. |
| `nuevo-categoria-red` | Ficha «Internet y red». | La elige. |
| `nuevo-categoria-otro` | Ficha «Otro». | La elige. |
| `nuevo-prioridad` | El bloque «Prioridad». | Sirve para señalar las tres opciones y su explicación. |
| `nuevo-prioridad-baja` | Opción «Baja». | La elige. |
| `nuevo-prioridad-normal` | Opción «Normal». | La elige. |
| `nuevo-prioridad-alta` | Opción «Alta». | La elige. |
| `nuevo-prioridad-ayuda` | Texto junto a las opciones. | Explica la prioridad elegida («Normal: lo necesitas esta semana.»). |
| `nuevo-siguiente` | Botón «Siguiente» (pasos 1 a 3). | Revisa el paso y pasa al siguiente. Si falta algo, muestra los errores y no avanza. |

### Paso 1 con errores · `nuevo-1-errores`

Aparecen al pulsar Siguiente con algo vacío.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `nuevo-titulo-error` | «Escribe un título.» o «El título es muy corto...». | Se va al escribir. |
| `nuevo-categoria-error` | «Elige una categoría.» | Se va al elegir una. |
| `nuevo-prioridad-error` | «Elige la prioridad.» | Se va al elegir una. |

### Paso 2: Fecha · `nuevo-2`

El calendario es propio de la app (no el del navegador) y solo deja elegir días hábiles a partir del tercer día hábil después de hoy. Con `hoy=2026-03-02` (lunes): hoy y el 3 y 4 de marzo son «muy pronto», el primer día posible es el **jueves 5 de marzo**, y sábados y domingos nunca se pueden. Muestra el mes del primer día posible y deja ir hasta dos meses adelante.

Un día que no se puede **sí se puede tocar**: no cambia la elección y el mensaje de abajo explica por qué.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `calendario` | El calendario completo, con su mensaje y su leyenda. | Sirve para señalar todo el calendario. |
| `calendario-mes` | El nombre del mes que se ve («Marzo de 2026»). | Nada: informa. |
| `calendario-anterior` | Botón de flecha a la izquierda. | Va al mes anterior. En el mes de hoy no se mueve y el mensaje dice «No puedes ir a meses que ya pasaron.» |
| `calendario-siguiente` | Botón de flecha a la derecha. | Va al mes siguiente, hasta dos meses adelante. Al llegar al límite no se mueve y el mensaje dice hasta qué mes se puede. |
| `calendario-dia-{fecha}` | Cada día del mes que se ve, por ejemplo `calendario-dia-2026-03-05`. | Si se puede, lo elige (queda azul). Si no, explica por qué en `calendario-mensaje`. Con hoy=2026-03-02: `calendario-dia-2026-03-02` es hoy, `calendario-dia-2026-03-04` es muy pronto, `calendario-dia-2026-03-05` es el primero posible y `calendario-dia-2026-03-07` es sábado. |
| `calendario-mensaje` | El recuadro de texto dentro del calendario, bajo los días. | Explica: al entrar, desde qué día se puede; al tocar un día que no se puede, por qué («El sábado 7 de marzo no se puede: en fin de semana no hay servicio.» o «El miércoles 4 de marzo es muy pronto. Pide con al menos 3 días hábiles: el primero libre es el jueves 5 de marzo.»); al elegir, «Elegiste el jueves 5 de marzo.» Tiene alto fijo para tres renglones: cambiar de mensaje no mueve nada de lo que hay debajo. |
| `calendario-leyenda` | La leyenda de colores (Disponible, No disponible, Hoy, Elegido). | Nada: explica los colores. |
| `nuevo-fecha-reglas` | La nota «Cómo se elige la fecha», a la derecha. | Nada: explica las reglas (días hábiles, 3 días de anticipación). |
| `nuevo-fecha-elegida` | El recuadro «Fecha elegida» dentro de esa nota. | Muestra el día elegido o «Aún no eliges un día». |
| `nuevo-atras` | Botón «Atrás» (pasos 2 a 4). | Vuelve al paso anterior sin perder lo escrito. |

Para señalar «los fines de semana» como bloque, une las cajas de los `calendario-dia-*` que tengan `data-motivo="fin-de-semana"`.

### Paso 2 con errores · `nuevo-2-errores`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `nuevo-fecha-error` | «Elige una fecha en el calendario.», bajo la fecha elegida. | Sale al pulsar Siguiente sin fecha. Se va al elegir un día. |

### Paso 3: Detalles · `nuevo-3`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `nuevo-descripcion` | Campo «Descripción» (varias líneas). | Recibe la descripción (mínimo 10 letras, máximo 500). |
| `nuevo-descripcion-contador` | «0 de 500», bajo el campo. | Cuenta las letras mientras escribes. |
| `nuevo-adjuntos` | El bloque «Archivos (opcional)». | Contiene la zona para adjuntar y la lista de adjuntos. |
| `nuevo-adjuntar` | Botón «Adjuntar archivo». | Abre el selector de archivos de ejemplo (no se sube nada de verdad). |

### Paso 3 con errores · `nuevo-3-errores`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `nuevo-descripcion-error` | «Escribe qué pasa.» o «Cuéntanos un poco más...». | Sale al pulsar Siguiente con la descripción vacía o corta. Se va al escribir. |

### Paso 3 con el selector abierto · `nuevo-3-selector`

Sale al pulsar Adjuntar archivo, como un menú flotante bajo el botón. Se cierra al elegir un archivo, con Cerrar, con Escape o con un clic fuera (ese clic sí llega a lo que tocaste).

| data-guia | Qué es | Qué hace |
|---|---|---|
| `adjuntos-selector` | El menú «Archivos recientes». | Contiene los tres archivos de ejemplo. |
| `adjuntos-archivo-1` | «foto-de-la-impresora.jpg · 1.2 MB». | Lo adjunta y cierra el menú. |
| `adjuntos-archivo-2` | «captura-de-pantalla.png · 240 KB». | Igual. |
| `adjuntos-archivo-3` | «hoja-de-prueba.pdf · 88 KB». | Igual. Un archivo ya adjunto dice «Ya está adjunto» y no se repite. |
| `adjuntos-cerrar` | Botón «Cerrar». | Cierra el menú. |

### Paso 3 con un archivo adjunto · `nuevo-3-adjunto`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `nuevo-adjuntos-lista` | La lista de archivos adjuntos. | Solo se ve si hay al menos uno. |
| `nuevo-adjunto-{n}` | Cada archivo adjunto, en el orden en que los agregaste (`nuevo-adjunto-1`...). | Nada: muestra nombre y peso. |
| `nuevo-adjunto-quitar-{n}` | La X de ese archivo. | Lo quita de la lista. |

### Paso 4: Revisar · `nuevo-4`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `revisar-resumen` | El resumen completo del pedido. | Contiene las tres secciones. |
| `revisar-seccion-1` | Sección «Qué necesitas» (título, categoría, prioridad). | Nada: muestra. |
| `revisar-seccion-2` | Sección «Fecha». | Nada: muestra. |
| `revisar-seccion-3` | Sección «Detalles» (descripción y archivos). | Nada: muestra. |
| `revisar-cambiar-1` | «Cambiar» de la sección 1. | Vuelve al paso 1 con todo lo escrito. |
| `revisar-cambiar-2` | «Cambiar» de la sección 2. | Vuelve al paso 2. |
| `revisar-cambiar-3` | «Cambiar» de la sección 3. | Vuelve al paso 3. |
| `revisar-confirmo` | La casilla «Revisé mi pedido y los datos están bien.» (con su texto). | Hay que marcarla para poder enviar. |
| `revisar-enviar` | Botón «Enviar pedido» (en lugar de Siguiente). | Crea el pedido y lleva a la confirmación. Sin la casilla marcada, muestra el error y no envía. |

### Paso 4 con errores · `nuevo-4-errores`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `revisar-confirmo-error` | «Marca la casilla para confirmar que revisaste tu pedido.» | Se va al marcar la casilla. |

## Confirmación · `listo`

Sale al enviar un pedido. Con `reiniciar=1` el primer pedido que envías siempre es el **MA-1048**: `#/listo/ma-1048`.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `listo-tarjeta` | La tarjeta de confirmación completa. | Sirve para señalar toda la pantalla. |
| `listo-titulo` | «¡Listo! Recibimos tu pedido». | Nada: confirma. |
| `listo-folio` | El folio en grande, con la etiqueta «Tu folio» («MA-1048»). | Nada: es lo que hay que guardar. |
| `listo-datos` | Pedido, Para cuándo y Estatus. | Nada: resume. |
| `listo-estatus` | El chip «Recibido». | Nada: informa. |
| `listo-correo` | «Te avisamos a ana@ejemplo.com cuando haya novedades.» | Nada: informa. |
| `listo-ver-pedido` | Botón «Ver mi pedido». | Abre el detalle del pedido nuevo. |
| `listo-inicio` | Botón «Ir al inicio». | Vuelve al inicio. |

## Mis pedidos · `pedidos`

Cómo llegar: menú Mis pedidos, o `/?hoy=2026-03-02&reiniciar=1&sesion=1#/pedidos`. Con los datos de ejemplo hay siete pedidos (ocho si ya enviaste uno). Cada estatus sale al menos una vez.

| Folio | Pedido | Estatus |
|---|---|---|
| MA-1047 | El internet se corta en la sala de juntas | Recibido |
| MA-1046 | La pantalla parpadea con el monitor externo | Requiere tu respuesta |
| MA-1045 | Acceso a la carpeta compartida de Proyectos | En proceso |
| MA-1044 | Instalar un lector de PDF | En revisión |
| MA-1043 | La impresora no imprime a doble cara | Resuelto |
| MA-1042 | Pasar mis archivos a la laptop nueva | Cancelado |
| MA-1041 | Recuperar el acceso a mi correo | Resuelto |

| data-guia | Qué es | Qué hace |
|---|---|---|
| `pedidos-nuevo` | Botón «Nuevo pedido». | Abre el formulario. |
| `pedidos-lista` | La tarjeta con el buscador y la lista. | Sirve para señalar la lista entera. |
| `pedidos-buscar` | Campo «Busca por título o folio». | Filtra la lista mientras escribes (por título, folio o categoría, sin importar acentos). |
| `pedidos-conteo` | «7 pedidos», o «1 de 7» al filtrar. | Nada: cuenta. |
| `pedidos-fila-{folio}` | Cada fila, por ejemplo `pedidos-fila-ma-1046`. | Abre el detalle de ese pedido (se puede tocar en cualquier parte de la fila). |
| `pedidos-estatus-{folio}` | El chip de estatus de esa fila, por ejemplo `pedidos-estatus-ma-1046` («Requiere tu respuesta»). | Nada: informa. |
| `pedidos-leyenda` | La tarjeta «Qué significa cada estatus», a la derecha. | Nada: explica los seis estatus. |
| `estatus-recibido` | En la leyenda: chip «Recibido» y su explicación. | Nada: explica. |
| `estatus-en-revision` | En la leyenda: «En revisión». | Nada: explica. |
| `estatus-requiere-respuesta` | En la leyenda: «Requiere tu respuesta». | Nada: explica. |
| `estatus-en-proceso` | En la leyenda: «En proceso». | Nada: explica. |
| `estatus-resuelto` | En la leyenda: «Resuelto». | Nada: explica. |
| `estatus-cancelado` | En la leyenda: «Cancelado». | Nada: explica. |

### Sin resultados · `pedidos-vacio`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `pedidos-vacio` | «No encontramos pedidos con «...».» | Sale cuando la búsqueda no encuentra nada. |

## Detalle de un pedido que espera tu respuesta · `detalle`

Cómo llegar: fila MA-1046 de Mis pedidos, el botón Responder del inicio, o `/?hoy=2026-03-02&reiniciar=1&sesion=1#/pedidos/ma-1046`. Todos los pedidos tienen esta pantalla; lo que cambia según el estatus está en las secciones de abajo.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `detalle-volver` | Enlace «Mis pedidos» con flecha, arriba a la izquierda. | Vuelve a la lista. |
| `detalle-folio` | El folio sobre el título («MA-1046»). | Nada: informa. |
| `detalle-titulo` | El título del pedido. | Nada: informa. |
| `detalle-estatus` | El chip de estatus grande, a la derecha. | Nada: informa. Cambia a «En revisión» cuando respondes. |
| `detalle-datos` | Tarjeta «Datos del pedido» (categoría, prioridad, para cuándo, creado). | Nada: informa. |
| `detalle-linea-tiempo` | Tarjeta «Línea de tiempo». | Muestra cada cambio de estatus, del más viejo al más nuevo. |
| `detalle-evento-{n}` | Cada paso de la línea de tiempo (`detalle-evento-1` es el más viejo). En MA-1046: 1 Recibido, 2 En revisión, 3 Requiere tu respuesta. | Nada: informa. El último lleva `data-actual="1"`. |
| `detalle-conversacion` | Tarjeta «Conversación». | Contiene los mensajes y la caja para responder. |
| `detalle-aviso` | Aviso ámbar «Luis Muestra espera tu respuesta. Contesta abajo.» | Solo sale si el pedido requiere tu respuesta. |
| `detalle-mensaje-{n}` | Cada mensaje, del más viejo al más nuevo. En MA-1046: 1 tu descripción (con una foto adjunta), 2 Luis se presenta, 3 la pregunta de Luis (resaltada en ámbar). Al responder sale el 4. | Nada: informa. |
| `detalle-responder` | El bloque para responder (etiqueta, caja y botón). | Sirve para señalar todo junto. |
| `detalle-respuesta` | Caja «Tu respuesta». | Recibe tu respuesta. |
| `detalle-enviar` | Botón «Enviar respuesta». | Agrega tu mensaje a la conversación. Si el pedido requería tu respuesta, pasa a «En revisión» y suma un paso a la línea de tiempo. |

### Respuesta vacía · `detalle-errores`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `detalle-respuesta-error` | «Escribe tu respuesta antes de enviarla.» | Sale al enviar la caja vacía. Se va al escribir. |

### Respuesta enviada · `detalle-enviado`

| data-guia | Qué es | Qué hace |
|---|---|---|
| `detalle-respuesta-enviada` | «Enviamos tu respuesta. Te avisamos cuando haya novedades.», junto al botón. | Se queda mientras sigas en esa pantalla. No es un aviso flotante: no se va solo. |

### Pedido resuelto o cancelado · `detalle-cerrado`

Por ejemplo MA-1043 (resuelto) o MA-1042 (cancelado). En lugar de la caja para responder sale una nota.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `detalle-cerrado` | «Este pedido ya está resuelto. Si necesitas algo más, haz un pedido nuevo.» | Nada: informa. |
| `detalle-nuevo` | Botón «Nuevo pedido» de esa nota. | Abre el formulario. |

## Página que no existe · `no-encontrado`

Por ejemplo `#/pedidos/ma-9999` o `#/algo`.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `no-encontrado` | Tarjeta «No encontramos esta página». | Nada: informa. |
| `no-encontrado-inicio` | Botón «Ir al inicio». | Vuelve al inicio. |

## Fecha mal escrita · `error-fecha`

Sale si `?hoy=` no es una fecha válida (por ejemplo `?hoy=2026-02-30`). La app no sigue con la fecha real a escondidas: se detiene y lo dice.

| data-guia | Qué es | Qué hace |
|---|---|---|
| `error-fecha` | Tarjeta «No pude leer la fecha» con el valor recibido y el formato correcto. | Nada: avisa. |
