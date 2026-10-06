// Crea un proyecto de video nuevo copiando la plantilla de la skill.
//
//   node <skill>/scripts/nuevo.mjs <carpeta>                      crea la carpeta y corre «npm install» ahí
//   node <skill>/scripts/nuevo.mjs <carpeta> --titulo "Cómo usar la Mesa de ayuda, paso a paso"
//   node <skill>/scripts/nuevo.mjs <carpeta> --ejemplo            el proyecto de ejemplo (la Mesa de ayuda), listo para correr
//   node <skill>/scripts/nuevo.mjs <carpeta> --sin-instalar       sin «npm install» (lo corres después)
//
// La carpeta no debe existir o debe estar vacía. Se copia todo plantilla/ menos lo que se genera (videos, voz, cachés) y se
// agregan revisar-entorno.mjs (para «node hacer.mjs entorno») y un .gitignore: los MP4 y las grabaciones pesan y no van a git.
// Después: llena proyecto.json y guion.mjs, y escribe los capítulos en grabacion/capN.mjs (ver grabacion/README.md).
// Con --ejemplo, además se copian encima proyecto.json, guion.mjs y grabacion/capN.mjs de ejemplo/, y app.arrancar apunta a
// la app de ejemplo desde la carpeta nueva: basta «node hacer.mjs todo».
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PLANTILLA = path.join(AQUI, '..', 'plantilla');
const EJEMPLO = path.join(AQUI, '..', 'ejemplo');
const args = process.argv.slice(2);
const falla = m => { console.error('FALLA: ' + m); process.exit(1); };
const op = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const destinoArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--titulo');
if (!destinoArg) falla('falta la carpeta: node scripts/nuevo.mjs <carpeta> [--titulo "..."] [--ejemplo] [--sin-instalar]');
const conEjemplo = args.includes('--ejemplo');
if (conEjemplo && args.includes('--titulo')) falla('--ejemplo ya trae su título: usa uno u otro.');
const destino = path.resolve(destinoArg);
if (!fs.existsSync(PLANTILLA)) falla('no encuentro la plantilla en ' + PLANTILLA);
if (fs.existsSync(destino) && fs.readdirSync(destino).length) falla(`${destino} ya existe y no está vacía: elige otra carpeta (nunca se pisa un proyecto).`);

// lo que se genera al hacer el video: no se copia
const GENERADO = [
  /^node_modules([\\/]|$)/, /^tmp([\\/]|$)/, /^out([\\/]|$)/, /^media([\\/]|$)/, /^renders([\\/]|$)/,
  /^voz[\\/](?!(voz|muestras|comprobar)\.py$)/, /^assets[\\/]audio([\\/]|$)/, /^assets[\\/]gsap\.min\.js$/,
  /^index\.html$/, /^GUION\.md$/, /^compositions[\\/]cierre\.html$/, /^package-lock\.json$/, /^grabacion[\\/]cap\d+\.mjs$/,
];
/**
 * Copia un archivo o una carpeta completa y devuelve cuántos archivos copió. No usa fs.cpSync: en Windows, con Node 22, cpSync
 * truena sin decir nada (sale con código 127) al copiar desde una ruta con acentos a una carpeta que ya existe en otra sin acentos.
 */
function copiarTodo(de, a, filtro = () => true) {
  if (!filtro(de)) return 0;
  if (fs.statSync(de).isDirectory()) {
    fs.mkdirSync(a, { recursive: true });
    let k = 0;
    for (const nombre of fs.readdirSync(de)) k += copiarTodo(path.join(de, nombre), path.join(a, nombre), filtro);
    return k;
  }
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.copyFileSync(de, a);
  return 1;
}
fs.mkdirSync(destino, { recursive: true });
const n = copiarTodo(PLANTILLA, destino, f => { const rel = path.relative(PLANTILLA, f); return !rel || !GENERADO.some(re => re.test(rel)); });
fs.copyFileSync(path.join(AQUI, 'revisar-entorno.mjs'), path.join(destino, 'revisar-entorno.mjs'));
fs.mkdirSync(path.join(destino, 'grabacion'), { recursive: true });
fs.mkdirSync(path.join(destino, 'voz'), { recursive: true });
fs.writeFileSync(path.join(destino, '.gitignore'), [
  '# lo que se genera al hacer el video (se rehace con node hacer.mjs)',
  'node_modules/', 'tmp/', 'out/', 'media/', 'renders/', 'assets/audio/', 'assets/gsap.min.js',
  'voz/*.wav', 'voz/muestras/', 'voz/comprobacion.json', 'index.html', 'compositions/cierre.html', '',
].join('\n'));

// nombre del proyecto y título
const nombre = path.basename(destino).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'video-tutorial';
const pkgF = path.join(destino, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgF, 'utf8')); pkg.name = nombre; fs.writeFileSync(pkgF, JSON.stringify(pkg, null, 2) + '\n');
const titulo = op('--titulo');
if (titulo) {
  const pf = path.join(destino, 'proyecto.json');
  const P = JSON.parse(fs.readFileSync(pf, 'utf8'));
  P.titulo = titulo; P.nombreArchivo = nombre;
  fs.writeFileSync(pf, JSON.stringify(P, null, 2) + '\n');
  const gf = path.join(destino, 'guion.mjs');
  fs.writeFileSync(gf, fs.readFileSync(gf, 'utf8').replace(/export const TITULO = '[^']*';/, `export const TITULO = '${titulo.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';`));
}
console.log(`Proyecto creado en ${destino} (${n} archivos de la plantilla).`);

// el proyecto de ejemplo: su proyecto.json, su guion y sus capítulos, con la app de ejemplo a la mano
if (conEjemplo) {
  const caps = fs.existsSync(path.join(EJEMPLO, 'grabacion')) ? fs.readdirSync(path.join(EJEMPLO, 'grabacion')).filter(f => /^cap\d+\.mjs$/.test(f)) : [];
  if (!caps.length) falla('no encuentro los capítulos de ejemplo en ' + path.join(EJEMPLO, 'grabacion'));
  for (const f of ['proyecto.json', 'guion.mjs']) fs.copyFileSync(path.join(EJEMPLO, f), path.join(destino, f));
  for (const f of caps) fs.copyFileSync(path.join(EJEMPLO, 'grabacion', f), path.join(destino, 'grabacion', f));
  // los pasos corren desde la carpeta del proyecto: app.arrancar va con la ruta a servidor.mjs desde ahí (entre comillas por si lleva espacios)
  const pf = path.join(destino, 'proyecto.json');
  const P = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const rel = path.relative(destino, path.join(EJEMPLO, 'app', 'servidor.mjs')).split(path.sep).join('/');
  const arrancar = `node ${/\s/.test(rel) ? `"${rel}"` : rel} --puerto ${P.app.puerto}`;
  if (P.app.arrancar !== arrancar) { P.app.arrancar = arrancar; fs.writeFileSync(pf, JSON.stringify(P, null, 2) + '\n'); }
  console.log(`Con el ejemplo: proyecto.json, guion.mjs y ${caps.length} capítulos (${caps.join(', ')}). La app arranca con: ${arrancar}`);
}

if (!args.includes('--sin-instalar')) {
  console.log('> npm install   (HyperFrames, playwright-core y GSAP; unos 180 MB, tarda un minuto)');
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: destino, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) falla('npm install no terminó bien. Revisa la conexión y córrelo a mano en la carpeta del proyecto.');
}
if (conEjemplo) {
  console.log(`
Siguiente paso, desde ${destino}:
  node hacer.mjs todo                revisa el entorno, genera la voz, arranca la app, graba, arma, renderiza, une, verifica
                                     y deja los videos en out/ (unos 15 minutos; mientras graba, no pongas a la computadora
                                     a hacer nada pesado)`);
  process.exit(0);
}
console.log(`
Siguientes pasos (todo desde ${destino}):
  1. node hacer.mjs entorno          revisa que esté todo instalado
  2. proyecto.json                   título, app (url y cómo arrancarla), versiones, palabras prohibidas, marca, contacto, música
  3. node hacer.mjs muestras         cuatro voces para elegir; la elegida va en proyecto.json → voz
  4. guion.mjs                       el texto (referencias/guion.md de la skill)
  5. grabacion/capN.mjs              un archivo por capítulo (grabacion/README.md)
  6. node hacer.mjs todo             voz, grabación, montaje, render, entradas, unión, verificación y versiones ligeras`);
