// Revisa que la computadora tenga lo que pide la skill y dice qué falta y cómo instalarlo.
//
//   node <skill>/scripts/revisar-entorno.mjs                    desde cualquier carpeta
//   node <skill>/scripts/revisar-entorno.mjs --proyecto <dir>   además, lo de ese proyecto (lo usa «node hacer.mjs entorno»)
// Si la carpeta actual es un proyecto de video (tiene proyecto.json), también la revisa.
//
// Revisa: Node 22 o más nuevo, Python con edge-tts (y cuál Python, si hay varios), FFmpeg y ffprobe con lo que se usa
// (x264, AAC, limitador, medidor de volumen), Chrome, espacio en disco y, en un proyecto, que estén instaladas sus dependencias
// (CLI de HyperFrames, @hyperframes/core, playwright-core, GSAP). Whisper es opcional. Sale con error si falta algo necesario.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Python escribe en UTF-8 aunque Windows use otra página de códigos (si no, una ruta con «ó» llega rota)
process.env.PYTHONIOENCODING = 'utf-8'; process.env.PYTHONUTF8 = '1';
const args = process.argv.slice(2);
const iP = args.indexOf('--proyecto');
let proyecto = iP >= 0 ? path.resolve(args[iP + 1] || '.') : (fs.existsSync(path.join(process.cwd(), 'proyecto.json')) ? process.cwd() : null);
const win = process.platform === 'win32', mac = process.platform === 'darwin';
const filas = [];
let faltan = 0;
const ok = (que, detalle) => filas.push(['OK', que, detalle]);
const mal = (que, detalle, como) => { faltan++; filas.push(['FALTA', que, detalle, como]); };
const ojo = (que, detalle, como) => filas.push(['AVISO', que, detalle, como]);
const correr = (cmd, a, o = {}) => { const r = spawnSync(cmd, a, { encoding: 'utf8', timeout: o.timeout || 20000, shell: false }); return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim(), error: r.error }; };

// ---------------------------------------------------------------- Node
const [mayor] = process.versions.node.split('.').map(Number);
if (mayor >= 22) ok('Node.js', 'versión ' + process.versions.node);
else mal('Node.js 22 o más nuevo', 'tienes la ' + process.versions.node, win ? 'Instala la versión LTS de nodejs.org' : mac ? 'brew install node' : 'Instala Node 22 LTS (nodejs.org o el gestor de paquetes)');

// ---------------------------------------------------------------- Python con edge-tts
const candidatos = [];
if (process.env.PYTHON) candidatos.push([process.env.PYTHON]);
candidatos.push(['python'], ['python3']);
if (win) candidatos.push(['py', '-3']);
let py = null; const vistos = [];
for (const [cmd, ...pre] of candidatos) {
  const r = correr(cmd, [...pre, '-c', 'import sys; print(sys.executable); print(sys.version.split()[0]); import edge_tts']);
  const lineas = r.out.split(/\r?\n/);
  if (lineas[0] && /python/i.test(lineas[0]) && !r.error) vistos.push(`${[cmd, ...pre].join(' ')} = ${lineas[1] || '?'}${r.ok ? ' (con edge-tts)' : ''}`);
  if (r.ok && !py) py = { cmd: [cmd, ...pre].join(' '), exe: lineas[0], version: lineas[1] };
}
if (py) {
  ok('Python con edge-tts', `${py.version} (${py.exe})` + (py.cmd !== 'python' && py.cmd !== 'python3' ? `; la skill lo encuentra sola, o apunta PYTHON a ese archivo` : ''));
  const w = correr(py.exe, ['-c', 'import faster_whisper']);
  if (w.ok) ok('Whisper (opcional)', 'faster-whisper instalado: se puede comprobar la voz');
  else ojo('Whisper (opcional)', 'no está: no se podrá transcribir la voz para compararla con el guion', `"${py.exe}" -m pip install faster-whisper`);
} else if (vistos.length) {
  mal('edge-tts (la voz)', 'hay Python pero ninguno tiene edge-tts: ' + vistos.join('; '), win ? 'python -m pip install edge-tts   (si hay varios Python: py -0p los lista; instala en el que quieras usar)' : 'python3 -m pip install edge-tts');
} else {
  mal('Python 3', 'no encontré Python', win ? 'Instálalo de python.org marcando «Add python.exe to PATH»; luego: python -m pip install edge-tts' : mac ? 'brew install python; luego: python3 -m pip install edge-tts' : 'sudo apt install python3-pip; luego: python3 -m pip install edge-tts');
}

// ---------------------------------------------------------------- FFmpeg
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
const ff = correr(FFMPEG, ['-hide_banner', '-version']);
if (!ff.ok) mal('FFmpeg', 'no está en el PATH', win ? 'winget install ffmpeg   (luego cierra y abre la terminal)' : mac ? 'brew install ffmpeg' : 'sudo apt install ffmpeg');
else {
  const v = (ff.out.match(/ffmpeg version (\S+)/) || [])[1] || '?';
  const enc = correr(FFMPEG, ['-hide_banner', '-encoders']).out, fil = correr(FFMPEG, ['-hide_banner', '-filters']).out;
  const necesita = [['libx264', enc], ['aac', enc], ['alimiter', fil], ['ebur128', fil], ['acrossfade', fil], ['ssim', fil], ['blackdetect', fil]].filter(([n, txt]) => !new RegExp(`\\s${n}\\s`).test(txt)).map(([n]) => n);
  if (necesita.length) mal('FFmpeg completo', `la versión ${v} no trae: ${necesita.join(', ')}`, 'Instala una compilación completa (en Windows, winget install ffmpeg)');
  else ok('FFmpeg', 'versión ' + v);
  if (correr(FFPROBE, ['-version']).ok) ok('ffprobe', 'está');
  else mal('ffprobe', 'no está junto a FFmpeg', 'Viene con FFmpeg: reinstálalo completo');
}

// ---------------------------------------------------------------- Chrome
const rutas = process.env.CHROME ? [process.env.CHROME] : win
  ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(d => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  : mac ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'];
const chrome = rutas.find(r => fs.existsSync(r));
if (chrome) ok('Google Chrome', chrome);
else {
  const edge = win ? [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES].filter(Boolean).map(d => path.join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe')).find(r => fs.existsSync(r)) : null;
  if (edge) ojo('Google Chrome', 'no está; la grabación usará Microsoft Edge', 'Mejor instala Chrome de google.com/chrome');
  else mal('Google Chrome', 'no lo encontré', 'Instálalo de google.com/chrome (o apunta la variable CHROME a su ejecutable)');
}

// ---------------------------------------------------------------- el proyecto
const GB = 1024 ** 3;
const libre = d => { try { const s = fs.statfsSync(d); return s.bavail * s.bsize; } catch { return null; } };
if (proyecto) {
  if (!fs.existsSync(path.join(proyecto, 'proyecto.json'))) mal('Proyecto', `${proyecto} no tiene proyecto.json`, 'Crea el proyecto con node <skill>/scripts/nuevo.mjs <carpeta>');
  else {
    const nm = path.join(proyecto, 'node_modules');
    const pkg = n => { try { return JSON.parse(fs.readFileSync(path.join(nm, n, 'package.json'), 'utf8')).version; } catch { return null; } };
    const deps = { hyperframes: pkg('hyperframes'), '@hyperframes/core': pkg('@hyperframes/core'), 'playwright-core': pkg('playwright-core'), gsap: pkg('gsap') };
    const sin = Object.entries(deps).filter(([, v]) => !v).map(([n]) => n);
    if (sin.length) mal('Dependencias del proyecto', 'faltan: ' + sin.join(', '), `En la carpeta del proyecto: npm install`);
    else ok('Dependencias del proyecto', Object.entries(deps).map(([n, v]) => `${n} ${v}`).join(', '));
    try {
      const P = JSON.parse(fs.readFileSync(path.join(proyecto, 'proyecto.json'), 'utf8'));
      if (!P.voz?.id) ojo('Voz elegida', 'proyecto.json no tiene voz.id', 'node hacer.mjs muestras, y escribe la elegida en proyecto.json → voz');
      if (!P.app?.url) mal('Dirección de la app', 'proyecto.json no tiene app.url', 'Escribe la dirección de la copia de prueba en proyecto.json → app.url');
      if (P.musica) for (const f of (Array.isArray(P.musica) ? P.musica : [P.musica])) if (!fs.existsSync(path.join(proyecto, f))) mal('Música', `no encuentro ${f}`, 'Revisa proyecto.json → musica (rutas relativas al proyecto) o pon null');
    } catch (e) { mal('proyecto.json', 'no se puede leer: ' + e.message.split('\n')[0], 'Revisa que sea JSON válido'); }
  }
}

// ---------------------------------------------------------------- disco
const donde = proyecto || process.cwd();
const lp = libre(donde);
const raizTmp = win ? path.parse(donde).root : os.tmpdir();
const lt = libre(raizTmp);
const minimo = Math.min(lp ?? Infinity, lt ?? Infinity);
if (minimo === Infinity) ojo('Espacio en disco', 'no lo pude medir', '');
else if (minimo < 2 * GB) mal('Espacio en disco', `${(minimo / GB).toFixed(1)} GB libres`, 'Renderizar pide unos 5 GB para un video de 4 minutos (menos si es corto). Libera espacio: pregunta antes de borrar algo que no hizo la skill.');
else if (minimo < 5 * GB) ojo('Espacio en disco', `${(minimo / GB).toFixed(1)} GB libres`, 'Alcanza para videos cortos; uno de 4 minutos pide unos 5 GB');
else ok('Espacio en disco', `${(minimo / GB).toFixed(1)} GB libres`);
const nombreUsuario = os.homedir();
if (!/^[\x20-\x7E]*$/.test(donde)) ok('Ruta con acentos', `la ruta ${proyecto ? 'del proyecto' : 'de esta carpeta'} tiene acentos o eñes: el render trabaja solo en una copia temporal con ruta sin acentos`);
else if (!/^[\x20-\x7E]*$/.test(nombreUsuario)) ok('Carpeta de usuario con acentos', 'el render usa una carpeta temporal sin acentos');

// ---------------------------------------------------------------- resultado
const ancho = Math.max(...filas.map(f => f[1].length));
console.log(`Revisión del entorno${proyecto ? ` (proyecto: ${proyecto})` : ''}\n`);
for (const [estado, que, detalle, como] of filas) {
  console.log(`${estado.padEnd(6)} ${que.padEnd(ancho)}  ${detalle}`);
  if (como && estado !== 'OK') console.log(`${' '.repeat(8 + ancho)}Cómo: ${como}`);
}
console.log('');
if (faltan) { console.log(`Falta${faltan > 1 ? 'n' : ''} ${faltan} cosa${faltan > 1 ? 's' : ''}: instálala${faltan > 1 ? 's' : ''} y vuelve a correr esta revisión. Detalle en referencias/instalacion.md de la skill.`); process.exit(1); }
console.log('Todo lo necesario está. HyperFrames tiene su propia revisión: npx hyperframes doctor (dentro del proyecto).');
