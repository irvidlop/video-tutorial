// El grabador: una escena = un capítulo grabado en Chrome real, contra el reloj de la voz.
// Lo que el video muestra como señal sale de cajas MEDIDAS en el DOM (nunca de coordenadas a mano) y se sigue
// midiendo mientras la señal está a la vista: si la página se mueve debajo, el constructor lo sabe.
// El cursor y el tecleo son humanos (curva que acelera y frena, micro pausa antes del clic, ritmo irregular) con un
// azar de semilla fija: cada corrida sale igual. Un vigilante revisa el texto visible contra palabrasProhibidas.
//
// Uso (un capítulo = un archivo grabacion/capN.mjs; ver grabacion/README.md):
//   const E = await Escena.abrir(1);            // abre Chrome
//   await E.ir();                               // la app (proyecto.json → app.url)
//   await E.iniciar();                          // empieza a grabar: segundo 0 del capítulo
//   await E.escribir('@correo', 'ana@ejemplo.com', { en: ['1.1', 'correo'] });
//   await E.senal('@correo', 'Tu correo', { desde: ['1.1', 'correo'] });
//   await E.frase('1.2');                       // espera a que empiece la frase 1.2
//   await E.clic('@entrar', { en: ['1.2', 'Entrar'] });
//   await E.cerrar();                           // guarda media/cap1.mp4, media/cap1.json y la sesión
import fs from 'node:fs';
import path from 'node:path';
import { abrir, Grabadora, VP, DPR, FPS, sleep, RAIZ, PROYECTO } from './lib.mjs';
import { tiempos, palabra, reProhibidas, firmaCapitulo } from '../tiempos.mjs';

export const MEDIA = path.join(RAIZ, 'media');
const TMP = path.join(RAIZ, 'tmp');
// Avisos flotantes de la app (toasts). Se espera a que se vayan antes de grabar y antes de marcar algo que tapen.
export const AVISOS = '.toast, .snackbar, [class*="toast" i], [class*="snackbar" i], [data-aviso], [role="alert"]';
const TOL = 8;   // píxeles: una señal vale mientras su elemento no se mueva más que esto

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const easeHumano = u => { const a = u * u * (3 - 2 * u); const b = 1 - Math.pow(1 - u, 3); return 0.65 * a + 0.35 * b; };   // acelera suave y frena largo
const r1 = n => Math.round(n * 10) / 10;
const caja1 = b => ({ x: r1(b.x), y: r1(b.y), w: r1(b.w ?? b.width), h: r1(b.h ?? b.height) });

/** «@correo» es atajo de [data-guia="correo"]. Cualquier otro texto es un selector CSS (o de Playwright). */
export const g = id => `[data-guia="${id}"]`;
const css = s => (typeof s === 'string' ? (s.startsWith('@') ? g(s.slice(1)) : s) : null);
const nombre = s => (typeof s === 'string' ? s : (s && s.toString ? s.toString() : 'elemento'));

// ---------------------------------------------------------------- funciones que corren DENTRO de la página
// Caja del primer elemento VISIBLE de cada selector CSS (null si no hay; {error} si el selector no es CSS).
const CAJAS = (sels) => sels.map((s) => {
  let lista;
  try { lista = document.querySelectorAll(s); } catch { return { error: 'selector' }; }
  for (const el of lista) {
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) continue;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  return null;
});
// Lo que ve la pantalla ahora: desplazamiento de la página y cajas de las señales activas.
const MUESTRA = (sels) => {
  const cajas = sels.map((s) => {
    let lista; try { lista = document.querySelectorAll(s); } catch { return null; }
    for (const el of lista) {
      const b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue;
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      return [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, Math.round(b.width * 10) / 10, Math.round(b.height * 10) / 10];
    }
    return null;
  });
  return { y: Math.round(window.scrollY * 10) / 10, cajas };
};
// Vigilante: palabras prohibidas en el texto VISIBLE en pantalla (no lo oculto, no las opciones sin elegir de un
// <select>, no lo que está fuera de la pantalla, no las contraseñas). `fuente` es una expresión para texto sin acentos.
export const VIGILAR = (fuente) => {
  const reG = new RegExp(fuente, 'g'), re1 = new RegExp(fuente);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const W = window.innerWidth, H = window.innerHeight;
  const enPantalla = rects => { for (const b of rects) if (b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < W && b.top < H) return true; return false; };
  const visible = el => !el.checkVisibility || el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const out = new Set();
  const mira = (txt, rects) => { const t = norm(txt); if (!re1.test(t) || !enPantalla(rects)) return; for (const m of t.match(reG) || []) out.add(m.replace(/\s+/g, ' ')); };
  const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('script,style,template,noscript,select,datalist,option,optgroup,textarea')) continue;
    const txt = n.textContent;
    if (!txt || !re1.test(norm(txt)) || !visible(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    mira(txt, rg.getClientRects());
  }
  for (const s of document.querySelectorAll('select')) { if (!visible(s)) continue; const o = s.selectedOptions && s.selectedOptions[0]; if (o) mira(o.textContent, s.getClientRects()); }
  for (const i of document.querySelectorAll('input, textarea')) {
    const tipo = (i.type || '').toLowerCase();
    if (['password', 'hidden', 'checkbox', 'radio', 'file', 'range', 'color'].includes(tipo) || !visible(i)) continue;
    mira(i.value || i.placeholder || '', i.getClientRects());
  }
  return [...out];
};
// Avisos flotantes visibles (y, con `caja`, solo los que la tapan). `propio`: lo que se va a señalar; si es un aviso, no cuenta.
const AVISOS_VISIBLES = ([sel, caja, propio]) => {
  let lista; try { lista = document.querySelectorAll(sel); } catch { return []; }
  let objetivo = null;
  if (propio) { try { for (const x of document.querySelectorAll(propio)) { const b = x.getBoundingClientRect(); if (b.width >= 1 && b.height >= 1) { objetivo = x; break; } } } catch { /* no es CSS */ } }
  const out = [];
  for (const el of lista) {
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || !(el.textContent || '').trim()) continue;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    if (b.bottom <= 0 || b.top >= window.innerHeight) continue;
    if (objetivo && (el.contains(objetivo) || objetivo.contains(el))) continue;
    if (caja && !(b.x < caja.x + caja.w && caja.x < b.right && b.y < caja.y + caja.h && caja.y < b.bottom)) continue;
    out.push((el.textContent || '').trim().slice(0, 60));
  }
  return out;
};
// Contenedor que se desplaza para dejar a la vista un elemento: la página o una caja con barra propia.
const DESPLAZABLE = ([s, margen]) => {
  let el = null;
  try { for (const x of document.querySelectorAll(s)) { const b = x.getBoundingClientRect(); if (b.width >= 1 && b.height >= 1) { el = x; break; } } } catch { return { error: 'selector' }; }
  if (!el) return null;
  for (let x = el; x && x !== document.body; x = x.parentElement) if (getComputedStyle(x).position === 'fixed') return { fijo: true };   // un modal o una barra fija: no hay nada que desplazar
  let c = el.parentElement;
  while (c && c !== document.body && c !== document.documentElement) {
    const st = getComputedStyle(c);
    if (/(auto|scroll|overlay)/.test(st.overflowY) && c.scrollHeight > c.clientHeight + 2) break;
    c = c.parentElement;
  }
  const b = el.getBoundingClientRect();
  if (!c || c === document.body || c === document.documentElement) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return { interno: false, desde: window.scrollY, hasta: Math.max(0, Math.min(max, window.scrollY + b.top - margen)) };
  }
  const cb = c.getBoundingClientRect();
  const max = c.scrollHeight - c.clientHeight;
  return { interno: true, desde: c.scrollTop, hasta: Math.max(0, Math.min(max, c.scrollTop + (b.top - cb.top) - margen)) };
};
const PONER_DESPLAZAMIENTO = ([s, y, interno]) => {
  if (!interno) { window.scrollTo(0, y); return; }
  let el = null; for (const x of document.querySelectorAll(s)) { const b = x.getBoundingClientRect(); if (b.width >= 1 && b.height >= 1) { el = x; break; } }
  let c = el && el.parentElement;
  while (c && c !== document.body) { const st = getComputedStyle(c); if (/(auto|scroll|overlay)/.test(st.overflowY) && c.scrollHeight > c.clientHeight + 2) break; c = c.parentElement; }
  if (c && c !== document.body) c.scrollTop = y;
};

// ---------------------------------------------------------------- control positivo del vigilante
/**
 * Un vigilante que nunca encuentra nada se ve igual de bien que uno roto. Antes de grabar se prueba contra dos páginas:
 * una con cada palabra sembrada donde SÍ se ve (debe encontrarlas todas) y otra con señuelos que no se ven
 * (oculta, fuera de pantalla, transparente, opción sin elegir, contraseña): ahí no debe encontrar nada.
 */
export async function controlVigilante(browser, palabras) {
  const fuente = reProhibidas(palabras);
  if (!fuente) return { ok: true, sinPalabras: true };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const bases = palabras.map(p => String(p).trim().replace(/\*$/, '')).filter(Boolean);
  const ctx = await browser.newContext({ viewport: VP });
  try {
    const p = await ctx.newPage();
    const may = s => s.charAt(0).toUpperCase() + s.slice(1);
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const caja = html => `<body style="margin:4px;font:10px/14px sans-serif"><div style="display:flex;flex-wrap:wrap;gap:4px">${html}</div></body>`;
    // cada canal por separado: si uno se rompe, el control lo dice (no lo tapa otro canal que sí funciona)
    const canales = {
      texto: bases.map((b, i) => `<p style="margin:0">Dato ${i}: ${esc(may(b))}.</p>`).join(''),
      select: bases.map(b => `<select><option>Otro</option><option selected>${esc(b)}</option></select>`).join(''),
      campo: bases.map(b => `<input style="width:150px;font-size:10px" value="${esc(b)}">`).join(''),
    };
    const encontro = {}, faltan = [];
    for (const [canal, html] of Object.entries(canales)) {
      await p.setContent(caja(html));
      const h = await p.evaluate(VIGILAR, fuente);
      encontro[canal] = h;
      for (const b of bases) if (!h.some(x => x.startsWith(norm(b).split(/\s+/)[0]))) faltan.push(`${b} (${canal})`);
    }
    await p.setContent(caja(`<p style="margin:0">Texto normal: pides ayuda y ves cómo va.</p>${bases.map(b => `<div style="display:none">${esc(b)}</div><p style="position:absolute;top:4000px">${esc(b)}</p><p style="opacity:0">${esc(b)}</p><select><option selected>Otro</option><option>${esc(b)}</option></select><input type="password" value="${esc(b)}">`).join('')}`));
    const falsos = await p.evaluate(VIGILAR, fuente);
    return { ok: !faltan.length && !falsos.length, encontro, faltan, falsos };
  } finally { await ctx.close().catch(() => {}); }
}

// ---------------------------------------------------------------- la escena
export class Escena {
  /** Abre Chrome para el capítulo `cap`. `sesion`: número de otro capítulo (o ruta de archivo) del que se toman cookies y almacenamiento. */
  static async abrir(cap, opciones = {}) { const e = new Escena(cap, opciones); await e._abrir(); return e; }

  constructor(cap, { sesion = null } = {}) {
    this.cap = cap;
    const T = tiempos();
    if (!T[cap]) throw new Error(`El capítulo ${cap} no está en guion.mjs (capítulos: ${Object.keys(T).join(', ')}).`);
    this.TT = T[cap]; this.F = this.TT.frases;
    this.sesion = sesion;
    this.azar = mulberry32(1000 + Number(cap) * 7919);
    this.vel = 1;                     // > 1: lo repetitivo (llenar campos) va más rápido
    this.avisos = AVISOS;             // selector de avisos flotantes; null = no esperar avisos
    this.pos = { x: Math.round(VP.width * 0.62), y: Math.round(VP.height * 0.6) };
    this.activas = [];                // señales que se siguen midiendo
    this.log = { cap, total: this.TT.total, firma: firmaCapitulo(this.TT), vp: VP, dpr: DPR, fps: FPS, cursor: [], clics: [], marcas: [], sonidos: [], eventos: [], tarde: [], llegadas: [], scroll: [], prohibidas: [], vigilante: { revisiones: 0, errores: 0 } };
  }

  async _abrir() {
    let sesion = this.sesion;
    if (typeof sesion === 'number' || /^\d+$/.test(String(sesion ?? ''))) {
      sesion = path.join(MEDIA, `cap${sesion}.sesion.json`);
      if (!fs.existsSync(sesion)) throw new Error(`Falta ${path.relative(RAIZ, sesion)}: graba antes ese capítulo.`);
    }
    Object.assign(this, await abrir({ sesion }));
    const caer = e => this._fallo(e && e.message ? e.message : String(e));
    process.on('unhandledRejection', caer);
    process.on('uncaughtException', caer);
    return this;
  }

  // ---------------------------------------------------------------- reloj
  ahora() { return this.rec?.inicio ? this.rec.ahora() : 0; }
  /** Pausa que respeta la velocidad (rapido). */
  pausa(ms) { return sleep(Math.max(20, ms / this.vel)); }
  p(ms) { return this.pausa(ms); }
  /** Corre `fn` con las acciones `k` veces más rápidas (cursor, tecleo, desplazamientos y pausas). */
  async rapido(k, fn) { const v0 = this.vel; this.vel = k; try { return await fn(); } finally { this.vel = v0; } }

  /**
   * Un momento del capítulo, en segundos. Puede ser:
   *   2.5                       segundo 2.5 del capítulo
   *   '1.2'                     cuando empieza la frase 1.2      '1.2:fin'  cuando termina
   *   ['1.2', 'Entrar']         cuando la voz dice «Entrar» en la frase 1.2
   *   ['1.2', 'el', 1, -0.2]    la segunda vez que dice «el», 0.2 s antes
   *   { frase: '1.2', palabra: 'Entrar', n: 0, mas: 0.1 }   lo mismo, con nombres
   */
  t(m) {
    const F = id => { const f = this.F[id]; if (!f) throw new Error(`La frase «${id}» no es del capítulo ${this.cap}.`); return f; };
    if (m == null) return this.ahora();
    if (typeof m === 'number') return m;
    if (typeof m === 'string') { const fin = m.endsWith(':fin'); const f = F(fin ? m.slice(0, -4) : m); return fin ? f.fin : f.ini; }
    if (Array.isArray(m)) { const [id, w = null, n = 0, mas = 0] = m; const f = F(id); return (w == null ? f.ini : palabra(this.TT, id, w, n)) + mas; }
    if (typeof m === 'object') { const f = F(m.frase); const base = m.fin ? f.fin : m.palabra ? palabra(this.TT, m.frase, m.palabra, m.n || 0) : f.ini; return base + (m.mas || 0); }
    throw new Error('Momento no válido: ' + JSON.stringify(m));
  }
  /** Espera hasta el momento `m`. Si ya pasó, lo anota como retraso (autoajustar.mjs lo usa). */
  async esperar(m, nota = '') {
    const t = this.t(m), d = t - this.ahora();
    this.log.llegadas.push({ nota, objetivo: +t.toFixed(3), llegada: +this.ahora().toFixed(3) });
    if (d > 0) await sleep(d * 1000);
    else if (d < -0.15) this.log.tarde.push({ t: +t.toFixed(3), retraso: +(-d).toFixed(2), nota });
  }
  /**
   * Espera a que empiece la frase `id`. Anota si las acciones de la frase anterior llegaron tarde: con eso se ajustan las pausas.
   * `antes`: segundos de adelanto, para preparar la pantalla (desplazar, abrir algo) antes de que la voz lo nombre.
   */
  frase(id, { antes = 0 } = {}) { return this.esperar(this.t(id) - antes, 'inicio ' + id); }

  // ---------------------------------------------------------------- navegar
  /** Abre una ruta de la app (relativa a proyecto.json → app.url). Sin ruta: app.url tal cual. */
  async ir(ruta = null, { espera = 400 } = {}) {
    const url = ruta == null ? PROYECTO.app.url : new URL(ruta, PROYECTO.app.url).href;
    try { await this.page.goto(url, { waitUntil: 'load', timeout: 30000 }); }
    catch (e) { await this._fallo(`No pude abrir ${url}: ${e.message.split('\n')[0]}. ¿Está corriendo la app? (node hacer.mjs app)`); }
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await sleep(espera);
  }

  // ---------------------------------------------------------------- medir
  /** Caja del elemento (píxeles CSS de la ventana grabada). Espera a que se vea; si no aparece, falla con una captura. */
  async caja(s, { espera = 6000 } = {}) {
    const c = css(s), t0 = Date.now();
    while (true) {
      let r;
      if (c !== null) {
        r = (await this.page.evaluate(CAJAS, [c]).catch(() => [undefined]))[0];
        if (r && r.error) return this._cajaLocator(this.page.locator(c), s, espera);
      } else return this._cajaLocator(s, s, espera);
      if (r) return caja1(r);
      if (Date.now() - t0 > espera) return this._fallo(`No encuentro «${nombre(s)}» visible en la pantalla.`);
      await sleep(80);
    }
  }
  async _cajaLocator(loc, s, espera) {
    try { await loc.first().waitFor({ state: 'visible', timeout: espera }); const b = await loc.first().boundingBox(); if (b) return caja1(b); } catch { /* abajo */ }
    return this._fallo(`No encuentro «${nombre(s)}» visible en la pantalla.`);
  }
  centro(r, px = 0.5, py = 0.5) { return { x: r.x + r.w * px, y: r.y + r.h * py }; }
  /** Espera a que aparezca un elemento (por ejemplo, la pantalla de confirmación). Si no sale, falla con una captura. */
  async esperarElemento(s, { espera = 8000 } = {}) { return this.caja(s, { espera }); }
  /** Espera a que se vayan los avisos flotantes (todos, o los que tapan `caja`). */
  async sinAvisos({ caja = null, espera = 8000, propio = null } = {}) {
    if (!this.avisos) return;
    const t0 = Date.now(); let v = [];
    while (Date.now() - t0 < espera) {
      v = await this.page.evaluate(AVISOS_VISIBLES, [this.avisos, caja, propio]).catch(() => []);
      if (!v.length) return;
      await sleep(120);
    }
    return this._fallo(`Un aviso flotante sigue en pantalla después de ${espera / 1000} s: «${v[0]}». Espera a que se vaya, ciérralo, o cambia E.avisos si no es un aviso.`);
  }

  // ---------------------------------------------------------------- cursor
  /** Mueve el cursor de verdad (con sus efectos de hover): curva, acelera y frena, y se acomoda al llegar. */
  async moverXY(x, y, dur = 0.7) {
    dur = dur / this.vel;
    const x0 = this.pos.x, y0 = this.pos.y, dx = x - x0, dy = y - y0, dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const curva = (this.azar() - 0.5) * 0.28 * Math.min(dist, 700);
    const c1 = { x: x0 + dx * 0.28 + nx * curva, y: y0 + dy * 0.28 + ny * curva };
    const c2 = { x: x0 + dx * 0.72 + nx * curva * 0.45, y: y0 + dy * 0.72 + ny * curva * 0.45 };
    const t0 = Date.now(), D = Math.max(1, dur * 1000); let ult = -1;
    while (true) {
      const u = Math.min(1, (Date.now() - t0) / D), e = easeHumano(u), m = 1 - e;
      const px = m * m * m * x0 + 3 * m * m * e * c1.x + 3 * m * e * e * c2.x + e * e * e * x;
      const py = m * m * m * y0 + 3 * m * m * e * c1.y + 3 * m * e * e * c2.y + e * e * e * y;
      await this.page.mouse.move(px, py);
      const t = this.ahora();
      if (t - ult > 0.022 || u >= 1) { this.log.cursor.push({ t: +t.toFixed(3), x: r1(px), y: r1(py) }); ult = t; }
      if (u >= 1) break;
      await sleep(8);
    }
    const ax = x + (this.azar() - 0.5) * 3, ay = y + (this.azar() - 0.5) * 3;   // se acomoda un par de píxeles
    await this.page.mouse.move(ax, ay);
    this.log.cursor.push({ t: +this.ahora().toFixed(3), x: r1(ax), y: r1(ay) });
    this.pos = { x: ax, y: ay };
  }
  /** Lleva el cursor a un elemento (lo deja a la vista si hace falta). Con `en`, llega en ese momento. */
  async mover(s, { en = null, dur = 0.7, px = 0.5, py = 0.5 } = {}) {
    const r = await this.aLaVista(s);
    if (en != null) await this.esperar(this.t(en) - dur / this.vel, 'mover ' + nombre(s));
    const c = this.centro(r, px, py);
    await this.moverXY(c.x, c.y, dur);
    return r;
  }

  // ---------------------------------------------------------------- acciones
  /** Clic humano: el cursor llega (con `en`, justo en ese momento), micro pausa y clic. La onda se dibuja en la composición. */
  async clic(s, { en = null, dur = 0.7, px = 0.5, py = 0.5, pausa = null } = {}) {
    const r = await this.aLaVista(s);
    if (en != null) await this.esperar(this.t(en) - dur / this.vel - 0.12, 'clic ' + nombre(s));
    const c = this.centro(r, px, py);
    await this.moverXY(c.x, c.y, dur);
    const r2 = await this.caja(s, { espera: 1500 });           // si el elemento se movió mientras llegaba, se corrige
    const c2 = this.centro(r2, px, py);
    if (Math.hypot(c2.x - this.pos.x, c2.y - this.pos.y) > 6) await this.moverXY(c2.x, c2.y, 0.15);
    await this.pausa(pausa ?? (80 + this.azar() * 90));
    this.log.clics.push({ t: +this.ahora().toFixed(3), x: r1(this.pos.x), y: r1(this.pos.y) });
    await this.page.mouse.down(); await this.pausa(55 + this.azar() * 45); await this.page.mouse.up();
    return r2;
  }
  /** Escribe letra por letra con ritmo irregular, en `dur` segundos. Antes hace clic en el campo (y lo vacía) y al final pulsa Tab. */
  async escribir(s, texto, { en = null, dur = null, tab = true, borrar = true, clic = true } = {}) {
    texto = String(texto);
    if (clic) await this.clic(s, { en, dur: 0.5 });
    else if (en != null) await this.esperar(en, 'escribir ' + nombre(s));
    if (borrar) {
      const v = await (css(s) !== null ? this.page.locator(css(s)).first() : s).inputValue({ timeout: 1000 }).catch(() => '');
      if (v) { await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A'); await this.pausa(60); await this.page.keyboard.press('Backspace'); await this.pausa(90); }
    }
    const total = ((dur ?? Math.min(4, Math.max(0.4, texto.length * 0.06))) / this.vel) * 1000;
    const pesos = [...texto].map((ch, i) => (0.55 + this.azar() * 0.9) * (/[ ,.:;@]/.test(ch) ? 1.7 : 1) * (i === 0 ? 1.4 : 1));
    const suma = pesos.reduce((a, b) => a + b, 0) || 1; const t0 = Date.now(); let acum = 0; let i = 0;
    for (const ch of texto) {
      await this.page.keyboard.type(ch);
      acum += pesos[i++]; const d = t0 + total * (acum / suma) - Date.now();
      if (d > 0) await sleep(d);
    }
    // En algunas apps el primer clic después de escribir se pierde porque la pantalla se repinta al soltar el foco: Tab lo suelta antes.
    if (tab) await this.soltarFoco();
  }
  /** «Pega» un texto largo: aparece de golpe (lo repetitivo va rápido). */
  async pegar(s, texto, { en = null, tab = true } = {}) {
    await this.clic(s, { en, dur: 0.4, pausa: 50 });
    await this.pausa(60);
    await (css(s) !== null ? this.page.locator(css(s)).first() : s).fill(String(texto));
    if (tab) await this.soltarFoco();
  }
  /** Elige una opción de un <select> (por su valor o su texto): el cursor llega, hay clic y el valor cambia. El menú nativo no sale en el video. */
  async elegir(s, valor, { en = null, dur = 0.6 } = {}) {
    const r = await this.aLaVista(s);
    if (en != null) await this.esperar(this.t(en) - dur / this.vel - 0.1, 'elegir ' + nombre(s));
    const c = this.centro(r);
    await this.moverXY(c.x, c.y, dur);
    await this.pausa(70 + this.azar() * 80);
    this.log.clics.push({ t: +this.ahora().toFixed(3), x: r1(this.pos.x), y: r1(this.pos.y) });
    await this.pausa(110);
    const loc = css(s) !== null ? this.page.locator(css(s)).first() : s;
    try { await loc.selectOption(valor, { timeout: 3000 }); }
    catch { try { await loc.selectOption({ label: String(valor) }, { timeout: 2000 }); } catch (e) { return this._fallo(`No pude elegir «${valor}» en «${nombre(s)}»: ${e.message.split('\n')[0]}`); } }
    return r;
  }
  /** Pulsa una tecla («Enter», «Escape», «Tab»...). */
  async tecla(nombreTecla, { en = null } = {}) {
    if (en != null) await this.esperar(en, 'tecla ' + nombreTecla);
    await this.page.keyboard.press(nombreTecla);
  }
  async soltarFoco() { await this.page.keyboard.press('Tab'); await this.pausa(200); }

  // ---------------------------------------------------------------- desplazar
  /**
   * Desplaza la pantalla con suavidad. `destino`: un selector (lo deja a `margen` px de arriba de su contenedor, sea la página
   * o una caja con barra propia), un número (desplazamiento de la página), 'arriba' o 'abajo'.
   */
  async desplazar(destino, { en = null, dur = 0.9, margen = 120 } = {}) {
    if (en != null) await this.esperar(en, 'desplazar');
    let plan, sel = null;
    if (typeof destino === 'number' || destino === 'arriba' || destino === 'abajo') {
      plan = await this.page.evaluate((d) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const y = d === 'arriba' ? 0 : d === 'abajo' ? max : Math.max(0, Math.min(max, d));
        return { interno: false, desde: window.scrollY, hasta: y };
      }, destino);
    } else {
      sel = css(destino);
      if (sel === null) { const b = await destino.first().boundingBox(); if (!b) return this._fallo(`No encuentro «${nombre(destino)}» para desplazar.`); plan = await this.page.evaluate(([top, m]) => ({ interno: false, desde: window.scrollY, hasta: Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight, window.scrollY + top - m)) }), [b.y, margen]); }
      else {
        await this.caja(destino);   // que exista y se vea (falla con captura si no)
        plan = await this.page.evaluate(DESPLAZABLE, [sel, margen]);
        if (!plan || plan.error) return this._fallo(`No pude desplazar hasta «${nombre(destino)}».`);
        if (plan.fijo) return;
      }
    }
    if (Math.abs(plan.hasta - plan.desde) < 2) return;
    const D = Math.max(1, (dur / this.vel) * 1000), t0 = Date.now();
    const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    while (true) {
      const u = Math.min(1, (Date.now() - t0) / D);
      await this.page.evaluate(PONER_DESPLAZAMIENTO, [sel, plan.desde + (plan.hasta - plan.desde) * ease(u), plan.interno]).catch(() => {});
      if (u >= 1) break;
      await sleep(8);
    }
    await sleep(140);   // que la página se asiente antes de medir nada
  }
  /** Si el elemento queda fuera de la pantalla (o pegado al borde), desplaza hasta dejarlo a la vista. Devuelve su caja. */
  async aLaVista(s) {
    let r = await this.caja(s);
    if (r.y < 60 || r.y + r.h > VP.height - 30) {
      await this.desplazar(s, { margen: Math.max(80, Math.round((VP.height - Math.min(r.h, VP.height * 0.6)) * 0.42)) });
      r = await this.caja(s);
    }
    return r;
  }

  // ---------------------------------------------------------------- señales
  /**
   * Señal sobre un elemento: se deja a la vista y se mide AHORA (después de cualquier desplazamiento), y se registra para
   * mostrarse de `desde` a `hasta`. Mientras está a la vista se sigue midiendo: si el elemento se mueve más de 8 px,
   * el constructor la recorta o la falla. Opciones:
   *   desde, hasta   momentos (ver t()); hasta, por omisión, el final de la frase de `desde`
   *   tipo           'recuadro' (oscurece lo demás), 'halo' (anillo que late) o 'flecha'
   *   zoom           true = la cámara se acerca antes de que aparezca
   *   pad            aire alrededor del elemento (px)      lado  'abajo' | 'arriba' | 'dentro' (dónde va la etiqueta)
   *   rect           caja a mano {x,y,w,h} (solo si no hay elemento que medir: no se sigue midiendo)
   */
  async senal(s, etiqueta, { desde = null, hasta = null, tipo = 'recuadro', zoom = false, pad = 8, lado = null, rect = null } = {}) {
    let r = rect ? caja1(rect) : await this.aLaVista(s);
    if (!rect) { await this.sinAvisos({ caja: r, espera: 4000, propio: css(s) }); r = await this.caja(s); }
    let t0 = desde == null ? this.ahora() + 0.05 : this.t(desde);
    let t1 = hasta != null ? this.t(hasta) : this._finDeFrase(desde, t0);
    const ya = this.ahora() + 0.05;
    if (t0 < ya) { if (ya - t0 > 0.2) this.log.tarde.push({ t: +t0.toFixed(3), retraso: +(ya - t0).toFixed(2), nota: 'señal ' + etiqueta }); t0 = ya; }
    if (t1 < t0 + 0.8) t1 = t0 + 0.8;
    const sy = await this.page.evaluate(() => window.scrollY).catch(() => 0);
    const marca = { t0: +t0.toFixed(3), t1: +t1.toFixed(3), rect: r, label: String(etiqueta), tipo: { caja: 'recuadro', anillo: 'halo' }[tipo] || tipo, zoom: !!zoom, pad, lado, sel: css(s) || nombre(s), medida: +this.ahora().toFixed(3), scrollY: r1(sy), traza: [] };
    if (!['recuadro', 'halo', 'flecha'].includes(marca.tipo)) throw new Error(`Tipo de señal desconocido «${tipo}»: usa recuadro, halo o flecha.`);
    this.log.marcas.push(marca);
    if (!rect) this.activas.push({ marca, sel: css(s), loc: css(s) === null ? s : null, hasta: t1 + 0.8 });
    return r;
  }
  /**
   * Como senal(), y además el cursor llega al elemento junto con la señal. La señal se mide y se registra PRIMERO y el cursor
   * sale después: medir al llegar tomaba unos 0.3 s y la señal salía tarde.
   */
  async apuntar(s, etiqueta, opciones = {}) {
    const { dur = 0.8, px = 0.5, py = 0.5 } = opciones;
    const r = await this.senal(s, etiqueta, opciones);
    if (opciones.desde != null) await this.esperar(this.t(opciones.desde) - dur / this.vel, 'apunta ' + etiqueta);
    const c = this.centro(r, px, py);
    await this.moverXY(c.x, c.y, dur);
    return r;
  }
  _finDeFrase(desde, t0) {
    let id = null;
    if (typeof desde === 'string') id = desde.replace(/:fin$/, '');
    else if (Array.isArray(desde)) id = desde[0];
    else if (desde && typeof desde === 'object') id = desde.frase;
    return id && this.F[id] ? Math.max(t0 + 1.2, this.F[id].fin + 0.3) : t0 + 2.5;
  }
  /** Un sonido corto (assets/sfx/<nombre>) en este momento o en `en`. Solo en momentos clave. */
  sonido(nombreSonido, { en = null, volumen = 0.6 } = {}) { this.log.sonidos.push({ t: +(en == null ? this.ahora() : this.t(en)).toFixed(3), nombre: nombreSonido, volumen }); }
  /** Anota algo que pasó (queda en la bitácora del capítulo). */
  evento(nombreEvento, datos = {}) { this.log.eventos.push({ t: +this.ahora().toFixed(3), nombre: nombreEvento, ...datos }); }

  // ---------------------------------------------------------------- grabar
  /** Empieza a grabar: espera a que se vayan los avisos flotantes, prueba el vigilante y arranca el reloj (segundo 0). */
  async iniciar() {
    await this.sinAvisos();
    this.fuente = reProhibidas(PROYECTO.palabrasProhibidas);
    const ctl = await controlVigilante(this.browser, PROYECTO.palabrasProhibidas || []);
    this.log.vigilante.control = ctl;
    this.log.vigilante.palabras = PROYECTO.palabrasProhibidas || [];   // con qué palabras se revisó (grabar --cambiados lo compara)
    if (!ctl.ok) return this._fallo(`El control positivo del vigilante falló (no encontró: ${(ctl.faltan || []).join(', ') || 'nada'}; encontró de más: ${(ctl.falsos || []).join(', ') || 'nada'}). No se puede confiar en él: no se graba.`);
    await this.page.mouse.move(this.pos.x, this.pos.y);
    this.rec = new Grabadora(this.page, this.ctx, path.join(TMP, 'cuadros', 'cap' + this.cap));
    await this.rec.iniciar();
    this.log.cursor.push({ t: 0, x: r1(this.pos.x), y: r1(this.pos.y) });
    this.log.url = this.page.url();
    this._vivo = true;
    this._lazos = [this._lazoMuestras(), this._lazoVigilante()];
    return this;
  }
  async _lazoMuestras() {
    while (this._vivo) {
      const t = this.ahora();
      this.activas = this.activas.filter(a => a.hasta > t);
      const sels = this.activas.filter(a => a.sel).map(a => a.sel);
      try {
        const m = await this.page.evaluate(MUESTRA, sels);
        const tt = +this.ahora().toFixed(3);
        this.log.scroll.push({ t: tt, y: m.y });
        let k = 0;
        for (const a of this.activas) {
          let b = null;
          if (a.sel) b = m.cajas[k++];
          else { const bb = await a.loc.first().boundingBox({ timeout: 60 }).catch(() => null); b = bb && [r1(bb.x), r1(bb.y), r1(bb.width), r1(bb.height)]; }
          a.marca.traza.push([tt, ...(b || [null, null, null, null])]);
        }
      } catch { /* la página está cambiando: se mide en la siguiente vuelta */ }
      await sleep(70);
    }
  }
  async _lazoVigilante() {
    if (!this.fuente) return;
    while (this._vivo) {
      await this._revisarTexto();
      await sleep(350);
    }
  }
  async _revisarTexto() {
    if (!this.fuente) return;
    this.log.vigilante.revisiones++;
    try {
      const h = await this.page.evaluate(VIGILAR, this.fuente);
      if (h.length) this.log.prohibidas.push({ t: +this.ahora().toFixed(2), palabras: h });
    } catch { this.log.vigilante.errores++; }
  }

  /** Termina el capítulo: sostiene la imagen hasta que acaba su tiempo, arma el MP4 y guarda la bitácora y la sesión. */
  async cerrar({ guardarSesion = true } = {}) {
    if (!this.rec) return this._fallo('cerrar() sin iniciar(): no hay nada grabado.');
    await this.esperar(this.TT.total, 'fin');
    // el video termina AQUÍ: lo que sigue (la última revisión y esperar a los lazos de medición) tarda hasta medio segundo
    // y alargaba cada capítulo; construir se detiene si un capítulo dura más de 0.4 s distinto de lo que pide la voz
    const tFin = this.ahora();
    await this._revisarTexto();
    this._vivo = false; await Promise.all(this._lazos);
    await this.rec.detener(tFin);
    fs.mkdirSync(MEDIA, { recursive: true });
    const nombreBase = path.join(MEDIA, 'cap' + this.cap);
    this.log.video = this.rec.aVideo(nombreBase + '.mp4');
    fs.writeFileSync(nombreBase + '.json', JSON.stringify(this.log));
    if (guardarSesion) fs.writeFileSync(nombreBase + '.sesion.json', JSON.stringify(await this.ctx.storageState()));
    await this.browser.close();
    const L = this.log;
    console.log(`cap${this.cap}: ${L.video.duracion.toFixed(1)} s (el guion pide ${this.TT.total.toFixed(1)}), ${L.video.cuadros} cuadros, ${L.marcas.length} señales, retrasos: ${L.tarde.length}` + (L.tarde.length ? ' (' + L.tarde.map(x => `${x.nota} ${x.retraso} s`).join(', ') + ')' : ''));
    const vg = L.vigilante;
    if (this.fuente && vg.errores > 0.25 * Math.max(1, vg.revisiones)) { console.error(`FALLA cap${this.cap}: el vigilante no pudo revisar la pantalla en ${vg.errores} de ${vg.revisiones} vueltas: no se puede asegurar que no salgan palabras prohibidas.`); process.exit(1); }
    if (L.prohibidas.length) {
      const pal = [...new Set(L.prohibidas.flatMap(x => x.palabras))].join(', ');
      console.error(`FALLA cap${this.cap}: salió en pantalla texto prohibido (${pal}) en los segundos ${L.prohibidas.slice(0, 8).map(x => x.t).join(', ')}${L.prohibidas.length > 8 ? '...' : ''}. Cambia los datos de ejemplo o el recorrido del capítulo: el cuerpo no puede nombrar a ninguna audiencia.`);
      process.exit(1);
    }
    return L;
  }

  async _fallo(msg) {
    if (this._cayendo) return new Promise(() => {});
    this._cayendo = true; this._vivo = false;
    const seg = this.rec?.inicio ? ` (segundo ${this.ahora().toFixed(1)} del capítulo)` : '';
    let foto = '';
    try { fs.mkdirSync(TMP, { recursive: true }); const f = path.join(TMP, `fallo-cap${this.cap}.png`); await this.page.screenshot({ path: f, timeout: 5000 }); foto = `\n  Así estaba la pantalla: ${path.relative(RAIZ, f)}`; } catch { /* sin captura */ }
    console.error(`FALLA en el capítulo ${this.cap}${seg}: ${msg}${foto}`);
    try { await this.browser.close(); } catch { /* ya cerrado */ }
    process.exit(1);
  }
}
