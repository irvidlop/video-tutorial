// Graba los capítulos con Chrome (grabacion/capN.mjs) y ajusta las pausas del guion a la voz hasta que todo quede estable:
//   1. una pasada (cada capítulo puede partir de la sesión que dejó otro: Escena.abrir(n, { sesion: n - 1 }))
//   2. autoajustar.mjs mira cuándo terminaron las acciones de cada frase y alarga o acorta las pausas (extra) del guion
//   3. se vuelven a grabar solo los capítulos cuyos tiempos cambiaron, y otra vez a ajustar, hasta «sin cambios» (máximo 4 vueltas)
// Mientras graba, NO pongas a la computadora a hacer nada pesado (render, otra grabación): las acciones van en tiempo
// real contra la voz y el retraso por carga se anota como falla y desajusta las pausas.
//
// Uso: node grabar.mjs                 todos los capítulos
//      node grabar.mjs --cambiados     solo los que cambiaron (guion, voz, pausas o su script)
//      node grabar.mjs 2 3             solo esos capítulos
// La app tiene que estar respondiendo en proyecto.json → app.url («node hacer.mjs grabar» la arranca si hace falta).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const P = JSON.parse(fs.readFileSync('proyecto.json', 'utf8'));
const args = process.argv.slice(2);
const soloCambiados = args.includes('--cambiados');
const solo = args.filter(a => /^\d+$/.test(a)).map(Number);
const falla = m => { console.error('FALLA: ' + m); process.exit(1); };

const { CAPITULOS } = await import('./guion.mjs');
const caps = CAPITULOS.map(c => c.id).filter(n => !solo.length || solo.includes(Number(n)));
const faltan = caps.filter(n => !fs.existsSync(`grabacion/cap${n}.mjs`));
if (faltan.length) falla(`falta el guion de grabación de ${faltan.map(n => `grabacion/cap${n}.mjs`).join(', ')}. Cómo se escribe: grabacion/README.md.`);

// ¿Responde la app?
try {
  const r = await fetch(P.app.url, { signal: AbortSignal.timeout(8000) });
  if (r.status >= 500) falla(`la app contesta con error ${r.status} en ${P.app.url}`);
} catch (e) { falla(`la app no responde en ${P.app.url} (${e.cause?.code || e.message}). Arráncala con «node hacer.mjs app» o revisa app.url.`); }

// Chrome guarda su perfil temporal en TEMP: se le da una carpeta propia y se borra al terminar (aunque algo falle)
const tmpChrome = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-grabar-'));
const env = { ...process.env, TEMP: tmpChrome, TMP: tmpChrome, TMPDIR: tmpChrome };
const limpiar = () => { try { fs.rmSync(tmpChrome, { recursive: true, force: true }); } catch { /* lo intentará el sistema */ } };
process.on('exit', limpiar);
process.on('SIGINT', () => { limpiar(); process.exit(130); });

const mtime = f => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
/** Tiempos y firmas de cada capítulo, leídos en un proceso aparte: autoajustar.mjs reescribe guion.mjs entre vuelta y vuelta. */
function leerTiempos() {
  const js = "import('./tiempos.mjs').then(m=>{const T=m.tiempos();const o={};for(const k in T)o[k]={total:T[k].total,firma:m.firmaCapitulo(T[k])};console.log(JSON.stringify(o))})";
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', js], { encoding: 'utf8' });
  if (r.status !== 0) falla('no pude calcular los tiempos: ' + (r.stderr || '').split('\n').find(l => l.trim()) );
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
/**
 * ¿La grabación del capítulo sigue valiendo? Mismos tiempos (firma), su script y el grabador no cambiaron después, y no es una
 * grabación que falló: la que vio una palabra prohibida o no pasó el control del vigilante queda escrita (para revisarla), pero
 * nunca cuenta como vigente.
 */
function vigente(n, T) {
  const json = `media/cap${n}.json`;
  if (!fs.existsSync(json) || !fs.existsSync(`media/cap${n}.mp4`)) return false;
  const L = JSON.parse(fs.readFileSync(json, 'utf8'));
  if (L.prohibidas?.length || ((P.palabrasProhibidas || []).length && !L.vigilante?.control?.ok)) return false;
  // si cambiaron las palabras prohibidas, el vigilante tiene que volver a revisar la pantalla
  if (JSON.stringify(L.vigilante?.palabras || []) !== JSON.stringify(P.palabrasProhibidas || [])) return false;
  return L.firma === T[n]?.firma && mtime(`grabacion/cap${n}.mjs`) < mtime(json) && mtime('grabacion/escena.mjs') < mtime(json) && mtime('grabacion/lib.mjs') < mtime(json);
}
async function pasada(soloLoQueCambio) {
  let grabados = 0;
  const T = leerTiempos();
  for (const n of caps) {
    if (soloLoQueCambio && vigente(n, T)) { console.log(`cap${n}: vigente`); continue; }
    const r = spawnSync(process.execPath, [`grabacion/cap${n}.mjs`], { stdio: 'inherit', env });
    if (r.status !== 0) falla(`el capítulo ${n} no se pudo grabar (arriba dice por qué).`);
    grabados++;
  }
  return grabados;
}
const ajustar = () => {
  const r = spawnSync(process.execPath, ['autoajustar.mjs'], { encoding: 'utf8' });
  if (r.status !== 0) falla('autoajustar.mjs: ' + (r.stderr || r.stdout));
  return r.stdout.trim();
};

console.log(soloCambiados ? '=== pasada de lo que cambió' : '=== pasada completa');
await pasada(soloCambiados);
let aj = ajustar(); console.log(aj);
for (let i = 1; i <= 4 && aj !== 'sin cambios'; i++) {
  console.log(`=== vuelta ${i}: se graba otra vez lo que cambió`);
  await pasada(true);
  aj = ajustar(); console.log(aj);
}
if (aj !== 'sin cambios') console.log('AVISO: las pausas siguen cambiando después de 4 vueltas. Revisa los retrasos de arriba: quizá la máquina está ocupada o una acción tarda distinto cada vez.');
else {
  const n = await pasada(true);   // lo último que cambió se graba con las pausas finales
  if (n) { aj = ajustar(); if (aj !== 'sin cambios') console.log('AVISO: el último ajuste cambió pausas otra vez:\n' + aj); }
  console.log('ESTABLE: la pantalla y la voz caminan juntas.');
}
const T = leerTiempos(); let suma = 0;
for (const c of CAPITULOS) { suma += T[c.id].total; console.log(`  capítulo ${c.id} (${c.rotulo}): ${T[c.id].total.toFixed(1)} s`); }
console.log(`  suma: ${suma.toFixed(1)} s`);
