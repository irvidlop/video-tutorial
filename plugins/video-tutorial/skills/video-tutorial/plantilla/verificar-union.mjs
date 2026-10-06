// Verifica los MP4 finales (out/<nombreArchivo>-<versión>.mp4) midiendo, no mirando:
//  1. duración y cuadros exactos (entrada + cuerpo), y audio y video del mismo largo
//  2. empalme de audio: sin clic (salto de muestra contra lo normal alrededor), sin hueco, y con música: sin escalón de nivel
//     (se compara con el escalón que ya tiene la pista sola en ese punto)
//  3. empalme de video: sin cuadro negro, y el último cuadro de la entrada casi igual al primero del cuerpo (SSIM)
//  4. volumen: integrado cerca de -15 LUFS, pico real bajo -1 dBTP, la voz igual de fuerte a los dos lados del empalme
//     y, con música, la música bien por debajo de la voz
//  5. una hoja de cuadros por versión para revisar a ojo: out/hojas/hoja-<versión>.png (inicio, empalme, cada capítulo, contacto, cierre)
// Uso: node verificar-union.mjs [versión ...]       (sin versiones: todas). Escribe tmp/verificacion-union.json
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lanzarChrome } from './grabacion/lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const { duracionEntrada } = await import('./entradas.mjs');
const { CAPITULOS } = await import('./guion.mjs');
const { tema } = await import('./tema.mjs');
const P = JSON.parse(fs.readFileSync('proyecto.json', 'utf8'));
const TEMA = tema(P);
const R = fs.existsSync('tmp/plan-resumen.json') ? JSON.parse(fs.readFileSync('tmp/plan-resumen.json', 'utf8')) : null;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
const SR = 48000, FPS = Number(P.video?.fps || 30);
const run = (exe, a, o = {}) => { const r = spawnSync(exe, a, { encoding: o.bin ? 'buffer' : 'utf8', maxBuffer: 1 << 29 }); if (r.status !== 0 && !o.tolerar) { console.error('FALLA al correr', path.basename(exe), a.join(' ').slice(0, 200), '\n', String(r.stderr).slice(-600)); process.exit(1); } return o.bin ? r.stdout : (r.stdout + (o.err ? r.stderr : '')); };
const todas = (P.versiones || []).map(v => v.id);
const versiones = process.argv.slice(2).length ? process.argv.slice(2) : todas;
const D = duracionEntrada();
if (!fs.existsSync('tmp/partes/cuerpo.mp4')) { console.error('FALLA: falta tmp/partes/cuerpo.mp4: corre «node hacer.mjs render».'); process.exit(1); }
const cuadrosCuerpo = +JSON.parse(run(FFPROBE, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'json', 'tmp/partes/cuerpo.mp4'])).streams[0].nb_read_frames;
const cuadrosEsperados = Math.round(D * FPS) + cuadrosCuerpo;
const esperado = +(cuadrosEsperados / FPS).toFixed(3);
const res = { D, esperado, cuadrosEsperados, versiones: {} };
let mal = 0;
const falla = (v, m) => { console.log(`  FALLA ${v}: ${m}`); res.versiones[v].fallas.push(m); mal++; };
const aviso = (v, m) => { console.log(`  AVISO ${v}: ${m}`); res.versiones[v].avisos.push(m); };

const pcm = (f, ini, dur) => { const b = run(FFMPEG, ['-v', 'error', '-ss', String(Math.max(0, ini)), '-t', String(dur), '-i', f, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { bin: true }); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
const pct = (arr, p) => { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0; };
const rms = (a, i0, i1) => { let q = 0; for (let i = i0; i < i1; i++) q += a[i] * a[i]; return Math.sqrt(q / Math.max(1, i1 - i0)); };
const dB = x => 20 * Math.log10(x + 1e-9);
/** Volumen integrado (LUFS) de un tramo. */
function lufs(f, ini, dur) {
  const t = run(FFMPEG, ['-v', 'info', '-ss', String(Math.max(0, ini)), '-t', String(dur), '-i', f, '-vn', '-af', 'ebur128', '-f', 'null', '-'], { err: true, tolerar: true });
  const m = t.match(/I:\s+(-?[\d.]+) LUFS/g); return m ? +m.at(-1).match(/-?[\d.]+/)[0] : null;
}

const browser = await lanzarChrome();   // el de la variable CHROME, el Chrome instalado o Edge
for (const v of versiones) {
  const f = `out/${P.nombreArchivo}-${v}.mp4`;
  const V = res.versiones[v] = { archivo: f, fallas: [], avisos: [] };
  console.log(f);
  if (!fs.existsSync(f)) { falla(v, `no existe ${f}: corre «node hacer.mjs unir»`); continue; }
  // 1. duración y cuadros
  const dur = +run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim();
  const vs = JSON.parse(run(FFPROBE, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,duration,r_frame_rate', '-of', 'json', f])).streams[0];
  const da = +run(FFPROBE, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', f]).trim();
  V.duracion = { archivo: dur, video: +vs.duration, audio: da, cuadros: +vs.nb_read_frames, esperado, cuadrosEsperados };
  if (+vs.nb_read_frames !== cuadrosEsperados) falla(v, `tiene ${vs.nb_read_frames} cuadros y debían ser ${cuadrosEsperados}`);
  if (Math.abs(dur - esperado) > 1.5 / FPS) falla(v, `dura ${dur} s y debía durar ${esperado} s`);
  if (Math.abs(+vs.duration - da) > 0.05) falla(v, `el audio (${da} s) y el video (${vs.duration} s) no miden lo mismo`);
  // 2. empalme de audio
  const J = D, Wv = 0.6;
  const x = pcm(f, J - Wv, 2 * Wv), c = Math.round(Wv * SR), cerca = Math.round(0.004 * SR);
  let maxCerca = 0; const resto = [];
  for (let i = 1; i < x.length; i++) { const s = Math.abs(x[i] - x[i - 1]); if (Math.abs(i - c) <= cerca) maxCerca = Math.max(maxCerca, s); else resto.push(s); }
  const p999 = pct(resto, 0.999), maxResto = resto.length ? Math.max(...resto) : 0;
  V.empalmeAudio = { saltoEnElEmpalme: +maxCerca.toFixed(5), saltoNormal: +p999.toFixed(5), saltoMaxAlrededor: +maxResto.toFixed(5) };
  if (maxCerca > Math.max(2 * p999, 1.5 * maxResto) && maxCerca > 0.003) falla(v, `salto de audio en el empalme (${maxCerca.toFixed(4)} contra ${p999.toFixed(4)} de lo normal): se oiría un clic`);
  if (P.musica) {
    const ven = (a, d0, d1) => rms(a, Math.round((Wv + d0) * SR), Math.round((Wv + d1) * SR));
    const paso = dB(ven(x, 0.05, 0.40)) - dB(ven(x, -0.40, -0.05));
    let pasoOriginal = null;
    if (fs.existsSync('assets/audio/musica.wav')) { const o = pcm('assets/audio/musica.wav', J - Wv, 2 * Wv); pasoOriginal = dB(ven(o, 0.05, 0.40)) - dB(ven(o, -0.40, -0.05)); }
    let minimo = 1e9; for (let k = -10; k < 10; k++) minimo = Math.min(minimo, rms(x, c + k * 480, c + (k + 1) * 480));
    Object.assign(V.empalmeAudio, { escalonDB: +paso.toFixed(2), escalonDeLaPistaSolaDB: pasoOriginal != null ? +pasoOriginal.toFixed(2) : null, rmsMinimo10ms: +minimo.toFixed(5) });
    if (pasoOriginal != null && Math.abs(paso - pasoOriginal) > 2.5) falla(v, `la música cambia ${paso.toFixed(1)} dB en el empalme y la pista sola ${pasoOriginal.toFixed(1)} dB: se oiría un escalón`);
    if (minimo < 1e-4) falla(v, 'hay un hueco de silencio en el empalme (la música se corta)');
  }
  // 3. empalme de video
  const negro = run(FFMPEG, ['-v', 'info', '-ss', String(Math.max(0, J - 1)), '-t', '2', '-i', f, '-vf', 'blackdetect=d=0.03:pix_th=0.12', '-an', '-f', 'null', '-'], { err: true, tolerar: true });
  V.cuadroNegro = /black_start/.test(negro);
  if (V.cuadroNegro) falla(v, 'hay un cuadro negro cerca del empalme');
  const dirH = path.join('tmp', 'hojas', v); fs.rmSync(dirH, { recursive: true, force: true }); fs.mkdirSync(dirH, { recursive: true });
  const cuadro = (t, nombre, ancho = 0) => { run(FFMPEG, ['-y', '-v', 'error', '-ss', t.toFixed(3), '-i', f, '-frames:v', '1', ...(ancho ? ['-vf', `scale=${ancho}:-2`] : []), path.join(dirH, nombre)]); return path.join(dirH, nombre); };
  const a1 = cuadro(J - 1 / FPS, 'empalme-antes.png'), a2 = cuadro(J, 'empalme-despues.png');
  const ssim = run(FFMPEG, ['-v', 'info', '-i', a1, '-i', a2, '-lavfi', 'ssim', '-f', 'null', '-'], { err: true, tolerar: true }).match(/All:([0-9.]+)/);
  V.ssimEmpalme = ssim ? +ssim[1] : null;
  if (V.ssimEmpalme != null && V.ssimEmpalme < 0.9) falla(v, `el último cuadro de la entrada y el primero del cuerpo se parecen poco (SSIM ${V.ssimEmpalme}): el empalme se vería`);
  // 4. volumen
  const vol = run(FFMPEG, ['-v', 'info', '-i', f, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { err: true, tolerar: true });
  const il = vol.match(/I:\s+(-?[\d.]+) LUFS/g), pk = vol.match(/Peak:\s+(-?[\d.]+) dBFS/g);
  V.volumen = { integradoLUFS: il ? +il.at(-1).match(/-?[\d.]+/)[0] : null, picoRealDBTP: pk ? +pk.at(-1).match(/-?[\d.]+/)[0] : null };
  if (V.volumen.integradoLUFS != null && (V.volumen.integradoLUFS < -19 || V.volumen.integradoLUFS > -11)) falla(v, `el volumen integrado es ${V.volumen.integradoLUFS} LUFS (se busca alrededor de -15)`);
  else if (V.volumen.integradoLUFS != null && Math.abs(V.volumen.integradoLUFS + 15) > 1.5) aviso(v, `el volumen integrado es ${V.volumen.integradoLUFS} LUFS (se busca alrededor de -15)`);
  if (V.volumen.picoRealDBTP != null && V.volumen.picoRealDBTP > -0.5) falla(v, `el pico real (${V.volumen.picoRealDBTP} dBTP) está a punto de saturar`);
  else if (V.volumen.picoRealDBTP != null && V.volumen.picoRealDBTP > -1) aviso(v, `el pico real (${V.volumen.picoRealDBTP} dBTP) pasa de -1`);
  // la voz igual de fuerte a los dos lados: última frase de la entrada contra la primera del cuerpo
  const resE = fs.existsSync(`tmp/entradas/${v}/resumen.json`) ? JSON.parse(fs.readFileSync(`tmp/entradas/${v}/resumen.json`, 'utf8')) : null;
  if (resE && R) {
    const ve = resE.voz.at(-1), vb = R.voz[0];
    const le = lufs(f, ve.t0 + 0.05, ve.t1 - ve.t0 - 0.1), lb = lufs(f, D + vb.t0 + 0.05, vb.t1 - vb.t0 - 0.1);
    V.vozAmbosLados = { entradaLUFS: le, cuerpoLUFS: lb };
    if (le != null && lb != null && Math.abs(le - lb) > 2) falla(v, `la voz suena ${Math.abs(le - lb).toFixed(1)} dB distinta a los dos lados del empalme (${le} y ${lb} LUFS)`);
    if (P.musica && vb.t0 > 0.5) {
      // música sola al arrancar el cuerpo (antes de la primera frase) contra la voz de esa primera frase
      const musica = dB(rms(pcm(f, D + 0.1, Math.min(0.6, vb.t0 - 0.15)), 0, Math.round(Math.min(0.6, vb.t0 - 0.15) * SR)));
      const voz = dB(rms(pcm(f, D + vb.t0, vb.t1 - vb.t0), 0, Math.round((vb.t1 - vb.t0) * SR)));
      V.musicaBajoLaVoz = +(voz - musica).toFixed(1);
      if (voz - musica < 10) falla(v, `la música queda solo ${(voz - musica).toFixed(1)} dB bajo la voz (se buscan unos 17)`);
    }
  }
  // 5. hoja de cuadros: inicio, empalme, cada capítulo, contacto y cierre. De cada capítulo, la mitad de su señal más larga (así se
  // revisa que lo señalado sea lo que dice la voz); si no tiene señales, a los 4 s.
  const fotos = [[Math.max(0.5, D - 2.2), 'Entrada'], [J - 1 / FPS, 'Último cuadro de la entrada'], [J, 'Primer cuadro del cuerpo']];
  if (R) {
    CAPITULOS.forEach((cp, i) => {
      const larga = (R.sigs || []).filter(s => s.cap === cp.id).sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0))[0];
      const t = larga ? D + (larga.t0 + larga.t1) / 2 : D + R.V[cp.id] + Math.min(R.DUR[cp.id] * 0.5, 4);
      fotos.push([t, `${i + 1}. ${cp.rotulo}${larga ? `: «${larga.label}»` : ''}`]);
    });
    if (R.contacto) fotos.push([D + R.contacto.t0 + 1, 'Tarjeta de contacto']);
    fotos.push([D + R.CIERRE_INI + Math.min(5.4, R.DUR_CIERRE - 0.3), 'Cierre']);
  }
  const celdas = fotos.map(([t, txt], i) => ({ img: path.basename(cuadro(Math.min(t, dur - 0.05), `c${String(i).padStart(2, '0')}.jpg`, 640)), txt, t }));
  const mmss = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  fs.writeFileSync(path.join(dirH, 'hoja.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:${TEMA.fondo2};font:600 18px/1.3 system-ui,sans-serif;color:${TEMA.tinta}}h1{font-size:24px;margin:0 0 16px}.g{display:grid;grid-template-columns:repeat(3,640px);gap:18px}figure{margin:0}img{display:block;width:640px;height:360px;border:1px solid ${TEMA.linea}}figcaption{margin-top:6px}</style><h1>${esc(path.basename(f))}: ${esc(dur.toFixed(1))} s</h1><div class="g">${celdas.map(c => `<figure><img src="${c.img}"><figcaption>${esc(mmss(c.t))} · ${esc(c.txt)}</figcaption></figure>`).join('')}</div>`);
  const pg = await browser.newPage({ viewport: { width: 3 * 640 + 2 * 18 + 48, height: 600 } });
  await pg.goto(pathToFileURL(path.resolve(dirH, 'hoja.html')).href);
  fs.mkdirSync('out/hojas', { recursive: true });
  await pg.screenshot({ path: `out/hojas/hoja-${v}.png`, fullPage: true });
  await pg.close();
  V.hoja = `out/hojas/hoja-${v}.png`;
  console.log(`  ${dur.toFixed(2)} s, ${vs.nb_read_frames} cuadros | empalme: salto ${maxCerca.toFixed(4)} (normal ${p999.toFixed(4)}), SSIM ${V.ssimEmpalme}${V.empalmeAudio.escalonDB != null ? `, escalón de música ${V.empalmeAudio.escalonDB} dB (pista sola ${V.empalmeAudio.escalonDeLaPistaSolaDB} dB)` : ''} | ${V.volumen.integradoLUFS} LUFS, pico ${V.volumen.picoRealDBTP} dBTP${V.vozAmbosLados ? ` | voz ${V.vozAmbosLados.entradaLUFS} / ${V.vozAmbosLados.cuerpoLUFS} LUFS` : ''}${V.musicaBajoLaVoz != null ? ` | música ${V.musicaBajoLaVoz} dB bajo la voz` : ''} | hoja: ${V.hoja}`);
}
await browser.close();
fs.rmSync('tmp/hojas', { recursive: true, force: true });
fs.mkdirSync('tmp', { recursive: true });
fs.writeFileSync('tmp/verificacion-union.json', JSON.stringify(res, null, 1));
console.log(mal ? `\n${mal} FALLA(S) en los videos finales` : '\nVideos finales: duración, empalmes y volumen en orden.');
process.exit(mal ? 1 : 0);
