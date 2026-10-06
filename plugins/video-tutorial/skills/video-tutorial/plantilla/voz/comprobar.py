"""¿La voz dice lo que dice el guion? Transcribe cada frase con Whisper (en la computadora, sin internet) y la compara.

Uso:   python voz/comprobar.py                    todas las frases de voz/frases.json
       python voz/comprobar.py 1.2,i-ventas-1     solo esas
       python voz/comprobar.py --modelo medium    modelo más grande (más exacto y más lento; small por omisión)
Necesita faster-whisper (pip install faster-whisper). El modelo se baja la primera vez (small: unos 500 MB).
Si no está instalado, lo dice y termina sin error: comprobar la voz es opcional.

No sustituye a escuchar el video. Sirve para cazar frases que la voz come, cambia o pronuncia mal:
un nombre propio raro suele salir mal y solo se nota así. Whisper también se equivoca con la voz rápida
y con las siglas, así que una frase marcada se revisa, no se da por mala.
Deja el resultado en voz/comprobacion.json.
"""
import json
import os
import re
import sys
import time
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

UNIDADES = 'cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte'.split()
DECENAS = {30: 'treinta', 40: 'cuarenta', 50: 'cincuenta', 60: 'sesenta', 70: 'setenta', 80: 'ochenta', 90: 'noventa'}
CENTENAS = {100: 'cien', 200: 'doscientos', 300: 'trescientos', 400: 'cuatrocientos', 500: 'quinientos', 600: 'seiscientos', 700: 'setecientos', 800: 'ochocientos', 900: 'novecientos'}


def en_palabras(n):
    """Número a palabras (0 a 9999), para comparar «5» con «cinco»."""
    if n <= 20:
        return UNIDADES[n]
    if n < 30:
        return 'veinti' + UNIDADES[n - 20]
    if n < 100:
        d, u = divmod(n, 10)
        return DECENAS[d * 10] + ('' if u == 0 else ' y ' + UNIDADES[u])
    if n < 1000:
        c, r = divmod(n, 100)
        if r == 0:
            return CENTENAS[c * 100]
        return ('ciento' if c == 1 else CENTENAS[c * 100]) + ' ' + en_palabras(r)
    if n < 10000:
        m, r = divmod(n, 1000)
        return ('mil' if m == 1 else en_palabras(m) + ' mil') + ('' if r == 0 else ' ' + en_palabras(r))
    return str(n)


def norm(t):
    t = unicodedata.normalize('NFD', t.lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    t = re.sub(r'\d+', lambda m: ' ' + en_palabras(int(m.group())) + ' ', t)
    t = re.sub(r'[^a-z0-9n ]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def wer(ref, hyp):
    """Error de palabras: cuántas sobran, faltan o cambian, entre las palabras del guion."""
    r, h = ref.split(), hyp.split()
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / max(1, len(r))


def main():
    args = sys.argv[1:]
    modelo = 'small'
    if '--modelo' in args:
        modelo = args[args.index('--modelo') + 1]
    ids = [a for a in args if not a.startswith('--') and a != modelo]
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print('Whisper no está instalado (pip install faster-whisper): la voz no se comprobó. Se sigue sin esta revisión.')
        return 0
    with open(os.path.join(AQUI, 'frases.json'), encoding='utf-8') as fh:
        frases = json.load(fh)
    if ids:
        solo = set(ids[0].split(','))
        frases = [f for f in frases if f['id'] in solo]
    t0 = time.time()
    model = WhisperModel(modelo, device='cpu', compute_type='int8')
    print(f'modelo {modelo} cargado en {time.time() - t0:.1f} s', flush=True)
    filas = []
    for f in frases:
        wav = os.path.join(AQUI, f['id'] + '.wav')
        if not os.path.exists(wav):
            print(f"{f['id']:<14} sin audio: corre «node hacer.mjs voz»", flush=True)
            continue
        seg, _ = model.transcribe(wav, language='es', beam_size=1, condition_on_previous_text=False)
        oido = ' '.join(s.text.strip() for s in seg)
        w = wer(norm(f['voz']), norm(oido))
        filas.append({'id': f['id'], 'error': round(w, 3), 'guion': f['voz'], 'whisper': oido})
        print(f"{f['id']:<14} error {w:5.0%} | {oido}", flush=True)
    malas = [x for x in filas if x['error'] > 0.15]
    medio = sum(x['error'] for x in filas) / max(1, len(filas))
    with open(os.path.join(AQUI, 'comprobacion.json'), 'w', encoding='utf-8') as fh:
        json.dump({'modelo': modelo, 'errorMedio': round(medio, 3), 'frases': filas}, fh, ensure_ascii=False, indent=1)
    print(f'\n{len(filas)} frases, error medio de palabras {medio:.1%}, {len(malas)} arriba de 15%')
    for x in malas:
        print(f"  {x['id']} ({x['error']:.0%})\n    guion  : {x['guion']}\n    whisper: {x['whisper']}")
    if malas:
        print('Revisa esas frases: si un nombre o una sigla sale mal, cambia cómo se escribe en «voz» (guion.mjs) y vuelve a generar.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
