"""Cuatro muestras de voz con el MISMO texto, para que la persona elija cómo suena su video.

Uso:   python voz/muestras.py                       las cuatro muestras
       python voz/muestras.py --texto "Hola..."     con otro texto
       python voz/muestras.py --rate +10%           a otra velocidad (por omisión, la de proyecto.json -> voz.rate)
       python voz/muestras.py --elegir 3            escribe la voz 3 en proyecto.json -> voz.id (deja la velocidad)
Deja   voz/muestras/1-mujer-....mp3 a 4-hombre-....mp3 (mismo volumen, -16 LUFS, para comparar parejo)

Dos voces de mujer y dos de hombre: las neuronales de México y las «Multilingual» conversacionales
(hablan español aunque su código diga en-US). Nadie del lado de la computadora puede oírlas: la persona elige.
"""
import asyncio
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voz import (AQUI, RAIZ, FFMPEG, sintetizar, a_pcm, recortar, escribir_wav, normalizar, falla, leer_proyecto)  # noqa: E402

VOCES = [
    ('mujer', 'es-MX-DaliaNeural', 'mujer, de México'),
    ('mujer', 'en-US-AvaMultilingualNeural', 'mujer, conversacional (multilingüe)'),
    ('hombre', 'es-MX-JorgeNeural', 'hombre, de México'),
    ('hombre', 'en-US-AndrewMultilingualNeural', 'hombre, conversacional (multilingüe)'),
]
TEXTO = ('¡Hola! En este video te enseño a usar la herramienta, paso a paso. Mira: primero entras con tu correo. '
         'Fíjate en el calendario: tu pedido tarda cinco días hábiles. ¿Te equivocaste de día? No pasa nada, lo cambias. ¡Listo!')


def opcion(args, nombre, defecto=None):
    if nombre in args:
        i = args.index(nombre)
        if i + 1 < len(args):
            return args[i + 1]
        falla(f'{nombre} necesita un valor')
    return defecto


def elegir(n):
    if not (1 <= n <= len(VOCES)):
        falla(f'--elegir va de 1 a {len(VOCES)}')
    ruta = os.path.join(RAIZ, 'proyecto.json')
    proyecto = leer_proyecto()
    v = dict(proyecto.get('voz') or {})
    v['id'] = VOCES[n - 1][1]
    v.setdefault('rate', '+15%')
    proyecto['voz'] = v
    with open(ruta, 'w', encoding='utf-8') as fh:
        json.dump(proyecto, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print(f'proyecto.json -> voz = {v["id"]}, velocidad {v["rate"]}. Ahora corre «node hacer.mjs voz».')


async def main():
    args = sys.argv[1:]
    if '--elegir' in args:
        return elegir(int(opcion(args, '--elegir')))
    proyecto = leer_proyecto()
    rate = opcion(args, '--rate', (proyecto.get('voz') or {}).get('rate') or '+15%')
    texto = opcion(args, '--texto', TEXTO)
    dir_m = os.path.join(AQUI, 'muestras')
    os.makedirs(dir_m, exist_ok=True)
    for f in os.listdir(dir_m):
        if f.endswith('.mp3') or f.endswith('.wav'):
            os.remove(os.path.join(dir_m, f))
    print(f'Texto: «{texto}»\nVelocidad: {rate}\n', flush=True)
    for n, (genero, voz, desc) in enumerate(VOCES, 1):
        mp3, palabras = await sintetizar(texto, voz, rate)
        b, _ = recortar(a_pcm(mp3), palabras)
        wav = os.path.join(dir_m, f'{n}.wav')
        escribir_wav(wav, b)
        normalizar(wav)
        salida = os.path.join(dir_m, f'{n}-{genero}-{voz}.mp3')
        r = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k', salida], capture_output=True)
        os.remove(wav)
        if r.returncode != 0:
            falla('FFmpeg no pudo hacer el MP3: ' + r.stderr.decode('utf-8', 'replace')[-300:])
        print(f'{n}. {desc:<38} {voz:<34} -> {os.path.relpath(salida, RAIZ)}', flush=True)
    print('\nQue la persona escuche las cuatro y elija. Luego: python voz/muestras.py --elegir <n> (o escribe el id en proyecto.json -> voz).')
    print('Ojo con las multilingües (2 y 4): hablan buen español, pero una palabra suelta puede salirles en inglés (en una prueba,')
    print('«¡Listo!» salió como «Let\'s go») y van más rápido con la misma velocidad. Si se elige una, comprueba la voz con Whisper:')
    print('node hacer.mjs voz --comprobar')


if __name__ == '__main__':
    asyncio.run(main())
