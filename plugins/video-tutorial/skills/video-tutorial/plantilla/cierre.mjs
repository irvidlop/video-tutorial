// Arma el cierre del video: compositions/cierre.html.
//
//   node cierre.mjs              arma el cierre del proyecto de esta carpeta
//   node cierre.mjs <carpeta>    arma el de otra carpeta de proyecto
//
// Lee de proyecto.json: marca.nombre, marca.logo (SVG, o PNG), video (ancho y alto), tema y colores.
// Deja una sub-composición de HyperFrames de 6 s, del tamaño del video:
//   0 a 0.4 s     el fondo entra con un fundido (tapa lo que haya debajo)
//   0.25 a 1.15   el logo sube, rebota una vez y se asienta; su sombra crece al aterrizar
//   1.05 a 1.95   el nombre aparece suave
//   2.0 a 4.1     el logo se mece tantito y vuelve a su lugar
//   4.5 a 6.0     todo quieto (aquí resuelve la música)
// Sin logo sale solo el nombre. Los colores salen solo de tema.mjs. La fuente y el logo van
// incrustados, así que el archivo no depende de rutas. Si el logo usa currentColor, toma el primario.
//
// Cómo se monta en index.html (último hijo del #root, para que quede encima de todo):
//   <div id="el-cierre" data-composition-id="cierre" data-composition-src="compositions/cierre.html"
//        data-start="FIN" data-duration="6" data-track-index="50"
//        data-width="1920" data-height="1080" style="z-index:999"></div>
// FIN = donde termina lo último que se ve. El host carga GSAP (el cierre lo usa).
// Seek-safe: una sola línea de tiempo en pausa, cada cosa empieza con fromTo y nada usa reloj ni azar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tema, conAlfa } from './tema.mjs';

export const ID = 'cierre';
export const DURACION = 6;
export const QUIETO_DESDE = 4.5;
export const FUNDIDO = 0.4;
export const SALIDA = 'compositions/cierre.html';
const FUENTE = 'assets/fonts/Raleway-var-latin.woff2';
const AQUI = path.dirname(fileURLToPath(import.meta.url));

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const r1 = (v) => Math.round(v * 10) / 10;

// Paradas de un degradado que se apaga en curva y no en línea recta: una rampa recta que termina de
// golpe deja un anillo visible en el video (banda de Mach). Dos curvas, las dos llegan a cero sin quiebre:
//   'meseta'  smoothstep: plana en el centro. Para formas cuyo centro queda fuera de cuadro y para la sombra.
//   'pico'    (1 - t)^2: sin meseta. Para el lavado claro del centro (con meseta se lee como un disco).
function paradasSuaves(color, alfa, fin, curva = 'meseta') {
  const queda = curva === 'pico' ? (t) => (1 - t) ** 2 : (t) => 1 - t * t * (3 - 2 * t);
  const paradas = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    paradas.push(`${conAlfa(color, alfa * queda(t))} ${r1(t * fin)}%`);
  }
  return paradas.join(',');
}

function leerProyecto(carpeta) {
  const archivo = path.join(carpeta, 'proyecto.json');
  let texto;
  try {
    texto = fs.readFileSync(archivo, 'utf8');
  } catch {
    throw new Error(`No encuentro ${archivo}. Corre el cierre desde la carpeta del proyecto o pásala: node cierre.mjs <carpeta>.`);
  }
  try {
    return JSON.parse(texto.replace(/^\uFEFF/, ''));
  } catch (e) {
    throw new Error(`proyecto.json no es JSON válido: ${e.message}`);
  }
}

function medidasVideo(video) {
  const ancho = Number(video?.ancho);
  const alto = Number(video?.alto);
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 320 || alto < 320) {
    throw new Error('proyecto.json → video: necesito ancho y alto en pixeles, por ejemplo { "ancho": 1920, "alto": 1080, "fps": 30 }.');
  }
  return { ancho, alto };
}

// El logo listo para incrustar: { src, ancho, alto, margen }. ancho y alto son los del dibujo (dan la
// proporción); margen es el aire transparente que se le agrega alrededor, en las mismas unidades.
// Por qué el margen: si el dibujo toca el borde de la imagen, el suavizado de ese borde cambia según
// por dónde se llegó a un tiempo (medido: 5 pixeles distintos al buscar dos veces el mismo cuadro).
export function leerLogo(archivo, primario) {
  if (!fs.existsSync(archivo)) throw new Error(`No encuentro el logo ${archivo} (proyecto.json → marca.logo).`);
  const ext = path.extname(archivo).toLowerCase();
  if (ext === '.svg') {
    let svg = fs.readFileSync(archivo, 'utf8').replace(/^\uFEFF/, '');
    const raiz = /<svg\b[^>]*>/i.exec(svg)?.[0];
    if (!raiz) throw new Error(`${archivo} no parece un SVG: no tiene <svg>.`);
    const vb = /\sviewBox\s*=\s*["']\s*([-+\d.eE]+)[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)\s*["']/i.exec(raiz);
    let [x0, y0, ancho, alto] = vb ? vb.slice(1, 5).map(Number) : [0, 0, NaN, NaN];
    if (!(ancho > 0 && alto > 0)) {
      const medida = (n) => Number(new RegExp(`\\s${n}\\s*=\\s*["']\\s*([\\d.]+)\\s*(px)?\\s*["']`, 'i').exec(raiz)?.[1]);
      [x0, y0, ancho, alto] = [0, 0, medida('width'), medida('height')];
    }
    if (!(ancho > 0 && alto > 0)) throw new Error(`${archivo}: el SVG no dice su tamaño. Ponle viewBox="0 0 ancho alto".`);
    const margen = Math.max(ancho, alto) * 0.04;
    const n = (v) => Number(v.toFixed(3));
    const nueva = raiz
      .replace(/\s(viewBox|width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '')
      .replace(/^<svg\b/i, `<svg viewBox="${n(x0 - margen)} ${n(y0 - margen)} ${n(ancho + 2 * margen)} ${n(alto + 2 * margen)}" width="${n(ancho + 2 * margen)}" height="${n(alto + 2 * margen)}"`);
    svg = svg.replace(raiz, nueva).replace(/currentColor/gi, primario);
    return { src: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`, ancho, alto, margen, bytes: svg.length };
  }
  if (ext === '.png') {
    const b = fs.readFileSync(archivo);
    if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${archivo} no es un PNG válido.`);
    return { src: `data:image/png;base64,${b.toString('base64')}`, ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20), margen: 0, bytes: b.length };
  }
  throw new Error(`${archivo}: el logo va en SVG (mejor) o en PNG.`);
}

// Todas las medidas en pixeles del video. u = 1 en 1080p (y en 1080x1920).
function medidas({ ancho, alto }, logo, nombre) {
  const u = Math.min(ancho, alto) / 1080;
  const m = Math.min(ancho, alto);
  const letras = [...nombre].length;
  const base = 88 * u;
  const tamNombre = letras <= 20 ? base : Math.max(60 * u, (base * 20) / letras);
  // logoW y logoH: lo que mide el dibujo en pantalla. La caja de la imagen trae además el margen
  // transparente (aire) por cada lado; un margen negativo igual lo saca del acomodo.
  let logoW = 0;
  let logoH = 0;
  let aire = 0;
  if (logo) {
    const maxW = 600 * u;
    const maxH = 300 * u;
    const prop = logo.ancho / logo.alto;
    if (prop >= maxW / maxH) {
      logoW = maxW;
      logoH = maxW / prop;
    } else {
      logoH = maxH;
      logoW = maxH * prop;
    }
    aire = (logo.margen || 0) * (logoW / logo.ancho);
  }
  const sombraW = logoW * 0.72;
  const sombraH = Math.max(14, 24 * u);
  return {
    u,
    tamNombre: r1(tamNombre),
    anchoNombre: r1(ancho * 0.8),
    hueco: r1(56 * u),
    logoW: r1(logoW),
    logoH: r1(logoH),
    aire: r1(aire),
    cajaW: r1(logoW + 2 * aire),
    cajaH: r1(logoH + 2 * aire),
    // el logo gira y rebota desde la base del dibujo, no desde la base de la caja con aire
    origen: `50% ${r1(((aire + logoH) / (logoH + 2 * aire || 1)) * 100)}%`,
    sombra: { w: r1(sombraW), h: r1(sombraH), x: r1(aire + (logoW - sombraW) / 2), y: r1(aire + logoH + 12 * u) },
    forma1: { d: r1(0.8 * m), x: r1(0.07 * ancho - 0.4 * m), y: r1(0.12 * alto - 0.4 * m) },
    forma2: { d: r1(0.88 * m), x: r1(0.95 * ancho - 0.44 * m), y: r1(0.92 * alto - 0.44 * m) },
  };
}

// El HTML de la sub-composición. Función pura: mismas entradas, mismo archivo.
export function htmlCierre({ nombre, logo, colores: t, video, fuente }) {
  const { ancho, alto } = video;
  const md = medidas(video, logo, nombre);
  const u = md.u;
  const px = (v) => `${r1(v)}px`;

  const css = `
@font-face{font-family:"Cierre Raleway";font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${fuente}) format("woff2")}
#cierre-raiz{position:absolute;inset:0;overflow:hidden}
#cierre-capa{position:absolute;inset:0;background:radial-gradient(ellipse 70% 78% at 50% 46%,${paradasSuaves(t.fondo2, 1, 100, 'pico')}),${t.fondo}}
#cierre-formas{position:absolute;inset:0}
.cierre-forma{position:absolute}
#cierre-forma-1{left:${px(md.forma1.x)};top:${px(md.forma1.y)};width:${px(md.forma1.d)};height:${px(md.forma1.d)};background:radial-gradient(closest-side,${paradasSuaves(t.primario, 0.16, 100)})}
#cierre-forma-2{left:${px(md.forma2.x)};top:${px(md.forma2.y)};width:${px(md.forma2.d)};height:${px(md.forma2.d)};background:radial-gradient(closest-side,${paradasSuaves(t.acento, 0.18, 100)})}
#cierre-escena{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${px(md.hueco)}}
#cierre-logo{position:relative;flex:none;width:${px(md.cajaW)};height:${px(md.cajaH)};margin:${px(-md.aire)}}
#cierre-sombra{position:absolute;left:${px(md.sombra.x)};top:${px(md.sombra.y)};width:${px(md.sombra.w)};height:${px(md.sombra.h)};background:radial-gradient(closest-side,${paradasSuaves(t.tinta, 0.2, 100)})}
#cierre-salto,#cierre-vaiven{position:absolute;inset:0}
#cierre-logo-img{display:block;width:100%;height:100%}
#cierre-nombre{margin:0;max-width:${px(md.anchoNombre)};font:800 ${px(md.tamNombre)}/1.18 "Cierre Raleway",sans-serif;letter-spacing:-0.01em;color:${t.tinta};text-align:center;text-wrap:balance}`;

  const bloqueLogo = logo
    ? `
      <div id="cierre-logo">
        <div id="cierre-sombra" data-layout-ignore></div>
        <div id="cierre-salto"><div id="cierre-vaiven"><img id="cierre-logo-img" src="${logo.src}" alt="${escapar(nombre ? `Logo de ${nombre}` : 'Logo')}"></div></div>
      </div>`
    : '';
  const bloqueNombre = nombre ? `
      <p id="cierre-nombre">${escapar(nombre)}</p>` : '';

  // Movimiento. Los números van en pixeles del video (u = 1 en 1080p).
  const y = (v) => r1(v * u);
  // Las formas solo se desplazan: si además cambian de escala, la GPU pinta su degradado con
  // diferencias de 1/255 entre dos búsquedas del mismo tiempo (medido). Con desplazamiento, idéntico.
  const pasos = [
    '  // fondo y formas: el fondo entra con fundido; las formas derivan lento y paran en 4.5 s',
    `  tl.fromTo("#cierre-capa", { opacity: 0 }, { opacity: 1, duration: ${FUNDIDO}, ease: "power1.out" }, 0);`,
    `  tl.fromTo("#cierre-forma-1", { x: ${y(-30)}, y: ${y(-22)} }, { x: ${y(26)}, y: ${y(24)}, duration: ${QUIETO_DESDE}, ease: "sine.inOut" }, 0);`,
    `  tl.fromTo("#cierre-forma-2", { x: ${y(28)}, y: ${y(24)} }, { x: ${y(-26)}, y: ${y(-18)}, duration: ${QUIETO_DESDE}, ease: "sine.inOut" }, 0);`,
  ];
  if (logo) {
    pasos.push(
      '  // el logo sube, pasa de largo un poco, aterriza (se aplasta), rebota una vez y se asienta',
      `  tl.fromTo("#cierre-salto", { y: ${y(70)}, scaleX: 0.9, scaleY: 1.1, opacity: 0, transformOrigin: "${md.origen}" }, { y: ${y(-16)}, scaleX: 0.97, scaleY: 1.04, opacity: 1, transformOrigin: "${md.origen}", duration: 0.36, ease: "power2.out" }, 0.25);`,
      `  tl.to("#cierre-salto", { y: 0, scaleX: 1.06, scaleY: 0.92, duration: 0.16, ease: "power2.in" }, 0.61);`,
      `  tl.to("#cierre-salto", { y: ${y(-6)}, scaleX: 0.98, scaleY: 1.03, duration: 0.15, ease: "power2.out" }, 0.77);`,
      '  tl.to("#cierre-salto", { y: 0, scaleX: 1, scaleY: 1, duration: 0.22, ease: "power1.inOut" }, 0.92);',
      '  // la sombra: chica mientras el logo va arriba, ancha al aterrizar',
      '  tl.fromTo("#cierre-sombra", { opacity: 0, scaleX: 0.55, transformOrigin: "50% 50%" }, { opacity: 0.5, scaleX: 0.72, transformOrigin: "50% 50%", duration: 0.36, ease: "power2.out" }, 0.25);',
      '  tl.to("#cierre-sombra", { opacity: 1, scaleX: 1.1, duration: 0.16, ease: "power2.in" }, 0.61);',
      '  tl.to("#cierre-sombra", { opacity: 0.85, scaleX: 0.93, duration: 0.15, ease: "power2.out" }, 0.77);',
      '  tl.to("#cierre-sombra", { opacity: 1, scaleX: 1, duration: 0.22, ease: "power1.inOut" }, 0.92);',
      '  // un leve vaivén desde la base, que se apaga solo',
      `  tl.fromTo("#cierre-vaiven", { rotation: 0, transformOrigin: "${md.origen}" }, { rotation: -3.5, transformOrigin: "${md.origen}", duration: 0.5, ease: "sine.inOut" }, 2.0);`,
      '  tl.to("#cierre-vaiven", { rotation: 2.6, duration: 0.62, ease: "sine.inOut" }, 2.5);',
      '  tl.to("#cierre-vaiven", { rotation: -1.2, duration: 0.5, ease: "sine.inOut" }, 3.12);',
      '  tl.to("#cierre-vaiven", { rotation: 0, duration: 0.45, ease: "sine.inOut" }, 3.62);',
    );
  }
  if (nombre) {
    const inicio = logo ? 1.05 : 0.3;
    pasos.push(
      '  // el nombre aparece suave',
      `  tl.fromTo("#cierre-nombre", { opacity: 0, y: ${y(24)}, scale: ${logo ? 1 : 0.97} }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out" }, ${inicio});`,
    );
  }

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<!-- Cierre del video: sub-composición de HyperFrames de ${DURACION} s. La genera cierre.mjs desde proyecto.json;
     no se edita a mano, se vuelve a generar. Todo lo que se usa al renderizar va DENTRO de <template>. -->
</head>
<body>
<template>
<style>${css}
</style>
<div id="cierre-raiz" data-composition-id="${ID}" data-width="${ancho}" data-height="${alto}" data-duration="${DURACION}">
  <div id="cierre-capa">
    <div id="cierre-formas" data-layout-ignore>
      <div class="cierre-forma" id="cierre-forma-1"></div>
      <div class="cierre-forma" id="cierre-forma-2"></div>
    </div>
    <div id="cierre-escena">${bloqueLogo}${bloqueNombre}
    </div>
  </div>
</div>
<script>
/* Una sola línea de tiempo en pausa: HyperFrames la busca cuadro por cuadro.
   Todo termina antes de ${QUIETO_DESDE} s; de ahí al final, quieto.
   force3D: false deja siempre transformaciones 2D: GSAP, por defecto, pasa a 3D mientras anima y
   vuelve a 2D al terminar; así no dependemos de capas que aparecen o no según el camino de búsqueda,
   y el logo se pinta nítido aunque cambie de escala. */
(function () {
  var tl = gsap.timeline({ paused: true, defaults: { force3D: false } });
${pasos.join('\n')}
  window.__timelines["${ID}"] = tl;
})();
</script>
</template>
</body>
</html>
`;
}

// Lee el proyecto, arma el cierre y lo escribe en compositions/cierre.html.
export function armarCierre(carpeta = AQUI) {
  const dir = path.resolve(carpeta);
  const proyecto = leerProyecto(dir);
  const colores = tema(proyecto);
  const video = medidasVideo(proyecto.video);
  const nombre = String(proyecto.marca?.nombre ?? '').trim();
  const rutaLogo = String(proyecto.marca?.logo ?? '').trim();
  if (!nombre && !rutaLogo) throw new Error('proyecto.json → marca: el cierre necesita marca.nombre, marca.logo o los dos.');
  const logo = rutaLogo ? leerLogo(path.resolve(dir, rutaLogo), colores.primario) : null;

  const rutaFuente = [path.join(dir, FUENTE), path.join(AQUI, FUENTE)].find((f) => fs.existsSync(f));
  if (!rutaFuente) throw new Error(`No encuentro la fuente ${FUENTE}. Cópiala de la plantilla de la skill.`);
  const fuente = fs.readFileSync(rutaFuente).toString('base64');

  const avisos = [];
  if ([...nombre].length > 40) avisos.push(`el nombre tiene ${[...nombre].length} letras; en el cierre se lee mejor si es corto (hasta unas 30).`);
  if (logo && logo.bytes > 1024 * 1024) avisos.push(`el logo pesa ${Math.round(logo.bytes / 1024)} KB; un SVG limpio pesa mucho menos.`);

  const html = htmlCierre({ nombre, logo, colores, video, fuente });
  const salida = path.join(dir, SALIDA);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, html);
  return { archivo: salida, kb: Math.round(Buffer.byteLength(html) / 1024), conLogo: Boolean(logo), nombre, tema: String(proyecto.tema ?? 'azul'), video, avisos };
}

function esPrincipal() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (esPrincipal()) {
  try {
    const r = armarCierre(process.argv[2] ?? AQUI);
    const sale = r.conLogo ? (r.nombre ? 'logo y nombre' : 'solo logo') : 'sin logo: solo el nombre';
    console.log(`Listo: ${SALIDA} (${r.kb} KB, ${r.video.ancho}x${r.video.alto}, ${DURACION} s, tema ${r.tema}, ${sale}).`);
    for (const a of r.avisos) console.log(`Ojo: ${a}`);
  } catch (e) {
    console.error(`No pude armar el cierre. ${e.message}`);
    process.exit(1);
  }
}
