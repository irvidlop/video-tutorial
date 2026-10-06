// Mide las ENTRADAS sin renderizar: abre cada una en Chrome, mueve su línea de tiempo y revisa en el DOM que
//  - todas duren lo mismo, y la voz termine 0.9 s antes del final (para que el empalme caiga en silencio)
//  - el título y la línea de «para quién» quepan en el cuadro, estén completos a la vista y no lleven nada encima
//  - cada subtítulo: a lo más 2 renglones, dentro del cuadro y debajo del título
//  - el último cuadro sea solo el fondo (el título ya se fue): así el empalme con el cuerpo no se nota
//  - los adornos del fondo no tapen nada que se lea, y las letras hayan cargado
// Usa tmp/entradas/<versión>/ si ya existe (lo que se renderizó); si no, la arma.
// Uso: node medir-entrada.mjs [versión ...]       (sin versiones: todas). Escribe tmp/medicion-entradas.json
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lanzarChrome } from './grabacion/lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const { duracionEntrada, COLA_ENTRADA } = await import('./entradas.mjs');
const { W, SUB_TOP } = await import('./capas.mjs');
const P = JSON.parse(fs.readFileSync('proyecto.json', 'utf8'));
const todas = (P.versiones || []).map(v => v.id);
const versiones = process.argv.slice(2).length ? process.argv.slice(2) : todas;
const D = duracionEntrada();
const res = { D, entradas: {}, fallas: [] };
const falla = (v, m) => { res.fallas.push(`${v}: ${m}`); console.log(`  FALLA ${v}: ${m}`); };
const solapa = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const browser = await lanzarChrome();   // el de la variable CHROME, el Chrome instalado o Edge
for (const v of versiones) {
  if (!todas.includes(v)) { falla(v, 'versión desconocida'); continue; }
  const dir = path.join('tmp', 'entradas', v);
  if (!fs.existsSync(path.join(dir, 'index.html'))) {
    const r = spawnSync(process.execPath, ['construir-entrada.mjs', v, '--sin-cuerpo'], { encoding: 'utf8' });
    if (r.status !== 0) { falla(v, 'no se pudo armar: ' + (r.stderr || r.stdout).trim().split('\n').pop()); continue; }
  }
  const S = JSON.parse(fs.readFileSync(path.join(dir, 'resumen.json'), 'utf8'));
  const K = S.K || 1;
  const E = res.entradas[v] = { D: S.D, voz: { arranca: S.arranque, termina: S.voz.at(-1).t1 }, medidas: [] };
  if (Math.abs(S.D - D) > 1e-6) falla(v, `dura ${S.D} s y las entradas ahora duran ${D} s: vuelve a armarla`);
  if (Math.abs(S.D - S.voz.at(-1).t1 - COLA_ENTRADA) > 0.02) falla(v, `la voz termina ${(S.D - S.voz.at(-1).t1).toFixed(2)} s antes del final (deben ser ${COLA_ENTRADA})`);
  const page = await browser.newPage({ viewport: { width: Math.round(W * K), height: Math.round(1080 * K) } });
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto(pathToFileURL(path.resolve(dir, 'index.html')).href, { waitUntil: 'load', timeout: 30000 });
  // ojo: no devolver la línea de tiempo de GSAP desde una evaluación (es «thenable» y Playwright se queda esperando)
  await page.waitForFunction(() => !!(window.__timelines && window.__timelines.main) && document.fonts.status === 'loaded', null, { timeout: 30000 });
  const medir = async t => {
    await page.evaluate(t => { window.__timelines.main.time(t, false); }, t);
    return page.evaluate(K => {
      const op = e => { let o = 1; for (let x = e; x && x !== document.body; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return o; };
      // del título importa dónde cae el TEXTO (sus renglones), no la caja del bloque, que ocupa todo el ancho
      const texto = e => {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const b of rg.getClientRects()) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom); } }
        return { x: x0 / K, y: y0 / K, w: (x1 - x0) / K, h: (y1 - y0) / K };
      };
      const caja = e => { const b = e.getBoundingClientRect(); return { x: b.x / K, y: b.y / K, w: b.width / K, h: b.height / K }; };
      const q = s => document.querySelector(s);
      const subs = [...document.querySelectorAll('.sub')].filter(e => op(e) > 0.5).map(e => ({ txt: e.textContent, ...caja(e), lh: parseFloat(getComputedStyle(e).lineHeight), pad: parseFloat(getComputedStyle(e).paddingTop) + parseFloat(getComputedStyle(e).paddingBottom), cortado: e.scrollWidth > e.clientWidth + 1 }));
      const adornos = [...document.querySelectorAll('.ficha, .punto')].filter(e => op(e) > 0.05).map(e => ({ id: e.id, ...caja(e) }));
      return { h1: texto(q('#intro h1')), p: texto(q('#intro p')), opIntro: op(q('#intro')), opH1: op(q('#intro h1')), opP: op(q('#intro p')), hijos: q('#intro').children.length, subs, adornos };
    }, K);
  };
  const instantes = [...S.subs.map(s => (s.t0 + s.t1) / 2), Math.max(1.8, S.arranque - 0.1), S.D - COLA_ENTRADA - 0.1, S.D - 0.02];
  for (const t of instantes) E.medidas.push({ t: +t.toFixed(2), ...(await medir(t)) });
  const titulo = E.medidas.at(-2), ultimo = E.medidas.at(-1);
  if (titulo.opH1 < 0.99 || titulo.opP < 0.99) falla(v, `el título no está del todo a la vista cuando la voz termina (${titulo.opH1.toFixed(2)}, ${titulo.opP.toFixed(2)})`);
  if (titulo.hijos !== 2) falla(v, `el bloque del título tiene ${titulo.hijos} piezas: va solo el título y la línea de «para quién» (nada de etiquetas encima)`);
  if (titulo.h1.x < 60 || titulo.h1.x + titulo.h1.w > W - 60) falla(v, `el título se sale o queda pegado al borde (x ${titulo.h1.x.toFixed(0)}, ancho ${titulo.h1.w.toFixed(0)})`);
  if (titulo.p.x < 60 || titulo.p.x + titulo.p.w > W - 60) falla(v, `la línea de «para quién» se sale (x ${titulo.p.x.toFixed(0)}, ancho ${titulo.p.w.toFixed(0)})`);
  if (titulo.p.y + titulo.p.h > SUB_TOP - 20) falla(v, 'la línea de «para quién» baja a la zona de los subtítulos');
  for (const m of E.medidas) {
    for (const s of m.subs) {
      const renglones = Math.round((s.h - s.pad) / s.lh);
      if (renglones > 2) falla(v, `subtítulo de ${renglones} renglones: «${s.txt.slice(0, 50)}»`);
      if (s.cortado) falla(v, `subtítulo cortado: «${s.txt.slice(0, 50)}»`);
      if (s.x < 40 || s.x + s.w > W - 40) falla(v, `subtítulo fuera del cuadro: «${s.txt.slice(0, 50)}»`);
      if (m.opIntro > 0.05 && s.y < titulo.p.y + titulo.p.h + 20) falla(v, `el subtítulo «${s.txt.slice(0, 40)}» queda pegado al título`);
    }
    const leer = [...m.subs, ...(m.opIntro > 0.05 ? [titulo.h1, titulo.p] : [])];
    for (const a of m.adornos) for (const l of leer) if (solapa(a, l)) falla(v, `en ${m.t} s el adorno ${a.id} tapa texto`);
  }
  // los adornos contra el título, también en cuadros intermedios
  for (let t = 0.5; t < S.D; t += 0.5) { const m = await medir(t); if (m.opIntro > 0.05) for (const a of m.adornos) for (const l of [m.h1, m.p]) if (solapa(a, l)) { falla(v, `en ${t.toFixed(1)} s el adorno ${a.id} tapa el título`); break; } }
  if (ultimo.opIntro > 0.02) falla(v, `el título sigue a la vista en el último cuadro (${ultimo.opIntro.toFixed(2)}): el empalme con el cuerpo se notaría`);
  if (ultimo.subs.length) falla(v, 'hay un subtítulo en el último cuadro');
  const familia = await page.evaluate(() => (getComputedStyle(document.documentElement).getPropertyValue('--letra-titulo').match(/"([^"]+)"/) || [])[1]);
  if (familia && !(await page.evaluate(n => document.fonts.check(`800 60px "${n}"`), familia))) falla(v, `la letra «${familia}» no cargó`);
  for (const e of errores) falla(v, 'error de JavaScript: ' + e);
  await page.close();
  console.log(`${v.padEnd(14)} ${S.D} s · título ${titulo.h1.w.toFixed(0)} x ${titulo.h1.h.toFixed(0)} px · línea ${titulo.p.w.toFixed(0)} px · ${S.subs.length} subtítulos · voz de ${S.arranque.toFixed(2)} a ${S.voz.at(-1).t1.toFixed(2)} s`);
}
await browser.close();
fs.mkdirSync('tmp', { recursive: true });
fs.writeFileSync('tmp/medicion-entradas.json', JSON.stringify(res, null, 1));
console.log(res.fallas.length ? `\n${res.fallas.length} FALLA(S) en las entradas` : 'Entradas medidas: todo dentro del cuadro y sin choques.');
process.exit(res.fallas.length ? 1 : 0);
