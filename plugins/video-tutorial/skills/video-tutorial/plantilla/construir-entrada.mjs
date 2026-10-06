// Construye la ENTRADA de una versión: tmp/entradas/<versión>/index.html, con el título, la línea de «para quién» y la voz de esa
// versión. Todas las entradas duran lo mismo (entradas.mjs). Es un proyecto aparte porque `hyperframes render` trabaja sobre una
// carpeta: el script copia ahí lo que necesita (GSAP, letras, música de la entrada y sus frases de voz).
//
// La cámara y la deriva de las capas parten de un acercamiento suave y terminan EXACTAMENTE en la posición de arranque del cuerpo
// (F0, z = 1, deriva 0, velocidad 0), y el último cuadro es solo el fondo: así el empalme con el cuerpo no se nota.
// La voz y la música llevan la misma ganancia que el render bajó en el cuerpo (tmp/partes/cuerpo.json): suenan igual a los dos lados.
//
// Uso:  node construir-entrada.mjs <versión>               (después de «node hacer.mjs render»)
//       node construir-entrada.mjs <versión> --sin-cuerpo  sin la ganancia del cuerpo (solo para medir o ver la vista previa)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const { TITULO } = await import('./guion.mjs');
const { leerVoz, reProhibidas } = await import('./tiempos.mjs');
const { duracionEntrada, tiemposEntrada, COLA_ENTRADA } = await import('./entradas.mjs');
const { r2, LAYERS, F0, camX, DERIVA, deco, trozos, renglones, esc, cssTema, leerProyecto, lienzo, nuevoPlan, audioHtml, variablesSinDefinir, MUSICA_BASE } = await import('./capas.mjs');

const falla = m => { console.error('FALLA entrada: ' + m); process.exit(1); };
const args = process.argv.slice(2);
const version = args.find(a => !a.startsWith('--'));
const sinCuerpo = args.includes('--sin-cuerpo');
const P = leerProyecto();
const { ancho, alto, K } = lienzo(P);
const V = (P.versiones || []).find(v => v.id === version);
if (!V) falla(`versión desconocida «${version}». Usa: ${(P.versiones || []).map(v => v.id).join(', ')}`);
const VOZ = leerVoz();
const D = duracionEntrada(P, VOZ);
const T = tiemposEntrada(version, D, VOZ);
const DIR = path.join('tmp', 'entradas', version);

// misma ganancia que el render aplicó al cuerpo (para quedar bajo -1 dBTP): si no, la voz cambia de volumen en el empalme
let ganDb = 0;
if (!sinCuerpo) {
  const f = 'tmp/partes/cuerpo.json';
  if (!fs.existsSync(f)) falla('falta el cuerpo renderizado (tmp/partes/cuerpo.json): corre «node hacer.mjs render» antes de las entradas.');
  const C = JSON.parse(fs.readFileSync(f, 'utf8'));
  ganDb = -(C.audioBajadoDb || 0);
  if (P.musica && C.introDur != null && Math.abs(C.introDur - D) > 1e-6) falla(`las entradas ahora duran ${D} s y el cuerpo se renderizó para ${C.introDur} s (su música arranca en ese segundo): vuelve a correr «construir» y «render».`);
}
const GAN = 10 ** (ganDb / 20);

const { PLAN, set, to, fromTo } = nuevoPlan();
const ui = [], AUD = [];

// ---------------------------------------------------------------- cámara: un acercamiento suave que se abre hasta F0 (z = 1) justo al terminar
const capas = ['Lbg', 'Lmid', 'Lflo'];
const F1 = { x: F0.x + 46, y: F0.y + 26 }, z1 = 1.07;
for (const L of capas) {
  set('#' + L, { transformOrigin: '0 0', ...camX(L, F1, z1) }, 0);
  to('#' + L, { ...camX(L, F0, 1), duration: D, ease: 'sine.inOut' }, 0);
}
// deriva lenta: sale de 0 y vuelve a 0 (con velocidad 0) al final, igual que arranca el cuerpo
for (const [L, ax, ay] of DERIVA) {
  if (!capas.includes(L)) continue;
  set(`#${L} .dr`, { x: 0, y: 0 }, 0);
  to(`#${L} .dr`, { x: ax, y: -ay, duration: r2(D / 2), ease: 'sine.inOut' }, 0);
  to(`#${L} .dr`, { x: 0, y: 0, duration: r2(D / 2), ease: 'sine.inOut' }, D / 2);
}

// ---------------------------------------------------------------- título y «para quién» (sin etiqueta chiquita encima)
const titulo = String(TITULO || P.titulo || '').trim();
if (!titulo) falla('no hay título: pon TITULO en guion.mjs (o titulo en proyecto.json)');
if (P.titulo && TITULO && P.titulo.trim() !== TITULO.trim()) console.log(`AVISO: el título de guion.mjs («${TITULO}») y el de proyecto.json («${P.titulo}») no son iguales; la entrada usa el del guion.`);
// dos renglones parejos si es largo (por la coma más cercana a la mitad, o por un espacio)
function partirTitulo(t) {
  if (t.length <= 24) return [t];
  const mid = t.length / 2; let mejor = -1, md = 1e9;
  for (const m of t.matchAll(/,\s/g)) { const d = Math.abs(m.index - mid); if (d < md && d < t.length * 0.3) { md = d; mejor = m.index + 1; } }
  if (mejor < 0) for (let i = 0; i < t.length; i++) if (t[i] === ' ') { const d = Math.abs(i - mid); if (d < md) { md = d; mejor = i; } }
  return mejor < 0 ? [t] : [t.slice(0, mejor).trim(), t.slice(mejor).trim()];
}
const lineas = partirTitulo(titulo);
const mayor = Math.max(...lineas.map(l => [...l].length));
const tamTitulo = Math.max(64, Math.min(104, Math.floor(1640 / (mayor * 0.6))));   // que el renglón más largo quepa en 1640 px
ui.push(`<div id="intro"><h1 style="font-size:${tamTitulo}px">${lineas.map(l => `<span>${esc(l)}</span>`).join('')}</h1><p>${esc(V.para || '')}</p></div>`);
fromTo('#intro h1', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0.2);
fromTo('#intro p', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.75);
to('#intro', { opacity: 0, y: -14, duration: 0.7, ease: 'power2.in' }, D - COLA_ENTRADA + 0.05);   // el último cuadro es solo el fondo

// ---------------------------------------------------------------- voz y subtítulos (la voz real es el reloj)
let SBN = 0;
const VOZSEC = [], SUBS = [];
for (const [id, fr] of Object.entries(T.frases)) {
  AUD.push({ id: `vo-${id.replace(/[^A-Za-z0-9-]/g, '_')}`, src: `voz/${id}.wav`, t: r2(fr.ini), dur: r2(fr.dur), vol: +GAN.toFixed(4), track: 1, group: 'voz' });
  VOZSEC.push({ id, t0: r2(fr.ini), t1: r2(fr.fin) });
  const ws = fr.words || [], a = ws.length ? ws[0].t0 : 0, b = ws.length ? ws[ws.length - 1].t1 : fr.dur;
  const tr = trozos(fr.sub), total = tr.reduce((s, x) => s + x.length, 0) || 1;
  let acum = 0;
  tr.forEach((x, i) => {
    const t0 = fr.ini + a + (b - a) * (acum / total), t1 = fr.ini + a + (b - a) * ((acum + x.length) / total);
    acum += x.length;
    const sid = `sb${SBN++}`;
    ui.push(`<div id="${sid}" class="sub" data-layout-ignore>${renglones(x)}</div>`);
    fromTo('#' + sid, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, t0 - 0.05);
    const fin = i === tr.length - 1 ? t1 + 0.2 : t1 + 0.04;
    to('#' + sid, { opacity: 0, duration: 0.18 }, fin);
    SUBS.push({ id: sid, texto: x, t0: r2(t0), t1: r2(fin + 0.18) });
  });
}

// ---------------------------------------------------------------- música: el ARRANQUE de la pista; el cuerpo sigue desde ese mismo segundo
let MUS = null;
if (P.musica) {
  if (!fs.existsSync('assets/audio/musica-entrada.wav')) falla('falta assets/audio/musica-entrada.wav: corre «node hacer.mjs construir».');
  const corte = fs.existsSync('assets/audio/musica.json') ? JSON.parse(fs.readFileSync('assets/audio/musica.json', 'utf8')) : null;
  if (!corte || Math.abs(corte.introDur - D) > 1e-6) falla(`la música está partida para ${corte?.introDur ?? '?'} s y las entradas duran ${D} s: corre «node hacer.mjs construir render».`);
  const base = +(MUSICA_BASE * GAN).toFixed(4);
  MUS = { id: 'musica', src: 'assets/audio/musica-entrada.wav', t: 0, dur: D, vol: 1, track: 20, group: 'musica', auto: { version: 1, lanes: [{ target: 'volume', points: [{ t: 0, v: 0 }, { t: 2.2, v: base }, { t: D, v: base }] }] } };
}

// ---------------------------------------------------------------- palabras prohibidas: la entrada SÍ nombra a su audiencia, así que no se revisa;
// pero el título se comparte con todas las versiones y no puede nombrar a ninguna
{ const re = reProhibidas(P.palabrasProhibidas); if (re && new RegExp(re).test(titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))) falla(`el título «${titulo}» tiene una palabra prohibida: lo ven todas las versiones.`); }

// ---------------------------------------------------------------- carpeta de la entrada con lo que necesita
fs.rmSync(DIR, { recursive: true, force: true });
for (const d of ['assets/fonts', 'assets/audio', 'voz']) fs.mkdirSync(path.join(DIR, d), { recursive: true });
const gsapOrigen = fs.existsSync('assets/gsap.min.js') ? 'assets/gsap.min.js' : 'node_modules/gsap/dist/gsap.min.js';
if (!fs.existsSync(gsapOrigen)) falla('falta GSAP: corre «npm install».');
fs.copyFileSync(gsapOrigen, path.join(DIR, 'assets/gsap.min.js'));
if (fs.existsSync('assets/fonts')) for (const f of fs.readdirSync('assets/fonts')) if (/\.(woff2?|ttf|otf)$/i.test(f)) fs.copyFileSync(path.join('assets/fonts', f), path.join(DIR, 'assets/fonts', f));
if (MUS) fs.copyFileSync('assets/audio/musica-entrada.wav', path.join(DIR, 'assets/audio/musica-entrada.wav'));
for (const id of Object.keys(T.frases)) { const w = `voz/${id}.wav`; if (!fs.existsSync(w)) falla(`falta ${w}: corre «node hacer.mjs voz».`); fs.copyFileSync(w, path.join(DIR, w)); }
fs.copyFileSync('hyperframes.json', path.join(DIR, 'hyperframes.json'));

const DEC = deco();
const tema = cssTema(P);
const ESTILOS = fs.readFileSync('src/estilos.css', 'utf8');
{ const sin = variablesSinDefinir(ESTILOS, tema.css); if (sin.length) falla(`src/estilos.css usa variables que el tema no define: ${sin.map(v => '--' + v).join(', ')}. Saldrían transparentes.`); }
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${ancho}, height=${alto}">
<title>${esc(titulo)}: entrada ${esc(version)}</title>
<script src="assets/gsap.min.js"></script>
<style>
${tema.css}
${ESTILOS}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${ancho}" data-height="${alto}" data-duration="${D}">
  <div id="escena"${K !== 1 ? ` style="transform:scale(${+K.toFixed(5)})"` : ''}>
  <div id="Lbg" class="lay" data-layout-allow-overflow><div class="dr">${DEC.bg}</div></div>
  <div id="Lmid" class="lay" data-layout-allow-overflow><div class="dr">${DEC.mid}</div></div>
  <div id="Lflo" class="lay" data-layout-allow-overflow><div class="dr">${DEC.flo}</div></div>
  <div id="ui">
    ${ui.join('\n    ')}
  </div>
  </div>
  ${AUD.map(audioHtml).join('\n  ')}
  ${MUS ? audioHtml(MUS) : ''}
</div>
<script>
const PLAN = ${JSON.stringify(PLAN)};
${fs.readFileSync('src/animar.js', 'utf8')}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(DIR, 'index.html'), html);
fs.writeFileSync(path.join(DIR, 'resumen.json'), JSON.stringify({ version, para: V.para, titulo: lineas, tamTitulo, D, arranque: T.arranque, voz: VOZSEC, subs: SUBS, gananciaDb: ganDb, musica: !!MUS, K }, null, 1));
console.log(`entrada ${version}: ${D} s, voz de ${T.arranque.toFixed(2)} a ${VOZSEC.at(-1).t1.toFixed(2)} s, ${SBN} subtítulos, título a ${tamTitulo} px${ganDb ? `, ganancia ${ganDb.toFixed(1)} dB (la del cuerpo)` : ''}`);
