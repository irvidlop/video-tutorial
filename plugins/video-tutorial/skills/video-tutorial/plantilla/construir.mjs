// Construye index.html (la composición de HyperFrames del CUERPO), compositions/cierre.html y GUION.md a partir de:
//   media/capN.mp4 + media/capN.json   la app grabada y su bitácora (cursor, clics, señales medidas en el DOM y su traza)
//   voz/voz.json + voz/*.wav           la locución: duración real y tiempo de cada palabra
//   guion.mjs + tiempos.mjs            texto, subtítulos y cuándo habla cada frase
//   proyecto.json + tema.mjs           título, contacto, música, colores, tamaño del video
// Todo el tiempo sale de la duración real de cada frase: si cambia la voz, se vuelve a grabar y a construir.
//
// Uso:  node construir.mjs            (se detiene si algo no cuadra: una señal fuera de su elemento, un capítulo desfasado...)
//       node construir.mjs --seguir   escribe todo aunque haya fallas (para revisar en la vista previa; render no acepta fallas)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const SEGUIR = process.argv.includes('--seguir');
const { CAPITULOS, TITULO, INTROS } = await import('./guion.mjs');
const { tiempos, palabra, leerVoz, firmaCapitulo, reProhibidas, ID_CONTACTO, revisarGuion } = await import('./tiempos.mjs');
const { W, A, FS, SUB_TOP, r2, LAYERS, F0, camX, DERIVA, deco, trozos, renglones, esc, cssTema, leerProyecto, lienzo, ventana, CHROME, nuevoPlan, audioHtml, variablesSinDefinir, MUSICA_BASE } = await import('./capas.mjs');
const { duracionEntrada } = await import('./entradas.mjs');

const P = leerProyecto();
const { ancho, alto, fps, K } = lienzo(P);
const fallas = [], avisos = [];
const falla = m => fallas.push(m), aviso = m => avisos.push(m);
const parar = m => { console.error('FALLA: ' + m); process.exit(1); };

{ const g = revisarGuion(P); for (const a of g.avisos) aviso(a); if (g.errores.length) parar('el guion no cuadra:\n  ' + g.errores.join('\n  ')); }
const VOZ = leerVoz();
const T = tiempos(VOZ);
const N = CAPITULOS.length, ULT = CAPITULOS[N - 1].id;

// ---------------------------------------------------------------- grabaciones
const LOG = {};
for (const c of CAPITULOS) {
  const f = `media/cap${c.id}.json`;
  if (!fs.existsSync(f) || !fs.existsSync(`media/cap${c.id}.mp4`)) parar(`falta la grabación del capítulo ${c.id} (media/cap${c.id}.mp4): corre «node hacer.mjs grabar».`);
  LOG[c.id] = JSON.parse(fs.readFileSync(f, 'utf8'));
}
const DUR = k => LOG[k].video?.duracion ?? T[k].total;
for (const c of CAPITULOS) {
  const L = LOG[c.id];
  if (L.firma !== firmaCapitulo(T[c.id])) falla(`el capítulo ${c.id} se grabó con otra voz u otras pausas: vuelve a grabarlo («node hacer.mjs grabar --cambiados»).`);
  else if (Math.abs(DUR(c.id) - T[c.id].total) > 0.4) falla(`el capítulo ${c.id} grabado dura ${DUR(c.id).toFixed(1)} s y la voz pide ${T[c.id].total.toFixed(1)} s: vuelve a grabarlo («node hacer.mjs grabar --cambiados»).`);
  if (L.prohibidas?.length) falla(`en la grabación del capítulo ${c.id} salió texto prohibido: ${[...new Set(L.prohibidas.flatMap(x => x.palabras))].join(', ')}.`);
  if ((P.palabrasProhibidas || []).length && !L.vigilante?.control?.ok) falla(`el capítulo ${c.id} se grabó sin el control positivo del vigilante: vuelve a grabarlo.`);
}
const vp0 = LOG[CAPITULOS[0].id].vp;
for (const c of CAPITULOS) if (LOG[c.id].vp.width !== vp0.width || LOG[c.id].vp.height !== vp0.height) parar('los capítulos se grabaron con ventanas de distinto tamaño: vuelve a grabarlos todos.');
// Cuadros clave de cada grabación: HyperFrames busca cuadros sueltos en el video; si los cuadros clave están muy separados, la imagen
// se puede quedar congelada en el render sin que nada falle. El grabador pone uno por segundo; aquí se comprueba.
for (const c of CAPITULOS) {
  const r = spawnSync(process.env.FFPROBE || 'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-skip_frame', 'nokey', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', `media/cap${c.id}.mp4`], { encoding: 'utf8' });
  const claves = (r.stdout || '').split(/\r?\n/).map(l => parseFloat(l)).filter(Number.isFinite);   // ffprobe a veces agrega una coma
  const hueco = Math.max(...claves.slice(1).map((t, i) => t - claves[i]), DUR(c.id) - (claves.at(-1) ?? 0));
  if (!claves.length || hueco > 2.05) falla(`la grabación del capítulo ${c.id} tiene cuadros clave cada ${hueco.toFixed(1)} s (se piden 1 o 2): la imagen se puede congelar al renderizar. Vuelve a grabarla con el grabador de la plantilla.`);
}

// ---------------------------------------------------------------- tiempos globales del cuerpo
const OV = 0.45;                                                // fundido encimado entre capítulos
const V = {}; { let tc = 0; for (const c of CAPITULOS) { V[c.id] = r2(tc); tc += DUR(c.id) - OV; } }
const G = (k, t) => r2(V[k] + t);                                // segundo del capítulo -> segundo del cuerpo
const FR = (k, id) => T[k].frases[id];
const END_CH = r2(V[ULT] + DUR(ULT));
const CT = P.contacto && P.contacto.frase ? P.contacto : null;
let CIERRE_INI, tCard = null, tVozCt = null;
if (CT) {
  const L = VOZ.lineas[ID_CONTACTO]; if (!L) parar('falta la voz de la tarjeta de contacto: corre «node hacer.mjs voz».');
  tCard = r2(END_CH - OV);
  tVozCt = r2(tCard + 0.55);
  CIERRE_INI = r2(Math.max(tCard + 0.9 + 4.4, tVozCt + L.dur + 0.7));
} else CIERRE_INI = r2(END_CH - 0.1);
let cierreMod;
try { cierreMod = await import('./cierre.mjs'); } catch (e) { parar('no pude cargar cierre.mjs: ' + e.message.split('\n')[0]); }
const DUR_CIERRE = cierreMod.DURACION ?? 6;
const END = r2(CIERRE_INI + DUR_CIERRE);

// ---------------------------------------------------------------- la ventana: del plano grabado (píxeles de la app) al mundo
const { S, WL, WT, PW, PH } = ventana(vp0);
const wx = px => WL + S * px, wy = py => WT + S * (CHROME + py);
const { PLAN, set, to, fromTo } = nuevoPlan();
const H_ = { plane: [], world: [], ui: [], vid: [] };
const AUD = [];
const NOTAS = { sigs: [], omitidas: [], clics: 0, subs: [], caps: [], voz: [] };

// ---------------------------------------------------------------- cámara con capas en parallax
let CAM = { F: { ...F0 }, z: 1 };
const CAMLOG = [{ t0: 0, t1: 0, F: { ...F0 }, z: 1 }];
for (const L of Object.keys(LAYERS)) set('#' + L, { transformOrigin: '0 0', ...camX(L, F0, 1) }, 0);
function camTo(tt, dur, F, z, ease = 'power3.inOut') {
  const prev = CAMLOG[CAMLOG.length - 1];
  if (tt < prev.t1 - 0.001) aviso(`dos movimientos de cámara se enciman en ${tt.toFixed(2)} s: el segundo pisa al primero`);
  for (const L of Object.keys(LAYERS)) to('#' + L, { ...camX(L, F, z), duration: r2(dur), ease }, tt);
  // Las fichas del frente desaparecen en cuanto la cámara empieza a acercarse (en 0.25 s, antes de que su capa alcance a moverse)
  // y vuelven solo cuando ya llegó: mientras la cámara se mueve, su capa (la que más se desplaza) las pasea por la pantalla y una
  // pasaba por encima del rótulo del capítulo (medir.mjs lo detectó, al acercarse y al alejarse).
  if (z > 1.2) to('#Lflo', { opacity: 0, duration: r2(Math.min(0.25, dur)), ease: 'power1.out' }, tt);
  else to('#Lflo', { opacity: 1, duration: 0.45, ease: 'power1.out' }, r2(tt + dur - 0.1));
  CAM = { F: { ...F }, z }; CAMLOG.push({ t0: r2(tt), t1: r2(tt + dur), F: { ...F }, z });
}
const mismaCam = (a, b) => Math.abs(a.z - b.z) < 0.02 && Math.abs(a.F.x - b.F.x) < 6 && Math.abs(a.F.y - b.F.y) < 6;
function camEn(tt) { let u = CAMLOG[0]; for (const c of CAMLOG) if (c.t0 <= tt + 1e-6) u = c; return { F: u.F, z: u.z, moviendo: tt < u.t1 - 1e-3 }; }
const aLienzo = (b, cam) => ({ x: A.x + (wx(b.x) - cam.F.x) * cam.z, y: A.y + (wy(b.y) - cam.F.y) * cam.z, w: S * b.w * cam.z, h: S * b.h * cam.z });
const recortarAlPlano = b => { const x = Math.max(0, b.x), y = Math.max(0, b.y); return { x, y, w: Math.min(PW, b.x + b.w) - x, h: Math.min(PH, b.y + b.h) - y }; };
function zoomPara(b) {
  const zw = (0.56 * W) / (S * b.w), zh = (0.52 * (SUB_TOP - 110)) / (S * b.h);
  const z = Math.min(zw, zh, 1.85);
  if (z < 1.22) return { F: { ...F0 }, z: 1 };                  // acercarse tan poco no vale la pena
  let fx = wx(b.x + b.w / 2), fy = wy(b.y + b.h / 2);
  const minX = WL + (W / 2) / z, maxX = WL + PW * S - (W / 2) / z;   // el foco no deja ver el fondo vacío a los lados ni arriba
  fx = minX <= maxX ? Math.min(maxX, Math.max(minX, fx)) : WL + (PW * S) / 2;
  fy = Math.max(fy, WT + A.y / z);
  return { F: { x: r2(fx), y: r2(fy) }, z: +z.toFixed(3) };
}
const ABIERTA = { F: { ...F0 }, z: 1 };
// la cámara nunca se congela: cada capa tiene un envoltorio interior (.dr) con una deriva lenta y finita
for (const [L, ax, ay, per] of DERIVA) {
  set(`#${L} .dr`, { x: 0, y: 0 }, 0);
  for (let t = 0, i = 0; t < END; t += per, i++) {
    const s = i % 2 ? -1 : 1;
    to(`#${L} .dr`, { x: r2(s * ax * (0.6 + 0.4 * ((i * 7) % 5) / 4)), y: r2(-s * ay * (0.6 + 0.4 * ((i * 3) % 5) / 4)), duration: per, ease: 'sine.inOut' }, t);
  }
}

// ---------------------------------------------------------------- señales: dónde estaba de verdad cada elemento mientras se veía
const TOL = 8;                                                    // px: una señal vale mientras su elemento no se mueva más que esto
const dif = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
const MARKS = [];
for (const c of CAPITULOS) for (const m0 of LOG[c.id].marcas || []) {
  const m = { ...m0, k: c.id };
  const tr = (m.traza || []).map(([t, x, y, w, h]) => ({ t, b: x == null ? null : { x, y, w, h } }));
  let ini = m.t0, fin = m.t1, B = m.rect;
  if (tr.length) {
    // empieza cuando el elemento está a la vista y quieto (dos muestras seguidas iguales); termina en cuanto se mueve o se va
    B = null;
    for (let i = 0; i < tr.length; i++) {
      const s = tr[i], sig = tr[i + 1];
      if (s.t < m.t0 - 0.1 || s.t > m.t1) continue;
      if (s.b && (!sig || (sig.b && dif(s.b, sig.b) <= 2))) { ini = Math.max(m.t0, s.t); B = s.b; break; }
    }
    if (B) for (const s of tr) if (s.t > ini && s.t <= m.t1 && (!s.b || dif(s.b, B) > TOL)) { fin = Math.min(fin, s.t - 0.06); break; }
    if (B && dif(B, m.rect) > TOL) aviso(`señal «${m.label}» (cap. ${m.k}): el elemento se movió entre la medida y la señal; se dibuja donde de verdad estaba`);
  } else if ((LOG[c.id].scroll || []).length && m.scrollY != null) {
    // señal con caja a mano: solo vale mientras la página no se desplace
    const sc = LOG[c.id].scroll.filter(p => p.t >= m.t0 - 0.05 && p.t <= m.t1), fuera = p => Math.abs(p.y - m.scrollY) > 3;
    for (const p of sc) { if (fuera(p)) ini = Math.max(ini, p.t + 0.12); else if (p.t >= ini) break; }
    for (const p of sc) if (p.t > ini && fuera(p)) { fin = Math.min(fin, p.t - 0.06); break; }
  }
  if (!B || fin - ini < 0.45) { NOTAS.omitidas.push({ cap: m.k, label: m.label, t0: m.t0 }); falla(`señal «${m.label}» (cap. ${m.k}, segundo ${m.t0.toFixed(1)}): su elemento no se quedó quieto a la vista; se quedaría en el aire. Desplaza la pantalla ANTES de marcar.`); continue; }
  if (ini - m.t0 > 0.2 || m.t1 - fin > 0.2) aviso(`señal «${m.label}» (cap. ${m.k}) ajustada a lo que se vio: ${m.t0.toFixed(2)}-${m.t1.toFixed(2)} -> ${ini.toFixed(2)}-${fin.toFixed(2)} s`);
  m.box0 = B; m.g0 = G(m.k, ini); m.g1 = G(m.k, fin);
  MARKS.push(m);
}
MARKS.sort((a, b) => a.g0 - b.g0);
const reProh = reProhibidas(P.palabrasProhibidas) ? new RegExp(reProhibidas(P.palabrasProhibidas)) : null;
const normTxt = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
for (let i = 0; i < MARKS.length; i++) {
  const m = MARKS[i], nx = MARKS[i + 1];
  const nw = m.label.trim().split(/\s+/).filter(Boolean).length;
  if (nw > 4) aviso(`etiqueta de ${nw} palabras: «${m.label}» (cap. ${m.k}); mejor de 2 a 4`);
  if (reProh && reProh.test(normTxt(m.label))) falla(`la etiqueta «${m.label}» (cap. ${m.k}) tiene una palabra prohibida`);
  if (nx && m.g1 > nx.g0 - 0.12) m.g1 = r2(nx.g0 - 0.12);                 // una señal a la vez
  m.g1 = Math.min(m.g1, r2(V[m.k] + DUR(m.k) - OV - 0.35));                // no pasa al fundido del capítulo siguiente
}
// la cámara se acerca ANTES de que aparezca la señal y se abre cuando ya no hace falta
let camFin = 0, camEstado = { ...ABIERTA };
const FIN_CAP = k => V[k] + DUR(k) - OV - 0.3;
for (let i = 0; i < MARKS.length; i++) {
  const m = MARKS[i];
  const bx = recortarAlPlano(m.box0), pad = m.pad ?? 8;
  m.box = { x: bx.x - pad, y: bx.y - pad, w: bx.w + 2 * pad, h: bx.h + 2 * pad };
  const meta = m.zoom ? zoomPara(m.box) : (camEstado.z > 1.01 ? ABIERTA : camEstado);
  if (!mismaCam(camEstado, meta)) {
    const dur = meta.z === 1 ? 1.0 : 1.1;
    let ts = Math.max(camFin, m.g0 - dur - 0.08);
    const ant = MARKS[i - 1];
    if (ant && ant.k === m.k && ant.g1 > ts - 0.05) {             // la señal anterior se quita antes de que la cámara se mueva
      ant.g1 = r2(Math.max(ant.g0 + 0.6, ts - 0.05));
      if (ant.g1 > ts - 0.05) ts = r2(ant.g1 + 0.05);
    }
    if (ts + dur > m.g0 - 0.05) m.g0 = r2(ts + dur + 0.05);      // la señal espera a que la cámara se asiente
    camTo(ts, dur, meta.F, meta.z); camFin = ts + dur; camEstado = { F: meta.F, z: meta.z };
  }
  if (m.g1 - m.g0 < 0.7) { aviso(`señal «${m.label}» (cap. ${m.k}) duraba ${(m.g1 - m.g0).toFixed(2)} s: se alarga a 0.7 s`); m.g1 = r2(m.g0 + 0.7); }
  const nx = MARKS[i + 1];
  if (camEstado.z > 1.01 && (!nx || nx.k !== m.k || !nx.zoom || nx.g0 - m.g1 > 1.9)) {
    const ts = Math.max(m.g1 + 0.1, camFin);
    const dur = Math.min(1.0, Math.max(0.6, FIN_CAP(m.k) - ts));
    camTo(ts, dur, ABIERTA.F, 1); camFin = ts + dur; camEstado = { ...ABIERTA };
    if (nx && nx.k === m.k && nx.g0 < camFin + 0.05) nx.g0 = r2(camFin + 0.05);
  }
}
// dibuja cada señal (recuadro, halo o flecha + etiqueta) con la cámara ya asentada
let SGN = 0;
const anchoEtiqueta = txt => Math.round([...txt].length * FS * 0.56 + 56);
for (const m of MARKS) {
  const id = `sg${SGN++}`, b = m.box;
  const cam = camEn(m.g0 + 0.01);
  if (cam.moviendo) aviso(`señal «${m.label}» aparece con la cámara en movimiento (${m.g0.toFixed(2)} s)`);
  const cr = aLienzo(b, cam);
  const radio = m.tipo === 'halo' ? Math.min(999, Math.round(Math.min(b.w, b.h) / 2)) : Math.min(14, Math.round(Math.min(b.w, b.h) / 2));
  H_.plane.push(`<div id="${id}" class="sg ${m.tipo}" style="left:${r2(b.x)}px;top:${r2(b.y)}px;width:${r2(b.w)}px;height:${r2(b.h)}px;border-radius:${radio}px"><i class="pu"></i></div>`);
  fromTo('#' + id, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.42, ease: 'power2.out' }, m.g0);
  to('#' + id, { opacity: 0, duration: 0.32, ease: 'power1.in' }, m.g1 - 0.32);
  if (m.tipo === 'halo') {
    const n = Math.max(0, Math.floor((m.g1 - m.g0 - 0.6) / 1.1) - 1);
    fromTo(`#${id} .pu`, { scale: 1, opacity: 0.75 }, { scale: 1.14, opacity: 0, duration: 1.1, repeat: n, ease: 'power1.out' }, m.g0 + 0.45);
  }
  if (m.tipo === 'flecha') {
    // la flecha va a un lado del elemento, DENTRO de la ventana de la app (afuera no se vería), y apunta hacia él
    const cabeIzq = b.x - 108 >= 0, cabeDer = b.x + b.w + 112 <= PW;
    if (!cabeIzq && !cabeDer) aviso(`la flecha de «${m.label}» no cabe a ningún lado del elemento: mejor un recuadro o un halo`);
    const izq = cabeIzq || !cabeDer;
    const fx = izq ? Math.max(0, b.x - 104) : b.x + b.w + 8, fy = b.y + b.h / 2 - 22;
    const fid = `fl${SGN}`;
    // dos trazos (apunta a la derecha o a la izquierda): voltearla con un transform de CSS chocaría con el tween de GSAP en x
    const trazo = izq ? 'M4 15 H58 V4 L92 22 L58 40 V29 H4 Z' : 'M92 15 H38 V4 L4 22 L38 40 V29 H92 Z';
    H_.plane.push(`<svg id="${fid}" class="fl-flecha" viewBox="0 0 96 44" style="left:${r2(fx)}px;top:${r2(fy)}px"><path d="${trazo}"/></svg>`);
    const dx = izq ? -26 : 26;
    fromTo('#' + fid, { opacity: 0, x: dx }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }, m.g0);
    const vueltas = Math.max(0, Math.floor((m.g1 - m.g0 - 0.9) / 0.9));
    if (vueltas) fromTo('#' + fid, { x: 0 }, { x: dx / 3, duration: 0.45, repeat: vueltas * 2 - 1, yoyo: true, ease: 'sine.inOut' }, m.g0 + 0.5);
    to('#' + fid, { opacity: 0, duration: 0.3, ease: 'power1.in' }, m.g1 - 0.3);
  }
  const rec = { cap: m.k, label: m.label, tipo: m.tipo, t0: r2(m.g0), t1: r2(m.g1), box: { x: r2(b.x), y: r2(b.y), w: r2(b.w), h: r2(b.h) }, elemento: m.box0, canvas: { x: r2(cr.x), y: r2(cr.y), w: r2(cr.w), h: r2(cr.h) }, zoom: cam.z, sel: m.sel };
  if (m.label) {
    const lid = `lb${SGN}`, tw = anchoEtiqueta(m.label), th = FS + 22, cx = cr.x + cr.w / 2;
    let lado = { abajo: 'b', arriba: 't', dentro: 'n' }[m.lado] || m.lado || 'b';
    if (lado === 'b' && cr.y + cr.h + 18 + th > SUB_TOP - 6) lado = 't';
    if (lado === 't' && cr.y - th - 18 < 92) lado = 'n';
    const ly = lado === 'b' ? cr.y + cr.h + 18 : lado === 't' ? cr.y - th - 18 : cr.y + 14;
    const lx = lado === 'n' ? cr.x + 14 : Math.min(W - 48 - tw, Math.max(48, cx - tw / 2));
    const px = Math.min(tw - 30, Math.max(30, cx - lx));
    H_.ui.push(`<div id="${lid}" class="lb ${lado}" style="left:${r2(lx)}px;top:${r2(ly)}px;--px:${r2(px)}px" data-layout-ignore>${esc(m.label)}</div>`);
    fromTo('#' + lid, { opacity: 0, y: lado === 't' ? -10 : 10 }, { opacity: 1, y: 0, duration: 0.38, ease: 'power3.out' }, m.g0 + 0.14);
    to('#' + lid, { opacity: 0, duration: 0.24, ease: 'power1.in' }, m.g1 - 0.26);
    rec.etiqueta = { id: lid, x: r2(lx), y: r2(ly), w: tw, h: th, lado };
    if (ly < 90 || ly + th > SUB_TOP - 4 || lx < 12 || lx + tw > W - 12) falla(`la etiqueta «${m.label}» (cap. ${m.k}, ${m.g0.toFixed(1)} s) se sale de la zona libre`);
  }
  if (cr.x < 12 || cr.y < 88 || cr.x + cr.w > W - 12 || cr.y + cr.h > SUB_TOP - 6) falla(`la señal «${m.label}» (cap. ${m.k}, ${m.g0.toFixed(1)} s) se sale de la zona libre (arriba del rótulo o sobre los subtítulos): desplaza la pantalla para dejar el elemento más al centro`);
  NOTAS.sigs.push(rec);
}

// ---------------------------------------------------------------- la app grabada (un video por capítulo) con fundido encimado
for (const c of CAPITULOS) {
  const k = c.id, d = DUR(k), i = CAPITULOS.indexOf(c);
  H_.vid.push(`<div class="vw" id="vw${k}"><video id="vid${k}" class="clip" src="media/cap${k}.mp4" muted playsinline preload="auto" data-start="${V[k]}" data-duration="${r2(d)}" data-track-index="${i + 2}"></video></div>`);
  fromTo(`#vw${k}`, { opacity: 0 }, { opacity: 1, duration: i === 0 ? 0.01 : OV, ease: 'power1.inOut' }, V[k]);
  if (k !== ULT) to(`#vw${k}`, { opacity: 0, duration: OV, ease: 'power1.inOut' }, V[k] + d - OV);
}
// la ventana entra al empezar el cuerpo (la entrada terminó sin ella) y se va cuando llega la tarjeta de contacto o el cierre
set('#winwrap', { opacity: 0, y: 26 }, 0);
to('#winwrap', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.05);
to('#winwrap', { opacity: 0, y: -14, duration: 0.6, ease: 'power2.in' }, CT ? tCard : CIERRE_INI);

// ---------------------------------------------------------------- cursor (la trayectoria real) y ondas de clic
for (const c of CAPITULOS) {
  const k = c.id, L = LOG[k], v0 = V[k], primero = c === CAPITULOS[0];
  const tFin = DUR(k) - OV - 0.3;
  const S0 = (L.cursor || []).filter(p => p.t <= tFin);
  if (!S0.length) continue;
  const pts = []; let ult = null;
  for (const p of S0) if (!ult || p.t - ult.t >= 0.045 || Math.hypot(p.x - ult.x, p.y - ult.y) > 40) { pts.push(p); ult = p; }
  if (pts[pts.length - 1] !== S0[S0.length - 1]) pts.push(S0[S0.length - 1]);
  set('#cur', { x: r2(wx(pts[0].x)), y: r2(wy(pts[0].y)) }, v0);
  if (primero) set('#cur', { opacity: 0 }, v0);
  to('#cur', { opacity: 1, duration: 0.35 }, primero ? 1.0 : v0 + 0.25);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dt = b.t - a.t;
    if (dt <= 0 || Math.hypot(a.x - b.x, a.y - b.y) < 0.4) continue;
    to('#cur', { x: r2(wx(b.x)), y: r2(wy(b.y)), duration: r2(Math.max(0.02, dt)), ease: dt > 0.2 ? 'sine.inOut' : 'none' }, v0 + a.t);
  }
  to('#cur', { opacity: 0, duration: 0.3 }, v0 + tFin);
  for (const cl of L.clics || []) {
    if (cl.t > tFin) continue;
    const tt = v0 + cl.t;
    to('#cur', { scale: 0.84, duration: 0.09, ease: 'power2.out' }, tt);
    to('#cur', { scale: 1, duration: 0.2, ease: 'power2.out' }, tt + 0.09);
    set('#ring', { x: r2(wx(cl.x)), y: r2(wy(cl.y)), scale: 0.25, opacity: 0.9 }, tt);
    to('#ring', { scale: 1.45, opacity: 0, duration: 0.55, ease: 'power2.out' }, tt);
    NOTAS.clics++;
  }
}

// ---------------------------------------------------------------- sonidos: solo los que pidió el guion de grabación (E.sonido)
const DURSFX = {};
function archivoSonido(nombre) {
  for (const ext of ['ogg', 'wav', 'mp3']) { const f = `assets/sfx/${nombre}.${ext}`; if (fs.existsSync(f)) return f; }
  return null;
}
function durSonido(f) {
  if (DURSFX[f] == null) {
    const r = spawnSync(process.env.FFPROBE || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' });
    DURSFX[f] = +(+r.stdout.trim() || 0.3).toFixed(3);
  }
  return DURSFX[f];
}
let SFXN = 0;
function sonido(nombre, tt, vol = 0.6) {
  const f = archivoSonido(nombre);
  if (!f) { falla(`no existe el sonido «${nombre}» en assets/sfx (hay: ${fs.existsSync('assets/sfx') ? fs.readdirSync('assets/sfx').filter(x => /\.(ogg|wav|mp3)$/.test(x)).join(', ') : 'ninguno'})`); return; }
  AUD.push({ id: `sfx-${SFXN}`, src: f, t: r2(tt), dur: durSonido(f), vol, track: 30 + (SFXN % 3) }); SFXN++;
}
for (const c of CAPITULOS) for (const s of LOG[c.id].sonidos || []) if (s.t < DUR(c.id) - OV) sonido(s.nombre, G(c.id, s.t), s.volumen ?? 0.6);

// ---------------------------------------------------------------- locución y subtítulos (la voz real es el reloj)
let SBN = 0;
function subtitulos(texto, fr, t0abs, ref) {
  const ws = fr.words || [];
  const a = ws.length ? ws[0].t0 : 0, b = ws.length ? ws[ws.length - 1].t1 : fr.dur;
  const tr = trozos(texto), total = tr.reduce((s, x) => s + x.length, 0) || 1;
  let acum = 0;
  tr.forEach((x, i) => {
    const s0 = r2(t0abs + a + (b - a) * (acum / total)), s1 = r2(t0abs + a + (b - a) * ((acum + x.length) / total));
    acum += x.length;
    const id = `sb${SBN++}`;
    H_.ui.push(`<div id="${id}" class="sub" data-layout-ignore>${renglones(x)}</div>`);
    fromTo('#' + id, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, s0 - 0.05);
    const fin = i === tr.length - 1 ? s1 + 0.2 : s1 + 0.04;
    to('#' + id, { opacity: 0, duration: 0.18 }, fin);
    NOTAS.subs.push({ id, frase: ref, texto: x, t0: r2(s0), t1: r2(fin + 0.18) });
  });
}
for (const c of CAPITULOS) for (const f of c.frases) {
  const fr = FR(c.id, f.id);
  AUD.push({ id: `vo-${f.id.replace(/[^A-Za-z0-9-]/g, '_')}`, src: `voz/${f.id}.wav`, t: G(c.id, fr.ini), dur: r2(fr.dur), vol: 1, track: 1, group: 'voz' });
  NOTAS.voz.push({ cap: c.id, id: f.id, t0: G(c.id, fr.ini), t1: G(c.id, fr.fin) });
  subtitulos(f.sub, fr, G(c.id, fr.ini), f.id);
}

// ---------------------------------------------------------------- rótulos de capítulo (arriba a la izquierda)
for (const c of CAPITULOS) {
  const k = c.id, primero = c === CAPITULOS[0];
  const t0 = primero ? 0.6 : G(k, 0.35), t1 = r2(V[k] + DUR(k) - OV - 0.35);
  H_.ui.push(`<div id="cap${k}" class="cap"><b>${CAPITULOS.indexOf(c) + 1}</b><span>${esc(c.rotulo)}</span></div>`);
  fromTo('#cap' + k, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }, t0);
  to('#cap' + k, { opacity: 0, x: 18, duration: 0.3, ease: 'power2.in' }, t1);
  NOTAS.caps.push({ cap: k, t0: r2(t0), t1: r2(t1) });
}

// ---------------------------------------------------------------- tarjeta de contacto (antes del cierre, completa al menos 4 s)
if (CT) {
  const L = VOZ.lineas[ID_CONTACTO];
  const det = String(CT.detalle || ''), nom = String(CT.nombre || '');
  // letra que cabe: la tarjeta mide a lo más 1640 px; el texto tiene unos 1180 px junto al icono
  const tamNom = Math.max(44, Math.min(72, Math.floor(1180 / Math.max(1, [...nom].length * 0.58)))), tamDet = Math.max(40, Math.min(60, Math.floor(1180 / Math.max(1, [...det].length * 0.6))));
  H_.ui.push(`<div id="contacto" data-layout-ignore><div class="ct-tarjeta"><div class="ct-icono"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9.5L5.5 19v-3.5H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg></div><div class="ct-tx"><div class="ct-nombre" style="font-size:${tamNom}px">${esc(nom)}</div>${det ? `<div class="ct-detalle" style="font-size:${tamDet}px">${esc(det)}</div>` : ''}</div></div></div>`);
  fromTo('#contacto', { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, tCard + 0.1);
  AUD.push({ id: 'vo-contacto', src: `voz/${ID_CONTACTO}.wav`, t: tVozCt, dur: r2(L.dur), vol: 1, track: 1, group: 'voz' });
  NOTAS.voz.push({ cap: 'contacto', id: ID_CONTACTO, t0: tVozCt, t1: r2(tVozCt + L.dur) });
  subtitulos(CT.frase, { dur: L.dur, words: L.words }, tVozCt, ID_CONTACTO);
  if (archivoSonido('aviso')) sonido('aviso', tCard + 0.2, 0.45);
  NOTAS.contacto = { t0: r2(tCard + 0.9), t1: CIERRE_INI, segundos: r2(CIERRE_INI - tCard - 0.9), nombre: nom, detalle: det };
  if (NOTAS.contacto.segundos < 4) falla(`la tarjeta de contacto se ve completa solo ${NOTAS.contacto.segundos} s (se piden 4)`);
}
for (let i = 1; i < NOTAS.voz.length; i++) if (NOTAS.voz[i].t0 < NOTAS.voz[i - 1].t1 - 0.01) falla(`dos frases de voz se enciman: ${NOTAS.voz[i - 1].id} y ${NOTAS.voz[i].id}`);
if (NOTAS.voz.at(-1).t1 > CIERRE_INI - 0.3) falla('la voz no termina antes del cierre');

// ---------------------------------------------------------------- música (opcional): entra ya sonando, se aparta de la voz (carve.mjs) y sale con el cierre
let MUS = null;
if (P.musica) {
  if (!fs.existsSync('assets/audio/musica-cuerpo.wav')) parar('falta assets/audio/musica-cuerpo.wav: corre «node preparar-musica.mjs» (hacer.mjs construir lo corre solo).');
  const lane = [{ t: 0, v: MUSICA_BASE }, { t: r2(CIERRE_INI + 1.0), v: MUSICA_BASE }, { t: r2(END), v: 0 }];
  MUS = { id: 'musica', src: 'assets/audio/musica-cuerpo.wav', t: 0, dur: END, vol: 1, track: 20, group: 'musica', auto: { version: 1, lanes: [{ target: 'volume', points: lane }] } };
}

// ---------------------------------------------------------------- el cierre (sub-composición de cierre.mjs)
try { cierreMod.armarCierre(AQUI); } catch (e) { parar('no pude armar el cierre: ' + e.message); }
const SALIDA_CIERRE = cierreMod.SALIDA || 'compositions/cierre.html';
if (!fs.existsSync(SALIDA_CIERRE)) parar(`falta ${SALIDA_CIERRE} después de correr cierre.mjs`);
const ID_CIERRE = cierreMod.ID || 'cierre';

// ---------------------------------------------------------------- HTML
const gsapOrigen = 'node_modules/gsap/dist/gsap.min.js';
if (!fs.existsSync(gsapOrigen)) parar('falta GSAP: corre «npm install» en la carpeta del proyecto.');
fs.mkdirSync('assets', { recursive: true });
fs.copyFileSync(gsapOrigen, 'assets/gsap.min.js');
const DEC = deco();
const tema = cssTema(P);
const ESTILOS = fs.readFileSync('src/estilos.css', 'utf8');
{ const sin = variablesSinDefinir(ESTILOS, tema.css); if (sin.length) parar(`src/estilos.css usa variables que el tema no define: ${sin.map(v => '--' + v).join(', ')}. Saldrían transparentes.`); }
const urlVentana = P.app?.direccion ?? (() => { try { const u = new URL(P.app.url); return /^(localhost|127\.|\[?::1|0\.0\.0\.0)/.test(u.hostname) ? '' : u.host; } catch { return ''; } })();
const filtros = (H_.plane.join('') + H_.ui.join('') + DEC.bg + DEC.mid + DEC.flo).match(/radial-gradient|filter:|clip-path/g)?.length || 0;
if (filtros > 25) aviso(`hay ${filtros} elementos con filter, clip-path o radial-gradient: más de unos 30 dan capturas negras al renderizar`);
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${ancho}, height=${alto}">
<title>${esc(TITULO)}</title>
<script src="assets/gsap.min.js"></script>
<style>
${tema.css}
${ESTILOS}
.win{width:${PW}px;height:${PH + CHROME}px}.plane,.vw,.vw video{width:${PW}px;height:${PH}px}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${ancho}" data-height="${alto}" data-duration="${END}">
  <div id="escena"${K !== 1 ? ` style="transform:scale(${+K.toFixed(5)})"` : ''}>
  <div id="Lbg" class="lay" data-layout-allow-overflow><div class="dr">${DEC.bg}</div></div>
  <div id="Lmid" class="lay" data-layout-allow-overflow><div class="dr">${DEC.mid}</div></div>
  <div id="Lworld" class="lay" data-layout-allow-overflow><div class="dr">
    <div id="winwrap"><div class="win" id="win" style="left:${WL}px;top:${WT}px;transform:scale(${S})"><div class="chrome"><i></i><i></i><i></i><span class="url" data-layout-ignore>${esc(urlVentana)}</span></div><div class="plane" id="pl">
      ${H_.vid.join('\n      ')}
      ${H_.plane.join('\n      ')}
    </div></div></div>
    ${H_.world.join('\n    ')}
    <div id="ring"></div>
    <div id="cur"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="cur-sombra" d="M5 3.6 L5 20.6 L9.5 16.6 L12.5 23.6 L15.5 22.3 L12.6 15.6 L18.5 15.6 Z"/><path class="cur-flecha" d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L17.5 14 Z"/></svg></div>
  </div></div>
  <div id="Lflo" class="lay" data-layout-allow-overflow><div class="dr">${DEC.flo}</div></div>
  <div id="ui">
    ${H_.ui.join('\n    ')}
  </div>
  </div>
  ${AUD.map(audioHtml).join('\n  ')}
  ${MUS ? audioHtml(MUS) : ''}
  <div id="el-cierre" style="z-index:999" data-composition-id="${ID_CIERRE}" data-composition-src="${SALIDA_CIERRE}" data-start="${CIERRE_INI}" data-duration="${DUR_CIERRE}" data-track-index="50" data-width="${ancho}" data-height="${alto}"></div>
</div>
<script>
const PLAN = ${JSON.stringify(PLAN)};
${fs.readFileSync('src/animar.js', 'utf8')}
</script>
</body>
</html>
`;
fs.writeFileSync('index.html', html);

// ---------------------------------------------------------------- resumen para medir, verificar y GUION.md
let INTRO_DUR = null;
try { INTRO_DUR = duracionEntrada(P, VOZ); } catch (e) { aviso('no se pudo calcular la duración de las entradas: ' + e.message); }
fs.mkdirSync('tmp', { recursive: true });
const resumen = { ancho, alto, fps, K, W, SUB_TOP, ventana: { S, WL, WT, PW, PH }, INTRO_DUR, END, END_CH, CIERRE_INI, DUR_CIERRE, OV, V, DUR: Object.fromEntries(CAPITULOS.map(c => [c.id, DUR(c.id)])), contacto: NOTAS.contacto || null, sigs: NOTAS.sigs, omitidas: NOTAS.omitidas, subs: NOTAS.subs, caps: NOTAS.caps, voz: NOTAS.voz, camlog: CAMLOG, fallas, avisos, musica: !!MUS, construido: new Date().toISOString() };
fs.writeFileSync('tmp/plan-resumen.json', JSON.stringify(resumen, null, 1));

// GUION.md: la tabla escena por escena, con la locución exacta y el minuto en el video final (no se edita a mano)
{
  const mmss = t => { const m = Math.floor(t / 60), s = t - 60 * m; return `${m}:${s.toFixed(1).padStart(4, '0')}`; };
  const celda = s => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
  const I0 = INTRO_DUR ?? 0, TOTAL = I0 + END;
  const out = [];
  out.push(`# Guion: ${TITULO}`, '');
  out.push('Se genera con `node hacer.mjs construir` a partir de `guion.mjs` (texto), `voz/voz.json` (duración real de cada frase) y las grabaciones. **No se edita a mano**: se cambia `guion.mjs` y se vuelve a correr.', '');
  out.push(`- **Duración de cada versión:** ${mmss(TOTAL)} (${TOTAL.toFixed(1)} s) = entrada ${I0} s + cuerpo ${mmss(CIERRE_INI)} + cierre ${DUR_CIERRE} s. Todas las versiones duran lo mismo.`);
  out.push(`- **Voz:** ${VOZ.voz}, velocidad ${VOZ.rate}. Voz sintética. Cada frase a -16 LUFS; entre frases, respiraciones de 250 a 700 ms (siempre las mismas para la misma frase).`);
  out.push(`- **Imagen:** la herramienta real grabada con Chrome sobre una copia con datos de ejemplo (${ancho} x ${alto}, ${fps} cuadros por segundo).`);
  if ((P.palabrasProhibidas || []).length) out.push(`- **El cuerpo no nombra a ninguna audiencia:** un vigilante revisó la pantalla cada 0.35 s buscando: ${P.palabrasProhibidas.join(', ')}.`);
  out.push('', '## Versiones', '', '| Versión | Archivo | Para quién | Qué dice la entrada |', '|---|---|---|---|');
  for (const v of P.versiones) out.push(`| ${v.id} | \`out/${P.nombreArchivo}-${v.id}.mp4\` | ${celda(v.para)} | «${celda((INTROS[v.id] || []).map(f => f.sub).join(' '))}» |`);
  out.push('', `## Capítulos (los minutos ya cuentan la entrada de ${I0} s)`, '', '| n.º | Capítulo | Empieza | Termina | Duración |', '|---|---|---|---|---|');
  CAPITULOS.forEach((c, i) => out.push(`| ${i + 1} | ${celda(c.rotulo)} | ${mmss(I0 + V[c.id])} | ${mmss(I0 + V[c.id] + DUR(c.id) - OV)} | ${DUR(c.id).toFixed(1)} s |`));
  if (CT) out.push(`| | Tarjeta de contacto: ${celda(CT.nombre)} (${celda(CT.detalle)}) | ${mmss(I0 + tCard)} | ${mmss(I0 + CIERRE_INI)} | ${(CIERRE_INI - tCard).toFixed(1)} s |`);
  out.push(`| | Cierre: ${celda(P.marca?.nombre || '')} | ${mmss(I0 + CIERRE_INI)} | ${mmss(TOTAL)} | ${DUR_CIERRE.toFixed(1)} s |`);
  CAPITULOS.forEach((c, i) => {
    out.push('', `## ${i + 1}. ${c.rotulo}`, '', '| n.º | Qué se ve | Qué se hace | Señal | Locución (texto exacto) | Duración |', '|---|---|---|---|---|---|');
    for (const f of c.frases) {
      const fr = FR(c.id, f.id), dicho = f.voz || f.sub;
      const loc = dicho === f.sub ? `«${celda(dicho)}»` : `«${celda(dicho)}»<br>Subtítulo: ${celda(f.sub)}`;
      out.push(`| ${f.id} | ${celda(f.ve)} | ${celda(f.hace)} | ${celda(f.senal)} | ${loc} | ${fr.dur.toFixed(1)} s (${mmss(I0 + V[c.id] + fr.ini)}) |`);
    }
  });
  if (CT) out.push('', '## Contacto', '', `«${celda(CT.frase)}» con la tarjeta de **${celda(CT.nombre)}** (${celda(CT.detalle)}), completa ${NOTAS.contacto.segundos} s antes del cierre.`);
  fs.writeFileSync('GUION.md', out.join('\n') + '\n');
}

console.log(`cuerpo: ${END} s (capítulos hasta ${END_CH} s, ${CT ? `contacto desde ${tCard} s, ` : ''}cierre de ${CIERRE_INI} a ${END} s), ${NOTAS.sigs.length} señales, ${NOTAS.clics} clics, ${NOTAS.subs.length} subtítulos, ${PLAN.length} movimientos${MUS ? ', con música' : ', sin música'}`);
for (const a of avisos) console.log('AVISO ' + a);
if (fallas.length) {
  console.error(`\n${fallas.length} FALLA(S):\n  ` + fallas.join('\n  '));
  if (!SEGUIR) { console.error('\nindex.html quedó escrito para revisarlo, pero el paso se detiene: arregla lo de arriba (o usa --seguir para ver la vista previa).'); process.exit(1); }
}
