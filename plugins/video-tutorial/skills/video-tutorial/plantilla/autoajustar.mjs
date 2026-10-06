// Ajusta las pausas del guion a lo que de verdad tardó la pantalla.
// Mira, en la bitácora de cada capítulo (media/capN.json), cuándo terminaron las acciones de cada frase y cuándo empezaba
// la siguiente («inicio <id>», que anota E.frase(id)), y cambia la pausa `extra` de la frase anterior en guion.mjs:
//   - si llegó tarde, la alarga (con un margen: el tiempo de las acciones varía un poco entre corridas);
//   - si sobró bastante, la acorta (nunca baja de 0: la respiración mínima ya la pone tiempos.mjs).
// Lo mismo con el final del capítulo («fin»). Imprime los cambios, o «sin cambios».
// Uso: node autoajustar.mjs        (lo corre grabar.mjs entre vuelta y vuelta)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.chdir(AQUI);
const { CAPITULOS } = await import('./guion.mjs');

const MARGEN_TARDE = 0.35;   // lo que se agrega además del retraso
const SOBRA_MAX = 0.9;       // si sobra más que esto, se acorta...
const SOBRA_DEJA = 0.55;     // ...dejando esto de holgura

/** Busca el objeto de la frase `id` en el texto de guion.mjs y devuelve [inicio, fin) (sin contar llaves dentro de textos). */
function objetoDe(s, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`id\\s*:\\s*(['"\`])${esc}\\1`).exec(s);
  if (!m) return null;
  let i = m.index, q = null;
  for (; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '/' && s[i + 1] === '/') { const n = s.indexOf('\n', i); i = n < 0 ? s.length : n; continue; }       // comentario de línea
    if (c === '/' && s[i + 1] === '*') { const n = s.indexOf('*/', i + 2); i = n < 0 ? s.length : n + 1; continue; } // comentario de bloque
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === '}') return [m.index, i];
  }
  return null;
}

function ponerExtra(s, id, valor) {
  const o = objetoDe(s, id);
  if (!o) throw new Error(`No encontré la frase ${id} en guion.mjs`);
  const trozo = s.slice(o[0], o[1]);
  const m = /extra\s*:\s*-?[\d.]+/.exec(trozo);
  const nuevo = m ? trozo.slice(0, m.index) + 'extra: ' + valor + trozo.slice(m.index + m[0].length)
    : trozo.replace(/\s*,?\s*$/, '') + ', extra: ' + valor + ' ';
  return s.slice(0, o[0]) + nuevo + s.slice(o[1]);
}

let s = fs.readFileSync('guion.mjs', 'utf8');
const cambios = [];
const nuevo = {};   // id -> extra nuevo (si una frase sale dos veces, gana la primera)
for (const c of CAPITULOS) {
  const f = `media/cap${c.id}.json`;
  if (!fs.existsSync(f)) continue;
  const L = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const x of L.llegadas || []) {
    let prev;
    if (/^inicio /.test(x.nota)) {
      const i = c.frases.findIndex(fr => fr.id === x.nota.slice(7));
      if (i <= 0) continue;
      prev = c.frases[i - 1];
    } else if (x.nota === 'fin') prev = c.frases[c.frases.length - 1];
    else continue;
    if (prev.id in nuevo) continue;
    const holgura = x.objetivo - x.llegada;           // positivo = sobró tiempo
    const g = prev.extra ?? 0;
    let g2 = g;
    if (holgura < -0.02) g2 = g + (-holgura) + MARGEN_TARDE;
    else if (holgura > SOBRA_MAX && g > 0) g2 = Math.max(0, g - (holgura - SOBRA_DEJA));
    g2 = +g2.toFixed(2);
    if (Math.abs(g2 - g) > 0.04) {
      nuevo[prev.id] = g2;
      s = ponerExtra(s, prev.id, g2);
      cambios.push(`${prev.id}: pausa ${g} -> ${g2} s (${holgura < 0 ? 'llegó tarde ' + (-holgura).toFixed(2) : 'sobraban ' + holgura.toFixed(2)} s)`);
    }
  }
}
if (cambios.length) fs.writeFileSync('guion.mjs', s);
console.log(cambios.join('\n') || 'sin cambios');
