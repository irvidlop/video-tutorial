// Versiones ligeras para mandar por correo: out/ligero/<nombreArchivo>-<versión>.mp4, unos 40 MB por cada 4 minutos.
// Un video de 4 a 5 minutos en 1080p pesa de 100 a 170 MB: sirve para Teams, OneDrive o una carpeta compartida, no para un correo.
// Esta versión baja a 1280 x 720 y calcula la tasa para llegar al tamaño (dos pasadas de x264: la primera mide, la segunda reparte).
// Uso: node ligero.mjs [versión ...]      (sin versiones: todas)      --mb-por-minuto=10 cambia el tamaño buscado
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const P = JSON.parse(fs.readFileSync('proyecto.json', 'utf8'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
const falla = m => { console.error('FALLA ligero: ' + m); process.exit(1); };
const args = process.argv.slice(2);
const mbMin = Number((args.find(a => a.startsWith('--mb-por-minuto=')) || '=10').split('=')[1]) || 10;
const todas = (P.versiones || []).map(v => v.id);
const versiones = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : todas;
const AUDIO_KBPS = 96;
fs.mkdirSync('out/ligero', { recursive: true });
const tmp = path.join('tmp', 'ligero'); fs.mkdirSync(tmp, { recursive: true });
const nulo = process.platform === 'win32' ? 'NUL' : '/dev/null';
for (const v of versiones) {
  if (!todas.includes(v)) falla(`versión desconocida «${v}»`);
  const f = `out/${P.nombreArchivo}-${v}.mp4`;
  if (!fs.existsSync(f)) falla(`falta ${f}: corre «node hacer.mjs unir».`);
  const dur = +spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
  const totalKbps = (mbMin * 8 * 1024) / 60;               // lo que cabe por segundo
  const videoKbps = Math.max(300, Math.floor(totalKbps - AUDIO_KBPS - 20));
  const salida = `out/ligero/${P.nombreArchivo}-${v}.mp4`;
  const log = path.join(tmp, v);
  const comun = ['-hide_banner', '-loglevel', 'error', '-y', '-i', f, '-vf', 'scale=1280:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-b:v', `${videoKbps}k`, '-maxrate', `${Math.round(videoKbps * 1.6)}k`, '-bufsize', `${videoKbps * 3}k`, '-pix_fmt', 'yuv420p', '-passlogfile', log];
  let r = spawnSync(FFMPEG, [...comun, '-pass', '1', '-an', '-f', 'mp4', nulo], { encoding: 'utf8' });
  if (r.status !== 0) falla('primera pasada: ' + (r.stderr || '').slice(-400));
  r = spawnSync(FFMPEG, [...comun, '-pass', '2', '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-movflags', '+faststart', salida], { encoding: 'utf8' });
  if (r.status !== 0) falla('segunda pasada: ' + (r.stderr || '').slice(-400));
  const mb = fs.statSync(salida).size / 1024 ** 2, meta = mbMin * dur / 60;
  console.log(`${salida}: ${mb.toFixed(1)} MB (se buscaban unos ${meta.toFixed(1)} MB para ${(dur / 60).toFixed(1)} min), 1280 x 720`);
  if (mb > meta * 1.2) console.log(`AVISO ${v}: salió más pesado de lo buscado`);
}
fs.rmSync(tmp, { recursive: true, force: true });
