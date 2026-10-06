# Ejemplo: la Mesa de ayuda

Esta carpeta trae dos cosas para aprender y probar la skill sin tocar una herramienta real:

1. **Una app de ejemplo** (`app/`): una «Mesa de ayuda» inventada, en español, donde una persona entra, pide ayuda con un formulario en pasos, recibe un folio y sigue sus pedidos. Todo es de mentira: la persona, los pedidos y el equipo de soporte.
2. **Un proyecto de video de ejemplo** (`proyecto.json`, `guion.mjs` y `grabacion/`): un tutorial de poco más de un minuto sobre esa app, con tres capítulos y dos versiones, listo para correr.

```
ejemplo/
  LEEME.md            este archivo
  proyecto.json       el proyecto de video de ejemplo
  guion.mjs           su guion: lo que dice la voz y lo que se señala
  grabacion/          qué se pulsa, se escribe y se señala en cada capítulo (cap1.mjs a cap3.mjs)
  .gitignore          deja fuera de git el proyecto que crees aquí (video/)
  app/
    index.html        la app: tres archivos estáticos, sin librerías ni fuentes de internet
    app.js
    estilos.css
    servidor.mjs      servidor local, sin dependencias
    MAPA.md           todo lo que un video puede señalar (data-guia), pantalla por pantalla
    revisar-mapa.mjs  revisa la app con Chrome y falla si algo no está como dice el mapa
    capturas/         tres capturas de referencia (inicio, calendario, detalle)
```

## La app

### Arrancarla

Solo hace falta Node 22 o más nuevo. Desde esta carpeta:

```
node app/servidor.mjs --puerto 8810
```

Abre `http://127.0.0.1:8810/?hoy=2026-03-02&reiniciar=1` y entra con `ana@ejemplo.com` y **cualquier contraseña** (es de ejemplo; en pantalla se ven puntos). Para cerrarla, Ctrl+C.

El servidor responde solo en `127.0.0.1` (nadie más en la red la ve) y solo entrega los tres archivos de la app: cualquier otra ruta da 404, así que no expone ningún otro archivo. Si el puerto está ocupado, lo dice y sale con error.

### Parámetros de la dirección

| Parámetro | Qué hace |
|---|---|
| `?hoy=AAAA-MM-DD` | Congela la fecha de hoy. El reloj empieza en las 10:00 y avanza unos minutos con cada cosa que envías. Las fechas de los pedidos de ejemplo se cuentan desde ese día. Si la fecha no es válida (por ejemplo `2026-02-30`), la app se detiene y lo dice; no sigue con la fecha real a escondidas. Sin `?hoy`, usa la fecha de la computadora. |
| `?reiniciar=1` | Vuelve a los datos de ejemplo y cierra la sesión. Todo se guarda en el navegador (localStorage); sin este parámetro, lo que hiciste se queda. |
| `?sesion=1` | Entra directo como Ana Ejemplo, sin pasar por la pantalla de Entrar. |

Las pantallas tienen su ruta después del `#`: `#/entrar`, `#/inicio`, `#/nuevo`, `#/listo/<folio>`, `#/pedidos` y `#/pedidos/<folio>` (folio en minúsculas, por ejemplo `#/pedidos/ma-1046`). Sin sesión, cualquier ruta muestra Entrar y al entrar sigue a la ruta pedida.

**Misma dirección, misma pantalla.** Con `?hoy=2026-03-02&reiniciar=1` siempre salen:

- Ana Ejemplo (`ana@ejemplo.com`) y siete pedidos, MA-1041 a MA-1047, con los seis estatus: Recibido, En revisión, Requiere tu respuesta, En proceso, Resuelto y Cancelado.
- El MA-1046 («La pantalla parpadea con el monitor externo») espera tu respuesta: Luis Muestra, de soporte, te preguntó qué cable usas. Por eso el inicio muestra un aviso.
- El primer pedido que envías es siempre el **MA-1048**.

La lista completa de lo que hay en cada pantalla, con lo que hace cada cosa, está en `app/MAPA.md`.

### El calendario

El paso «Fecha» del nuevo pedido usa un calendario propio (no el del navegador, que no sale en una grabación):

- Solo deja elegir **días hábiles**: sábados y domingos nunca.
- Pide **al menos 3 días hábiles** de anticipación. Con `hoy=2026-03-02` (lunes), el primer día posible es el jueves 5 de marzo.
- Un día que no se puede **sí se puede tocar**: no se elige, y el mensaje dentro del calendario explica por qué («El sábado 7 de marzo no se puede: en fin de semana no hay servicio.»). Ese mensaje tiene alto fijo: cambiarlo no mueve nada.
- Los días que no se pueden van en gris con un rayado suave; hoy lleva un marco. Deja ir hasta dos meses adelante y funciona con el teclado (flechas, Inicio, Fin, Re Pág y Av Pág).

### Lo que la app cuida para que se grabe bien

- **El primer clic después de escribir nunca se pierde.** Ninguna pantalla se repinta al soltar el foco de un campo: lo escrito se guarda tecla por tecla y la pantalla solo cambia con un clic o al enviar. No hace falta pulsar Tab antes de hacer clic.
- **Nada se mueve solo.** No hay animaciones; solo un cambio de color corto (0.12 s) al pasar el cursor. No hay avisos flotantes: los mensajes se quedan en su lugar. No usa `role="alert"` ni `data-aviso`, que el grabador esperaría a que se fueran.
- **Misma pantalla en cualquier ventana 16:9.** La letra crece con la ventana: 13.66 px en 1366x768, 16 px en 1600x900 y 20.48 px en 2048x1152. Ninguna pantalla se sale ni obliga a desplazar.
- **Pistas para esperar sin mirar la imagen:** `body[data-pantalla]` dice qué pantalla está pintada y `body[data-paso]` en qué paso del formulario vas. Los días del calendario llevan `data-estado` y `data-motivo`, y los chips `data-estatus`.
- **Accesible:** todo lo que se toca mide al menos 2.5 rem (40 px en 1600x900), el foco se ve con el teclado y todo el texto tiene contraste AA.

## El proyecto de ejemplo

`proyecto.json`, `guion.mjs` y `grabacion/` siguen el formato de la plantilla de la skill. El video:

- **Cuerpo** de unos 65 segundos en tres capítulos: *Entrar*, *Pedir algo* (con el calendario y el folio) y *Seguir tu pedido* (estatus y responder una pregunta). Con la tarjeta de contacto y el cierre, 75.5 s.
- **Dos versiones**, `general` y `ventas`, cada una con una entrada de dos frases (9 s). Cada MP4 dura 84.5 s.
- **`palabrasProhibidas`**: `["ventas", "vended*"]`. El cuerpo sirve para todos, así que no puede nombrar al equipo. `ventas` va sin comodín porque `venta*` también atraparía «ventana»; `vended*` atrapa vendedor, vendedora, vendedores y vendedoras. El revisor de la app y el vigilante del grabador comprueban que ninguna salga en pantalla.
- **Los capítulos** (`grabacion/cap1.mjs` a `cap3.mjs`): cursor, tecleo, señales, el calendario que explica por qué el sábado no se puede, el folio, los estatus y una respuesta. Graban sin retrasos y son el mejor modelo para escribir los de otra herramienta.
- `guion.mjs` ya trae las pausas (`extra`) que dejó estables una grabación de prueba: en otra computadora, `grabar` las vuelve a ajustar.

### Correrlo

Desde la carpeta de la skill:

```
node scripts/nuevo.mjs ejemplo/video --ejemplo
cd ejemplo/video
node hacer.mjs todo
```

`--ejemplo` copia la plantilla, pone encima `proyecto.json`, `guion.mjs` y `grabacion/` de esta carpeta, apunta `app.arrancar` a `app/servidor.mjs` desde la carpeta nueva y corre `npm install`. `todo` revisa el entorno, genera la voz, arranca la app, graba, arma, renderiza, une, verifica y hace las versiones ligeras: en una prueba, de cero, tardó 12 minutos (el render del cuerpo, 4 min 30 s). Los videos quedan en `ejemplo/video/out/` y las hojas de cuadros en `out/hojas/`.

Se puede crear en cualquier carpeta (`node scripts/nuevo.mjs <carpeta> --ejemplo`): `app.arrancar` queda con la ruta correcta. La carpeta `video/` está en `.gitignore`: grabaciones, audio y MP4 pesan y no van a git.

### Dónde empieza cada capítulo

Las rutas son relativas a `app.url` (en la grabación, `E.ir(ruta)`):

| Capítulo | Empieza en | Por qué |
|---|---|---|
| 1 Entrar | `app.url` tal cual | Datos de ejemplo y la pantalla de Entrar. |
| 2 Pedir algo | `?hoy=2026-03-02&reiniciar=1&sesion=1#/inicio` | Datos de ejemplo y ya dentro: no depende del capítulo 1. |
| 3 Seguir tu pedido | Con la sesión del capítulo 2 (`Escena.abrir(3, { sesion: 2 })`) y `?hoy=2026-03-02#/listo/ma-1048` | Sigue donde acabó el 2 y el pedido nuevo sale en la lista. Si se graba solo, `?hoy=2026-03-02&reiniciar=1&sesion=1#/inicio` también sirve: el texto no depende del pedido nuevo. |

Cada frase de `guion.mjs` lleva un comentario `guía:` con los `data-guia` que toca. Como la app nunca pierde el primer clic, en la grabación puedes escribir con `tab: false`: así no aparece el anillo de foco en el siguiente campo (después del título, por ejemplo, saldría sobre la primera categoría).

## Revisar la app

```
node app/revisar-mapa.mjs
```

Arranca su propio servidor y su propio Chrome sin ventana, con un perfil temporal, y al terminar cierra los dos y borra el perfil, aunque algo falle. No instala nada: habla con Chrome directamente. Revisa:

- **El mapa:** cada `data-guia` de `MAPA.md` se ve en su pantalla una sola vez, y todo `data-guia` que se ve en pantalla está en `MAPA.md`.
- **Que funcione:** el calendario bloquea lo que debe en todos los meses que deja ver (con cuatro fechas distintas, incluido el cambio de año) y explica por qué; `?hoy`, `?reiniciar` y `?sesion` hacen lo que dicen; el primer clic después de escribir responde; la misma dirección da el mismo HTML y la misma imagen.
- **Que se vea bien:** en 1600x900, 1366x768 y 2048x1152 nada se sale ni obliga a desplazar; contraste AA; botones de buen tamaño; foco visible; ninguna palabra prohibida de `proyecto.json` en pantalla.
- **Que el revisor no esté ciego:** siembra un `data-guia` fuera del mapa, un texto gris claro y las palabras prohibidas, y comprueba que los detecta.

Si algo falla, dice qué y en qué pantalla, y sale con código 1. Opciones: `--capturas` (vuelve a sacar las tres capturas), `--solo-mapa` (solo el mapa, más rápido), `--url http://127.0.0.1:8810` (usa una app que ya está corriendo) y `--chrome "<ruta>"` (si no encuentra Chrome; también sirve la variable `CHROME`). Córrelo cada vez que cambies la app o el mapa.

## Capturas

`app/capturas/` tiene tres imágenes chicas (800x450) de la app en 1600x900: `01-inicio.png` (el inicio con el aviso), `02-calendario.png` (el calendario explicando por qué el sábado no se puede) y `03-detalle.png` (la conversación con la pregunta pendiente). Se vuelven a sacar con `node app/revisar-mapa.mjs --capturas`.
