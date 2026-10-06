# Versiones: un cuerpo y una entrada por audiencia

Archivos: `entradas.mjs` (tiempos), `construir-entrada.mjs`, `carve.mjs --soltar`, `preparar-musica.mjs`, `unir.mjs` y los pasos `entradas` y `unir` de `hacer.mjs`.

## La idea

El tutorial (el **cuerpo**) es el mismo para todos y no nombra a ninguna audiencia: se renderiza **una sola vez**, que es lo lento. Cada audiencia tiene su **entrada** corta, que saluda y dice para quién es. Todas las entradas duran exactamente lo mismo, así que cada una se pega al mismo cuerpo sin recodificar el video. Salen tantos MP4 como versiones: `out/<nombreArchivo>-<versión>.mp4`.

Las versiones son `proyecto.json` → `versiones` (`id` y la línea `para`) y el texto de cada entrada es `guion.mjs` → `INTROS[<id>]`. Las palabras prohibidas solo valen para el cuerpo: la entrada sí nombra a su audiencia. El título sí se revisa, porque lo ven todas.

## Cuánto dura una entrada

```
duración = la mayor de: 6 s, o (0.9 s de título solo + lo que habla la entrada más larga + 0.9 s de silencio al final)
```

redondeada hacia arriba a medio segundo (o a un segundo, si con medio segundo no salen cuadros enteros a los fps del video). Así cae en cuadro entero y en muestra entera a 48 kHz, y el corte de la música es exacto. «Lo que habla» es la suma de sus frases más 0.4 s entre frase y frase.

- La voz de **todas** termina 0.9 s antes del final: el empalme cae en silencio.
- La entrada que habla menos empieza a hablar más tarde: el título se ve más tiempo antes.
- `node entradas.mjs` imprime la duración común y cuándo habla cada versión. Úsalo antes de renderizar.

## Cómo se ve una entrada

- El **título** del guion (`TITULO`, o `proyecto.json` → `titulo`), solo, en dos renglones parejos si es largo (se parte por la coma más cercana a la mitad, o por un espacio), con la letra más grande que quepa en 1640 px (de 104 a 64 px). Debajo, la línea de **para quién** (`versiones[].para`). Nada de etiquetas chiquitas encima.
- El mismo fondo, las mismas capas y la misma cámara que el cuerpo (`capas.mjs`). La cámara parte de un acercamiento suave (1.07) y se abre despacio hasta exactamente la posición con que arranca el cuerpo; la deriva de cada capa sale de 0 y vuelve a 0. Las dos terminan con velocidad 0.
- El título se va 0.85 s antes del final: **el último cuadro es solo el fondo**, igual que el primero del cuerpo (la ventana de la app entra después). Por eso el corte no se nota (en una prueba, los dos cuadros midieron SSIM 1.0, es decir, iguales).
- Voz y subtítulos como en el cuerpo.

Cada entrada se arma como un proyecto aparte en `tmp/entradas/<versión>/` (HyperFrames renderiza carpetas completas), con copia de GSAP, las letras, el pedazo de música y sus frases de voz, más un `resumen.json` que usa `medir-entrada.mjs`.

## La música cruza el empalme sin brincar

- `preparar-musica.mjs` parte `assets/audio/musica.wav` en **dos pedazos exactos a 48 kHz** en la muestra donde termina la entrada: `musica-entrada.wav` (lo usan todas las entradas) y `musica-cuerpo.wav` (el cuerpo sigue desde ese mismo segundo). Salen de la misma lectura, así que juntos son la pista original al bit. Van ya a 48 kHz porque así mezcla HyperFrames; si no, cada render remuestrearía por su cuenta. El corte queda anotado en `assets/audio/musica.json`.
- En la entrada la música sube de 0 a su volumen en 2.2 s y se queda ahí.
- **Soltar el carve antes del corte.** El carve baja la música bajo la voz y la suelta muy despacio (unos 5 dB por segundo): al terminar de hablar, la música de la entrada seguiría abajo y el cuerpo, que arranca con la música a su nivel, la subiría de golpe en el empalme. `carve.mjs --soltar` lleva los recortes del carve a 0 entre 0.15 s después de la última palabra y 0.4 s antes del final. En una prueba, el escalón de la música en el corte midió 3.55 dB y el de la pista sola en ese mismo punto 3.56 dB: la música no brinca.

## El volumen, igual a los dos lados

- La voz deja margen de picos (`referencias/voz.md`) para que el render casi nunca tenga que bajar el audio. Si aun así el render del cuerpo lo baja (para no pasar de -1 dBTP; en el ejemplo, 1 dB, porque dos sonidos caen encima de una frase), lo anota en `tmp/partes/cuerpo.json` y **las entradas aplican la misma bajada** a su voz y su música. Por eso las entradas se arman después del render del cuerpo.
- Si el render de una entrada baja su audio todavía más, `unir` baja lo mismo el cuerpo **de esa versión** (bajar es lo seguro: subir la entrada la haría saturar).
- `verificar` mide la voz a los dos lados: la última frase de la entrada contra la primera del cuerpo (en una prueba, -13.8 y -13.3 LUFS).

## El empalme: `unir.mjs`

1. **Video**: la entrada se recorta a sus cuadros exactos y se concatena con el cuerpo **sin recodificar** (los dos salen del mismo render con los mismos parámetros). Si los parámetros no coinciden, se recodifica la unión y se avisa.
2. **Audio**: cada parte se pasa a PCM a 48 kHz, se deja exactamente del largo de su video (a la muestra), se juntan en PCM y **solo entonces** se codifica una vez a AAC. Unir los AAC directamente dejaría el retardo del codificador (unos 20 ms) en el corte: un clic.
3. Video y audio van al MP4 final, listo para reproducirse mientras baja (`+faststart`). Los intermedios se borran al terminar cada versión.

`unir` se detiene si falta el cuerpo o una entrada, si una entrada se hizo para otra duración o si la música se partió para otra duración (ver abajo).

## Cuando una entrada nueva no cabe en la duración de las demás

Si una entrada nueva (o una que cambió) habla más de lo que cabe, **la duración común sube, y sube para todas**: no puede haber entradas de largos distintos pegadas al mismo cuerpo. Qué hay que rehacer depende de si hay música:

- **Sin música**: el cuerpo no cambia. Hay que volver a hacer **todas** las entradas y todas las uniones:
  ```
  node hacer.mjs voz entradas unir verificar
  ```
  Si se te olvida alguna, `unir` se detiene diciendo cuál entrada se hizo para la duración vieja.
- **Con música**: la música del cuerpo arranca en el segundo donde termina la entrada, así que el cuerpo también cambia. Hay que volver a partir la música, construir y renderizar el cuerpo, y luego todas las entradas:
  ```
  node hacer.mjs voz construir render entradas unir verificar
  ```
  Si no, `entradas` y `unir` se detienen: «la música y el cuerpo se prepararon para entradas de X s y ahora duran Y s».

Para que no pase: escribe entradas de largo parecido (una o dos frases cortas), revisa con `node entradas.mjs` cuánto habla cada una antes de renderizar y, si una se pasa, acórtala en vez de alargar todas. Una entrada más corta que las demás nunca es problema: su título espera un poco más antes de que hable la voz.

## Cambios típicos

| Qué cambió | Qué correr |
|---|---|
| El texto de una entrada (cabe en la duración) | `voz`, `entradas --version=<id>`, `unir --version=<id>`, `verificar --version=<id>` |
| La línea de «para quién» | `entradas --version=<id>`, `unir --version=<id>`, `verificar --version=<id>` |
| Una audiencia nueva | agrégala a `versiones` y a `INTROS`; luego `voz`, `entradas --version=<id>`, `unir --version=<id>`, `verificar --version=<id>` |
| Una entrada ya no cabe | ver la sección de arriba |
| El título | `entradas` y `unir` de todas (el título solo está en las entradas; `construir` actualiza `GUION.md`) |
| Algo del cuerpo (texto, pantalla, voz) | `construir`, `render`, `entradas`, `unir`, `verificar`: las entradas se rehacen porque llevan la bajada de volumen del render del cuerpo |
| Quitar una audiencia | bórrala de `versiones` y de `INTROS`, corre `voz` (quita su audio) y borra su MP4 de `out/` |

`--version=a,b` limita `entradas`, `unir`, `verificar` y `ligero` a esas versiones.

## Archivos

| Dónde | Qué |
|---|---|
| `tmp/partes/cuerpo.mp4`, `cuerpo.json` | el cuerpo renderizado y cuánto bajó su audio (y para qué duración de entrada se partió su música) |
| `tmp/entradas/<versión>/` | el proyecto de cada entrada, con `resumen.json` |
| `tmp/partes/entrada-<versión>.mp4`, `.json` | cada entrada renderizada, con su duración y cuánto bajó su audio |
| `assets/audio/musica.wav`, `musica-entrada.wav`, `musica-cuerpo.wav`, `musica.json` | la pista nivelada, sus dos pedazos y el corte |
| `out/<nombreArchivo>-<versión>.mp4` | los videos finales |
