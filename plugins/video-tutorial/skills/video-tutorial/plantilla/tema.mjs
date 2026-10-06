// Los colores del video. El motor (cuerpo, entradas, tarjeta de contacto) y el cierre toman sus
// colores SOLO de aquí: nada de colores sueltos en otros archivos.
//
//   import { tema } from './tema.mjs';
//   const t = tema(proyecto);        // proyecto = el contenido de proyecto.json
//   t.primario, t.tinta, ...         // siempre hex #RRGGBB en mayúsculas
//
// Qué es cada color y dónde va:
//   primario        color principal: rótulos de capítulo, etiquetas de las señales, formas del fondo.
//   primarioTinta   letra encima de primario.
//   acento          segundo color: formas suaves del fondo y detalles. No es color de letra.
//   fondo           fondo del escenario (detrás de la ventana de la app), de las entradas y del cierre.
//   fondo2          superficies encima del fondo: fichas flotantes, tarjeta de contacto.
//   tinta           letra principal, sobre fondo o fondo2.
//   tintaSuave      letra secundaria (la línea de «para quién», detalles), sobre fondo o fondo2.
//   linea           bordes finos y separadores. Es adorno, no letra.
//   senal           trazo de las señales: halo, recuadro, flecha y onda del clic. No es color de letra:
//                   la etiqueta de una señal va con letra primarioTinta sobre primario.
//   subtituloFondo  caja de los subtítulos (puede ir translúcida hasta OPACIDAD_SUBTITULO).
//   subtituloTinta  letra de los subtítulos.
//
// Garantía: todo par letra/fondo de PARES pasa 4.5:1 (WCAG AA) y la señal pasa 3:1 contra blanco,
// fondo y fondo2 (regla de objetos gráficos). tema() lo mide antes de devolver y, si no se cumple,
// se detiene y dice qué par falla, cuánto da y qué color usar en su lugar.
// La prueba vive en tema.prueba.mjs:  node tema.prueba.mjs

export const CLAVES = Object.freeze([
  'primario', 'primarioTinta', 'acento', 'fondo', 'fondo2', 'tinta', 'tintaSuave',
  'linea', 'senal', 'subtituloFondo', 'subtituloTinta',
]);

export const MINIMO_TEXTO = 4.5;       // letra normal (WCAG AA)
export const MINIMO_TRAZO = 3;         // trazos y formas que hay que ver (WCAG 1.4.11)
export const OPACIDAD_SUBTITULO = 0.8; // la caja del subtítulo puede bajar hasta aquí y se sigue leyendo

const BLANCO = '#FFFFFF';
const NEGRO = '#000000';

// Los cuatro temas. azul, verde y violeta son de la misma familia que los de la skill de
// presentaciones narradas; morado es morado ciruela con rosa frambuesa.
export const TEMAS = Object.freeze({
  azul: Object.freeze({
    primario: '#3E5BA9', primarioTinta: '#FFFFFF', acento: '#E0795B',
    fondo: '#EDF1F8', fondo2: '#FFFFFF', tinta: '#1E2230', tintaSuave: '#4F5566',
    linea: '#D3DAE6', senal: '#D4583A', subtituloFondo: '#161A26', subtituloTinta: '#FFFFFF',
  }),
  verde: Object.freeze({
    primario: '#2A7466', primarioTinta: '#FFFFFF', acento: '#C9A45C',
    fondo: '#EBF3F0', fondo2: '#FFFFFF', tinta: '#17272A', tintaSuave: '#475A57',
    linea: '#D0DED9', senal: '#A8711A', subtituloFondo: '#10201D', subtituloTinta: '#FFFFFF',
  }),
  violeta: Object.freeze({
    primario: '#6B5E9B', primarioTinta: '#FFFFFF', acento: '#FF9248',
    fondo: '#F1EFF7', fondo2: '#FFFFFF', tinta: '#211F33', tintaSuave: '#555170',
    linea: '#DCD8E8', senal: '#CF5F1A', subtituloFondo: '#1C1830', subtituloTinta: '#FFFFFF',
  }),
  morado: Object.freeze({
    primario: '#7D3A88', primarioTinta: '#FFFFFF', acento: '#E0679A',
    fondo: '#F6EFF5', fondo2: '#FFFFFF', tinta: '#271C2B', tintaSuave: '#5C5062',
    linea: '#E4D6E2', senal: '#C94683', subtituloFondo: '#1B1322', subtituloTinta: '#FFFFFF',
  }),
});

// Pares letra/fondo que se garantizan (4.5:1). La caja del subtítulo se mide también translúcida,
// sobre blanco y sobre negro, porque debajo puede pasar cualquier cosa.
export const PARES = Object.freeze([
  { texto: 'tinta', fondo: 'fondo', para: 'letra principal sobre el fondo' },
  { texto: 'tinta', fondo: 'fondo2', para: 'letra principal en fichas y tarjetas' },
  { texto: 'tintaSuave', fondo: 'fondo', para: 'letra secundaria sobre el fondo' },
  { texto: 'tintaSuave', fondo: 'fondo2', para: 'letra secundaria en fichas y tarjetas' },
  { texto: 'primarioTinta', fondo: 'primario', para: 'letra encima del color principal' },
  { texto: 'subtituloTinta', fondo: 'subtituloFondo', para: 'subtítulos' },
]);

// Trazos que se tienen que ver (3:1): la señal sobre la app (casi siempre clara), el fondo y las fichas.
export const TRAZOS = Object.freeze([
  { color: 'senal', contra: BLANCO, para: 'señal sobre una app clara' },
  { color: 'senal', contra: 'fondo', para: 'señal sobre el fondo' },
  { color: 'senal', contra: 'fondo2', para: 'señal sobre fichas' },
]);

// ---------- medir y mezclar ----------

export function esHex(valor) {
  return typeof valor === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(valor.trim());
}

export function normalizarHex(valor) {
  if (!esHex(valor)) throw new Error(`«${valor}» no es un color hex. Usa #RRGGBB, por ejemplo #3E5BA9.`);
  let h = valor.trim().slice(1).toUpperCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return '#' + h;
}

export function aRgb(hex) {
  const h = normalizarHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function aHex([r, g, b]) {
  const canal = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + canal(r) + canal(g) + canal(b)).toUpperCase();
}

// Luminancia relativa (WCAG 2.x, sRGB).
export function luminancia(hex) {
  const lineal = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = aRgb(hex).map(lineal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contraste entre dos colores, de 1 a 21.
export function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

// Mezcla en sRGB (como color-mix in srgb): t = 0 da a, t = 1 da b.
export function mezcla(a, b, t) {
  const x = aRgb(a);
  const y = aRgb(b);
  return aHex(x.map((v, i) => v + (y[i] - v) * t));
}

// El color que se ve cuando "arriba" va con opacidad alfa encima de "abajo".
export function sobre(arriba, alfa, abajo) {
  return mezcla(abajo, arriba, alfa);
}

// Para CSS: un color del tema con transparencia, sin escribir colores sueltos.
export function conAlfa(hex, alfa) {
  const [r, g, b] = aRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Number(alfa.toFixed(3))})`;
}

// Variables CSS listas para pegar: --primario, --primario-tinta, ... (en kebab-case).
export function variablesCss(t) {
  return CLAVES.map((k) => `--${k.replace(/[A-Z0-9]/g, (m) => '-' + m.toLowerCase())}:${t[k]}`).join(';');
}

function aHsl(hex) {
  const [r, g, b] = aRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function deHsl([h, s, l]) {
  if (s === 0) return aHex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return aHex([canal(h + 1 / 3), canal(h), canal(h - 1 / 3)].map((v) => v * 255));
}

// El color más parecido a "hex" (mismo tono, otra luz) que cumple la condición. null si ninguno.
function buscarLuz(hex, cumple) {
  if (cumple(hex)) return hex;
  const [h, s, l] = aHsl(hex);
  for (let paso = 1; paso <= 100; paso++) {
    for (const signo of [-1, 1]) {
      const nl = l + (signo * paso) / 100;
      if (nl < 0 || nl > 1) continue;
      const c = deHsl([h, s, nl]);
      if (cumple(c)) return c;
    }
  }
  return null;
}

// ---------- revisar ----------

const valor = (t, clave) => (clave.startsWith('#') ? clave : t[clave]);

// Mide todos los pares. Devuelve la lista de lo que falla (vacía si todo se lee).
export function revisarContraste(t) {
  const fallas = [];
  for (const { texto, fondo, para } of PARES) {
    const r = contraste(t[texto], t[fondo]);
    if (!(r >= MINIMO_TEXTO)) fallas.push({ texto, fondo, para, ratio: r, minimo: MINIMO_TEXTO });
  }
  for (const debajo of [BLANCO, NEGRO]) {
    const caja = sobre(t.subtituloFondo, OPACIDAD_SUBTITULO, debajo);
    const r = contraste(t.subtituloTinta, caja);
    if (!(r >= MINIMO_TEXTO)) {
      fallas.push({
        texto: 'subtituloTinta', fondo: 'subtituloFondo', ratio: r, minimo: MINIMO_TEXTO,
        para: `subtítulos con la caja al ${OPACIDAD_SUBTITULO * 100}% sobre ${debajo === BLANCO ? 'blanco' : 'negro'}`,
      });
    }
  }
  for (const { color, contra, para } of TRAZOS) {
    const r = contraste(t[color], valor(t, contra));
    if (!(r >= MINIMO_TRAZO)) fallas.push({ texto: color, fondo: contra, para, ratio: r, minimo: MINIMO_TRAZO });
  }
  return fallas;
}

function describir(t, f) {
  const fondoHex = valor(t, f.fondo);
  const nombreFondo = f.fondo.startsWith('#') ? fondoHex : `${f.fondo} ${fondoHex}`;
  // para letra encima de un color, primero la tinta o el blanco; si no, el mismo color con otra luz
  const deCasa = ['primarioTinta', 'subtituloTinta'].includes(f.texto)
    ? [t.tinta, BLANCO].find((c) => c !== t[f.texto] && contraste(c, fondoHex) >= f.minimo)
    : null;
  const cambio = deCasa ?? buscarLuz(t[f.texto], (c) => contraste(c, fondoHex) >= f.minimo + 0.1);
  const idea = cambio ? ` Prueba ${f.texto} ${cambio} (da ${contraste(cambio, fondoHex).toFixed(2)}:1).` : '';
  return `  · ${f.texto} ${t[f.texto]} sobre ${nombreFondo} da ${f.ratio.toFixed(2)}:1 y necesita ${f.minimo}:1 (${f.para}).${idea}`;
}

// ---------- derivar lo que no dio la persona ----------

// Letra para un fondo: la primera candidata que pasa; si ninguna, la última se oscurece o aclara.
function letraPara(fondo, candidatas) {
  for (const c of candidatas) if (contraste(c, fondo) >= MINIMO_TEXTO) return c;
  const ultima = candidatas[candidatas.length - 1];
  return buscarLuz(ultima, (c) => contraste(c, fondo) >= MINIMO_TEXTO) ?? (contraste(BLANCO, fondo) > contraste(NEGRO, fondo) ? BLANCO : NEGRO);
}

const DERIVADOS = [
  {
    clave: 'primarioTinta',
    depende: ['primario', 'tinta'],
    calcular: (t) => letraPara(t.primario, [BLANCO, t.tinta]),
  },
  {
    // caja oscura con el tono del primario, como la noche de los temas
    clave: 'subtituloFondo',
    depende: ['primario'],
    calcular: (t) => {
      const [h, s] = aHsl(t.primario);
      return deHsl([h, Math.min(s, 0.32), 0.11]);
    },
  },
  {
    clave: 'subtituloTinta',
    depende: ['subtituloFondo', 'tinta'],
    calcular: (t) => {
      const pasa = (c) => [BLANCO, NEGRO].every((d) => contraste(c, sobre(t.subtituloFondo, OPACIDAD_SUBTITULO, d)) >= MINIMO_TEXTO);
      for (const c of [BLANCO, t.tinta]) if (pasa(c)) return c;
      return buscarLuz(t.tinta, pasa) ?? letraPara(t.subtituloFondo, [BLANCO, t.tinta]);
    },
  },
  {
    // fichas: blanco sobre un fondo claro; un poco más claras que el fondo si es oscuro
    clave: 'fondo2',
    depende: ['fondo', 'tinta'],
    calcular: (t) => {
      const claro = luminancia(t.fondo) >= 0.4;
      const meta = claro ? (t.fondo === BLANCO ? mezcla(BLANCO, t.tinta, 0.035) : BLANCO) : mezcla(t.fondo, BLANCO, 0.08);
      for (let k = 1; k >= 0; k -= 0.05) {
        const c = mezcla(t.fondo, meta, k);
        if (contraste(t.tinta, c) >= MINIMO_TEXTO) return c;
      }
      return t.fondo;
    },
  },
  {
    clave: 'tintaSuave',
    depende: ['tinta', 'fondo', 'fondo2'],
    calcular: (t) => {
      for (let k = 0.3; k > 0; k -= 0.01) {
        const c = mezcla(t.tinta, t.fondo, k);
        if (contraste(c, t.fondo) >= MINIMO_TEXTO && contraste(c, t.fondo2) >= MINIMO_TEXTO) return c;
      }
      return t.tinta;
    },
  },
  {
    // entre el fondo y las fichas, hacia la tinta lo justo para que se vea en los dos
    clave: 'linea',
    depende: ['fondo', 'fondo2', 'tinta'],
    calcular: (t) => {
      const base = mezcla(t.fondo, t.fondo2, 0.5);
      for (let k = 0.12; k <= 0.6; k += 0.01) {
        const c = mezcla(base, t.tinta, k);
        if (contraste(c, t.fondo2) >= 1.25 && contraste(c, t.fondo) >= 1.15) return c;
      }
      return mezcla(base, t.tinta, 0.6);
    },
  },
  {
    // la señal sale del acento: misma familia de color, con la luz justa para verse
    clave: 'senal',
    depende: ['acento', 'fondo', 'fondo2'],
    calcular: (t) => {
      const contra = [BLANCO, t.fondo, t.fondo2];
      for (const margen of [0.3, 0]) {
        const c = buscarLuz(t.acento, (x) => contra.every((f) => contraste(x, f) >= MINIMO_TRAZO + margen));
        if (c) return c;
      }
      return null;
    },
    sinSalida: (t) => `con el fondo ${t.fondo} ningún color de señal se ve a la vez sobre una app clara y sobre el fondo `
      + `(hace falta ${MINIMO_TRAZO}:1 contra los dos). Usa un fondo más claro o más oscuro.`,
  },
];

// ---------- el tema del proyecto ----------

export function tema(proyecto = {}) {
  const nombre = String(proyecto?.tema ?? 'azul').trim().toLowerCase();
  const base = TEMAS[nombre];
  if (!base) {
    throw new Error(`proyecto.json → tema: «${proyecto.tema}» no existe. Usa uno de estos: ${Object.keys(TEMAS).join(', ')}.`);
  }
  const t = { ...base };
  const colores = proyecto?.colores;

  if (colores != null) {
    if (typeof colores !== 'object' || Array.isArray(colores)) {
      throw new Error('proyecto.json → colores: va un objeto como { "primario": "#3E5BA9" } o null.');
    }
    const dados = new Set();
    for (const [clave, v] of Object.entries(colores)) {
      if (!CLAVES.includes(clave)) {
        throw new Error(`proyecto.json → colores.${clave}: no es un color del tema. Usa ${CLAVES.join(', ')}.`);
      }
      if (v == null) continue;
      try {
        t[clave] = normalizarHex(v);
      } catch {
        throw new Error(`proyecto.json → colores.${clave}: «${v}» no es un color hex. Usa #RRGGBB, por ejemplo #3E5BA9.`);
      }
      dados.add(clave);
    }

    // Lo que dio la persona entre sí: si la tinta no se lee sobre el fondo, no hay nada que derivar.
    if (contraste(t.tinta, t.fondo) < MINIMO_TEXTO) {
      const f = { texto: 'tinta', fondo: 'fondo', para: 'letra principal sobre el fondo', ratio: contraste(t.tinta, t.fondo), minimo: MINIMO_TEXTO };
      throw new Error(`proyecto.json → colores no se lee:\n${describir(t, f)}`);
    }

    // Se recalcula todo lo que depende de un color que cambió (salvo lo que la persona dio).
    const cambiados = new Set([...dados].filter((k) => t[k] !== base[k]));
    for (const d of DERIVADOS) {
      if (dados.has(d.clave) || !d.depende.some((k) => cambiados.has(k))) continue;
      const nuevo = d.calcular(t);
      if (!nuevo) {
        const porque = d.sinSalida ? d.sinSalida(t) : `no encontré un color de ${d.clave} que se lea con estos colores.`;
        throw new Error(`proyecto.json → colores: ${porque}`);
      }
      if (nuevo !== t[d.clave]) cambiados.add(d.clave);
      t[d.clave] = nuevo;
    }
  }

  const fallas = revisarContraste(t);
  if (fallas.length) {
    const origen = colores ? 'proyecto.json → colores' : `el tema ${nombre}`;
    throw new Error(`${origen}: hay colores que no se leen.\n${fallas.map((f) => describir(t, f)).join('\n')}`);
  }

  const salida = {};
  for (const k of CLAVES) salida[k] = t[k];
  return salida;
}
