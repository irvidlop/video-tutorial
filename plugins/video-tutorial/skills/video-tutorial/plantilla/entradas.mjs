// Tiempos de las ENTRADAS (una por versión de proyecto.json). Todas duran exactamente lo mismo (duracionEntrada), para que
// el cuerpo se renderice una sola vez y se una a cada entrada sin recodificar. Todo sale de la duración real de la voz.
//
//  - La voz de todas termina COLA_ENTRADA segundos antes del final; la que habla menos arranca después (el título espera más).
//  - La duración es múltiplo de 0.5 s (o de 1 s si los fps no lo permiten): cae en cuadro entero y en muestra entera a 48 kHz,
//    así el corte de la música es exacto.
//  - Si una entrada nueva ya no cabe, la duración sube para TODAS (y, si hay música, el cuerpo se vuelve a renderizar,
//    porque su música arranca en ese segundo).
//
//   node entradas.mjs       imprime la duración y cuándo habla cada entrada
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTROS } from './guion.mjs';
import { leerVoz } from './tiempos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const HUECO = 0.4;            // silencio entre las frases de una entrada
export const COLA_ENTRADA = 0.9;     // silencio al final de la entrada, antes de que arranque el cuerpo
export const ARRANQUE_MIN = 0.9;     // lo mínimo que se ve el título antes de que hable la voz
export const DURACION_MIN = 6;       // una entrada dura al menos esto (el título se alcanza a leer)
// El carve baja la música bajo la voz y la suelta MUY despacio (unos 5 dB por segundo): al terminar la voz de la entrada la
// música seguiría abajo y el cuerpo, que arranca con la música a su nivel, la subiría de golpe en el empalme. Por eso los carriles
// del carve de la entrada se sueltan a 0 entre SUELTA_INI y SUELTA_FIN (carve.mjs): la música llega a su nivel antes del empalme.
export const SUELTA_FIN_ANTES = 0.4;    // ya suelta 0.4 s antes del corte: los últimos cuadros de la entrada suenan como el arranque del cuerpo

const proyecto = () => JSON.parse(fs.readFileSync(path.join(AQUI, 'proyecto.json'), 'utf8').replace(/^﻿/, ''));
/** Paso de la duración: 0.5 s si da cuadros enteros a estos fps, si no 1 s. */
export const paso = fps => (Number.isInteger(0.5 * fps) ? 0.5 : 1);

/** Frases de la entrada de una versión (guion.mjs → INTROS). */
export function frasesEntrada(version) {
  const fr = INTROS?.[version];
  if (!fr || !fr.length) throw new Error(`Falta la entrada de la versión «${version}» en guion.mjs → INTROS.`);
  return fr;
}
const habla = (version, VOZ) => frasesEntrada(version).reduce((s, f) => {
  const L = VOZ.lineas[f.id]; if (!L) throw new Error(`Falta la voz de ${f.id}: corre «node hacer.mjs voz».`);
  return s + L.dur;
}, 0) + HUECO * (frasesEntrada(version).length - 1);

/** Duración común de todas las entradas (segundos), según la voz y las versiones de proyecto.json. */
export function duracionEntrada(P = proyecto(), VOZ = leerVoz()) {
  const fps = Number(P.video?.fps ?? 30), k = paso(fps);
  const max = Math.max(...(P.versiones || []).map(v => habla(v.id, VOZ)));
  return Math.max(DURACION_MIN, Math.ceil((ARRANQUE_MIN + max + COLA_ENTRADA) / k - 1e-9) * k);
}
export const sueltaIni = D => +(D - COLA_ENTRADA + 0.15).toFixed(3);  // 0.15 s después de la última palabra
export const sueltaFin = D => +(D - SUELTA_FIN_ANTES).toFixed(3);

/** Cuándo habla cada frase de la entrada (segundos desde el inicio de la entrada). */
export function tiemposEntrada(version, D, VOZ = leerVoz()) {
  const h = habla(version, VOZ);
  let t = +(D - COLA_ENTRADA - h).toFixed(3);
  const arranque = t;
  const frases = {};
  for (const f of frasesEntrada(version)) {
    const L = VOZ.lineas[f.id];
    frases[f.id] = { ini: +t.toFixed(3), fin: +(t + L.dur).toFixed(3), dur: L.dur, words: L.words, sub: f.sub };
    t += L.dur + HUECO;
  }
  return { frases, habla: +h.toFixed(3), arranque };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const P = proyecto(), D = duracionEntrada(P);
  console.log(`Todas las entradas duran ${D} s`);
  for (const v of P.versiones) { const T = tiemposEntrada(v.id, D); console.log(`  ${v.id.padEnd(14)} la voz habla ${T.habla.toFixed(2)} s, de ${T.arranque.toFixed(2)} a ${Object.values(T.frases).at(-1).fin.toFixed(2)} s`); }
}
