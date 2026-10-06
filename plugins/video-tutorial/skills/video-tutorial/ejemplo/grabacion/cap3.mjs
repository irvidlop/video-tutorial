// Capítulo 3 del ejemplo: «Seguir tu pedido». Mis pedidos, qué significa cada estatus y contestar la pregunta pendiente.
// Vive en ejemplo/grabacion/ y se copia a grabacion/ del proyecto con «node scripts/nuevo.mjs <carpeta> --ejemplo».
import { Escena } from './escena.mjs';

const E = await Escena.abrir(3, { sesion: 2 });   // las cookies y el almacenamiento que dejó el capítulo 2: ya existe el MA-1048
await E.ir('?hoy=2026-03-02#/listo/ma-1048');     // sin reiniciar: la confirmación donde terminó el capítulo 2
await E.iniciar();

// 3.1 «Para ver en qué va, entra a Mis pedidos.»
await E.apuntar('@menu-pedidos', 'Mis pedidos', { desde: ['3.1', 'entra'], tipo: 'halo' });
await E.clic('@menu-pedidos', { en: { frase: '3.1', fin: true, mas: 0.1 }, dur: 0.3 });
await E.esperarElemento('body[data-pantalla="pedidos"]');

// 3.2 «Cada pedido tiene un estatus, y aquí ves qué significa cada uno.»
await E.frase('3.2', { antes: 0.1 });
await E.mover('@pedidos-estatus-ma-1048', { en: ['3.2', 'estatus'], dur: 0.8 });   // el pedido nuevo, arriba: «Recibido»
await E.senal('@pedidos-leyenda', 'Qué significa', { desde: ['3.2', 'aquí'] });
await E.mover('@estatus-en-revision', { en: ['3.2', 'significa'], dur: 0.9, px: 0.2 });

// 3.3 «Ojo con este: requiere tu respuesta.»
await E.frase('3.3', { antes: 0.6 });
await E.apuntar('@pedidos-estatus-ma-1046', 'Te toca a ti', { desde: ['3.3', 'este'], tipo: 'halo' });

// 3.4 «Entra, lee la pregunta y contesta aquí abajo.»
await E.frase('3.4', { antes: 0.9 });
await E.clic('@pedidos-fila-ma-1046', { en: ['3.4', 'Entra'], px: 0.35 });
await E.esperarElemento('body[data-pantalla="detalle"]');
// halo y no recuadro: la pregunta se sigue viendo mientras escribes la respuesta abajo (un recuadro oscurecería la caja).
// La etiqueta va arriba: abajo taparía la caja donde se escribe.
await E.senal('@detalle-mensaje-3', 'La pregunta', { desde: ['3.4', 'pregunta'], tipo: 'halo', lado: 'arriba' });
await E.escribir('@detalle-respuesta', 'Uso un cable HDMI.', { en: ['3.4', 'contesta', 0, 0.3], dur: 1.1, tab: false });

// 3.5 «Envía tu respuesta y tu pedido vuelve a estar en revisión.»
await E.frase('3.5', { antes: 0.7 });
await E.clic('@detalle-enviar', { en: ['3.5', 'Envía', 0, 0.15] });
E.sonido('exito');
await E.esperarElemento('@detalle-respuesta-enviada');
// el chip cambia de texto (y de ancho) al enviar: se marca DESPUÉS, ya con «En revisión».
// Sin acercamiento: después viene la tarjeta de contacto y la cámara no tiene que abrirse encima de ella.
const finDe35 = { frase: '3.5', fin: true, mas: 1.0 };
await E.senal('@detalle-estatus', 'En revisión', { desde: ['3.5', 'revisión'], hasta: finDe35, tipo: 'halo' });
await E.esperar({ ...finDe35, mas: 1.1 });   // se sostiene para que la señal se alcance a ver antes del final

await E.cerrar();
