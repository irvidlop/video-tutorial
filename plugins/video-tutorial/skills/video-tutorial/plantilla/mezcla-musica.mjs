// Arma assets/audio/musica.wav: la música de fondo, larga y pareja, a partir de proyecto.json → musica.
//   "musica": null                         sin música (no hace nada)
//   "musica": "musica/tema.mp3"            una pista (si no alcanza, se repite con un fundido)
//   "musica": ["musica/a.mp3", "musica/b.mp3"]   varias, unidas con fundidos de 6 s (y repetidas si no alcanzan)
// Las rutas son relativas a la carpeta del proyecto. Usa solo música que la persona tenga permiso de usar.
// La pista sale a 48 kHz, estéreo, a -16 LUFS (lo mismo que la voz): así el volumen de la música en el video no depende del archivo.
// Es un archivo derivado: no va al repositorio; se rehace con este script («node hacer.mjs construir» lo corre).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
const falla = m => { console.error('FALLA música: ' + m); process.exit(1); };
const P = JSON.parse(fs.readFileSync('proyecto.json', 'utf8'));
if (!P.musica) { console.log('sin música (proyecto.json → musica: null)'); process.exit(0); }
const pistas = (Array.isArray(P.musica) ? P.musica : [P.musica]).map(String);
for (const f of pistas) if (!fs.existsSync(f)) falla(`no encuentro la pista «${f}» (proyecto.json → musica, ruta relativa a la carpeta del proyecto)`);
const dura = f => { const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }); const d = +r.stdout.trim(); if (!d) falla('no pude leer la duración de ' + f); return d; };

// cuánto hace falta: la entrada más el cuerpo, con margen (el cuerpo real sale de la voz)
const { tiempos } = await import('./tiempos.mjs');
const { duracionEntrada } = await import('./entradas.mjs');
const T = tiempos();
const necesito = duracionEntrada() + Object.values(T).reduce((s, c) => s + c.total, 0) + 30;
const FUNDIDO = 6;
const lista = [];
let largo = 0;
for (let i = 0; largo < necesito && i < 200; i++) { const f = pistas[i % pistas.length]; const d = dura(f); lista.push(f); largo += lista.length > 1 ? d - FUNDIDO : d; }
if (largo < necesito) falla('las pistas son demasiado cortas');

fs.mkdirSync('assets/audio', { recursive: true });
const tmp = 'assets/audio/musica.sin-nivel.wav';
const entradas = lista.flatMap(f => ['-i', f]);
let filtro = lista.length === 1 ? '[0:a]anull[m]' : '';
if (lista.length > 1) { let prev = '[0:a]'; for (let i = 1; i < lista.length; i++) { const sal = i === lista.length - 1 ? '[m]' : `[x${i}]`; filtro += `${prev}[${i}:a]acrossfade=d=${FUNDIDO}:c1=tri:c2=tri${sal};`; prev = sal; } filtro = filtro.replace(/;$/, ''); }
let r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...entradas, '-filter_complex', filtro + ';[m]aresample=48000[o]', '-map', '[o]', '-ac', '2', '-c:a', 'pcm_s16le', tmp], { encoding: 'utf8' });
if (r.status !== 0) falla('FFmpeg no pudo unir las pistas: ' + (r.stderr || '').slice(-500));
// a -16 LUFS con un limitador (sin retrasar el audio)
r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
const lufs = +((r.stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop() || '').replace(/[^-\d.]/g, '');
if (!Number.isFinite(lufs)) falla('no pude medir el volumen de la música');
const gan = (-16 - lufs).toFixed(2);
const lim = ['volume=' + gan + 'dB,alimiter=limit=0.89:level=disabled:latency=1', 'volume=' + gan + 'dB,alimiter=limit=0.89:level=disabled'];
let ok = false;
for (const af of lim) { r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-af', af, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', 'assets/audio/musica.wav'], { encoding: 'utf8' }); if (r.status === 0) { ok = true; break; } }
fs.rmSync(tmp, { force: true });
if (!ok) falla('FFmpeg no pudo nivelar la música: ' + (r.stderr || '').slice(-400));
console.log(`assets/audio/musica.wav: ${lista.length} tramo(s), ${largo.toFixed(0)} s (hacen falta unos ${necesito.toFixed(0)}), de ${lufs.toFixed(1)} a -16 LUFS`);
