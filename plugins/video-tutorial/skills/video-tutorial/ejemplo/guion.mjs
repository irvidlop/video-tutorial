// Guion del video de ejemplo: la ÚNICA fuente del texto. De aquí salen la voz, los subtítulos, los tiempos y GUION.md.
// Cómo escribirlo: referencias/guion.md de la skill. Lo que se señala en pantalla está en app/MAPA.md.
//
// Cada frase:
//   id      capítulo.número en el cuerpo («1.2»); i-<versión>-<número> en las entradas
//   sub     lo que se lee en pantalla
//   voz     (opcional) lo que se dice, si es distinto de sub: números en palabras, siglas deletreadas
//   ve, hace, senal   columnas del guion: qué se ve, qué pasa en la pantalla y qué se señala
//   pre     silencio antes de la frase (segundos)
//   extra   pausa después de la frase (segundos). En un guion nuevo empieza en 0 y «node hacer.mjs grabar» la ajusta sola.
//           Aquí ya vienen las que dejó estables una grabación de prueba: en otra computadora grabar las vuelve a ajustar.
//
// El comentario «guía:» de cada frase dice qué data-guia toca (en la grabación se escriben con @, por ejemplo @entrar-correo).
// Dónde empieza cada capítulo (las rutas son relativas a app.url de proyecto.json):
//   1  app.url tal cual: datos de ejemplo y la pantalla de Entrar.
//   2  '?hoy=2026-03-02&reiniciar=1&sesion=1#/inicio': datos de ejemplo y ya dentro, en el inicio.
//   3  con la sesión del capítulo 2 y '?hoy=2026-03-02#/listo/ma-1048': sigue donde acabó el 2 y el pedido nuevo sale en la lista.
//      Si se graba solo, '?hoy=2026-03-02&reiniciar=1&sesion=1#/inicio' también sirve: el texto no depende del pedido nuevo.
// Con reiniciar=1 el primer pedido que se envía siempre es el MA-1048 y la fecha de hoy es el lunes 2 de marzo de 2026.

export const TITULO = 'Cómo usar la Mesa de ayuda, paso a paso';

export const CAPITULOS = [
  { id: 1, rotulo: 'Entrar', frases: [
    // guía: entrar-correo
    { id: '1.1',
      sub: 'Para entrar, escribe tu correo.',
      ve: 'Pantalla de inicio de sesión de la Mesa de ayuda',
      hace: 'Clic en Correo y escribe ana@ejemplo.com',
      senal: 'Recuadro en el campo de correo: «Tu correo»',
      pre: 0, extra: 1.11 },
    // guía: entrar-contrasena
    { id: '1.2',
      sub: 'Luego tu contraseña. Fíjate: solo se ven puntos.',
      ve: 'El correo ya escrito; el cursor baja a Contraseña',
      hace: 'Clic en Contraseña y escribe una contraseña de prueba',
      senal: 'Recuadro en la contraseña: «Solo puntos»',
      pre: 0, extra: 0 },
    // guía: entrar-boton, después inicio-saludo
    { id: '1.3',
      sub: 'Pulsa Entrar y listo: ya estás dentro.',
      ve: 'El inicio, con tu saludo y tus pedidos recientes',
      hace: 'Clic en Entrar',
      senal: 'Halo en el saludo: «Tu inicio»',
      pre: 0, extra: 0.68 },
  ] },

  { id: 2, rotulo: 'Pedir algo', frases: [
    // guía: inicio-nuevo
    { id: '2.1',
      sub: 'Para pedir ayuda, pulsa Nuevo pedido.',
      ve: 'El inicio',
      hace: 'Clic en Nuevo pedido',
      senal: 'Halo en el botón: «Nuevo pedido»',
      pre: 0, extra: 0.38 },
    // guía: nuevo-titulo
    { id: '2.2',
      sub: 'Ponle un título corto que diga qué pasa.',
      ve: 'Paso 1 del formulario: Qué necesitas',
      hace: 'Escribe «La impresora no imprime a color» en Título',
      senal: 'Recuadro en el título: «Corto y claro»',
      pre: 0, extra: 0.49 },
    // guía: nuevo-categoria, nuevo-categoria-impresoras, nuevo-prioridad, nuevo-prioridad-normal, nuevo-siguiente
    { id: '2.3',
      sub: 'Elige la categoría y la prioridad.',
      ve: 'Las seis categorías y las tres prioridades',
      hace: 'Clic en Impresoras, luego en Normal y en Siguiente',
      senal: 'Recuadro en las categorías: «La categoría»; luego en la prioridad: «La prioridad»',
      pre: 0, extra: 1.02 },
    // guía: calendario
    { id: '2.4',
      sub: 'Ahora, la fecha. Mira: solo se pueden días hábiles.',
      ve: 'Paso 2: el calendario de marzo, con los fines de semana en gris',
      hace: 'Nada: se ve el calendario',
      senal: 'Recuadro en el calendario: «Solo días hábiles»',
      pre: 0, extra: 0 },
    // guía: calendario-dia-2026-03-07, calendario-mensaje
    { id: '2.5',
      sub: 'Si un día no se puede, el calendario te dice por qué.',
      ve: 'El mensaje del calendario explica que en fin de semana no hay servicio',
      hace: 'Clic en el sábado 7',
      senal: 'Recuadro en el mensaje del calendario: «Te dice por qué»',
      pre: 0, extra: 0 },
    // guía: calendario-dia-2026-03-05, nuevo-siguiente
    { id: '2.6',
      sub: 'Pide con al menos 3 días hábiles. Este jueves ya se puede.',
      voz: 'Pide con al menos tres días hábiles. Este jueves ya se puede.',
      ve: 'El jueves 5 queda elegido, en azul',
      hace: 'Clic en el jueves 5 y en Siguiente',
      senal: 'Halo en el jueves 5: «Primer día posible»',
      pre: 0, extra: 1.63 },
    // guía: nuevo-descripcion, nuevo-adjuntar, adjuntos-archivo-1, nuevo-siguiente
    { id: '2.7',
      sub: 'Cuenta qué pasa y, si quieres, adjunta una foto.',
      ve: 'Paso 3: Descripción y Archivos',
      hace: 'Escribe «Sale todo en gris.», clic en Adjuntar archivo, elige foto-de-la-impresora.jpg y clic en Siguiente',
      senal: 'Halo en Adjuntar archivo: «Opcional»',
      pre: 0, extra: 2.44 },
    // guía: revisar-resumen, revisar-confirmo, revisar-enviar
    { id: '2.8',
      sub: 'Revisa que todo esté bien, marca la casilla y envía.',
      ve: 'Paso 4: el resumen del pedido',
      hace: 'Marca la casilla y clic en Enviar pedido',
      senal: 'Halo en la casilla: «Confirma»',
      pre: 0, extra: 0.19 },
    // guía: listo-folio
    { id: '2.9',
      sub: '¡Listo! Este es tu folio: MA-1048. Guárdalo.',
      voz: '¡Listo! Este es tu folio: eme a, mil cuarenta y ocho. Guárdalo.',
      ve: 'La confirmación con el folio en grande',
      hace: 'Nada: se ve el folio',
      senal: 'Recuadro en el folio: «Tu folio»',
      pre: 0, extra: 0 },
  ] },

  { id: 3, rotulo: 'Seguir tu pedido', frases: [
    // guía: menu-pedidos
    { id: '3.1',
      sub: 'Para ver en qué va, entra a Mis pedidos.',
      ve: 'Mis pedidos: la lista y qué significa cada estatus',
      hace: 'Clic en Mis pedidos, en el menú de arriba',
      senal: 'Halo en Mis pedidos, en el menú: «Mis pedidos»',
      pre: 0, extra: 0 },
    // guía: pedidos-leyenda
    { id: '3.2',
      sub: 'Cada pedido tiene un estatus, y aquí ves qué significa cada uno.',
      ve: 'La lista con sus chips de colores y la explicación a la derecha',
      hace: 'El cursor pasa por la explicación de los estatus',
      senal: 'Recuadro en la explicación de los estatus: «Qué significa»',
      pre: 0, extra: 0 },
    // guía: pedidos-estatus-ma-1046
    { id: '3.3',
      sub: 'Ojo con este: requiere tu respuesta.',
      ve: 'El pedido MA-1046 con su chip ámbar',
      hace: 'El cursor llega al pedido MA-1046',
      senal: 'Halo en el chip «Requiere tu respuesta»: «Te toca a ti»',
      pre: 0, extra: 0 },
    // guía: pedidos-fila-ma-1046, detalle-mensaje-3, detalle-respuesta
    { id: '3.4',
      sub: 'Entra, lee la pregunta y contesta aquí abajo.',
      ve: 'El detalle: la línea de tiempo y la conversación, con la pregunta resaltada',
      hace: 'Clic en el pedido; escribe «Uso un cable HDMI.» en Tu respuesta',
      senal: 'Halo en la pregunta: «La pregunta»',
      pre: 0, extra: 1.02 },
    // guía: detalle-enviar, detalle-estatus
    { id: '3.5',
      sub: 'Envía tu respuesta y tu pedido vuelve a estar en revisión.',
      ve: 'Tu respuesta en la conversación y el estatus En revisión',
      hace: 'Clic en Enviar respuesta',
      senal: 'Halo en el estatus: «En revisión»',
      pre: 0, extra: 0.51 },
  ] },
];

// Una entrada por cada versión de proyecto.json (misma clave que versiones[].id).
export const INTROS = {
  general: [
    { id: 'i-general-1', sub: '¡Hola! Este video es para todo el equipo.' },
    { id: 'i-general-2', sub: 'En un minuto aprendes a pedir ayuda y a seguir tu pedido.' },
  ],
  ventas: [
    { id: 'i-ventas-1', sub: '¡Hola! Si estás en Ventas, este video es para ti.' },
    { id: 'i-ventas-2', sub: 'Si algo falla en tu computadora, así pides ayuda sin perder tiempo.' },
  ],
};
