# Cómo escribir el guion

`guion.mjs` es la única fuente del texto del video. De ahí salen la voz, los subtítulos, los tiempos y `GUION.md`. `GUION.md` no se edita a mano: `construir` lo vuelve a escribir.

La voz es quien enseña. Si suena a folleto o a robot, el video entero se siente falso, aunque la imagen esté perfecta.

## La forma

```js
export const TITULO = 'Cómo usar la Mesa de ayuda, paso a paso';

export const CAPITULOS = [
  { id: 1, rotulo: 'Entrar', frases: [
    { id: '1.1',
      sub: 'Entras con tu correo y tu contraseña.',
      ve: 'Pantalla de inicio de sesión',
      hace: 'Escribe el correo y la contraseña y pulsa Entrar',
      senal: 'Recuadro en el campo de correo: «Tu correo»',
      pre: 0, extra: 0 },
  ] },
];

// Una entrada por cada versión de proyecto.json (misma clave que versiones[].id)
export const INTROS = {
  general: [ { id: 'i-general-1', sub: '¡Hola! Este video es para todo el equipo.' } ],
  ventas:  [ { id: 'i-ventas-1',  sub: '¡Hola! Si estás en Ventas, este video es para ti.' } ],
};
```

| Campo | Qué es |
|---|---|
| `TITULO` | El título del video. |
| `rotulo` | El nombre del capítulo en pantalla, de una a tres palabras: «Entrar», «Pedir ayuda», «Ver cómo va». |
| `id` | En el cuerpo, `capítulo.número` («2.3»). En las entradas, `i-<versión>-<número>`. Solo letras sin acento, números, punto y guion, porque nombra archivos. Cada uno distinto. |
| `sub` | Lo que se lee en el subtítulo. |
| `voz` | Lo que se dice, solo cuando es distinto de `sub` (ver abajo). |
| `ve`, `hace`, `senal` | Las columnas del guion: qué se ve, qué pasa en la pantalla y qué se señala. La persona las lee en `GUION.md` y a ti te guían para escribir `grabacion/capN.mjs`. |
| `pre` | Silencio antes de la frase, en segundos. |
| `extra` | Pausa después de la frase, para que la pantalla alcance a hacer lo suyo. Empieza en 0: `grabar` ajusta las pausas a la voz. |

## El tono: una plática

Escribe como alguien que se sienta junto a la persona y le enseña la herramienta.

- **De tú.** El saludo («¡Hola!») va en la entrada. El cuerpo arranca directo, porque siempre va después de una entrada.
- **Conectores de plática**: «mira», «fíjate», «ojo con esto», «listo», «no pasa nada», «mi recomendación». Uno cada tantas frases: si van en todas, suenan a muletilla.
- **Alguna pregunta** a quien ve: «¿Y si te equivocaste de día?». Una o dos en todo el video, con la respuesta en la frase que sigue.
- **Una idea por frase.** Al oír no hay comas visibles: una frase de 30 palabras se pierde.
- **Frases de largo variado.** Una corta después de una larga descansa el oído («Listo.»). Si todas miden lo mismo, suena a lectura.
- **Primero qué haces, luego por qué**, y el porqué solo cuando ayuda a hacerlo bien: «Deja tu extensión. Si falta un dato, así te localizan.»
- **Las mismas palabras que la pantalla.** Si el botón dice «Nuevo pedido», la voz dice «Nuevo pedido» y no «crear una solicitud». Así la persona encuentra el botón.
- **Nombra lo que se ve, en el orden en que se ve.** Así la señal cae donde la persona está mirando.
- **Lo repetitivo va rápido.** Llenar cinco campos cabe en una frase. Donde la gente se equivoca, una frase y una señal para eso solo.
- **Nada que no esté en la pantalla o que no haya dicho la persona.** No inventes reglas, plazos ni procesos. Si no sabes algo, pregúntalo.
- **Nada de relleno ni de frases de folleto**: «descubre», «potencia», «revolucionario», «de manera rápida y sencilla», «sin duda», «cabe destacar», «en el mundo actual». Tampoco le digas a quien ve qué sentir («esto es muy fácil»): enséñale y que lo note solo.
- **La voz es sintética**: no dice ser una persona («soy Ana»). Puede hablar en plural por quien hizo el video: «te explicamos».
- **Sin guion largo** en ningún texto. Usa dos puntos o punto.

El primer capítulo engancha: en una o dos frases, qué resuelve la herramienta. La entrada ya dijo qué se va a aprender, así que nada de «En este video aprenderás…».

## `sub` y `voz`: lo que se lee y lo que se dice

`sub` es para leer y `voz` es para oír. Escribe `voz` solo cuando algo cambia:

| `sub` (en pantalla) | `voz` (lo que se dice) | Por qué |
|---|---|---|
| Tienes 5 días para responder. | Tienes cinco días para responder. | Los números en palabras: la voz no duda. |
| Adjunta un PDF de hasta 2 MB. | Adjunta un pe de efe de hasta dos megas. | Las siglas, deletreadas como se dicen. |
| El 3 de marzo a las 9:00. | El tres de marzo a las nueve de la mañana. | Fechas y horas, como se dicen. |
| Guárdala con Ctrl + D. | Guárdala con control más de. | Las teclas, como se dicen. |
| Entra a ayuda.ejemplo.com | Entra a la dirección que ves en pantalla. | Correos y direcciones solo se leen. Dichos en voz alta nadie los retiene. |

- **Correos, teléfonos y direcciones** no se dicen: se leen en pantalla. El correo de contacto sale en la tarjeta del final.
- **Palabras en inglés**: la voz en español las pronuncia en español. Si importan, cámbialas («vista previa» en vez de «preview») o escríbelas en `voz` como suenan.
- **Nombres propios poco comunes**: escríbelos en `voz` como suenan, y pide que alguien los escuche. Es lo que más falla y solo se nota oyendo.

## Las entradas: una por audiencia

Cada versión de `proyecto.json` tiene su entrada en `INTROS`, con la misma clave (`versiones[].id`). Se une al cuerpo y no se nota el corte.

- **Todas duran lo mismo**, así que escríbelas parecidas de largo: dos frases, unas 25 palabras, unos 10 segundos con la voz a `+25%`. Si una es mucho más larga, las demás quedan con silencio o esa no cabe.
- **Primera frase**: el saludo a esa audiencia. **Segunda**: qué va a aprender, en sus palabras.
- **Solo lo que la persona te dijo de esa audiencia.** No inventes procesos internos («tu jefe lo autoriza», «se revisa los viernes»): si no te lo dijeron, no va.
- La entrada sí nombra a su audiencia. El cuerpo no.
- Si el cuerpo enseña algo que esa audiencia no puede hacer en la herramienta, díselo a la persona antes de grabar.

```js
export const INTROS = {
  general: [
    { id: 'i-general-1', sub: '¡Hola! Este video es para todo el equipo.' },
    { id: 'i-general-2', sub: 'Vas a ver cómo pedir ayuda y cómo saber en qué va tu pedido.' },
  ],
  ventas: [
    { id: 'i-ventas-1', sub: '¡Hola! Si estás en Ventas, este video es para ti.' },
    { id: 'i-ventas-2', sub: 'Vas a ver cómo pedir ayuda a la Mesa y cómo seguir tus pedidos.' },
  ],
};
```

## El cuerpo no nombra puestos

El cuerpo es el mismo en todas las versiones. Si dice «como gerente», la versión para otra audiencia suena equivocada.

- **En la voz y en los subtítulos**: «tú», «tu pedido», «tu equipo». Nada de puestos, áreas ni nombres de equipos.
- **En la pantalla**: el usuario de prueba no muestra un puesto, y los datos de ejemplo tampoco.
- Esas palabras van en `palabrasProhibidas`. Cada una cuenta también en plural, y `geren*` cubre todo lo que empiece así (gerente, gerencia). La revisión del guion se detiene si una sale en el cuerpo, en un rótulo o en la tarjeta de contacto, y el grabador se detiene si sale en pantalla.
- Si un área tiene que aparecer porque hace algo en el proceso («la aprueba Compras»), pregúntale a la persona: en la versión para esa área se va a oír raro.

## Antes del cierre: a quién escribirle

La frase de dudas no se escribe en `guion.mjs`: va en `proyecto.json` → `contacto.frase`. La voz la dice mientras sale la tarjeta de contacto, justo antes del cierre con el logo.

```json
"contacto": { "nombre": "Equipo de soporte", "detalle": "soporte@ejemplo.com", "frase": "Si tienes dudas, escríbele al equipo de soporte." }
```

- Que la frase nombre a quien sale en la tarjeta (`contacto.nombre`).
- El correo o el teléfono (`contacto.detalle`) no se dicen: se quedan a la vista en la tarjeta para leerlos.
- Si la frase se dice distinto de como se lee, va en `contacto.voz`, igual que `voz` en las frases del guion.
- No la repitas como última frase del cuerpo: se oiría dos veces.
- Si hay dos o tres reglas que nadie debe olvidar, la última frase del cuerpo puede juntarlas: «Para terminar, recuerda dos cosas: …».
- Sin `contacto` (`null`) no hay tarjeta ni frase de dudas.

## Cuánto dura

- Con la voz a `+25%` y las pausas para que la pantalla haga lo suyo, salen unas 145 palabras por minuto de video. Un cuerpo de 4 minutos son unas 600 palabras.
- El largo lo pone lo que hay que enseñar. Más de 6 minutos cansa: mejor dos videos, o deja fuera lo que casi nadie usa.
- Frases de 5 a 25 palabras. Un capítulo por tarea; si uno pasa de unas diez frases, pártelo en dos.
- `senal`: una señal principal por frase, con una etiqueta de 2 a 4 palabras («Tu folio»).

## Un ejemplo malo y uno bueno

**Malo:**

```js
{ id: '2.1',
  sub: 'En este apartado descubrirás cómo crear de manera rápida y sencilla una solicitud de soporte, la cual será atendida por el equipo correspondiente en un máximo de 48 horas, y como gerente podrás darle seguimiento en todo momento.' },
```

- Una frase de 38 palabras con tres ideas: al oírla se pierde.
- «Descubrirás», «de manera rápida y sencilla», «en todo momento»: frases de folleto.
- Dice «solicitud de soporte» y la pantalla dice «Nuevo pedido»: la persona no encuentra el botón.
- «48 horas»: un plazo que nadie confirmó, y el número sin `voz`.
- «Como gerente»: el cuerpo nombra un puesto.
- No dice qué se ve ni qué se señala.

**Bueno:**

```js
{ id: '2.1', sub: 'Para pedir ayuda, entra a «Nuevo pedido».',
  ve: 'Inicio', hace: 'Clic en «Nuevo pedido»', senal: 'Halo en el botón: «Nuevo pedido»' },
{ id: '2.2', sub: 'Cuéntanos qué pasa en 2 o 3 renglones. Mientras más claro, más rápido te ayudan.',
  voz: 'Cuéntanos qué pasa en dos o tres renglones. Mientras más claro, más rápido te ayudan.',
  ve: 'Formulario de nuevo pedido', hace: 'Escribe la descripción', senal: 'Recuadro en el campo: «Qué pasa»' },
{ id: '2.3', sub: 'Luego eliges el día. Fíjate: si uno no se puede, el calendario te dice por qué.',
  ve: 'Calendario de días hábiles', hace: 'Pica un sábado y sale el aviso', senal: 'Recuadro en el aviso: «Por qué no»' },
{ id: '2.4', sub: 'Listo. Te da un folio, y con ese número sigues tu pedido.',
  ve: 'Confirmación', hace: 'Se muestra el folio', senal: 'Recuadro en el folio: «Tu folio»' },
```

- Una idea por frase, de largo variado.
- Las mismas palabras que la pantalla: «Nuevo pedido», «folio».
- «Fíjate», «listo»: suena a plática.
- El número va en palabras en `voz`.
- Cada frase dice qué se ve, qué pasa y qué se señala.
- No nombra a nadie, así que sirve para todas las audiencias.

## Antes de generar la voz

1. Léelo en voz alta, o por lo menos con ritmo. Lo que te trabe, cámbialo.
2. Si está la skill `no-ai-slop` (o otra que limpie el texto con sabor a IA), pásale todos los `sub` y `voz`, y también `contacto.frase`, y quédate con su versión. Después revisa que siga usando las mismas palabras que la pantalla.
3. `node hacer.mjs voz`. Los pasos revisan el guion y se detienen si falta la entrada de una versión, si un `id` se repite o lleva acentos, si hay guion largo o si una palabra prohibida sale en el cuerpo, en un rótulo o en la tarjeta. Arregla lo que digan y vuelve a correrlo.
