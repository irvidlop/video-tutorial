// Prueba de los colores: node tema.prueba.mjs
// Mide cada par letra/fondo de cada tema y de colores propios. Si algo no pasa, lo dice y sale con error.
import {
  TEMAS, CLAVES, PARES, TRAZOS, MINIMO_TEXTO, MINIMO_TRAZO, OPACIDAD_SUBTITULO,
  tema, contraste, revisarContraste, mezcla, sobre, luminancia, normalizarHex, conAlfa, variablesCss,
} from './tema.mjs';

let total = 0;
const fallas = [];

function prueba(nombre, fn) {
  total++;
  try {
    fn();
  } catch (e) {
    fallas.push(`${nombre}\n    ${String(e.message).split('\n').join('\n    ')}`);
  }
}

function igual(real, esperado, que) {
  if (real !== esperado) throw new Error(`${que}: salió ${real}, se esperaba ${esperado}`);
}

function verdad(cond, que) {
  if (!cond) throw new Error(que);
}

function lanza(fn, debeDecir, que) {
  let error = null;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  if (!error) throw new Error(`${que}: no se detuvo y debía detenerse`);
  if (debeDecir && !debeDecir.test(error.message)) throw new Error(`${que}: se detuvo, pero el mensaje no dice lo que debe (${error.message})`);
}

function todoSeLee(t, que) {
  const f = revisarContraste(t);
  if (f.length) throw new Error(`${que}: ${f.map((x) => `${x.texto}/${x.fondo} ${x.ratio.toFixed(2)}:1 (${x.para})`).join('; ')}`);
}

function hexValido(t, que) {
  for (const k of CLAVES) verdad(/^#[0-9A-F]{6}$/.test(t[k]), `${que}: ${k} = ${t[k]} no es #RRGGBB en mayúsculas`);
  igual(Object.keys(t).join(','), CLAVES.join(','), `${que}: claves`);
}

// Semilla fija: la misma corrida da siempre los mismos colores.
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. La medida misma, con valores conocidos (control positivo: también tiene que reprobar lo que reprueba).
prueba('la fórmula de contraste da los valores conocidos', () => {
  igual(contraste('#000000', '#FFFFFF').toFixed(2), '21.00', 'negro/blanco');
  igual(contraste('#FFFFFF', '#FFFFFF').toFixed(2), '1.00', 'blanco/blanco');
  igual(contraste('#767676', '#FFFFFF').toFixed(2), '4.54', 'el gris más claro que pasa sobre blanco');
  igual(contraste('#777777', '#FFFFFF').toFixed(2), '4.48', 'el gris que ya no pasa');
  verdad(contraste('#777777', '#FFFFFF') < MINIMO_TEXTO, '#777777 sobre blanco debe reprobar');
  igual(luminancia('#FFFFFF').toFixed(4), '1.0000', 'luminancia del blanco');
  igual(normalizarHex('#abc'), '#AABBCC', 'hex corto');
  igual(mezcla('#000000', '#FFFFFF', 0.5), '#808080', 'mezcla a la mitad');
  igual(sobre('#000000', 0.8, '#FFFFFF'), '#333333', 'negro al 80% sobre blanco');
  igual(conAlfa('#3E5BA9', 0.25), 'rgba(62, 91, 169, 0.25)', 'color con transparencia');
});

prueba('el revisor detecta un par que no se lee (control positivo)', () => {
  const malo = { ...TEMAS.azul, tintaSuave: '#B8BCC6' };
  const f = revisarContraste(malo);
  verdad(f.some((x) => x.texto === 'tintaSuave'), 'no detectó la tinta suave ilegible');
  const subMalo = { ...TEMAS.azul, subtituloFondo: '#6A6F80' };
  verdad(revisarContraste(subMalo).some((x) => /80% sobre blanco/.test(x.para)), 'no detectó la caja de subtítulo translúcida ilegible');
  const senalMala = { ...TEMAS.azul, senal: '#F6B39E' };
  verdad(revisarContraste(senalMala).some((x) => x.texto === 'senal'), 'no detectó una señal que no se ve');
});

// 2. Los cuatro temas.
const tabla = [];
for (const [nombre, t] of Object.entries(TEMAS)) {
  prueba(`tema ${nombre}: todo par letra/fondo pasa ${MINIMO_TEXTO}:1 y la señal ${MINIMO_TRAZO}:1`, () => {
    hexValido(t, nombre);
    todoSeLee(t, nombre);
    const fila = { tema: nombre };
    for (const p of PARES) fila[`${p.texto}/${p.fondo}`] = contraste(t[p.texto], t[p.fondo]).toFixed(2);
    fila[`subtítulo al ${OPACIDAD_SUBTITULO * 100}% sobre blanco`] = contraste(t.subtituloTinta, sobre(t.subtituloFondo, OPACIDAD_SUBTITULO, '#FFFFFF')).toFixed(2);
    for (const r of TRAZOS) fila[`senal/${r.contra.startsWith('#') ? 'blanco' : r.contra}`] = contraste(t.senal, r.contra.startsWith('#') ? r.contra : t[r.contra]).toFixed(2);
    tabla.push(fila);
  });
  prueba(`tema ${nombre}: el primario también se lee como letra y la línea se ve`, () => {
    verdad(contraste(t.primario, t.fondo) >= MINIMO_TEXTO, `primario/fondo ${contraste(t.primario, t.fondo).toFixed(2)}:1`);
    verdad(contraste(t.primario, t.fondo2) >= MINIMO_TEXTO, `primario/fondo2 ${contraste(t.primario, t.fondo2).toFixed(2)}:1`);
    verdad(contraste(t.linea, t.fondo2) >= 1.2, `linea/fondo2 ${contraste(t.linea, t.fondo2).toFixed(2)}:1 casi no se ve`);
    verdad(contraste(t.tintaSuave, t.tinta) >= 1.4, 'la tinta suave casi no se distingue de la tinta');
  });
  prueba(`tema ${nombre}: tema() lo devuelve igual y en copia`, () => {
    const r = tema({ tema: nombre });
    for (const k of CLAVES) igual(r[k], t[k], `${nombre}.${k}`);
    r.primario = '#000000';
    verdad(TEMAS[nombre].primario !== '#000000', 'tema() devolvió el objeto original y no una copia');
  });
}

// 3. Elegir tema.
prueba('sin tema sale azul', () => {
  igual(JSON.stringify(tema({})), JSON.stringify(TEMAS.azul), 'tema({})');
  igual(JSON.stringify(tema()), JSON.stringify(TEMAS.azul), 'tema()');
  igual(JSON.stringify(tema({ tema: 'Verde ', colores: null })), JSON.stringify(TEMAS.verde), 'mayúsculas, espacios y colores null');
});
prueba('un tema que no existe se detiene y dice cuáles hay', () => {
  lanza(() => tema({ tema: 'rosa' }), /azul, verde, violeta, morado/, 'tema rosa');
});

// 4. Colores propios (proyecto.colores).
const casos = [
  { que: 'primario amarillo claro: la letra encima pasa a oscura', colores: { primario: '#F2C94C' }, revisa: (t) => verdad(t.primarioTinta !== '#FFFFFF', 'dejó letra blanca sobre amarillo') },
  { que: 'fondo oscuro con tinta clara', colores: { fondo: '#14161F', tinta: '#F2F4F8' } },
  { que: 'marca completa', colores: { primario: '#0B7285', acento: '#F59F00', fondo: '#F8F9FA', tinta: '#212529' } },
  { que: 'fondo blanco: las fichas quedan apenas grises', colores: { fondo: '#fff' }, revisa: (t) => { igual(t.fondo, '#FFFFFF', 'hex corto normalizado'); verdad(t.fondo2 !== '#FFFFFF', 'fichas iguales al fondo'); } },
  { que: 'solo el acento: lo demás se queda como el tema', colores: { acento: '#00A3FF' }, revisa: (t) => { for (const k of CLAVES) if (!['acento', 'senal'].includes(k)) igual(t[k], TEMAS.azul[k], k); } },
  { que: 'primario gris medio: la letra encima sale oscura', colores: { primario: '#7A7A7A' } },
  { que: 'colores en minúsculas', colores: { primario: '#3e5ba9', acento: '#e0795b' }, revisa: (t) => igual(t.primario, '#3E5BA9', 'primario normalizado') },
  { que: 'sobre tema morado, solo el fondo', tema: 'morado', colores: { fondo: '#FFF8FB' } },
  { que: 'la persona da la señal ella misma', colores: { senal: '#B4232A' }, revisa: (t) => igual(t.senal, '#B4232A', 'senal dada') },
];
for (const c of casos) {
  prueba(`colores propios: ${c.que}`, () => {
    const t = tema({ tema: c.tema ?? 'azul', colores: c.colores });
    hexValido(t, c.que);
    todoSeLee(t, c.que);
    for (const [k, v] of Object.entries(c.colores)) igual(t[k], normalizarHex(v), `colores.${k} se respeta`);
    c.revisa?.(t);
  });
}

prueba('colores propios que no se leen: se detiene, dice cuánto da y sugiere otro', () => {
  lanza(() => tema({ colores: { fondo: '#FFFFFF', tinta: '#999999' } }), /tinta #999999 sobre fondo #FFFFFF da 2\.85:1 y necesita 4\.5:1.*Prueba tinta #/s, 'tinta gris sobre blanco');
  lanza(() => tema({ colores: { primario: '#FFD43B', primarioTinta: '#FFFFFF' } }), /primarioTinta #FFFFFF sobre primario #FFD43B.*Prueba primarioTinta #1E2230/s, 'letra blanca dada a mano sobre amarillo');
  lanza(() => tema({ colores: { senal: '#FFE8A3' } }), /senal #FFE8A3/, 'señal pálida dada a mano');
});
prueba('colores mal escritos: se detiene y dice cuál', () => {
  lanza(() => tema({ colores: { primario: 'azul' } }), /colores\.primario: «azul» no es un color hex/, 'nombre en lugar de hex');
  lanza(() => tema({ colores: { secundario: '#123456' } }), /colores\.secundario: no es un color del tema/, 'clave que no existe');
  lanza(() => tema({ colores: '#123456' }), /va un objeto/, 'colores como texto');
});
prueba('un fondo gris oscuro con el que ninguna señal se ve: se detiene y lo dice', () => {
  lanza(() => tema({ colores: { fondo: '#4A4A4A', tinta: '#FFFFFF' } }), /ningún color de señal se ve a la vez/, 'fondo gris oscuro');
});

// 5. Muchas combinaciones al azar (con semilla): lo que se deriva siempre se lee.
prueba('400 combinaciones de colores propios: todo lo derivado se lee', () => {
  const r = azar(20261005);
  const hex = () => '#' + [0, 0, 0].map(() => Math.floor(r() * 256).toString(16).padStart(2, '0')).join('').toUpperCase();
  let probadas = 0;
  while (probadas < 400) {
    const fondo = hex();
    const Lf = luminancia(fondo);
    if (Lf > 0.03 && Lf < 0.55) continue; // fondos de escenario: claros o muy oscuros
    let tinta = hex();
    if (contraste(tinta, fondo) < MINIMO_TEXTO) tinta = Lf > 0.5 ? mezcla(tinta, '#000000', 0.85) : mezcla(tinta, '#FFFFFF', 0.85);
    if (contraste(tinta, fondo) < MINIMO_TEXTO) continue;
    const colores = { primario: hex(), acento: hex(), fondo, tinta };
    let t;
    try {
      t = tema({ colores });
    } catch (e) {
      throw new Error(`se detuvo con ${JSON.stringify(colores)}: ${e.message}`);
    }
    todoSeLee(t, JSON.stringify(colores));
    verdad(contraste(t.linea, t.fondo2) >= 1.2, `la línea casi no se ve con ${JSON.stringify(colores)}: ${contraste(t.linea, t.fondo2).toFixed(2)}:1`);
    probadas++;
  }
});

prueba('variablesCss da una variable por color', () => {
  const css = variablesCss(TEMAS.azul);
  verdad(css.includes('--primario:#3E5BA9') && css.includes('--primario-tinta:#FFFFFF') && css.includes('--subtitulo-fondo:#161A26'), css);
  igual(css.split(';').length, CLAVES.length, 'número de variables');
});

console.log('Contraste de los temas (letra/fondo):');
console.table(tabla);
if (fallas.length) {
  console.error(`\n${fallas.length} de ${total} pruebas fallaron:\n`);
  for (const f of fallas) console.error(`FALLA: ${f}\n`);
  process.exit(1);
}
console.log(`\nBien: ${total} pruebas, ninguna falla.`);
