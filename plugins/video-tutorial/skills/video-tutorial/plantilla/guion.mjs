// Guion del video: la ÚNICA fuente del texto. De aquí salen la voz, los subtítulos, los tiempos y GUION.md.
// Cómo escribirlo: referencias/guion.md de la skill. Este es un ejemplo mínimo: cámbialo completo.
//
// Cada frase:
//   id      capítulo.número en el cuerpo («1.2»); i-<versión>-<número> en las entradas
//   sub     lo que se lee en pantalla
//   voz     (opcional) lo que se dice, si es distinto de sub: números en palabras, siglas deletreadas
//   ve, hace, senal   columnas del guion: qué se ve, qué pasa en la pantalla y qué se señala
//   pre     silencio antes de la frase (segundos)
//   extra   pausa después de la frase (segundos). Empieza en 0: «node hacer.mjs grabar» la ajusta solo.

export const TITULO = 'Cómo usar la Mesa de ayuda, paso a paso';

export const CAPITULOS = [
  { id: 1, rotulo: 'Entrar', frases: [
    { id: '1.1',
      sub: 'Entras con tu correo y tu contraseña.',
      ve: 'Pantalla de inicio de sesión',
      hace: 'Escribe el correo y la contraseña',
      senal: 'Recuadro en el campo de correo: «Tu correo»',
      pre: 0, extra: 0 },
    { id: '1.2',
      sub: 'Pulsa Entrar, y listo: ya estás dentro.',
      ve: 'Inicio con la lista de pedidos',
      hace: 'Pulsa Entrar',
      senal: 'Halo en el botón Entrar: «Entrar»',
      pre: 0, extra: 0 },
  ] },
];

// Una entrada por cada versión de proyecto.json (misma clave que versiones[].id).
export const INTROS = {
  general: [
    { id: 'i-general-1', sub: '¡Hola! Este video es para todo el equipo.' },
    { id: 'i-general-2', sub: 'En un minuto aprendes a entrar a la Mesa de ayuda.' },
  ],
  ventas: [
    { id: 'i-ventas-1', sub: '¡Hola! Si estás en Ventas, este video es para ti.' },
    { id: 'i-ventas-2', sub: 'En un minuto aprendes a entrar a la Mesa de ayuda.' },
  ],
};
