// Une cada ENTRADA con el CUERPO (ya renderizados) y deja los MP4 finales: out/<nombreArchivo>-<versión>.mp4.
//   entrada: tmp/partes/entrada-<versión>.mp4      cuerpo: tmp/partes/cuerpo.mp4
// Uso: node unir.mjs [versión ...]      (sin versiones: todas las de proyecto.json)
//
// Video: se concatena SIN recodificar (los dos salen del mismo render con los mismos parámetros). Si no coinciden, se recodifica y se avisa.
// Audio: cada parte se pasa a PCM 48 kHz, se deja de la duración EXACTA de su video (a la muestra) y se juntan en PCM; solo después
//        se codifica UNA vez a AAC. Concatenar los AAC directamente dejaría el retardo del codificador (unos 20 ms) en el empalme: un clic.
//        La música es la misma pista partida en dos (preparar-musica.mjs): la entrada usa [0, D) y el cuerpo sigue desde ahí.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const { duracionEntrada } = await import('./entradas.mjs');
const P = JSON.parse(fs.readFileSync('proyecto.json', 'utf8'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
const SR = 48000, FPS = Number(P.video?.fps || 30);
const falla = m => { console.error('FALLA unir: ' + m); process.exit(1); };
const run = (exe, a) => { const r = spawnSync(exe, a, { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) falla(`${path.basename(exe)} ${a.join(' ').slice(0, 240)}\n${(r.stderr || '').slice(-1200)}`); return r.stdout; };
const probe = f => JSON.parse(run(FFPROBE, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,profile,level,width,height,pix_fmt,r_frame_rate,time_base,nb_read_frames,color_range,color_space', '-of', 'json', f])).streams[0];

const todas = (P.versiones || []).map(v => v.id);
const versiones = process.argv.slice(2).length ? process.argv.slice(2) : todas;
for (const v of versiones) if (!todas.includes(v)) falla(`versión desconocida «${v}» (hay: ${todas.join(', ')})`);
const cuerpo = 'tmp/partes/cuerpo.mp4';
if (!fs.existsSync(cuerpo)) falla(`falta ${cuerpo}: corre «node hacer.mjs render».`);
const D = duracionEntrada();
if (P.musica) {
  const corte = fs.existsSync('assets/audio/musica.json') ? JSON.parse(fs.readFileSync('assets/audio/musica.json', 'utf8')) : null;
  const C = fs.existsSync('tmp/partes/cuerpo.json') ? JSON.parse(fs.readFileSync('tmp/partes/cuerpo.json', 'utf8')) : null;
  if (!corte || Math.abs(corte.introDur - D) > 1e-6 || !C || Math.abs((C.introDur ?? -1) - D) > 1e-6) falla(`la música y el cuerpo se prepararon para entradas de ${C?.introDur ?? corte?.introDur ?? '?'} s y ahora duran ${D} s: corre «node hacer.mjs construir render entradas unir».`);
}
fs.mkdirSync('out', { recursive: true });
fs.rmSync('tmp/union', { recursive: true, force: true });
fs.mkdirSync('tmp/union', { recursive: true });

const pb = probe(cuerpo);
const cuadrosCuerpo = +pb.nb_read_frames;
const cuadrosEntrada = Math.round(D * FPS);
if (Math.abs(cuadrosEntrada - D * FPS) > 1e-6) falla(`la entrada dura ${D} s, que no da cuadros enteros a ${FPS} fps`);
/** Audio de un MP4 a PCM 48 kHz estéreo, exactamente de `cuadros` cuadros de largo (rellena o recorta las últimas muestras). */
const pcm = (mp4, cuadros, salida) => {
  const muestras = Math.round(cuadros / FPS * SR);
  run(FFMPEG, ['-y', '-loglevel', 'error', '-i', mp4, '-vn', '-af', `aresample=${SR},apad=whole_len=${muestras},atrim=end_sample=${muestras}`, '-ac', '2', '-c:a', 'pcm_s16le', '-f', 'wav', salida]);
  return muestras;
};
const mCuerpo = pcm(cuerpo, cuadrosCuerpo, 'tmp/union/cuerpo.wav');
console.log(`cuerpo: ${cuadrosCuerpo} cuadros (${(cuadrosCuerpo / FPS).toFixed(3)} s), audio ${mCuerpo} muestras`);

for (const v of versiones) {
  const ent = `tmp/partes/entrada-${v}.mp4`;
  if (!fs.existsSync(ent)) falla(`falta ${ent}: corre «node hacer.mjs entradas --version=${v}».`);
  const info = fs.existsSync(`tmp/partes/entrada-${v}.json`) ? JSON.parse(fs.readFileSync(`tmp/partes/entrada-${v}.json`, 'utf8')) : null;
  if (info && Math.abs(info.D - D) > 1e-6) falla(`la entrada de «${v}» se hizo de ${info.D} s y ahora las entradas duran ${D} s: vuelve a correr «node hacer.mjs entradas» (todas).`);
  const pe = probe(ent);
  if (+pe.nb_read_frames < cuadrosEntrada) falla(`la entrada «${v}» tiene ${pe.nb_read_frames} cuadros y se esperaban ${cuadrosEntrada}`);
  const mismos = ['codec_name', 'profile', 'level', 'width', 'height', 'pix_fmt', 'r_frame_rate', 'time_base', 'color_range', 'color_space'].every(k => pe[k] === pb[k]);
  pcm(ent, cuadrosEntrada, `tmp/union/entrada-${v}.wav`);
  // Si el render de la entrada tuvo que bajar su audio (para quedar bajo -1 dBTP) más que el del cuerpo, la voz sonaría distinta a los
  // dos lados: el cuerpo de ESTA versión baja lo mismo. Bajar es lo seguro: subir la entrada la haría saturar.
  let cuerpoV = 'cuerpo.wav';
  const extra = info?.audioBajadoDb || 0;
  if (Math.abs(extra) > 0.05) {
    cuerpoV = `cuerpo-${v}.wav`;
    run(FFMPEG, ['-y', '-loglevel', 'error', '-i', 'tmp/union/cuerpo.wav', '-af', `volume=${(-extra).toFixed(2)}dB`, '-c:a', 'pcm_s16le', `tmp/union/${cuerpoV}`]);
    console.log(`${v}: el render de su entrada bajó el audio ${extra} dB; el cuerpo de esta versión baja lo mismo para que la voz suene igual a los dos lados`);
  }
  fs.writeFileSync(`tmp/union/audio-${v}.txt`, `file 'entrada-${v}.wav'\nfile '${cuerpoV}'\n`);
  run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `tmp/union/audio-${v}.txt`, '-c:a', 'pcm_s16le', `tmp/union/junto-${v}.wav`]);
  run(FFMPEG, ['-y', '-loglevel', 'error', '-i', `tmp/union/junto-${v}.wav`, '-c:a', 'aac', '-b:a', '192k', `tmp/union/junto-${v}.m4a`]);
  const vid = `tmp/union/video-${v}.mp4`;
  if (mismos) {
    run(FFMPEG, ['-y', '-loglevel', 'error', '-i', ent, '-an', '-frames:v', String(cuadrosEntrada), '-c:v', 'copy', `tmp/union/entrada-${v}-video.mp4`]);
    fs.writeFileSync(`tmp/union/video-${v}.txt`, `file 'entrada-${v}-video.mp4'\nfile '../partes/cuerpo.mp4'\n`);
    run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `tmp/union/video-${v}.txt`, '-an', '-c:v', 'copy', vid]);
  } else {
    console.log(`AVISO ${v}: la entrada y el cuerpo no salieron con los mismos parámetros de video: se recodifica la unión (más lento y pierde un poco de calidad)`);
    run(FFMPEG, ['-y', '-loglevel', 'error', '-i', ent, '-i', cuerpo, '-filter_complex', `[0:v]trim=end_frame=${cuadrosEntrada},setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]`, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), vid]);
  }
  const salida = `out/${P.nombreArchivo}-${v}.mp4`;
  run(FFMPEG, ['-y', '-loglevel', 'error', '-i', vid, '-i', `tmp/union/junto-${v}.m4a`, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', salida]);
  const d = +run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', salida]).trim();
  console.log(`${salida}: ${d.toFixed(3)} s (esperado ${((cuadrosEntrada + cuadrosCuerpo) / FPS).toFixed(3)}), ${(fs.statSync(salida).size / 1024 ** 2).toFixed(1)} MB, video ${mismos ? 'sin recodificar' : 'recodificado'}`);
  // los intermedios de esta versión (cientos de MB en un video largo) ya no hacen falta
  for (const f of fs.readdirSync('tmp/union')) if (f !== 'cuerpo.wav' && (f.includes(`-${v}.`) || f.includes(`-${v}-`))) fs.rmSync(`tmp/union/${f}`);
}
fs.rmSync('tmp/union', { recursive: true, force: true });
