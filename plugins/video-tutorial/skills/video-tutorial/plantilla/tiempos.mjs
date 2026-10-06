// La voz es el reloj. Este módulo calcula cuándo empieza y termina cada frase de cada capítulo
// (t = 0 es el primer cuadro del video grabado de ese capítulo) a partir de la duración REAL de cada frase
// (voz/voz.json, que escribe voz/voz.py) y de las pausas del guion (pre, extra).
//
// Los silencios entre frases son variables pero fijos: una respiración de 250 a 700 ms que sale de una semilla
// (el id de la frase). Al abrir cada capítulo hay un respiro un poco más largo. Así la misma voz da siempre los mismos tiempos.
//
// También junta todas las frases que se dicen (cuerpo, entradas y tarjeta de contacto) y revisa el guion.
//
//   node tiempos.mjs        imprime cuánto dura cada capítulo
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CAPITULOS, INTROS } from './guion.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const LEAD_CAP1 = 0.8;   // el cuerpo abre justo después de la entrada: un respiro y arranca la voz
export const COLA = 0.35;       // silencio al terminar cada capítulo grabado
export const ID_CONTACTO = 'contacto';   // la frase de la tarjeta de contacto (proyecto.json → contacto.frase)

/** Número «al azar» pero fijo para cada texto (semilla = el texto): cada corrida sale igual. */
export function azar(semilla) {
  let h = 2166136261;
  for (const c of String(semilla)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 2246822519); h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}
export const respiro = id => +(0.25 + 0.45 * azar(id)).toFixed(3);                                      // 250 a 700 ms
export const entradaCap = n => (n === CAPITULOS[0]?.id ? LEAD_CAP1 : +(0.75 + 0.35 * azar('cap' + n)).toFixed(3));   // al abrir cada capítulo

/** Lee voz/voz.json. Si no existe, dice qué correr. */
export function leerVoz() {
  const f = path.join(AQUI, 'voz', 'voz.json');
  if (!fs.existsSync(f)) throw new Error('Falta voz/voz.json: corre «node hacer.mjs voz».');
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/** Normaliza una palabra para compararla: minúsculas, sin acentos, solo letras y números. */
export const normPalabra = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');

/** Tiempos de todos los capítulos: { [cap]: { frases: { [id]: { ini, fin, dur, words } }, total } }. */
export function tiempos(VOZ = leerVoz()) {
  const out = {};
  for (const c of CAPITULOS) {
    let t = entradaCap(c.id);
    const fr = {};
    for (const f of c.frases) {
      t += f.pre || 0;
      const L = VOZ.lineas[f.id];
      if (!L) throw new Error(`Falta la voz de la frase ${f.id}: corre «node hacer.mjs voz».`);
      fr[f.id] = { ini: +t.toFixed(3), fin: +(t + L.dur).toFixed(3), dur: L.dur, words: L.words };
      t += L.dur + respiro(f.id) + (f.extra ?? 0);
    }
    out[c.id] = { frases: fr, total: +(t + COLA).toFixed(3) };
  }
  return out;
}

/** Firma de los tiempos de un capítulo: si cambia la voz o una pausa, cambia la firma y hay que volver a grabarlo. */
export const firmaCapitulo = TT => crypto.createHash('sha1').update(JSON.stringify(TT)).digest('hex').slice(0, 12);

/**
 * Segundo (del capítulo) en que la voz dice la palabra `w` de la frase `id`. `n` = cuál de las repeticiones (0 = la primera).
 * Primero busca la palabra exacta («ve» no es «verás»); si no hay, la que empieza igual.
 */
export function palabra(T, id, w, n = 0) {
  const f = T.frases[id];
  if (!f) throw new Error(`La frase ${id} no es de este capítulo.`);
  const k = normPalabra(w);
  for (const exacto of [true, false]) {
    let c = 0;
    for (const p of f.words) {
      const q = normPalabra(p.text);
      if (exacto ? q === k : q.startsWith(k)) { if (c++ === n) return +(f.ini + p.t0).toFixed(3); }
    }
  }
  throw new Error(`No encuentro la palabra «${w}»${n ? ` (la número ${n + 1})` : ''} en la frase ${id}. La voz dice: ${f.words.map(p => p.text).join(' ')}`);
}

/** Todas las frases que se dicen, en orden: cuerpo, entradas y tarjeta de contacto. */
export function todasLasFrases(proyecto) {
  const out = [];
  for (const c of CAPITULOS) for (const f of c.frases) out.push({ id: f.id, parte: 'cuerpo', cap: c.id, sub: f.sub, voz: f.voz || f.sub });
  for (const [version, frases] of Object.entries(INTROS || {})) for (const f of frases) out.push({ id: f.id, parte: 'entrada', version, sub: f.sub, voz: f.voz || f.sub });
  const ct = proyecto?.contacto;
  if (ct && ct.frase) out.push({ id: ID_CONTACTO, parte: 'contacto', sub: ct.frase, voz: ct.voz || ct.frase });
  return out;
}

/** Expresión regular (para texto ya normalizado: minúsculas y sin acentos) que encuentra las palabras prohibidas. */
export function reProhibidas(palabras) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alts = (palabras || []).map(p => String(p).trim()).filter(Boolean).map(p => {
    const base = p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    // «gerent*» = todo lo que empiece así; si no, la palabra completa y su plural
    if (base.endsWith('*')) return esc(base.slice(0, -1)).replace(/\s+/g, '\\s+') + '[a-z0-9ñ]*';
    return esc(base).replace(/\s+/g, '\\s+') + '(?:s|es)?';
  });
  return alts.length ? `(?<![a-z0-9ñ])(?:${alts.join('|')})(?![a-z0-9ñ])` : null;
}

/** Revisa el guion contra proyecto.json. Devuelve { errores, avisos } (los errores detienen el paso). */
export function revisarGuion(proyecto) {
  const errores = [], avisos = [];
  const frases = todasLasFrases(proyecto);
  const vistos = new Set();
  for (const f of frases) {
    if (!f.id || typeof f.id !== 'string') errores.push(`una frase no tiene id (texto: «${String(f.sub).slice(0, 40)}»)`);
    if (vistos.has(f.id)) errores.push(`el id ${f.id} se repite: cada frase lleva uno distinto`);
    vistos.add(f.id);
    if (!f.sub || !String(f.sub).trim()) errores.push(`la frase ${f.id} no tiene texto (sub)`);
    if (/[\u2014\u2013]/.test(f.sub + f.voz)) errores.push(`la frase ${f.id} tiene guion largo o medio: usa dos puntos o punto`);
    if (!/^[A-Za-z0-9._-]+$/.test(f.id)) errores.push(`el id «${f.id}» solo puede llevar letras sin acento, números, punto y guion (se usa en nombres de archivo)`);
  }
  const ids = (proyecto.versiones || []).map(v => v.id);
  if (!ids.length) errores.push('proyecto.json → versiones está vacío: va al menos una versión (por ejemplo «general»)');
  for (const v of ids) if (!INTROS || !INTROS[v] || !INTROS[v].length) errores.push(`falta la entrada de la versión «${v}» en INTROS (guion.mjs)`);
  for (const k of Object.keys(INTROS || {})) if (!ids.includes(k)) avisos.push(`INTROS tiene «${k}», que no está en proyecto.json → versiones: no se usa`);
  const re = reProhibidas(proyecto.palabrasProhibidas);
  if (re) {
    const R = new RegExp(re, 'g');
    const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const c of CAPITULOS) {
      const enRotulo = norm(c.rotulo).match(R);
      if (enRotulo) errores.push(`el rótulo del capítulo ${c.id} dice «${enRotulo[0]}», que está en palabrasProhibidas`);
      for (const f of c.frases) {
        const m = norm(f.sub + ' ' + (f.voz || '')).match(R);
        if (m) errores.push(`la frase ${f.id} dice «${m[0]}», que está en palabrasProhibidas: el cuerpo no nombra a ninguna audiencia`);
      }
    }
    const ct = proyecto.contacto;
    if (ct) { const m = norm([ct.frase, ct.nombre, ct.detalle].join(' ')).match(R); if (m) errores.push(`la tarjeta de contacto dice «${m[0]}», que está en palabrasProhibidas`); }
  }
  for (const c of CAPITULOS) {
    if (!c.rotulo) avisos.push(`el capítulo ${c.id} no tiene rótulo`);
    else if (c.rotulo.trim().split(/\s+/).length > 3) avisos.push(`el rótulo «${c.rotulo}» pasa de 3 palabras`);
    if (!c.frases?.length) errores.push(`el capítulo ${c.id} no tiene frases`);
  }
  return { errores, avisos };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const T = tiempos(); let g = 0;
  for (const k in T) { console.log(`capítulo ${k}: ${T[k].total.toFixed(1)} s`); g += T[k].total; }
  console.log(`suma de capítulos: ${g.toFixed(1)} s`);
}
