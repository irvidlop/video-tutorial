# Verificación

`node hacer.mjs verificar` mide el cuerpo, las entradas y los videos finales, y deja una hoja de cuadros por versión. Archivos: `medir.mjs`, `medir-entrada.mjs`, `verificar-union.mjs` y la revisión de HyperFrames que corre `hacer.mjs`.

## Tres reglas

- **Se mide, no se mira.** El color calculado y no el que se quiso poner, la caja medida en el DOM y no la que se planeó, los cuadros y las muestras del archivo final.
- **El defecto peligroso es el que se ve bien.** Una señal en el aire, un vigilante que nunca encuentra nada, una variable de color sin definir: todos se ven «bien» a primera vista. Por eso las pruebas que podrían estar rotas tienen su **control positivo**: se les da algo que sí deben encontrar.
- **Falla ruidoso.** Cada script sale con error y dice qué y dónde. `verificar` corre todo y al final se detiene si algo falló.

## Lo que se revisa antes de verificar

Varias cosas se miden al grabar y al construir, y detienen el paso en ese momento:

| Dónde | Qué |
|---|---|
| `grabar` | El control positivo del vigilante antes de cada capítulo; las palabras prohibidas en pantalla (cada 0.35 s); que Chrome mande cuadros del tamaño pedido (si no, el video saldría estirado); los selectores que no aparecen; los avisos flotantes que no se van. |
| `voz` | Que todas las frases tengan voz, con la misma voz y el texto vigente. |
| `construir` | Que cada capítulo se haya grabado con la voz y las pausas actuales y dure lo que pide la voz; que cada grabación traiga un cuadro clave por segundo; que cada señal se haya sostenido sobre su elemento (traza, 8 px) y quede en la zona libre; la tarjeta de contacto 4 s o más; la voz antes del cierre; ninguna variable de color sin definir. Ver `referencias/composicion.md`. |
| `render` | El lint de HyperFrames con `--strict`. |

## 1. La revisión de HyperFrames

`hacer.mjs` copia el cuerpo y cada entrada a una carpeta temporal sin acentos y corre `hyperframes check`: lint, errores de JavaScript, layout (algo que se sale o se encima en varios cuadros), movimiento y **contraste WCAG AA** de cada texto. Debe decir «Check passed». En el ejemplo: 0 errores, 0 avisos, 0 problemas de layout en 9 cuadros, contraste 9 de 9 en el cuerpo y 14 de 14 en cada entrada.

## 2. El cuerpo: `medir.mjs`

Abre `index.html` en Chrome, mueve la línea de tiempo a cada momento que importa y mide en el DOM. Escribe `tmp/medicion.json`.

| Qué | Cómo | Falla si |
|---|---|---|
| Cada señal cayó sobre su elemento | Recorre la traza que se midió al grabar mientras la señal se veía | el elemento se movió más de 8 px, desapareció o no hay medidas |
| Una señal a la vez y donde debe | A la mitad de cada señal | hay más de una a la vista, o quedó a más de 16 px de donde la cámara debía ponerla, o se sale de la zona libre, o pisa el rótulo |
| Etiquetas | A la mitad de cada señal | no se ve, se sale de la zona libre o pisa el rótulo |
| Subtítulos | A la mitad de cada trozo, con la letra real | pasan de 2 renglones, se cortan, se salen del cuadro (40 px de margen), suben sobre la ventana, o una etiqueta o una señal queda debajo |
| Contraste de los subtítulos | El color calculado de la letra contra la caja translúcida puesta sobre blanco y sobre negro | menos de 4.5:1, o la caja es más transparente de lo que permite el tema |
| Texto dibujado encima | Rótulo, número del capítulo, etiquetas, subtítulos y tarjeta de contacto: su letra contra el **fondo propio** que de verdad calculó el navegador | no tiene fondo propio (transparente) o no pasa 4.5:1 |
| Palabras prohibidas | En la bitácora de cada capítulo (vigilante, control positivo y cuántas veces revisó) y en el texto que se dibuja encima | aparece alguna, el control no pasó o el vigilante revisó muy pocas veces |
| Tarjeta de contacto | Ya entera a la vista | el nombre o el dato no son exactamente los de `proyecto.json`, no caben, se salen, invaden los subtítulos o se ven menos de 4 s |
| Adornos del fondo | Un cuadro cada medio segundo y, mientras la cámara se mueve, uno cada 0.1 s (ahí los adornos se desplazan rápido) | una ficha o un punto tapa algo que se lee |
| Voz | Con el plan | dos frases se enciman o la última termina menos de 0.3 s antes del cierre |
| Letras y errores | | una letra no cargó o la composición tiene un error de JavaScript |

El control positivo de la prueba de «texto dibujado encima» fue el defecto que la originó: el rótulo del capítulo salió sin fondo porque la hoja de estilos usaba `--fondo2` y el tema define `--fondo-2`. Ninguna medida geométrica lo vio; la del fondo propio sí, y falla con esa composición.

## 3. Las entradas: `medir-entrada.mjs`

Abre cada entrada (`tmp/entradas/<versión>/`; si no existe, la arma) y escribe `tmp/medicion-entradas.json`.

| Qué | Falla si |
|---|---|
| Duración | no es la duración común de las entradas |
| La voz | no termina exactamente 0.9 s antes del final |
| El título y «para quién» | no están del todo a la vista cuando la voz termina, se salen del cuadro (60 px de margen), la línea baja a la zona de subtítulos, o el bloque trae algo más que esas dos piezas |
| Subtítulos | más de 2 renglones, cortados, fuera del cuadro o pegados al título |
| El último cuadro | el título o un subtítulo siguen a la vista (el empalme se notaría) |
| Adornos | una ficha o un punto tapan el título o un subtítulo (cada medio segundo) |
| Letras y errores | la letra del título no cargó o hay un error de JavaScript |

## 4. Los videos finales: `verificar-union.mjs`

Mide cada `out/<nombreArchivo>-<versión>.mp4` y escribe `tmp/verificacion-union.json`.

| Qué | Cómo | Falla si |
|---|---|---|
| Duración | Cuenta los cuadros | no son exactamente los de la entrada más los del cuerpo, o el audio y el video no miden lo mismo |
| Clic en el empalme | El salto más grande entre dos muestras de audio en los 4 ms del corte, contra lo normal alrededor | es más del doble de lo normal y más de 1.5 veces el mayor de alrededor |
| Escalón de la música | Volumen 350 ms antes y después del corte, contra el mismo escalón en la pista sola | difiere más de 2.5 dB del de la pista sola |
| Hueco | El volumen más bajo en tramos de 10 ms alrededor del corte (solo con música) | hay silencio |
| Cuadro negro | Detector de negro de FFmpeg en el segundo del corte | aparece |
| Salto de imagen | Parecido (SSIM) entre el último cuadro de la entrada y el primero del cuerpo | menos de 0.9 |
| Volumen | Integrado (LUFS) y pico real (dBTP) de todo el video | fuera de -19 a -11 LUFS (aviso si se aleja más de 1.5 de -15), o pico sobre -0.5 dBTP (aviso sobre -1) |
| Voz a los dos lados | LUFS de la última frase de la entrada contra la primera del cuerpo | difieren más de 2 dB |
| Música bajo la voz | Volumen de la música sola al arrancar el cuerpo contra la primera frase | la música queda a menos de 10 dB de la voz (se buscan unos 17) |

Una prueba con música, de 19.9 s, dio: cuadros exactos (596), salto en el corte 0.0015 contra 0.0025 normal, escalón de música 3.55 dB contra 3.56 de la pista sola, SSIM 1.0, -14.4 LUFS, pico -2 dBTP, voz -13.8 y -13.3 LUFS a los dos lados, música 16.3 dB bajo la voz. El ejemplo de la skill (sin música, 84.5 s por versión) dio: 2535 cuadros exactos (270 de la entrada y 2265 del cuerpo), el corte en silencio (-91 dB), SSIM 1.0, -14.8 LUFS, pico -1.5 dBTP y voz -14.2 y -14.7 LUFS a los dos lados.

## 5. La hoja de cuadros

`out/hojas/hoja-<versión>.png`: la entrada con su título, el último cuadro de la entrada y el primero del cuerpo, un cuadro de cada capítulo (a la mitad de su señal más larga, con la etiqueta en el pie), la tarjeta de contacto y el cierre, cada uno con su minuto. Sirve para lo que no se mide: que lo señalado sea lo que dice la voz, que nada se vea raro, que los datos de ejemplo se vean creíbles y que no haya texto prohibido dentro de una imagen o un `<iframe>` (el vigilante no los lee).

## Lo que no se puede comprobar

- **Oír.** Nadie del lado de la computadora puede escuchar el video: la voz y la mezcla se miden, no se oyen. Whisper (`node hacer.mjs voz --comprobar`) ayuda a encontrar palabras mal dichas, pero la persona tiene que escuchar el video completo antes de compartirlo, sobre todo los nombres propios y las siglas.
- **Otros reproductores** (Teams, una presentación, el celular): solo se comprueba que FFmpeg lee el archivo completo.
- **Personas**: si alguien que nunca usó la herramienta entiende el video.
- **Lo que el vigilante no ve**: texto en imágenes, en `<iframe>` o en *shadow DOM*.

## Si algo falla

Lee el mensaje: dice qué, en qué capítulo o versión y en qué segundo. Arregla la causa en `guion.mjs`, `proyecto.json` o `grabacion/capN.mjs`, rehace desde el paso que corresponde (`SKILL.md`, «Cambiar un video ya hecho») y vuelve a correr `verificar`. Nunca se salta un chequeo para seguir.
