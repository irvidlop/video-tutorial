// Capítulo 2 del ejemplo: «Pedir algo». Nuevo pedido en cuatro pasos, el calendario que explica por qué un día no se puede
// y el folio. Vive en ejemplo/grabacion/ y se copia a grabacion/ del proyecto con «node scripts/nuevo.mjs <carpeta> --ejemplo».
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
await E.senal('@nuevo-titulo', 'Corto y claro', { desde: ['2.2', 'título'] });
await E.escribir('@nuevo-titulo', 'La impresora no imprime a color', { en: ['2.2', 'título', 0, 0.2], dur: 1.6, tab: false });

// 2.3 «Elige la categoría y la prioridad.»: dos cosas, dos señales seguidas (nunca dos a la vez)
await E.frase('2.3', { antes: 0.3 });
await E.senal('@nuevo-categoria', 'La categoría', { desde: ['2.3', 'categoría'], hasta: ['2.3', 'prioridad', 0, -0.1] });
await E.clic('@nuevo-categoria-impresoras', { en: ['2.3', 'categoría', 0, 0.35] });
await E.senal('@nuevo-prioridad', 'La prioridad', { desde: ['2.3', 'prioridad'] });
await E.clic('@nuevo-prioridad-normal', { en: ['2.3', 'prioridad', 0, 0.45], dur: 0.45 });   // está cerca: viaje corto
await E.clic('@nuevo-siguiente', { en: { frase: '2.3', fin: true, mas: 0.8 }, dur: 0.5 });
await E.esperarElemento('body[data-paso="2"]');

// 2.4 «Ahora, la fecha. Mira: solo se pueden días hábiles.»
await E.frase('2.4');
await E.senal('@calendario', 'Solo días hábiles', { desde: ['2.4', 'Mira'] });
await E.mover('@calendario-dia-2026-03-14', { en: ['2.4', 'días'], dur: 0.8 });   // el cursor pasa por un fin de semana, en gris

// 2.5 «Si un día no se puede, el calendario te dice por qué.»
await E.frase('2.5', { antes: 0.3 });
await E.clic('@calendario-dia-2026-03-07', { en: ['2.5', 'puede'] });   // el sábado 7: no se elige y el mensaje explica por qué
E.sonido('pop', { en: ['2.5', 'puede', 0, 0.1] });
await E.senal('@calendario-mensaje', 'Te dice por qué', { desde: ['2.5', 'calendario'], zoom: true });   // la cámara se acerca al mensaje

// 2.6 «Pide con al menos 3 días hábiles. Este jueves ya se puede.»
// Sin acercamiento: la cámara se abre después del mensaje y el jueves se ve en su calendario (acercarse otra vez marearía).
await E.frase('2.6');
await E.apuntar('@calendario-dia-2026-03-05', 'Primer día posible', { desde: ['2.6', 'jueves'], tipo: 'halo' });
await E.clic('@calendario-dia-2026-03-05', { en: ['2.6', 'puede'], dur: 0.25 });
await E.clic('@nuevo-siguiente', { en: { frase: '2.6', fin: true, mas: 0.6 } });
await E.esperarElemento('body[data-paso="3"]');

// 2.7 «Cuenta qué pasa y, si quieres, adjunta una foto.»
await E.frase('2.7', { antes: 0.7 });
await E.escribir('@nuevo-descripcion', 'Sale todo en gris.', { en: ['2.7', 'Cuenta'], dur: 0.8, tab: false });
// halo y no recuadro: el recuadro oscurece lo demás y el menú de archivos sale justo debajo
await E.senal('@nuevo-adjuntar', 'Opcional', { desde: ['2.7', 'adjunta'], tipo: 'halo' });
await E.clic('@nuevo-adjuntar', { en: ['2.7', 'foto'] });
await E.clic('@adjuntos-archivo-1', { dur: 0.5 });
await E.esperarElemento('@nuevo-adjunto-1');
await E.clic('@nuevo-siguiente', { dur: 0.6 });
await E.esperarElemento('body[data-paso="4"]');

// 2.8 «Revisa que todo esté bien, marca la casilla y envía.»
await E.frase('2.8', { antes: 0.8 });
await E.mover('@revisar-resumen', { en: ['2.8', 'Revisa'], dur: 0.8, py: 0.3 });
await E.senal('@revisar-confirmo', 'Confirma', { desde: ['2.8', 'casilla', 0, -0.15], tipo: 'halo' });
await E.clic('@revisar-confirmo', { en: ['2.8', 'casilla'], px: 0.04 });
await E.clic('@revisar-enviar', { en: ['2.8', 'envía', 0, 0.4] });
await E.esperarElemento('body[data-pantalla="listo"]');

// 2.9 «¡Listo! Este es tu folio: MA-1048. Guárdalo.»
await E.frase('2.9');
E.sonido('exito');
await E.senal('@listo-folio', 'Tu folio', { desde: ['2.9', 'folio'], zoom: true });

await E.cerrar();   // guarda la sesión: el capítulo 3 sigue desde aquí, con el pedido nuevo
