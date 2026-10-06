// Parte la música en dos pedazos EXACTOS (WAV a 48 kHz) para que corra continua a través del empalme entrada + cuerpo:
//   assets/audio/musica-entrada.wav = [0, D)       la usan las entradas (el arranque de la pista)
//   assets/audio/musica-cuerpo.wav  = [D, final)   la usa el cuerpo: sigue desde ese mismo segundo
// D es la duración común de las entradas (entradas.mjs). Los dos salen de la MISMA lectura de assets/audio/musica.wav, cortados
// en una muestra entera: juntos son la pista original al bit. Ya van a 48 kHz porque así mezcla HyperFrames; si no, cada
// composición remuestrearía por su cuenta y el empalme podría sonar.
// Deja assets/audio/musica.json con el corte, para que entradas y unir comprueben que nadie cambió D después.
// Uso: node preparar-musica.mjs     (sin música no hace nada)
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
if (!P.musica) { console.log('sin música: no hay nada que partir'); process.exit(0); }
if (!fs.existsSync('assets/audio/musica.wav')) falla('falta assets/audio/musica.wav: corre «node mezcla-musica.mjs».');
const { duracionEntrada } = await import('./entradas.mjs');
const D = duracionEntrada();
const SR = 48000, M = Math.round(D * SR);
const corta = (salida, filtro) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'assets/audio/musica.wav', '-af', `aresample=${SR},${filtro},asetpts=N/SR/TB`, '-ac', '2', '-c:a', 'pcm_s16le', salida], { encoding: 'utf8' });
  if (r.status !== 0) falla(r.stderr);
};
corta('assets/audio/musica-entrada.wav', `atrim=end_sample=${M}`);
corta('assets/audio/musica-cuerpo.wav', `atrim=start_sample=${M}`);
const muestras = f => { const r = spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'a:0', '-count_packets', '-show_entries', 'stream=duration_ts', '-of', 'csv=p=0', f], { encoding: 'utf8' }); return +r.stdout.trim(); };
const me = muestras('assets/audio/musica-entrada.wav');
if (me !== M) falla(`el pedazo de la entrada tiene ${me} muestras y debían ser ${M}`);
fs.writeFileSync('assets/audio/musica.json', JSON.stringify({ introDur: D, muestraCorte: M, sr: SR }, null, 1));
console.log(`música partida en la muestra ${M} (${D} s a ${SR} Hz): musica-entrada.wav y musica-cuerpo.wav`);
