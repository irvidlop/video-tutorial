// Aparta la música de la voz («carve»): escucha la locución, encuentra las bandas donde habla y escribe en la pista de música
// unos recortes que siguen a la voz, más una bajada general mientras habla. Es el mismo análisis de HyperFrames
// (@hyperframes/core: audio-carve y audio-fx), sin depender de ninguna otra skill instalada.
//
// Uso:  node carve.mjs index.html                                  el cuerpo
//       node carve.mjs tmp/entradas/<versión>/index.html --soltar  una entrada: además suelta la música antes del empalme
// Sin música (proyecto.json → musica: null) no hace nada.
//
// La música es el <audio id="musica">; las voces, los <audio data-audio-group="voz">.
// --soltar: el carve suelta la música MUY despacio (unos 5 dB por segundo). Al terminar la voz de la entrada la música seguiría
// abajo y el cuerpo, que arranca con la música a su nivel, la subiría de golpe en el empalme. Con --soltar los carriles del carve
// suben a 0 (sin recorte) entre el final de la voz y el final de la entrada (entradas.mjs: sueltaIni, sueltaFin).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const FUERZA = 0.8;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const falla = m => { console.error('FALLA carve: ' + m); process.exit(1); };

const args = process.argv.slice(2);
const comp = path.resolve(args.find(a => !a.startsWith('--')) || path.join(AQUI, 'index.html'));
const soltar = args.includes('--soltar');
if (!fs.existsSync(comp)) falla('no existe ' + comp);
const dir = path.dirname(comp);
let html = fs.readFileSync(comp, 'utf8');

const attr = (tag, n) => (tag.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1] ?? null;
const sinEsc = v => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const conEsc = v => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const audios = [...html.matchAll(/<audio\b[^>]*>/g)].map(m => m[0]);
const camaTag = audios.find(t => attr(t, 'id') === 'musica');
if (!camaTag) { console.log('carve: sin música, no hay nada que apartar'); process.exit(0); }
const vocesTags = audios.filter(t => attr(t, 'data-audio-group') === 'voz');
if (!vocesTags.length) falla('no hay voces (<audio data-audio-group="voz">) en ' + comp);

// @hyperframes/core, el del proyecto (npm install lo deja en node_modules)
async function cargar(sub) {
  const req = createRequire(pathToFileURL(path.join(AQUI, 'package.json')));
  let pkgPath;
  try { pkgPath = req.resolve('@hyperframes/core/package.json'); } catch { falla('falta @hyperframes/core: corre «npm install» en la carpeta del proyecto.'); }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const e = pkg.exports?.['./' + sub];
  const destino = typeof e === 'string' ? e : (e?.import ?? e?.default);
  if (!destino) falla(`@hyperframes/core ${pkg.version} no trae ${sub}: actualízalo (npm i -D @hyperframes/core@latest).`);
  return import(pathToFileURL(path.resolve(path.dirname(pkgPath), destino)).href);
}
const carve = await cargar('audio-carve');
const fx = await cargar('audio-fx');

function decodificar(src) {
  const f = path.resolve(dir, sinEsc(src));
  if (!fs.existsSync(f)) falla('no existe el audio ' + f);
  const raw = execFileSync(FFMPEG, ['-v', 'error', '-i', f, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
const inicio = t => Number(attr(t, 'data-start')) || 0;

const perfil = carve.carveProfile(FUERZA);
const voz = carve.mixCarveSources(vocesTags.map(t => ({ samples: decodificar(attr(t, 'src')), offsetSeconds: inicio(t) - inicio(camaTag) })), SR);
const bandas = carve.analyseCarveBands(voz, SR, perfil);
const cama = perfil.duckDb > 0 ? decodificar(attr(camaTag, 'src')) : null;
const bajada = cama ? carve.analyseCarveDuck(voz, cama, SR, perfil, 0) : [];

// lo que no es del carve (por ejemplo, el volumen dibujado a mano) se conserva
const cadenaVieja = attr(camaTag, 'data-fx-chain');
const nodosViejos = cadenaVieja ? fx.parseAudioFxChain(sinEsc(cadenaVieja)).nodes : [];
const propios = nodosViejos.filter(n => !n.fromCarve);
const prefijosViejos = nodosViejos.filter(n => n.fromCarve && n.id).map(n => `fx.${n.id}.`);
let cadena = { version: 1, nodes: propios };
const nuevo = nodo => { const n = { ...nodo, id: fx.mintAudioFxNodeId(cadena), fromCarve: true }; cadena = { version: 1, nodes: [...cadena.nodes, n] }; return n; };
const nodosBanda = bandas.map(b => nuevo(carve.carveBandsToChain([b]).nodes[0]));
const nodoBajada = bajada.length ? nuevo({ type: 'gain', enabled: true, params: { ...fx.defaultAudioFxParams('gain'), gain: 0 } }) : null;
const cadenaFinal = { version: 1, nodes: [...nodosBanda, ...(nodoBajada ? [nodoBajada] : []), ...propios] };
const carril = (id, puntos) => {
  const p = puntos.map(x => ({ t: +x.t.toFixed(3), v: x.v })).filter(x => x.t >= 0);
  if ((p[0]?.t ?? 0) > 0) p.unshift({ t: 0, v: 0 });
  return p.length > 1 ? [{ target: `fx.${id}.gain`, points: p }] : [];
};
let carrilesCarve = [
  ...carve.analyseCarveDynamics(voz, SR, bandas).flatMap((d, i) => (nodosBanda[i]?.id ? carril(nodosBanda[i].id, d.points) : [])),
  ...(nodoBajada ? carril(nodoBajada.id, bajada) : []),
];
const autoViejo = attr(camaTag, 'data-automation');
const carrilesPropios = autoViejo ? (JSON.parse(sinEsc(autoViejo)).lanes || []).filter(l => !prefijosViejos.some(p => String(l.target).startsWith(p))) : [];

let nota = '';
if (soltar) {
  const { duracionEntrada, sueltaIni, sueltaFin } = await import('./entradas.mjs');
  const D = Number(attr(html.match(/<div id="root"[^>]*>/)?.[0] || '', 'data-duration')) || duracionEntrada();
  const ini = sueltaIni(D), fin = sueltaFin(D);
  carrilesCarve = carrilesCarve.map(l => {
    const antes = l.points.filter(p => p.t <= ini), sig = l.points.find(p => p.t > ini), ant = antes.at(-1);
    const v0 = ant && sig ? ant.v + (sig.v - ant.v) * (ini - ant.t) / (sig.t - ant.t) : (ant ? ant.v : 0);
    return { ...l, points: [...antes.filter(p => p.t < ini), { t: ini, v: +v0.toFixed(3) }, { t: fin, v: 0 }] };
  });
  nota = `; los ${carrilesCarve.length} carriles del carve suben a 0 entre ${ini} y ${fin} s (la música llega a su nivel antes del empalme)`;
}

const ajustes = { enabled: true, sources: ['voz'], strength: FUERZA };
const escrito = ` data-fx-carve="${conEsc(JSON.stringify(ajustes))}" data-fx-chain="${conEsc(fx.serializeAudioFxChain(cadenaFinal))}" data-automation="${conEsc(JSON.stringify({ version: 1, lanes: [...carrilesPropios, ...carrilesCarve] }))}"`;
let limpio = camaTag;
for (const a of ['data-fx-carve', 'data-fx-chain', 'data-automation']) limpio = limpio.replace(new RegExp(`\\s${a}="[^"]*"`), '');
html = html.replace(camaTag, limpio.replace(/\/?>$/, c => escrito + c));
fs.writeFileSync(comp, html);
console.log(`carve: ${vocesTags.length} frases de voz, ${bandas.length} bandas (${bandas.map(b => `${b.freq} Hz ${b.gainDb} dB`).join(', ')}), bajada ${bajada.length ? Math.min(...bajada.map(p => p.v)).toFixed(1) + ' dB como máximo' : 'ninguna'}${nota}`);
