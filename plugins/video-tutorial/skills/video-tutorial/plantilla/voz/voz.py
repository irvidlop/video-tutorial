"""Locución con edge-tts (voces neuronales de Microsoft), frase por frase. La voz es el reloj del video.

Uso:   python voz/voz.py                    genera las frases nuevas o que cambiaron
       python voz/voz.py --todo             vuelve a generar todas
       python voz/voz.py 1.2,i-ventas-1     solo esas frases
Lee    voz/frases.json        lo escribe «node hacer.mjs voz» a partir de guion.mjs (no se edita a mano)
       proyecto.json -> voz   { "id": "es-MX-JorgeNeural", "rate": "+25%", "pitch": "+0Hz" (opcional) }
Deja   voz/<id>.wav           48 kHz, mono, sin el silencio de las orillas, a -16 LUFS
       voz/voz.json           duración real de cada frase y en qué momento cae cada palabra

Cada frase guarda una «clave» (voz + velocidad + tono + texto): si nada cambió, no se vuelve a pedir.
Necesita internet (solo se manda el texto de la locución), el paquete edge-tts y FFmpeg.
"""
import array
import asyncio
import hashlib
import json
import os
import re
import subprocess
import sys
import wave

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
SR = 48000                 # así mezcla HyperFrames: nada se remuestrea después
OBJETIVO_LUFS = -16.0      # todas las frases al mismo volumen
UMBRAL = int(0.012 * 32767)  # por debajo de esto es silencio (unos -38 dBFS)
ANTES, DESPUES = 0.05, 0.09  # lo que se deja antes de la primera muestra con voz y después de la última (s)
FUNDIDO = 0.012            # fundido de entrada y salida (s), para que el corte no truene

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def falla(msg):
    print('FALLA: ' + msg, flush=True)
    sys.exit(1)


def leer_proyecto():
    with open(os.path.join(RAIZ, 'proyecto.json'), encoding='utf-8') as f:
        return json.load(f)


def voz_del_proyecto(proyecto):
    v = proyecto.get('voz') or {}
    if not v.get('id'):
        falla('falta proyecto.json -> voz.id. Corre «node hacer.mjs muestras», que la persona elija y escribe su id ahí.')
    return v['id'], v.get('rate') or '+0%', v.get('pitch') or '+0Hz'


PROCESO = 2   # sube si cambia cómo se recorta o nivela: las frases hechas con el proceso anterior se rehacen


def clave(voz, rate, pitch, texto):
    return hashlib.sha1(f'{voz}|{rate}|{pitch}|{texto}|p{PROCESO}'.encode('utf-8')).hexdigest()[:12]


async def sintetizar(texto, voz, rate='+0%', pitch='+0Hz'):
    """Pide la frase a edge-tts. Devuelve (mp3 en bytes, [{t0, t1, text}] en segundos)."""
    import edge_tts
    ultimo = None
    for intento in range(5):
        try:
            try:
                com = edge_tts.Communicate(texto, voz, rate=rate, pitch=pitch, boundary='WordBoundary')
            except TypeError:   # edge-tts 6 o anterior: ya da los tiempos por palabra sin pedirlos
                com = edge_tts.Communicate(texto, voz, rate=rate, pitch=pitch)
            audio, palabras = bytearray(), []
            async for ch in com.stream():
                if ch['type'] == 'audio':
                    audio += ch['data']
                elif ch['type'] == 'WordBoundary':
                    palabras.append({'t0': ch['offset'] / 1e7, 't1': (ch['offset'] + ch['duration']) / 1e7, 'text': ch['text']})
            if audio:
                return bytes(audio), palabras
            ultimo = 'llegó vacío'
        except Exception as e:   # red inestable: se reintenta
            ultimo = e
        print(f'  reintento {intento + 1}: {ultimo}', flush=True)
        await asyncio.sleep(1.5 * (intento + 1))
    falla(f'edge-tts no respondió ({ultimo}). ¿Hay internet? ¿Existe la voz «{voz}»? (lista: edge-tts --list-voices)')


def a_pcm(mp3):
    """MP3 -> muestras de 16 bits, mono, 48 kHz."""
    r = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', str(SR), '-f', 's16le', 'pipe:1'],
                       input=mp3, capture_output=True)
    if r.returncode != 0:
        falla('FFmpeg no pudo leer el audio de edge-tts: ' + r.stderr.decode('utf-8', 'replace')[-400:])
    a = array.array('h')
    a.frombytes(r.stdout[: len(r.stdout) // 2 * 2])
    if sys.byteorder != 'little':
        a.byteswap()
    return a


def escribir_wav(ruta, muestras):
    with wave.open(ruta, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(muestras.tobytes())


def recortar(a, palabras):
    """Quita el silencio de las orillas (edge-tts deja casi 1 s al final) y funde los bordes. Devuelve (muestras, inicio en s)."""
    n = len(a)
    i = 0
    while i < n and abs(a[i]) < UMBRAL:
        i += 1
    j = n - 1
    while j > i and abs(a[j]) < UMBRAL:
        j -= 1
    if i >= n:
        falla('edge-tts devolvió una frase sin voz')
    i0 = max(0, i - int(ANTES * SR))
    i1 = min(n, j + int(DESPUES * SR))
    if palabras:   # nunca se corta antes de que termine la última palabra
        i1 = max(i1, min(n, int((palabras[-1]['t1'] + 0.12) * SR)))
    b = a[i0:i1]
    f = int(FUNDIDO * SR)
    for k in range(min(f, len(b))):
        g = k / f
        b[k] = int(b[k] * g)
        b[len(b) - 1 - k] = int(b[len(b) - 1 - k] * g)
    return b, i0 / SR


def lufs(ruta):
    r = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-i', ruta, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    m = re.findall(r'I:\s+(-?\d+(?:\.\d+)?) LUFS', r.stderr)
    return float(m[-1]) if m else None


RETRASO_LIMITADOR = 0.0


def normalizar(ruta):
    """Lleva la frase a -16 LUFS con un limitador que no deja pasar de 0.79 (-2 dBFS, y no retrasa la voz): con ese margen el
    render no tiene que bajar el audio por la voz (si lo baja por un sonido encima, las entradas bajan lo mismo)."""
    global RETRASO_LIMITADOR
    antes = lufs(ruta)
    if antes is None:
        falla('no pude medir el volumen de ' + ruta)
    gan = OBJETIVO_LUFS - antes
    tmp = ruta + '.tmp.wav'
    base = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', ruta]
    fin = ['-ar', str(SR), '-ac', '1', '-c:a', 'pcm_s16le', tmp]
    r = subprocess.run(base + ['-af', f'volume={gan:.2f}dB,alimiter=limit=0.79:level=disabled:latency=1'] + fin, capture_output=True)
    if r.returncode != 0:   # FFmpeg viejo, sin «latency»: el limitador retrasa 5 ms y se descuenta en las palabras
        r = subprocess.run(base + ['-af', f'volume={gan:.2f}dB,alimiter=limit=0.79:level=disabled'] + fin, capture_output=True)
        if r.returncode != 0:
            falla('FFmpeg no pudo normalizar ' + ruta + ': ' + r.stderr.decode('utf-8', 'replace')[-300:])
        RETRASO_LIMITADOR = 0.005
    os.replace(tmp, ruta)
    return round(antes, 1)


def leer_wav(ruta):
    with wave.open(ruta, 'rb') as w:
        n = w.getnframes()
        a = array.array('h')
        a.frombytes(w.readframes(n))
        return a, w.getframerate()


async def hacer_frase(f, voz, rate, pitch):
    mp3, palabras = await sintetizar(f['voz'], voz, rate, pitch)
    if not palabras:
        falla(f'edge-tts no dio el tiempo de cada palabra en la frase {f["id"]}: sin eso las señales no caen en la palabra. Actualiza edge-tts (pip install -U edge-tts).')
    a = a_pcm(mp3)
    b, desp = recortar(a, palabras)
    wav = os.path.join(AQUI, f['id'] + '.wav')
    escribir_wav(wav, b)
    antes = normalizar(wav)
    c, sr = leer_wav(wav)
    pico = max((abs(x) for x in c), default=0) / 32767
    pal = [{'t0': round(max(0.0, p['t0'] - desp + RETRASO_LIMITADOR), 3), 't1': round(max(0.0, p['t1'] - desp + RETRASO_LIMITADOR), 3), 'text': p['text']} for p in palabras]
    return {'dur': round(len(c) / sr, 3), 'words': pal, 'texto': f['voz'], 'lufs_antes': antes, 'pico': round(pico, 3)}


async def main():
    args = sys.argv[1:]
    todo = '--todo' in args
    ids = [a for a in args if not a.startswith('--')]
    solo = set(ids[0].split(',')) if ids else None
    proyecto = leer_proyecto()
    voz, rate, pitch = voz_del_proyecto(proyecto)
    ruta_frases = os.path.join(AQUI, 'frases.json')
    if not os.path.exists(ruta_frases):
        falla('falta voz/frases.json: corre «node hacer.mjs voz» (lo escribe a partir de guion.mjs).')
    with open(ruta_frases, encoding='utf-8') as fh:
        frases = json.load(fh)
    ruta_json = os.path.join(AQUI, 'voz.json')
    viejo = {}
    if os.path.exists(ruta_json):
        with open(ruta_json, encoding='utf-8') as fh:
            viejo = json.load(fh)
    lineas = dict(viejo.get('lineas') or {})
    print(f'voz {voz}, velocidad {rate}, tono {pitch}', flush=True)
    hechas = saltadas = 0
    for f in frases:
        if solo and f['id'] not in solo:
            continue
        k = clave(voz, rate, pitch, f['voz'])
        wav = os.path.join(AQUI, f['id'] + '.wav')
        previa = lineas.get(f['id'])
        if not todo and not solo and previa and previa.get('clave') == k and os.path.exists(wav):
            saltadas += 1
            continue
        L = await hacer_frase(f, voz, rate, pitch)
        L['clave'] = k
        lineas[f['id']] = L
        hechas += 1
        print(f"{f['id']:<14} {L['dur']:6.2f} s  ({L['lufs_antes']} LUFS -> {OBJETIVO_LUFS:.0f})  {f['voz'][:60]}", flush=True)
    # frases que ya no están en el guion: se quitan de voz.json y se borra su audio
    vigentes = {f['id'] for f in frases}
    for k in [k for k in lineas if k not in vigentes]:
        del lineas[k]
        w = os.path.join(AQUI, k + '.wav')
        if os.path.exists(w):
            os.remove(w)
        print('quitada la frase vieja', k, flush=True)
    faltan = [f['id'] for f in frases if f['id'] not in lineas]
    # todas las frases deben salir con la MISMA voz y el texto vigente: una frase vieja mezclada se oiría distinta
    viejas = [f['id'] for f in frases if f['id'] in lineas and lineas[f['id']].get('clave') != clave(voz, rate, pitch, f['voz'])]
    out = {'voz': voz, 'rate': rate, 'pitch': pitch, 'lineas': lineas, 'total': round(sum(x['dur'] for x in lineas.values()), 2)}
    with open(ruta_json, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(f'listo: {hechas} generadas, {saltadas} sin cambios; suma de frases {out["total"]} s', flush=True)
    if faltan:
        falla('faltan frases sin voz: ' + ', '.join(faltan))
    if viejas:
        falla('estas frases tienen otra voz, otra velocidad o un texto viejo: ' + ', '.join(viejas) + '. Corre «python voz/voz.py» sin ids para rehacerlas.')


if __name__ == '__main__':
    asyncio.run(main())
