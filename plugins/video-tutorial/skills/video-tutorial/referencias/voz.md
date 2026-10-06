# Voz

Cómo se genera la locución y por qué todo el video depende de ella. Archivos: `voz/voz.py`, `voz/muestras.py`, `voz/comprobar.py` y `tiempos.mjs`. Cómo escribir lo que se dice: `referencias/guion.md`.

## La voz es el reloj

Cada frase se genera aparte con **edge-tts** (las voces neuronales con que Edge lee en voz alta) y se guarda cuánto dura y en qué momento cae cada palabra. Con eso:

- `tiempos.mjs` calcula en qué segundo de cada capítulo empieza cada frase;
- el grabador hace cada acción cuando la voz dice su palabra (`en: ['1.2', 'Entrar']`);
- las señales aparecen justo cuando la voz nombra la cosa;
- los subtítulos se reparten sobre la voz real.

Por eso **cambiar la voz, la velocidad o un texto obliga a volver a grabar** (`grabar --cambiados` sabe qué capítulos) y a construir y renderizar otra vez.

## Elegir la voz: `node hacer.mjs muestras`

Genera cuatro muestras con **el mismo texto**, al `rate` de `proyecto.json` → `voz` (o `+15%` si no hay), niveladas igual para compararlas parejo:

| Archivo en `voz/muestras/` | Voz | Cómo es |
|---|---|---|
| `1-mujer-es-MX-DaliaNeural.mp3` | `es-MX-DaliaNeural` | mujer, de México |
| `2-mujer-en-US-AvaMultilingualNeural.mp3` | `en-US-AvaMultilingualNeural` | mujer, conversacional (multilingüe) |
| `3-hombre-es-MX-JorgeNeural.mp3` | `es-MX-JorgeNeural` | hombre, de México |
| `4-hombre-en-US-AndrewMultilingualNeural.mp3` | `en-US-AndrewMultilingualNeural` | hombre, conversacional (multilingüe) |

Nadie del lado de la computadora puede oírlas: la persona escucha y elige. La elegida va en `proyecto.json`:

```json
"voz": { "id": "es-MX-JorgeNeural", "rate": "+25%" }
```

`rate` es la velocidad (`+25%` es una cuarta parte más rápida que la normal) y `pitch`, opcional, el tono (`"+0Hz"`). También se puede escribir con `node hacer.mjs muestras --elegir=3` (conserva la velocidad). Para otro texto u otra velocidad está el script directo, `python voz/muestras.py --texto "..." --rate +10%`, corrido con el Python que tiene edge-tts (`node hacer.mjs entorno` dice cuál: no siempre es el de `python`).

**Ojo con las multilingües.** Hablan buen español, pero una palabra suelta puede salirles en inglés: en una prueba, el «¡Listo!» del final salió como «Let's go» en una y como «Listell» en la otra. Además van más rápido con el mismo `rate` (la muestra dura unos 12 s contra 15 de las de México). Si se elige una, comprueba toda la locución con Whisper.

## Generar la locución: `node hacer.mjs voz`

1. `hacer.mjs` revisa el guion (ids repetidos, guion largo, entradas que faltan, palabras prohibidas en el cuerpo) y escribe `voz/frases.json` con todas las frases que se dicen: las del cuerpo, las de cada entrada y la de la tarjeta de contacto (`contacto.frase`, o `contacto.voz` si se dice distinto; su id es `contacto`).
2. `voz/voz.py` pide cada frase a edge-tts, con los tiempos de cada palabra.
3. **Recorta el silencio de las orillas**: edge-tts deja casi un segundo callado al final de cada frase. Se deja 50 ms antes de la primera muestra con voz y 90 ms después de la última (umbral: unos -38 dBFS), y nunca se corta antes de que termine la última palabra más 120 ms. Los bordes llevan un fundido de 12 ms para que el corte no truene.
4. **Nivela** cada frase a **-16 LUFS** (volumen percibido), con un limitador que no deja pasar los picos de 0.79 (-2 dBFS) y que no retrasa la voz. Con ese margen la voz sola nunca obliga al render a bajar el audio para quedar bajo -1 dBTP. Si un sonido cae encima de una frase, el render puede bajar todo un poco (en el ejemplo, 1 dB) y las entradas aplican la misma bajada: la voz suena igual en el cuerpo y en todas las entradas.
5. Guarda `voz/<id>.wav` (48 kHz, mono, 16 bits) y `voz/voz.json`.

Solo se piden las frases nuevas o que cambiaron: cada una guarda una **clave** hecha con la voz, la velocidad, el tono, el texto y la versión del proceso. Si cambia cualquiera, se rehace. `--todo` rehace todas; `python voz/voz.py 1.2,i-ventas-1` rehace solo esas. Si al final alguna frase quedó con otra voz o un texto viejo, el paso falla (una frase con otra voz se oiría distinta). Las frases que ya no están en el guion se quitan de `voz.json` y se borra su audio.

Necesita internet: solo se manda el texto de la locución. Si la red falla, cada frase se reintenta cinco veces.

### `voz/voz.json`

```json
{
 "voz": "es-MX-JorgeNeural", "rate": "+25%", "pitch": "+0Hz",
 "lineas": {
  "1.1": {
   "dur": 1.72,
   "words": [ { "t0": 0.0, "t1": 0.38, "text": "Escribe" }, { "t0": 0.5, "t1": 0.84, "text": "correo" } ],
   "texto": "Escribe tu correo y tu contraseña.",
   "lufs_antes": -18.7, "pico": 0.79, "clave": "3f2a9c1e7b04"
  }
 },
 "total": 9.61
}
```

`dur` es la duración real del WAV recortado y `t0`, `t1` el principio y el fin de cada palabra desde el inicio de ese WAV. No se edita a mano.

## Los tiempos: `tiempos.mjs`

- El primer capítulo abre con 0.8 s antes de la primera frase (la entrada ya saludó). Los demás, con un respiro de 0.75 a 1.1 s.
- Entre frase y frase hay una **respiración de 250 a 700 ms**, al azar pero fija: sale de una semilla que es el id de la frase, así que la misma frase siempre respira igual y el video sale igual cada vez.
- `pre` agrega silencio antes de una frase y `extra` después (lo ajusta `grabar`).
- Cada capítulo termina 0.35 s después de su última pausa.
- `node tiempos.mjs` imprime cuánto dura cada capítulo.

De aquí salen la firma de cada capítulo (si cambia, hay que volver a grabarlo) y la función `palabra()`, que busca una palabra en una frase: primero la exacta, sin mayúsculas ni acentos, y si no, la que empieza igual.

## Comprobar lo que dice: `node hacer.mjs voz --comprobar`

`voz/comprobar.py` transcribe cada frase con **Whisper** (en la computadora, sin internet) y la compara con el guion: cuenta las palabras que sobran, faltan o cambian (error de palabras) y marca las que pasan de 15%. Los números se comparan en palabras, así que «5» y «cinco» cuentan igual.

- Necesita `faster-whisper` (`python -m pip install faster-whisper`). Si no está, lo dice y sigue: es opcional.
- Usa el modelo `small` (unos 500 MB la primera vez); `node hacer.mjs voz --comprobar --modelo=medium` es más exacto y más lento. Si ya bajaste un modelo, usa ese: cada uno pesa cientos de MB.
- Deja el resultado en `voz/comprobacion.json`.

Whisper también se equivoca con la voz rápida, con las siglas y con los nombres raros: una frase marcada se revisa, no se da por mala. Y no sustituye a escuchar: un nombre propio puede salir mal pronunciado y Whisper adivinarlo bien. Antes de compartir el video, la persona lo escucha completo.

## Python

Los pasos buscan un Python que tenga edge-tts: primero la variable `PYTHON`, luego `python`, `python3` y, en Windows, `py -3`. Es común tener varios Python y que la voz esté instalada en uno que no es el de `python`: la búsqueda lo resuelve sola. Siempre se le pide salida en UTF-8; si no, en Windows una ruta con «ó» llega rota.

## Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| `falta proyecto.json -> voz.id` | Corre `muestras`, que la persona elija y escribe la voz. |
| `edge-tts no respondió` | Revisa internet y que el id de la voz exista (`edge-tts --list-voices`). |
| `edge-tts no dio el tiempo de cada palabra` | Actualiza edge-tts: `python -m pip install -U edge-tts`. |
| Una frase suena rara | Escríbela distinto en `voz` (el subtítulo no cambia): números en palabras, siglas separadas, un nombre como se pronuncia. |
| Faltan frases sin voz | Corre `node hacer.mjs voz` (sin ids). |
