// Capítulo 1 del ejemplo: «Entrar». Lo que se pulsa, se escribe y se señala, contra el reloj de la voz.
// Vive en ejemplo/grabacion/ y se copia a grabacion/ del proyecto con «node scripts/nuevo.mjs <carpeta> --ejemplo»: ahí está escena.mjs.
// Los @id son los data-guia de ejemplo/app/MAPA.md. Cómo se escribe un capítulo: grabacion/README.md del proyecto.
import { Escena } from './escena.mjs';

const E = await Escena.abrir(1);
await E.ir();                    // app.url tal cual: datos de ejemplo y la pantalla de Entrar
await E.iniciar();               // segundo 0 del capítulo

// 1.1 «Para entrar, escribe tu correo.»
// La señal se registra ANTES de actuar: sale cuando la voz dice «correo», y el clic en el campo cae en esa misma palabra.
await E.senal('@entrar-correo', 'Tu correo', { desde: ['1.1', 'correo'], zoom: true });
// esta app nunca pierde el primer clic después de escribir: sin Tab, no sale el anillo de foco en el campo siguiente
await E.escribir('@entrar-correo', 'ana@ejemplo.com', { en: ['1.1', 'correo'], dur: 0.75, tab: false });

// 1.2 «Luego tu contraseña. Fíjate: solo se ven puntos.»
// antes: el cursor sale hacia el campo un poco antes de que empiece la frase, para llegar cuando la voz dice «contraseña»
await E.frase('1.2', { antes: 0.4 });
await E.senal('@entrar-contrasena', 'Solo puntos', { desde: ['1.2', 'contraseña'], zoom: true });
await E.escribir('@entrar-contrasena', 'ejemplo123', { en: ['1.2', 'contraseña'], dur: 0.8, tab: false });   // de prueba: en pantalla, puntos

// 1.3 «Pulsa Entrar y listo: ya estás dentro.»
await E.frase('1.3', { antes: 0.6 });
await E.clic('@entrar-boton', { en: ['1.3', 'Entrar'] });
await E.esperarElemento('body[data-pantalla="inicio"]');
E.sonido('exito');
const finDe13 = { frase: '1.3', fin: true, mas: 1.0 };
await E.senal('@inicio-saludo', 'Tu inicio', { desde: ['1.3', 'dentro'], hasta: finDe13, tipo: 'halo' });
await E.mover('@inicio-fecha', { dur: 0.9, py: 1.4 });   // el cursor se aparta, sin tapar el saludo
// La última frase del capítulo termina justo con la señal: se sostiene la pantalla un segundo más para que se alcance a ver.
// Esperar más allá del final hace que «grabar» alargue la pausa de la frase hasta que quepa.
await E.esperar({ ...finDe13, mas: 1.1 });

await E.cerrar();
