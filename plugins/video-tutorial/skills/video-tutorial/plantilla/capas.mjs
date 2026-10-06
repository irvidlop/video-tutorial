// Piezas comunes del CUERPO (index.html) y de las ENTRADAS (tmp/entradas/<versión>/index.html):
// lienzo, cámara con capas en parallax, fondo, colores y letras del tema, y la partición de los subtítulos.
// Las dos composiciones importan esto, así el fondo y la cámara son idénticos en el empalme: la entrada termina con la
// cámara en F0 (z = 1) y la deriva de las capas en 0, y el cuerpo arranca exactamente igual.
//
// Todo se diseña en un lienzo de 1920 x 1080. Si proyecto.json → video pide otro tamaño 16:9 (por ejemplo 1280 x 720 o
// 3840 x 2160), la escena entera se escala con un solo factor K, sin mover nada de lugar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tema, conAlfa, mezcla, contraste, variablesCss } from './tema.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const W = 1920, H = 1080;            // lienzo de diseño
export const A = { x: 960, y: 500 };        // punto de la pantalla donde cae el foco de la cámara
export const FS = 32;                       // letra de las etiquetas de las señales
export const SUB_TOP = 905;                 // de aquí para abajo van los subtítulos: arriba es la zona libre para señales
export const r2 = n => +(+n).toFixed(2);
// volumen de la música (cuerpo y entradas por igual): la pista viene a -16 LUFS como la voz (mezcla-musica.mjs); 0.15 la deja unos
// 16.5 dB abajo, y el carve la baja todavía más mientras alguien habla
export const MUSICA_BASE = 0.15;

export function leerProyecto() {
  return JSON.parse(fs.readFileSync(path.join(AQUI, 'proyecto.json'), 'utf8').replace(/^﻿/, ''));
}

/** Tamaño del video: ancho, alto, fps y K (factor de escala del lienzo de diseño). Solo 16:9. */
export function lienzo(P) {
  const ancho = Number(P.video?.ancho ?? 1920), alto = Number(P.video?.alto ?? 1080), fps = Number(P.video?.fps ?? 30);
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || Math.abs(ancho / alto - 16 / 9) > 0.01) throw new Error(`proyecto.json → video: ${ancho} x ${alto} no es 16:9. Usa 1920 x 1080 (o 1280 x 720, 3840 x 2160).`);
  if (!Number.isInteger(fps) || fps < 12 || fps > 60) throw new Error(`proyecto.json → video.fps: ${fps} no es válido (usa 24, 25, 30 o 60).`);
  return { ancho, alto, fps, K: alto / H };
}

// ---------------------------------------------------------------- cámara y capas con parallax
// fondo 0.2, formas suaves 0.5, ventana de la app 1.0, fichas flotantes 1.35. kz: cuánto se acerca cada capa cuando la cámara se acerca.
export const LAYERS = { Lbg: { k: 0.2, kz: 0.12 }, Lmid: { k: 0.5, kz: 0.3 }, Lworld: { k: 1, kz: 1 }, Lflo: { k: 1.35, kz: 1.3 } };
export const F0 = { x: 960, y: 500 };       // foco de la cámara en reposo (z = 1)
export const camX = (L, F, z) => { const { k, kz } = LAYERS[L]; const sc = L === 'Lworld' ? z : 1 + (z - 1) * kz; return { x: r2(A.x - F.x * k * sc), y: r2(A.y - F.y * k * sc), scale: +sc.toFixed(4) }; };
// deriva lenta de cada capa (envoltorio interior .dr): [capa, amplitud x, amplitud y, periodo]. Nada se congela.
export const DERIVA = [['Lbg', 9, 6, 11.3], ['Lmid', 14, 9, 9.1], ['Lworld', 4, 3, 13.7], ['Lflo', 20, 13, 7.9]];
/** Pasa un punto de la pantalla (con la cámara en reposo) a las coordenadas de una capa. */
const enCapa = (L, sx, sy) => { const o = camX(L, F0, 1); return { x: r2(sx - o.x), y: r2(sy - o.y) }; };

// ---------------------------------------------------------------- la ventana del navegador donde va la app grabada
export const CHROME = 36;                   // barra de la ventana (puntitos y dirección)
/** Medidas de la ventana para una grabación de vp.width x vp.height: escala S, esquina (WL, WT). Cabe sobre los subtítulos. */
export function ventana(vp) {
  const WT = 70;
  const S = Math.min(1434 / vp.width, (SUB_TOP + 10 - WT) / (vp.height + CHROME));
  return { S: +S.toFixed(5), WL: r2((W - vp.width * S) / 2), WT, PW: vp.width, PH: vp.height };
}

// ---------------------------------------------------------------- el fondo: formas suaves y fichas, sin texto
/**
 * Adornos de cada capa, en pantalla con la cámara en reposo. Van a los lados, fuera de la ventana de la app (x 243 a 1677) y fuera
 * de la franja del título de las entradas (x 140 a 1780, y 290 a 630), sin letras: no se leen ni estorban, y no chocan entre sí.
 */
export function deco() {
  const bg = [], mid = [], flo = [];
  const blob = (sx, sy, d, color) => { const p = enCapa('Lbg', sx - d / 2, sy - d / 2); return `<i class="blob" style="left:${p.x}px;top:${p.y}px;width:${d}px;height:${d}px;background:radial-gradient(circle at 50% 50%,var(${color}) 0%,transparent 68%)"></i>`; };
  bg.push(blob(300, 260, 1000, '--blob-1'), blob(1640, 860, 1100, '--blob-2'));
  const raya = (sx, sy, h, color) => { const p = enCapa('Lmid', sx, sy); return `<i class="raya" style="left:${p.x}px;top:${p.y}px;height:${h}px;background:var(${color})"></i>`; };
  mid.push(raya(62, 262, 360, '--raya-1'), raya(150, 690, 250, '--raya-2'));
  mid.push(raya(1830, 92, 330, '--raya-2'), raya(1812, 470, 250, '--raya-3'));
  const ficha = (sx, sy, id) => { const p = enCapa('Lflo', sx, sy); return `<div id="${id}" class="ficha" data-layout-ignore style="left:${p.x}px;top:${p.y}px"><i class="fp"></i><i class="fl"></i><i class="fl c"></i></div>`; };
  flo.push(ficha(40, 128, 'ficha1'), ficha(1704, 772, 'ficha2'));
  const punto = (sx, sy, d, color, id) => { const p = enCapa('Lflo', sx, sy); return `<i id="${id}" class="punto" style="left:${p.x}px;top:${p.y}px;width:${d}px;height:${d}px;background:var(${color})"></i>`; };
  flo.push(punto(1700, 160, 30, '--punto-1', 'punto1'), punto(60, 900, 38, '--punto-2', 'punto2'));
  return { bg: bg.join(''), mid: mid.join(''), flo: flo.join('') };
}

// ---------------------------------------------------------------- colores y letras
/** Las letras de assets/fonts: una regla @font-face por archivo, más cuál va en títulos y cuál en texto. */
export function fuentes(dir = path.join(AQUI, 'assets', 'fonts'), url = 'assets/fonts') {
  const archivos = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.(woff2|woff|ttf|otf)$/i.test(f)).sort() : [];
  const familias = [];
  const reglas = archivos.map(f => {
    const base = f.replace(/\.[^.]+$/, '').split(/[-_]/)[0];
    const familia = base.replace(/([a-z])([A-Z])/g, '$1 $2');
    const italica = /italic/i.test(f);
    if (!familias.includes(familia)) familias.push(familia);
    const fmt = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[f.split('.').pop().toLowerCase()];
    return `@font-face{font-family:"${familia}";font-style:${italica ? 'italic' : 'normal'};font-weight:100 900;font-display:block;src:url("${url}/${f}") format("${fmt}")}`;
  });
  const titulo = familias.find(f => /raleway/i.test(f)) || familias[0] || null;
  const texto = familias.find(f => /work/i.test(f)) || familias.find(f => f !== titulo) || titulo;
  return { css: reglas.join('\n'), titulo, texto, archivos };
}

/** Variables CSS del video (todos los colores salen de tema.mjs) y las letras. */
export function cssTema(P, { urlFuentes = 'assets/fonts', dirFuentes } = {}) {
  const t = tema(P);
  const f = fuentes(dirFuentes, urlFuentes);
  const pila = fam => (fam ? `"${fam}",` : '') + 'system-ui,sans-serif';
  const detalle = contraste(t.primario, t.fondo2) >= 4.5 ? t.primario : t.tinta;   // el correo del contacto, en color si se lee
  const vars = [
    variablesCss(t),
    `--fondo-b:${mezcla(t.fondo, t.acento, 0.07)}`, `--fondo-c:${mezcla(t.fondo, t.primario, 0.06)}`,
    `--sombra:${conAlfa(t.tinta, 0.22)}`, `--sombra-suave:${conAlfa(t.tinta, 0.12)}`,
    `--velo:${conAlfa(t.tinta, 0.42)}`, `--velo-claro:${conAlfa(t.fondo, 0.92)}`,
    `--brillo-senal:${conAlfa(t.senal, 0.45)}`, `--senal-suave:${conAlfa(t.senal, 0.16)}`,
    `--blob-1:${conAlfa(t.primario, 0.2)}`, `--blob-2:${conAlfa(t.acento, 0.2)}`,
    `--raya-1:${conAlfa(t.primario, 0.2)}`, `--raya-2:${conAlfa(t.acento, 0.24)}`, `--raya-3:${conAlfa(t.linea, 0.9)}`,
    `--punto-1:${conAlfa(t.primario, 0.45)}`, `--punto-2:${conAlfa(t.acento, 0.4)}`,
    `--subtitulo-caja:${conAlfa(t.subtituloFondo, 0.9)}`, `--detalle-contacto:${detalle}`,
    `--letra-titulo:${pila(f.titulo)}`, `--letra-texto:${pila(f.texto)}`,
  ].join(';');
  return { css: `${f.css}\n:root{${vars}}`, t, fuentes: f };
}

/**
 * Variables que usa la hoja de estilos y nadie define. Una variable sin definir no da error: el color sale transparente y el
 * defecto se ve «bien» (así pasó con --fondo2, que el tema llama --fondo-2). Los constructores se detienen si la lista no está vacía.
 */
export function variablesSinDefinir(estilos, temaCss, propias = ['px']) {
  const definidas = new Set([...temaCss.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1]));
  return [...new Set([...estilos.matchAll(/var\(--([a-z0-9-]+)/g)].map(m => m[1]))].filter(v => !definidas.has(v) && !propias.includes(v));
}

// ---------------------------------------------------------------- subtítulos: de a lo más 2 renglones
const LARGO_TROZO = 84;    // letras por subtítulo (dos renglones)
const LARGO_RENGLON = 44;  // más que esto se parte a mano en dos renglones parejos
/** Parte el texto de una frase en trozos de a lo más 2 renglones: por oraciones y, si hace falta, por comas o espacios. */
export function trozos(txt) {
  const out = [];
  const partir = f => {
    if (f.length <= LARGO_TROZO) { out.push(f); return; }
    const mid = f.length / 2; let mejor = -1, md = 1e9;
    for (const m of f.matchAll(/[,:;]\s/g)) { const d = Math.abs(m.index + 1 - mid); if (d < md && m.index > 12 && f.length - m.index > 12) { md = d; mejor = m.index + 1; } }
    if (mejor < 0) for (let i = 0; i < f.length; i++) if (f[i] === ' ') { const d = Math.abs(i - mid); if (d < md) { md = d; mejor = i; } }
    if (mejor < 0) { out.push(f); return; }
    partir(f.slice(0, mejor).trim()); partir(f.slice(mejor).trim());
  };
  for (const f of String(txt).split(/(?<=[.?!])\s+/)) if (f.trim()) partir(f.trim());
  // un trozo muy corto («¡Hola!», «Listo.») va con el que sigue si juntos caben
  for (let i = 0; i < out.length - 1; i++) if (out[i].length < 14 && (out[i] + ' ' + out[i + 1]).length <= LARGO_TROZO) { out.splice(i, 2, out[i] + ' ' + out[i + 1]); i--; }
  return out;
}
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** HTML de un subtítulo: si es largo, dos renglones parejos (así no queda una palabra sola abajo). */
export function renglones(x) {
  if (x.length <= LARGO_RENGLON) return escHtml(x);
  const mid = x.length / 2; let mejor = -1, md = 1e9;
  for (let i = 0; i < x.length; i++) if (x[i] === ' ') { const d = Math.abs(i - mid) - (/[,:;]/.test(x[i - 1]) ? 6 : 0); if (d < md) { md = d; mejor = i; } }
  return mejor < 0 ? escHtml(x) : `<span class="l">${escHtml(x.slice(0, mejor))}</span><span class="l">${escHtml(x.slice(mejor + 1))}</span>`;
}
export const esc = escHtml;

// ---------------------------------------------------------------- la línea de tiempo
/** Plan de animación: una lista de tweens que src/animar.js convierte en UNA línea de tiempo de GSAP en pausa. */
export function nuevoPlan() {
  const PLAN = [];
  return {
    PLAN,
    set: (s, v, t = 0) => PLAN.push({ k: 'set', s, v, t: r2(t) }),
    to: (s, v, t) => PLAN.push({ k: 'to', s, v, t: r2(t) }),
    fromTo: (s, f, v, t) => PLAN.push({ k: 'fromTo', s, f, v, t: r2(t) }),
  };
}
/** Etiqueta <audio> de HyperFrames. */
export const audioHtml = a => `<audio id="${a.id}" data-start="${a.t}" data-duration="${a.dur}" data-track-index="${a.track}" data-volume="${a.vol}"${a.group ? ` data-audio-group="${a.group}"` : ''}${a.auto ? ` data-automation="${JSON.stringify(a.auto).replace(/"/g, '&quot;')}"` : ''} src="${a.src}"></audio>`;
