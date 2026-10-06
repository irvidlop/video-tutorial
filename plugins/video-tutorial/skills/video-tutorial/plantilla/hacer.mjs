// Hace el video completo, o una parte. Todo se corre desde la carpeta del proyecto:  node hacer.mjs <paso> [opciones]
//
//   entorno     revisa Node, Python con edge-tts, FFmpeg, Chrome, HyperFrames y espacio en disco
//   muestras    cuatro muestras de voz con el mismo texto (dos de mujer, dos de hombre)        --elegir=N la escribe en proyecto.json
//   voz         la locución frase por frase, con el tiempo de cada palabra (voz/voz.json)      --todo rehace todas · --comprobar transcribe con Whisper
//                                                                                              (--modelo=medium, más exacto; small por omisión)
//   app         arranca la app (si hay app.arrancar) y espera a que responda; queda prendida para «grabar»   --apagar la apaga
//   grabar      graba cada capítulo con Chrome y ajusta las pausas a la voz                    --cambiados graba solo lo que cambió · grabar 2 solo ese
//   construir   música partida, composición del cuerpo (index.html), cierre, carve y GUION.md   --seguir escribe aunque haya fallas
//   render      renderiza el cuerpo una vez (en una carpeta temporal sin acentos; revisa el disco antes)
//               --forzar aunque no alcance el disco · --png cuadros de la grabación en PNG · --seguir aunque construir tenga fallas
//   entradas    arma y renderiza una entrada por versión, todas de la misma duración          --version=a,b solo esas
//   unir        une cada entrada con el cuerpo: out/<nombreArchivo>-<versión>.mp4              --version=a,b
//   verificar   revisión de HyperFrames, mide cuerpo, entradas y empalmes, y deja una hoja de cuadros por versión   --version=a,b
//   ligero      versiones ligeras para correo en out/ligero/ (unos 10 MB por minuto)           --version=a,b · --mb-por-minuto=N
//   todo        entorno, voz, app, grabar, construir, render, entradas, unir, verificar y ligero (muestras no: la voz la elige la persona)
//
// Varios pasos a la vez se corren en el orden de arriba:  node hacer.mjs construir render entradas unir
// Si un paso falla, se detiene y dice qué y dónde. La app que prendió la skill se apaga al terminar de grabar (y solo esa).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
// Python escribe en UTF-8 aunque Windows use otra página de códigos (si no, una ruta con «ó» llega rota)
process.env.PYTHONIOENCODING = 'utf-8'; process.env.PYTHONUTF8 = '1';
const ORDEN = ['entorno', 'muestras', 'voz', 'app', 'grabar', 'construir', 'render', 'entradas', 'unir', 'verificar', 'ligero'];
const TODO = ['entorno', 'voz', 'app', 'grabar', 'construir', 'render', 'entradas', 'unir', 'verificar', 'ligero'];
const args = process.argv.slice(2);
const op = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
let pasos = args.filter(a => !a.startsWith('--'));
const numeros = pasos.filter(a => /^\d+$/.test(a));   // capítulos sueltos para «grabar»
pasos = pasos.filter(a => !/^\d+$/.test(a));
if (!pasos.length || args.includes('--ayuda') || args.includes('-h')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(pasos.length ? 0 : 1);
}
for (const p of pasos) if (!ORDEN.includes(p) && p !== 'todo') { console.error(`Paso desconocido «${p}». Pasos: ${ORDEN.join(', ')}, todo.`); process.exit(1); }
const quiere = p => pasos.includes(p) || (pasos.includes('todo') && TODO.includes(p));

const falla = m => { console.error('\nFALLA: ' + m); process.exit(1); };
const P = JSON.parse(fs.readFileSync('proyecto.json', 'utf8').replace(/^\uFEFF/, ''));
const NODE = process.execPath;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
const versionesPedidas = () => {
  const todas = (P.versiones || []).map(v => v.id);
  const v = op('version');
  if (!v || v === true) return todas;
  const pedidas = String(v).split(',').map(s => s.trim()).filter(Boolean);
  for (const x of pedidas) if (!todas.includes(x)) falla(`versión desconocida «${x}» (hay: ${todas.join(', ')})`);
  return pedidas;
};

/** Corre un programa mostrando su salida. Si falla, se detiene. */
function correr(cmd, a = [], { cwd = AQUI, env = {}, permitir = false } = {}) {
  console.log(`> ${path.basename(cmd)} ${a.join(' ')}`);
  const r = spawnSync(cmd, a, { stdio: 'inherit', cwd, env: { ...process.env, ...env } });
  if (r.error) falla(`no pude correr ${cmd}: ${r.error.message}`);
  if (r.status !== 0 && !permitir) falla(`${path.basename(cmd)} ${a.slice(0, 2).join(' ')} terminó con error (arriba dice por qué).`);
  return r.status;
}
const nodo = (script, a = [], o = {}) => correr(NODE, [script, ...a], o);

// ---------------------------------------------------------------- Python con edge-tts
let PY = null;
function buscarPython() {
  if (PY) return PY;
  const candidatos = [];
  if (process.env.PYTHON) candidatos.push([process.env.PYTHON]);
  candidatos.push(['python'], ['python3'], ['py', '-3']);
  for (const [cmd, ...pre] of candidatos) {
    const r = spawnSync(cmd, [...pre, '-c', 'import edge_tts, sys; print(sys.executable)'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) { PY = r.stdout.trim().split(/\r?\n/).pop(); return PY; }
  }
  falla('no encontré un Python con edge-tts. Instálalo con «pip install edge-tts» (o apunta la variable PYTHON a un Python que lo tenga).');
}

// ---------------------------------------------------------------- disco y carpeta temporal sin acentos
const GB = 1024 ** 3;
function libre(ruta) { try { const s = fs.statfsSync(ruta); return s.bavail * s.bsize; } catch { return null; } }
const esAscii = s => /^[\x20-\x7E]*$/.test(s);
/** Carpeta temporal con ruta ASCII (la CLI de HyperFrames truena con acentos). */
function raizAscii() {
  const intentos = [];
  if (process.env.VIDEO_TUTORIAL_TMP) intentos.push(process.env.VIDEO_TUTORIAL_TMP);
  if (process.platform === 'win32') intentos.push(path.join(path.parse(AQUI).root || 'C:\\', 'vt-tmp'));
  intentos.push(os.tmpdir());
  for (const d of intentos) {
    if (!esAscii(d)) continue;
    try { fs.mkdirSync(d, { recursive: true }); const real = fs.realpathSync.native(d); if (!esAscii(real) && d !== process.env.VIDEO_TUTORIAL_TMP) continue; fs.accessSync(d, fs.constants.W_OK); return d; } catch { /* siguiente */ }
  }
  falla('no encontré una carpeta temporal con ruta sin acentos. Crea una (por ejemplo C:\\vt-tmp) y apunta ahí la variable VIDEO_TUTORIAL_TMP.');
}
function duracionMedia(f) { const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }); return +r.stdout.trim() || 0; }
// copias temporales que quedan por borrar si algo se cae a la mitad (o si Chrome tardó en soltarlas)
const POR_BORRAR = new Set();
const borrar = d => { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 }); return true; } catch { return false; } };   // Chrome tarda un momento en soltar sus archivos
process.on('exit', () => {
  for (const d of POR_BORRAR) {
    borrar(d);
    // la carpeta raíz C:\vt-tmp también, si quedó vacía (si no, se quedaba sola en el disco)
    if (path.basename(path.dirname(d)) === 'vt-tmp') { try { fs.rmdirSync(path.dirname(d)); } catch { /* otra copia la usa */ } }
  }
});
/**
 * Copia un archivo o una carpeta completa. No usa fs.cpSync: en Windows, con Node 22, cpSync truena sin decir nada (sale con
 * código 127) al copiar desde una ruta con acentos a una carpeta que ya existe en otra sin acentos, justo lo que hace el render.
 */
function copiarTodo(de, a, filtro = () => true) {
  if (!filtro(de)) return;
  if (fs.statSync(de).isDirectory()) {
    fs.mkdirSync(a, { recursive: true });
    for (const nombre of fs.readdirSync(de)) copiarTodo(path.join(de, nombre), path.join(a, nombre), filtro);
    return;
  }
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.copyFileSync(de, a);
}
const CLI = path.join(AQUI, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');

/**
 * Copia lo necesario de `origen` a una carpeta temporal con ruta ASCII (la CLI de HyperFrames truena con acentos). Los temporales
 * de Chrome y la caché de cuadros quedan DENTRO de esa carpeta, así que borrarla deja el disco como estaba.
 */
function copiaAscii({ origen, copiar, prefijo }) {
  if (!fs.existsSync(CLI)) falla('falta la CLI de HyperFrames: corre «npm install» en la carpeta del proyecto.');
  const raiz = raizAscii();
  const dir = fs.mkdtempSync(path.join(raiz, prefijo + '-'));
  const temporal = path.join(dir, '.temporal'), cache = path.join(dir, '.cuadros');
  fs.mkdirSync(temporal);
  POR_BORRAR.add(dir);
  for (const rel of copiar) {
    const de = path.join(origen, rel);
    if (fs.existsSync(de)) copiarTodo(de, path.join(dir, rel), f => !/(^|[\\/])(node_modules|\.git)([\\/]|$)/.test(f));
  }
  const limpiar = () => {
    if (borrar(dir)) POR_BORRAR.delete(dir);
    if (path.basename(raiz) === 'vt-tmp') { try { fs.rmdirSync(raiz); } catch { /* no está vacía: otra copia la usa */ } }
  };
  return { dir, cache, limpiar, env: { ...process.env, TEMP: temporal, TMP: temporal, TMPDIR: temporal, HYPERFRAMES_EXTRACT_CACHE_DIR: cache } };
}
/** Corre la CLI de HyperFrames mostrando solo lo útil (avance cada 10%, avisos, errores). Devuelve { codigo, texto }. */
function cli(a, { dir, env }) {
  return new Promise((res, rej) => {
    const ch = spawn(NODE, [CLI, ...a], { cwd: dir, env });
    let texto = '', ultimo = -10;
    const util = l => {
      if (!l.trim() || /\[INFO\]/.test(l) || (/^\s*\[/.test(l) && !/warn|error/i.test(l))) return false;
      if (/Checking browser/.test(l)) return false;   // la ruedita de espera
      const m = l.match(/(\d+)%/);
      if (m) { if (+m[1] - ultimo < 10 && +m[1] !== 100) return false; ultimo = +m[1]; return true; }
      return /Audio lowered|error|Error|WARN|lint|complete|rendered|passed|failed|issue|check|contrast/i.test(l);
    };
    const eco = d => { const s = d.toString(); texto += s; process.stdout.write(s.split(/\r?\n/).filter(util).map(l => '  ' + l.trim() + '\n').join('')); };
    ch.stdout.on('data', eco); ch.stderr.on('data', eco);
    ch.on('error', rej);
    ch.on('close', codigo => res({ codigo, texto }));
  });
}
const lineasDeError = t => t.split('\n').filter(l => /error|fail|✗|×/i.test(l)).slice(-12).join('\n');
// lo que necesita el cuerpo para renderizarse o revisarse (nada más se copia)
const COPIA_CUERPO = ['index.html', 'hyperframes.json', 'compositions', 'assets/gsap.min.js', 'assets/fonts', 'assets/sfx', 'assets/audio/musica-cuerpo.wav', 'media', 'voz'];

/**
 * Renderiza una composición en una copia con ruta ASCII: revisa el disco, copia solo lo necesario, renderiza con la CLI del
 * proyecto, trae el MP4 y borra la copia. Devuelve { audioBajadoDb, segundos }.
 */
async function renderizar({ origen, copiar, salida, segundos, nombre }) {
  const raiz = raizAscii();
  const necesita = Math.max(1.5, 0.8 + 1.15 * (segundos / 60)) * GB;    // un cuerpo de 4 minutos pidió unos 5 GB (cuadros extraídos y memoria)
  const hay = libre(raiz);
  if (hay != null && hay < necesita && !op('forzar')) falla(`no alcanza el disco para renderizar «${nombre}»: hay ${(hay / GB).toFixed(1)} GB libres en ${path.parse(raiz).root} y hacen falta unos ${(necesita / GB).toFixed(1)} GB. Libera espacio (pregunta antes de borrar algo que no hizo la skill) y vuelve a correr.`);
  const hayProy = libre(AQUI);
  if (hayProy != null && hayProy < (0.1 + 0.05 * segundos / 60) * GB) falla(`no alcanza el disco del proyecto para guardar el video (${(hayProy / GB).toFixed(2)} GB libres).`);
  const c = copiaAscii({ origen, copiar, prefijo: 'render' });
  try {
    console.log(`> render de «${nombre}» (${segundos.toFixed(1)} s de video) en ${c.dir}`);
    const inicio = Date.now();
    // 3 trabajadores: más pueden agotar la memoria de Node en un cuerpo largo (VIDEO_TUTORIAL_WORKERS cambia el número)
    const r0 = await cli(['render', c.dir, '--output', path.join(c.dir, 'salida.mp4'), '--fps', String(P.video?.fps || 30), '--video-frame-format', op('png') ? 'png' : 'jpg', '--frames-cache-dir', c.cache, '--workers', String(process.env.VIDEO_TUTORIAL_WORKERS || 3), '--strict'], c)
      .catch(e => falla(`no pude correr la CLI de HyperFrames: ${e.message}`));
    if (r0.codigo !== 0) falla(`el render de «${nombre}» falló (código ${r0.codigo}):\n${lineasDeError(r0.texto)}`);
    const out = path.join(c.dir, 'salida.mp4');
    if (!fs.existsSync(out)) falla(`el render de «${nombre}» no dejó el MP4.`);
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    fs.copyFileSync(out, salida);
    const m = r0.texto.match(/Audio lowered by (-?[\d.]+) dB/);
    const r = { audioBajadoDb: m ? +m[1] : 0, segundos: +((Date.now() - inicio) / 1000).toFixed(0) };
    console.log(`  listo en ${r.segundos} s: ${path.relative(AQUI, salida)} (${(fs.statSync(salida).size / 1024 ** 2).toFixed(1)} MB)${r.audioBajadoDb ? `, el render bajó el audio ${r.audioBajadoDb} dB para no saturar` : ''}`);
    return r;
  } finally { c.limpiar(); }
}
/** La revisión de HyperFrames (lint, runtime, layout, movimiento y contraste) sobre una copia ASCII. Devuelve true si pasa. */
async function revisarConHyperframes({ origen, copiar, nombre }) {
  const c = copiaAscii({ origen, copiar, prefijo: 'check' });
  try {
    console.log(`> hyperframes check de «${nombre}»`);
    const r = await cli(['check', c.dir], c).catch(e => ({ codigo: 1, texto: e.message }));
    const ok = r.codigo === 0 && /Check passed/i.test(r.texto);
    if (!ok) console.log(`  FALLA hyperframes check de «${nombre}»:\n${lineasDeError(r.texto) || r.texto.slice(-1500)}`);
    return ok;
  } finally { c.limpiar(); }
}

// ---------------------------------------------------------------- la app
// La skill solo apaga la app que ella misma prendió: guarda su número de proceso en tmp/app.json y, antes de apagarla, comprueba
// que ese proceso siga siendo el mismo comando. Nunca apaga otra cosa (puede ser el servidor de otra persona o de otra sesión).
const ARCHIVO_APP = path.join(AQUI, 'tmp', 'app.json');
let appPropia = null;   // { pid, comando } de la app que prendió esta corrida
async function appResponde() { try { const r = await fetch(P.app.url, { signal: AbortSignal.timeout(3000) }); return r.status < 500; } catch { return false; } }
function lineaDeComando(pid) {
  if (process.platform === 'win32') {
    // PowerShell escribe en la página de códigos de la consola: se le pide UTF-8 (si no, una ruta con «ó» llega rota y no coincide)
    const r = spawnSync('powershell', ['-NoProfile', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; (Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`], { encoding: 'utf8' });
    return (r.stdout || '').trim();
  }
  const r = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}
const soloAscii = s => String(s).replace(/[^\x21-\x7E]/g, '');
function apagarApp() {
  let a = appPropia;
  if (!a && fs.existsSync(ARCHIVO_APP)) { try { a = JSON.parse(fs.readFileSync(ARCHIVO_APP, 'utf8')); } catch { a = null; } }
  if (!a) return false;
  appPropia = null;
  const cmd = lineaDeComando(a.pid);
  if (cmd && (cmd.includes(a.comando) || soloAscii(cmd).includes(soloAscii(a.comando)))) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(a.pid), '/T', '/F'], { stdio: 'ignore' });   // solo ese árbol de procesos
    else { try { process.kill(-a.pid, 'SIGTERM'); } catch { try { process.kill(a.pid, 'SIGTERM'); } catch { /* ya no está */ } } }
    console.log(`la app que prendió la skill (proceso ${a.pid}) se apagó`);
  } else if (cmd) console.log(`AVISO: el proceso ${a.pid} ya no es la app que prendió la skill: no se toca`);
  fs.rmSync(ARCHIVO_APP, { force: true });
  return true;
}
let apagarAlSalir = false;
process.on('exit', () => { if (apagarAlSalir) apagarApp(); });
process.on('SIGINT', () => { if (apagarAlSalir) apagarApp(); process.exit(130); });
/** Que la app responda. Si no responde y hay app.arrancar, la prende en segundo plano. Devuelve true si la prendió esta corrida. */
async function asegurarApp() {
  if (!P.app?.url) falla('falta proyecto.json → app.url');
  if (await appResponde()) { console.log(`la app responde en ${P.app.url}`); return false; }
  if (!P.app.arrancar) falla(`la app no responde en ${P.app.url} y no hay app.arrancar en proyecto.json: arráncala tú y vuelve a correr.`);
  fs.mkdirSync('tmp', { recursive: true });
  const log = fs.openSync('tmp/app.log', 'a');
  console.log(`> ${P.app.arrancar}   (lo que diga queda en tmp/app.log)`);
  const ch = spawn(P.app.arrancar, { shell: true, cwd: AQUI, stdio: ['ignore', log, log], detached: true, windowsHide: true });
  ch.unref();
  appPropia = { pid: ch.pid, comando: P.app.arrancar, desde: new Date().toISOString() };
  fs.writeFileSync(ARCHIVO_APP, JSON.stringify(appPropia, null, 1));
  for (let i = 0; i < 80; i++) { if (await appResponde()) { console.log(`la app responde en ${P.app.url}`); return true; } if (ch.exitCode != null) break; await new Promise(r => setTimeout(r, 500)); }
  apagarApp();
  falla(`la app no respondió en ${P.app.url} después de 40 s. Revisa tmp/app.log.`);
}

// ---------------------------------------------------------------- revisión del entorno (scripts/revisar-entorno.mjs de la skill)
function buscarRevisor() {
  const locales = [path.join(AQUI, 'revisar-entorno.mjs')];
  if (process.env.VIDEO_TUTORIAL_SKILL) locales.push(path.join(process.env.VIDEO_TUTORIAL_SKILL, 'scripts', 'revisar-entorno.mjs'));
  for (let d = AQUI, i = 0; i < 6; i++, d = path.dirname(d)) locales.push(path.join(d, 'scripts', 'revisar-entorno.mjs'));
  return locales.find(f => fs.existsSync(f)) || null;
}

// ================================================================ los pasos
const reloj = Date.now();
const titulo = p => console.log(`\n=== ${p} ===`);

if (quiere('entorno')) {
  titulo('entorno');
  const rev = buscarRevisor();
  if (!rev) falla('no encuentro revisar-entorno.mjs (va en la carpeta scripts/ de la skill). Apunta VIDEO_TUTORIAL_SKILL a la carpeta de la skill.');
  nodo(rev, ['--proyecto', AQUI]);
}
if (quiere('muestras')) {
  titulo('muestras de voz');
  const e = op('elegir');
  correr(buscarPython(), ['voz/muestras.py', ...(e ? ['--elegir', String(e)] : [])]);
}
if (quiere('voz')) {
  titulo('voz');
  const { todasLasFrases, revisarGuion } = await import('./tiempos.mjs');
  const g = revisarGuion(P);
  for (const a of g.avisos) console.log('AVISO ' + a);
  if (g.errores.length) falla('el guion no cuadra:\n  ' + g.errores.join('\n  '));
  const frases = todasLasFrases(P);
  fs.writeFileSync('voz/frases.json', JSON.stringify(frases, null, 1));
  console.log(`${frases.length} frases (${frases.reduce((n, f) => n + f.voz.split(/\s+/).length, 0)} palabras)`);
  correr(buscarPython(), ['voz/voz.py', ...(op('todo') ? ['--todo'] : [])]);
  if (op('comprobar')) { const m = op('modelo'); correr(buscarPython(), ['voz/comprobar.py', ...(m && m !== true ? ['--modelo', String(m)] : [])]); }
  else console.log('Para comprobar lo que dice la voz (si hay Whisper): node hacer.mjs voz --comprobar');
}
if (quiere('app')) {
  titulo('app');
  if (op('apagar')) { if (!apagarApp()) console.log('no hay una app prendida por la skill'); }
  else {
    const prendida = await asegurarApp();
    // sola, la app queda prendida para «grabar» en otra llamada; con más pasos (o con «todo»), se apaga al terminar
    if (prendida && pasos.length === 1 && pasos[0] === 'app') console.log(`La app queda prendida (proceso ${appPropia.pid}). «node hacer.mjs grabar» la usa y la apaga al terminar; para apagarla antes: node hacer.mjs app --apagar`);
    else if (prendida) apagarAlSalir = true;
  }
}
if (quiere('grabar')) {
  titulo('grabar');
  await asegurarApp();
  apagarAlSalir = true;   // al terminar se apaga la app que haya prendido la skill (en esta llamada o en «app»), y solo esa
  nodo('grabar.mjs', [...(op('cambiados') ? ['--cambiados'] : []), ...numeros]);
  apagarApp(); apagarAlSalir = false;
}
if (quiere('construir')) {
  titulo('construir');
  if (P.musica) { nodo('mezcla-musica.mjs'); nodo('preparar-musica.mjs'); }
  nodo('construir.mjs', op('seguir') ? ['--seguir'] : []);
  if (P.musica) nodo('carve.mjs', ['index.html']);
}
if (quiere('render')) {
  titulo('render del cuerpo');
  if (!fs.existsSync('tmp/plan-resumen.json') || !fs.existsSync('index.html')) falla('falta index.html: corre «node hacer.mjs construir».');
  const R = JSON.parse(fs.readFileSync('tmp/plan-resumen.json', 'utf8'));
  if (R.fallas?.length && !op('seguir')) falla('construir dejó fallas sin resolver:\n  ' + R.fallas.join('\n  '));
  const r = await renderizar({ origen: AQUI, copiar: COPIA_CUERPO, salida: path.join(AQUI, 'tmp/partes/cuerpo.mp4'), segundos: R.END, nombre: 'cuerpo' });
  const corte = fs.existsSync('assets/audio/musica.json') ? JSON.parse(fs.readFileSync('assets/audio/musica.json', 'utf8')) : null;
  fs.writeFileSync('tmp/partes/cuerpo.json', JSON.stringify({ ...r, introDur: P.musica ? corte?.introDur ?? null : null, duracion: duracionMedia('tmp/partes/cuerpo.mp4'), plan: R.construido, fecha: new Date().toISOString() }, null, 1));
}
if (quiere('entradas')) {
  titulo('entradas');
  if (!fs.existsSync('tmp/partes/cuerpo.json')) falla('falta el cuerpo renderizado: corre «node hacer.mjs render» antes de las entradas.');
  const C = JSON.parse(fs.readFileSync('tmp/partes/cuerpo.json', 'utf8'));
  for (const v of versionesPedidas()) {
    nodo('construir-entrada.mjs', [v]);
    const dir = path.join(AQUI, 'tmp', 'entradas', v);
    if (P.musica) nodo('carve.mjs', [path.join('tmp', 'entradas', v, 'index.html'), '--soltar']);
    const res = JSON.parse(fs.readFileSync(path.join(dir, 'resumen.json'), 'utf8'));
    const r = await renderizar({ origen: dir, copiar: ['.'], salida: path.join(AQUI, 'tmp', 'partes', `entrada-${v}.mp4`), segundos: res.D, nombre: `entrada ${v}` });
    if (Math.abs(r.audioBajadoDb) > 0.15) console.log(`AVISO entrada ${v}: su render bajó el audio otros ${r.audioBajadoDb} dB; la voz sonará un poco distinta a los dos lados del empalme (verificar lo mide).`);
    fs.writeFileSync(path.join(AQUI, 'tmp', 'partes', `entrada-${v}.json`), JSON.stringify({ ...r, D: res.D, gananciaCuerpoDb: -(C.audioBajadoDb || 0) }, null, 1));
  }
}
if (quiere('unir')) {
  titulo('unir');
  nodo('unir.mjs', versionesPedidas());
}
if (quiere('verificar')) {
  titulo('verificar');
  const vs = versionesPedidas();
  const malos = [];
  if (!(await revisarConHyperframes({ origen: AQUI, copiar: COPIA_CUERPO, nombre: 'cuerpo' }))) malos.push('cuerpo (hyperframes check)');
  for (const v of vs) {
    const dir = path.join(AQUI, 'tmp', 'entradas', v);
    if (fs.existsSync(path.join(dir, 'index.html')) && !(await revisarConHyperframes({ origen: dir, copiar: ['.'], nombre: `entrada ${v}` }))) malos.push(`entrada ${v} (hyperframes check)`);
  }
  if (nodo('medir.mjs', [], { permitir: true }) !== 0) malos.push('cuerpo (medir.mjs)');
  if (nodo('medir-entrada.mjs', vs, { permitir: true }) !== 0) malos.push('entradas (medir-entrada.mjs)');
  if (nodo('verificar-union.mjs', vs, { permitir: true }) !== 0) malos.push('videos finales (verificar-union.mjs)');
  if (malos.length) falla('la verificación encontró problemas en: ' + malos.join(', ') + '. Arriba dice qué y dónde.');
  console.log('\nVERIFICADO: todo lo que se puede medir está en orden. Falta lo que no se mide: que la persona lo escuche completo y mire las hojas de cuadros (out/hojas/).');
}
if (quiere('ligero')) {
  titulo('ligero');
  const mb = op('mb-por-minuto');
  nodo('ligero.mjs', [...versionesPedidas(), ...(mb && mb !== true ? ['--mb-por-minuto=' + mb] : [])]);
}
const s = Math.round((Date.now() - reloj) / 1000);
console.log(`\nterminado en ${Math.floor(s / 60)} min ${s % 60} s`);
