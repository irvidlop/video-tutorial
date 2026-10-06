// Mide el CUERPO (index.html) en Chrome, sin renderizar: abre la composición, mueve la línea de tiempo a cada momento que importa
// y mide en el DOM. Nada a ojo. Revisa:
//  1. cada señal cayó sobre su elemento: la traza medida al grabar no se movió más de 8 px mientras la señal estuvo a la vista
//  2. cada señal y su etiqueta: una a la vez, dentro de la zona libre, sin pisar subtítulos ni el rótulo del capítulo
//  3. subtítulos: a lo más 2 renglones, dentro del cuadro, sin texto cortado, con contraste AA sobre blanco y sobre negro
//  4. ninguna palabra prohibida en pantalla: ni en la grabación (vigilante, con su control positivo) ni en lo que se dibuja encima
//  5. la voz: sin frases encimadas y terminando antes del cierre
//  6. la tarjeta de contacto: el nombre y el dato exactos, completos, y a la vista al menos 4 s
//  7. los adornos del fondo nunca tapan algo que se lee; las letras cargaron
// Uso: node medir.mjs        (después de construir; escribe tmp/medicion.json; sale con error si algo no cumple)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lanzarChrome } from './grabacion/lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const { reProhibidas } = await import('./tiempos.mjs');
const { contraste, OPACIDAD_SUBTITULO } = await import('./tema.mjs');
if (!fs.existsSync('tmp/plan-resumen.json')) { console.error('FALLA: falta tmp/plan-resumen.json: corre «node hacer.mjs construir».'); process.exit(1); }
const R = JSON.parse(fs.readFileSync('tmp/plan-resumen.json', 'utf8'));
const P = JSON.parse(fs.readFileSync('proyecto.json', 'utf8'));
const { CAPITULOS } = await import('./guion.mjs');
const W = 1920, SUB_TOP = R.SUB_TOP, K = R.K;
const res = { fallas: [], avisos: [...(R.avisos || [])], señales: [], subtitulos: {}, contacto: null };
const falla = m => { res.fallas.push(m); console.log('FALLA ' + m); };
for (const f of R.fallas || []) falla('(construir) ' + f);
const solapa = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const TOL = 8;

// ---------------------------------------------------------------- 1 y 4: lo que dice la bitácora de cada grabación
const LOG = {};
for (const c of CAPITULOS) LOG[c.id] = JSON.parse(fs.readFileSync(`media/cap${c.id}.json`, 'utf8'));
for (const s of R.sigs) {
  const L = LOG[s.cap], m = (L.marcas || []).find(x => x.label === s.label && Math.abs(R.V[s.cap] + x.t0 - s.t0) < 3) || null;
  const t0 = s.t0 - R.V[s.cap], t1 = s.t1 - R.V[s.cap];
  let peor = 0, muestras = 0, sinElemento = 0;
  for (const [t, x, y, w, h] of m?.traza || []) {
    if (t < t0 || t > t1) continue;
    muestras++;
    if (x == null) { sinElemento++; continue; }
    peor = Math.max(peor, Math.abs(x - s.elemento.x), Math.abs(y - s.elemento.y), Math.abs(w - s.elemento.w), Math.abs(h - s.elemento.h));
  }
  const r = { cap: s.cap, label: s.label, t0: s.t0, t1: s.t1, muestrasTraza: muestras, desvioMaxPx: +peor.toFixed(1) };
  if (m?.traza?.length && !muestras) falla(`señal «${s.label}» (cap. ${s.cap}): no hay medidas del elemento mientras se ve`);
  if (sinElemento) falla(`señal «${s.label}» (cap. ${s.cap}): su elemento desapareció ${sinElemento} veces mientras se veía`);
  if (peor > TOL) falla(`señal «${s.label}» (cap. ${s.cap}, ${s.t0} s): su elemento se movió ${peor.toFixed(1)} px mientras se veía (máximo ${TOL})`);
  res.señales.push(r);
}
for (const o of R.omitidas || []) falla(`señal «${o.label}» (cap. ${o.cap}) quedó fuera: su elemento no estuvo quieto a la vista`);
const palabras = P.palabrasProhibidas || [];
for (const c of CAPITULOS) {
  const L = LOG[c.id], vg = L.vigilante || {};
  if (L.prohibidas?.length) falla(`capítulo ${c.id}: el vigilante vio texto prohibido en pantalla (${[...new Set(L.prohibidas.flatMap(x => x.palabras))].join(', ')})`);
  if (palabras.length) {
    if (!vg.control?.ok) falla(`capítulo ${c.id}: no pasó (o no corrió) el control positivo del vigilante`);
    if (!vg.revisiones || vg.revisiones < (L.video?.duracion || 0) / 0.7) falla(`capítulo ${c.id}: el vigilante revisó la pantalla muy pocas veces (${vg.revisiones || 0})`);
  }
}

// ---------------------------------------------------------------- 2, 3, 6 y 7: la composición en Chrome
const browser = await lanzarChrome();   // el de la variable CHROME, el Chrome instalado o Edge
const page = await browser.newPage({ viewport: { width: R.ancho, height: R.alto } });
const errores = [];
page.on('pageerror', e => errores.push(e.message));
await page.goto(pathToFileURL(path.join(AQUI, 'index.html')).href, { waitUntil: 'load', timeout: 60000 });
// ojo: la línea de tiempo de GSAP es «thenable»; si una evaluación la devuelve, Playwright se queda esperando para siempre
await page.waitForFunction(() => !!(window.__timelines && window.__timelines.main) && document.fonts.status === 'loaded', null, { timeout: 30000 });
const en = async (t, fn, arg) => { await page.evaluate(t => { window.__timelines.main.time(t, false); }, t); return page.evaluate(fn, arg); };
const MEDIDAS = (K) => {
  const op = e => { let o = 1; for (let x = e; x && x !== document.body; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return o; };
  const r = e => { const b = e.getBoundingClientRect(); return { x: b.x / K, y: b.y / K, w: b.width / K, h: b.height / K }; };
  const vis = s => [...document.querySelectorAll(s)].filter(e => op(e) > 0.9);
  return {
    sgs: vis('.sg').map(e => ({ id: e.id, ...r(e) })),
    lbs: vis('.lb').map(e => ({ id: e.id, txt: e.textContent, ...r(e) })),
    subs: vis('.sub').map(e => ({ id: e.id, txt: e.textContent, ...r(e), lh: parseFloat(getComputedStyle(e).lineHeight) / 1, pad: parseFloat(getComputedStyle(e).paddingTop) + parseFloat(getComputedStyle(e).paddingBottom), cortado: e.scrollWidth > e.clientWidth + 1 })),
    caps: vis('.cap').map(e => ({ id: e.id, ...r(e) })),
    adornos: [...document.querySelectorAll('.ficha, .punto')].filter(e => op(e) > 0.05).map(e => ({ id: e.id, ...r(e) })),
    win: r(document.querySelector('#win')),
  };
};
// 3. subtítulos: cada uno a la mitad de su tiempo
let maxRenglones = 0;
const colores = await page.evaluate(() => { const e = document.querySelector('.sub'); if (!e) return null; const s = getComputedStyle(e); return { color: s.color, fondo: s.backgroundColor }; });
for (const s of R.subs) {
  const m = await en((s.t0 + s.t1) / 2, MEDIDAS, K);
  const sb = m.subs.find(x => x.id === s.id);
  if (!sb) { falla(`subtítulo «${s.texto.slice(0, 40)}» no está a la vista a la mitad de su tiempo (${((s.t0 + s.t1) / 2).toFixed(2)} s)`); continue; }
  const renglones = Math.round((sb.h - sb.pad) / sb.lh);
  maxRenglones = Math.max(maxRenglones, renglones);
  if (renglones > 2) falla(`subtítulo de ${renglones} renglones: «${s.texto.slice(0, 60)}»`);
  if (sb.cortado) falla(`subtítulo cortado: «${s.texto.slice(0, 60)}»`);
  if (sb.x < 40 || sb.x + sb.w > W - 40) falla(`subtítulo fuera del cuadro: «${s.texto.slice(0, 50)}» (x ${sb.x.toFixed(0)}, ancho ${sb.w.toFixed(0)})`);
  if (sb.y < m.win.y + m.win.h - 14 && sb.y < SUB_TOP - 8) falla(`subtítulo «${s.texto.slice(0, 40)}» sube sobre la ventana de la app`);
  for (const lb of m.lbs) if (solapa(lb, sb)) falla(`la etiqueta «${lb.txt}» pisa el subtítulo «${s.texto.slice(0, 30)}»`);
  for (const sg of m.sgs) if (solapa({ x: sg.x + 4, y: sg.y + 4, w: sg.w - 8, h: sg.h - 8 }, sb)) falla(`una señal queda debajo del subtítulo «${s.texto.slice(0, 30)}»`);
}
res.subtitulos = { cuantos: R.subs.length, maxRenglones };
// contraste de los subtítulos: la caja translúcida sobre blanco y sobre negro
if (colores) {
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const [cr, cg, cb] = rgb(colores.color), [fr, fg, fb, fa = 1] = rgb(colores.fondo);
  const sobre = d => hex([fr * fa + d * (1 - fa), fg * fa + d * (1 - fa), fb * fa + d * (1 - fa)]);
  const minimo = Math.min(contraste(hex([cr, cg, cb]), sobre(255)), contraste(hex([cr, cg, cb]), sobre(0)));
  res.subtitulos.contrasteMin = +minimo.toFixed(2);
  if (fa < OPACIDAD_SUBTITULO - 0.01) falla(`la caja de los subtítulos es más transparente (${fa}) de lo que permite el tema (${OPACIDAD_SUBTITULO})`);
  if (minimo < 4.5) falla(`los subtítulos no pasan contraste AA (${minimo.toFixed(2)}:1)`);
}
// 2. señales y etiquetas a la mitad de su tiempo
for (const s of R.sigs) {
  const t = (s.t0 + s.t1) / 2, m = await en(t, MEDIDAS, K);
  if (m.sgs.length !== 1) falla(`en ${t.toFixed(2)} s hay ${m.sgs.length} señales a la vista (debe haber una: «${s.label}»)`);
  const sg = m.sgs[0];
  if (sg) {
    const d = Math.max(Math.abs(sg.x - s.canvas.x), Math.abs(sg.y - s.canvas.y), Math.abs(sg.w - s.canvas.w), Math.abs(sg.h - s.canvas.h));
    if (d > 16) falla(`la señal «${s.label}» quedó ${d.toFixed(0)} px lejos de donde la cámara debía ponerla`);
    if (sg.x < 0 || sg.y < 0 || sg.x + sg.w > W || sg.y + sg.h > SUB_TOP) falla(`la señal «${s.label}» (${t.toFixed(1)} s) se sale de la zona libre`);
    for (const c of m.caps) if (solapa(sg, c) && s.canvas.y < 90) falla(`la señal «${s.label}» pisa el rótulo del capítulo`);
  }
  if (s.label) {
    const lb = m.lbs.find(l => l.txt === s.label);
    if (!lb) falla(`la etiqueta «${s.label}» no está a la vista a la mitad de su señal (${t.toFixed(2)} s)`);
    else {
      if (lb.x < 12 || lb.x + lb.w > W - 12 || lb.y < 0 || lb.y + lb.h > SUB_TOP - 4) falla(`la etiqueta «${s.label}» se sale de la zona libre`);
      for (const c of m.caps) if (solapa(lb, c)) falla(`la etiqueta «${s.label}» pisa el rótulo del capítulo`);
    }
  }
}
// 7. adornos del fondo contra lo que se lee: un cuadro cada medio segundo y, mientras la cámara se mueve, uno cada 0.1 s
// (ahí es cuando los adornos se desplazan rápido: un cruce de un cuarto de segundo cabe entre dos cuadros parejos)
let cuadros = 0;
const instantesAdornos = [];
for (let t = 0.2; t < R.CIERRE_INI; t += 0.5) instantesAdornos.push(t);
for (const c of R.camlog || []) if (c.t1 > c.t0) for (let t = c.t0 + 0.05; t < c.t1 + 0.5 && t < R.CIERRE_INI; t += 0.1) instantesAdornos.push(t);
instantesAdornos.sort((a, b) => a - b);
for (const t of instantesAdornos) {
  const m = await en(t, MEDIDAS, K); cuadros++;
  const leer = [...m.subs, ...m.lbs, ...m.caps];
  for (const a of m.adornos) for (const l of leer) if (solapa(a, l)) { falla(`en ${t.toFixed(1)} s el adorno ${a.id} tapa «${(l.txt || l.id).slice(0, 30)}»`); break; }
}
// 6. la tarjeta de contacto, ya entera a la vista
if (R.contacto) {
  const c = await en(R.contacto.t0 + 0.3, K => {
    const op = e => { let o = 1; for (let x = e; x && x !== document.body; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return o; };
    const r = e => { const b = e.getBoundingClientRect(); return { x: b.x / K, y: b.y / K, w: b.width / K, h: b.height / K }; };
    const q = s => document.querySelector(s);
    const nom = q('#contacto .ct-nombre'), det = q('#contacto .ct-detalle'), card = q('#contacto .ct-tarjeta');
    return { op: op(q('#contacto')), card: r(card), nom: nom && { txt: nom.textContent, ...r(nom), cortado: nom.scrollWidth > nom.clientWidth + 1 }, det: det && { txt: det.textContent, ...r(det), cortado: det.scrollWidth > det.clientWidth + 1 } };
  }, K);
  res.contacto = { ...c, segundosALaVista: R.contacto.segundos };
  if (c.op < 0.99) falla(`la tarjeta de contacto no está del todo a la vista cuando debería (opacidad ${c.op.toFixed(2)})`);
  if (c.nom?.txt !== String(P.contacto.nombre)) falla(`el nombre de la tarjeta dice «${c.nom?.txt}» y debía decir «${P.contacto.nombre}»`);
  if (P.contacto.detalle && c.det?.txt !== String(P.contacto.detalle)) falla(`el dato de la tarjeta dice «${c.det?.txt}» y debía decir «${P.contacto.detalle}»`);
  for (const x of [c.nom, c.det]) if (x && (x.cortado || x.x < c.card.x || x.x + x.w > c.card.x + c.card.w)) falla(`«${x.txt}» no cabe en la tarjeta de contacto`);
  if (c.card.x < 40 || c.card.x + c.card.w > W - 40) falla('la tarjeta de contacto se sale del cuadro o queda pegada al borde');
  if (c.card.y + c.card.h > SUB_TOP - 20) falla('la tarjeta de contacto invade la zona de subtítulos');
  if (R.contacto.segundos < 4) falla(`la tarjeta de contacto se ve completa solo ${R.contacto.segundos} s (se piden 4)`);
}
// 3b. todo texto dibujado encima del video lleva fondo propio y se lee: si su fondo sale transparente (una variable sin definir,
// por ejemplo), la letra queda sobre lo que tenga la app debajo y puede no leerse. Se mide el color calculado, no el que se quiso.
{
  const fondos = await page.evaluate(() => {
    const rgba = s => (s.match(/[\d.]+/g) || []).map(Number);
    const out = [];
    for (const sel of ['.cap span', '.cap b', '.lb', '.sub', '#contacto .ct-nombre', '#contacto .ct-detalle']) {
      const e = document.querySelector(sel); if (!e) continue;
      let f = null;
      for (let x = e; x && x.id !== 'ui' && x !== document.body; x = x.parentElement) { const c = rgba(getComputedStyle(x).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.01) { f = c; break; } }
      out.push({ sel, letra: rgba(getComputedStyle(e).color), fondo: f });
    }
    return out;
  });
  const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  res.contrasteEncima = {};
  for (const { sel, letra, fondo } of fondos) {
    if (!fondo || (fondo[3] ?? 1) < 0.8) { falla(`«${sel}» no tiene fondo propio (sale ${fondo ? 'casi transparente' : 'transparente'}): su letra queda sobre lo que haya debajo`); continue; }
    const a = fondo[3] ?? 1, sobre = d => hex(fondo.slice(0, 3).map(v => v * a + d * (1 - a)));
    const r = Math.min(contraste(hex(letra), sobre(255)), contraste(hex(letra), sobre(0)));
    res.contrasteEncima[sel] = +r.toFixed(2);
    if (r < 4.5) falla(`«${sel}» no pasa contraste AA (${r.toFixed(2)}:1)`);
  }
}
// 4. lo que se dibuja encima tampoco puede nombrar a una audiencia
const textos = await page.evaluate(() => [...document.querySelectorAll('.sub, .lb, .cap, #contacto')].map(e => e.textContent));
const fuente = reProhibidas(palabras);
if (fuente) { const re = new RegExp(fuente); const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); for (const t of textos) if (re.test(norm(t))) falla(`texto encima del video con palabra prohibida: «${t.slice(0, 60)}»`); }
// letras
const fam = await page.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue('--letra-titulo'), getComputedStyle(document.documentElement).getPropertyValue('--letra-texto')]);
for (const f of fam) { const nombre = (f.match(/"([^"]+)"/) || [])[1]; if (nombre && !(await page.evaluate(n => document.fonts.check(`700 40px "${n}"`), nombre))) falla(`la letra «${nombre}» no cargó`); }
await browser.close();
for (const e of errores) falla('error de JavaScript en la composición: ' + e);

// ---------------------------------------------------------------- 5: la voz
for (let i = 1; i < R.voz.length; i++) if (R.voz[i].t0 < R.voz[i - 1].t1 - 0.01) falla(`dos frases de voz encimadas: ${R.voz[i - 1].id} y ${R.voz[i].id}`);
const ultima = R.voz.at(-1);
res.voz = { frases: R.voz.length, terminaEn: ultima.t1, cierreEmpieza: R.CIERRE_INI, margen: +(R.CIERRE_INI - ultima.t1).toFixed(2) };
if (R.CIERRE_INI - ultima.t1 < 0.3) falla(`la voz termina ${(R.CIERRE_INI - ultima.t1).toFixed(2)} s antes del cierre (se piden al menos 0.3)`);
res.duracion = { cuerpo: R.END, cierre: R.DUR_CIERRE, entrada: R.INTRO_DUR, version: R.INTRO_DUR != null ? +(R.INTRO_DUR + R.END).toFixed(2) : null };
res.cuadrosRevisadosAdornos = cuadros;

fs.writeFileSync('tmp/medicion.json', JSON.stringify(res, null, 1));
console.log(`cuerpo: ${R.sigs.length} señales (desvío máximo ${Math.max(0, ...res.señales.map(s => s.desvioMaxPx))} px), ${R.subs.length} subtítulos (hasta ${maxRenglones} renglones, contraste ${res.subtitulos.contrasteMin ?? '?'}:1), voz termina ${res.voz.margen} s antes del cierre${res.contacto ? `, contacto ${R.contacto.segundos} s a la vista` : ''}, ${cuadros} cuadros revisados por adornos`);
for (const a of res.avisos) console.log('AVISO ' + a);
console.log(res.fallas.length ? `\n${res.fallas.length} FALLA(S) en el cuerpo` : 'Cuerpo medido: todo en orden.');
process.exit(res.fallas.length ? 1 : 0);
