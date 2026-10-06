#!/usr/bin/env node
// Revisa la Mesa de ayuda con Chrome de verdad. No instala nada: habla con Chrome
// por su protocolo de depuración usando el WebSocket que ya trae Node 22.
//
// Qué revisa:
//   1. El mapa: cada data-guia de MAPA.md se ve en su pantalla, una sola vez, y
//      todo data-guia que se ve en pantalla está en MAPA.md.
//   2. Que funcione: el calendario bloquea lo que debe y explica por qué; ?hoy,
//      ?reiniciar y ?sesion hacen lo que dicen; el primer clic después de escribir
//      sí responde; la misma dirección da la misma pantalla.
//   3. Que se vea bien: nada se sale de la ventana ni obliga a desplazar (1600x900,
//      1366x768 y 2048x1152), contraste AA, botones cómodos, foco visible y ninguna
//      palabra prohibida de ../proyecto.json en pantalla.
//
// Uso (desde cualquier carpeta):
//   node revisar-mapa.mjs              todo
//   node revisar-mapa.mjs --capturas   además guarda 3 capturas chicas en capturas/
//   node revisar-mapa.mjs --solo-mapa  solo el punto 1, en 1600x900 (más rápido)
//   node revisar-mapa.mjs --url http://127.0.0.1:8810   usa una app que ya está corriendo
//   node revisar-mapa.mjs --chrome "<ruta a chrome>"    si no encuentra Chrome solo
//
// Si algo falla, lo dice (qué y en qué pantalla) y sale con código 1.
// Arranca su propio servidor y su propio Chrome sin ventana, con un perfil temporal;
// al terminar cierra los dos y borra el perfil, aunque algo falle.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CARPETA = path.dirname(fileURLToPath(import.meta.url));
const HOY = '2026-03-02';
const TAMANOS = [[1600, 900], [1366, 768], [2048, 1152]];
const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

const AYUDA = `Revisa la Mesa de ayuda con Chrome.

  node revisar-mapa.mjs              todo
  node revisar-mapa.mjs --capturas   además guarda 3 capturas en capturas/
  node revisar-mapa.mjs --solo-mapa  solo el mapa, en 1600x900
  node revisar-mapa.mjs --url URL    usa una app que ya está corriendo
  node revisar-mapa.mjs --chrome R   ruta a Chrome (o la variable CHROME)`;

// ---------------------------------------------------------------- opciones
function leerOpciones(argumentos) {
  const o = { capturas: false, soloMapa: false, url: null, chrome: null };
  for (let i = 0; i < argumentos.length; i += 1) {
    const a = argumentos[i];
    if (a === '--capturas') o.capturas = true;
    else if (a === '--solo-mapa') o.soloMapa = true;
    else if (a === '--url') { o.url = argumentos[i + 1]; i += 1; }
    else if (a.startsWith('--url=')) o.url = a.slice(6);
    else if (a === '--chrome') { o.chrome = argumentos[i + 1]; i += 1; }
    else if (a.startsWith('--chrome=')) o.chrome = a.slice(9);
    else if (a === '--ayuda' || a === '--help' || a === '-h') { console.log(AYUDA); process.exit(0); }
    else { console.error(`No conozco la opción «${a}».\n\n${AYUDA}`); process.exit(2); }
  }
  if (o.url) o.url = o.url.replace(/\/+$/, '');
  return o;
}
const OPCIONES = leerOpciones(process.argv.slice(2));

// ---------------------------------------------------------------- resultados
const fallas = [];
let revisiones = 0;
class Detener extends Error {}

/** Anota una revisión. Si no se cumple, la cuenta como falla y la dice. */
function ok(condicion, mensaje) {
  revisiones += 1;
  if (!condicion) {
    fallas.push(mensaje);
    console.log(`  FALLA  ${mensaje}`);
  }
  return Boolean(condicion);
}

/** Como ok(), pero si falla ya no tiene caso seguir el recorrido. */
function debe(condicion, mensaje) {
  if (!ok(condicion, mensaje)) throw new Detener(mensaje);
}

// ---------------------------------------------------------------- el mapa
const FAMILIAS = { '{fecha}': '\\d{4}-\\d{2}-\\d{2}', '{folio}': 'ma-\\d{4}', '{n}': '[1-9]\\d*' };

function leerMapa() {
  const texto = readFileSync(path.join(CARPETA, 'MAPA.md'), 'utf8');
  const secciones = new Map();
  let actual = null;
  for (const linea of texto.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(linea)) {
      const m = /^#{2,3}\s+.*`([a-z0-9-]+)`\s*$/.exec(linea);
      actual = m ? { clave: m[1], ids: [] } : null;
      if (m) {
        if (secciones.has(m[1])) throw new Error(`MAPA.md repite la sección «${m[1]}».`);
        secciones.set(m[1], actual);
      }
      continue;
    }
    const fila = /^\|\s*`([^`]+)`\s*\|/.exec(linea);
    if (fila && actual) actual.ids.push(fila[1]);
  }
  if (!secciones.size) throw new Error('MAPA.md no tiene ninguna sección con clave (un título que termine en `clave`).');
  return secciones;
}

function aExpresion(id) {
  if (!id.includes('{')) return null;
  let fuente = id.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  for (const [familia, patron] of Object.entries(FAMILIAS)) fuente = fuente.split(familia).join(patron);
  if (/[{}]/.test(fuente.replace(/\\d\{4\}|\\d\{2\}/g, ''))) throw new Error(`MAPA.md: no conozco la familia de «${id}». Usa {fecha}, {folio} o {n}.`);
  return new RegExp(`^${fuente}$`);
}

const MAPA = leerMapa();
const DOCUMENTADOS = [...MAPA.values()].flatMap((s) => s.ids).map((id) => ({ id, re: aExpresion(id) }));
const SECCIONES_VISTAS = new Set();

// ---------------------------------------------------------------- palabras prohibidas (las de ../proyecto.json)
const normalizar = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Misma regla que el grabador: palabra completa y su plural; «geren*» es todo lo que empiece así. */
function expresionProhibidas(palabras) {
  const alternativas = (palabras || []).map((p) => normalizar(String(p).trim())).filter(Boolean).map((base) => (base.endsWith('*')
    ? `${escapar(base.slice(0, -1)).replace(/\s+/g, '\\s+')}[a-z0-9]*`
    : `${escapar(base).replace(/\s+/g, '\\s+')}(?:s|es)?`));
  return alternativas.length ? new RegExp(`(?<![a-z0-9])(?:${alternativas.join('|')})(?![a-z0-9])`) : null;
}

function leerProhibidas() {
  const ruta = path.join(CARPETA, '..', 'proyecto.json');
  if (!existsSync(ruta)) return { palabras: [], re: null };
  const proyecto = JSON.parse(readFileSync(ruta, 'utf8'));
  const palabras = proyecto.palabrasProhibidas || [];
  return { palabras, re: expresionProhibidas(palabras) };
}
const PROHIBIDAS = leerProhibidas();

// ---------------------------------------------------------------- reglas del calendario, escritas otra vez aquí
// A propósito no se copian de app.js: si las dos versiones no coinciden, una de las dos está mal.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaNum = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
const deDiaNum = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const semana = (iso) => new Date(diaNum(iso) * 86400000).getUTCDay();
const habil = (iso) => semana(iso) !== 0 && semana(iso) !== 6;
const nombreDia = (iso) => `${DIAS[semana(iso)]} ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const nombreMes = (iso) => { const m = MESES[Number(iso.slice(5, 7)) - 1]; return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${iso.slice(0, 4)}`; };

function primerDiaPosible(hoy) {
  let n = diaNum(hoy);
  let cuenta = 0;
  while (cuenta < 3) {
    n += 1;
    if (habil(deDiaNum(n))) cuenta += 1;
  }
  return deDiaNum(n);
}

function motivoEsperado(hoy) {
  const primero = diaNum(primerDiaPosible(hoy));
  return (iso) => {
    const n = diaNum(iso);
    if (n < diaNum(hoy)) return 'pasado';
    if (n === diaNum(hoy)) return 'hoy';
    if (!habil(iso)) return 'fin-de-semana';
    if (n < primero) return 'muy-pronto';
    return '';
  };
}

// ---------------------------------------------------------------- servidor y Chrome
function puertoLibre() {
  return new Promise((resolver, rechazar) => {
    const s = net.createServer();
    s.unref();
    s.on('error', rechazar);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolver(port));
    });
  });
}

async function arrancarServidor() {
  const puerto = await puertoLibre();
  const hijo = spawn(process.execPath, [path.join(CARPETA, 'servidor.mjs'), '--puerto', String(puerto)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '';
  hijo.stdout.on('data', (d) => { salida += d; });
  hijo.stderr.on('data', (d) => { salida += d; });
  const url = `http://127.0.0.1:${puerto}`;
  for (let i = 0; i < 100; i += 1) {
    if (hijo.exitCode !== null) break;
    try {
      const r = await fetch(`${url}/`);
      if (r.ok) return { url, hijo };
    } catch { /* todavía no responde */ }
    await dormir(100);
  }
  hijo.kill();
  throw new Error(`El servidor de la app no arrancó.\n${salida}`);
}

function buscarChrome() {
  const elegido = OPCIONES.chrome || process.env.CHROME || process.env.CHROME_PATH;
  if (elegido) return existsSync(elegido) ? elegido : null;
  const candidatos = [];
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
      if (base) candidatos.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    for (const base of [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES]) {
      if (base) candidatos.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidatos.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    for (const nombre of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      const r = spawnSync('which', [nombre], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) candidatos.push(r.stdout.trim());
    }
  }
  return candidatos.find((c) => existsSync(c)) || null;
}

async function abrirChrome(ruta) {
  const perfil = mkdtempSync(path.join(os.tmpdir(), 'mesa-ayuda-revisar-'));
  const argumentos = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-features=Translate,MediaRouter', '--mute-audio', '--force-color-profile=srgb',
    '--disable-lcd-text',   // sin suavizado de subpíxel: el texto no sale con bordes de color en las capturas reducidas
    '--force-device-scale-factor=1', '--window-size=1600,900', '--lang=es-MX', 'about:blank',
  ];
  const hijo = spawn(ruta, argumentos, { stdio: ['ignore', 'ignore', 'pipe'] });
  const chrome = { hijo, perfil, ws: null };
  try {
    chrome.ws = await new Promise((resolver, rechazar) => {
      let texto = '';
      const reloj = setTimeout(() => rechazar(new Error('Chrome no respondió en 30 s.')), 30000);
      hijo.stderr.on('data', (d) => {
        texto += d;
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(texto);
        if (m) { clearTimeout(reloj); resolver(m[1]); }
      });
      hijo.on('exit', (codigo) => { clearTimeout(reloj); rechazar(new Error(`Chrome se cerró al arrancar (código ${codigo}).`)); });
    });
  } catch (error) {
    await cerrarChrome(chrome, null);
    throw error;
  }
  return chrome;
}

function esperarSalida(hijo, ms) {
  if (hijo.exitCode !== null || hijo.signalCode !== null) return Promise.resolve();
  return new Promise((resolver) => {
    const reloj = setTimeout(resolver, ms);
    hijo.once('exit', () => { clearTimeout(reloj); resolver(); });
  });
}

async function cerrarChrome(chrome, cdp) {
  if (cdp) {
    try { await Promise.race([cdp.enviar('Browser.close'), dormir(3000)]); } catch { /* ya estaba cerrado */ }
    cdp.cerrar();
  }
  await esperarSalida(chrome.hijo, 5000);
  if (chrome.hijo.exitCode === null && chrome.hijo.signalCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(chrome.hijo.pid), '/T', '/F'], { stdio: 'ignore' });
    else chrome.hijo.kill('SIGKILL');
    await esperarSalida(chrome.hijo, 3000);
  }
  for (let i = 0; i < 20 && existsSync(chrome.perfil); i += 1) {
    try { rmSync(chrome.perfil, { recursive: true, force: true }); } catch { await dormir(250); }
  }
  if (existsSync(chrome.perfil)) console.log(`AVISO: no pude borrar el perfil temporal de Chrome: ${chrome.perfil}. Bórralo a mano.`);
}

// ---------------------------------------------------------------- protocolo de Chrome (lo mínimo)
class Cdp {
  static async conectar(url) {
    const ws = new WebSocket(url);
    await new Promise((resolver, rechazar) => {
      ws.addEventListener('open', resolver, { once: true });
      ws.addEventListener('error', () => rechazar(new Error('No pude conectarme con Chrome.')), { once: true });
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.siguiente = 0;
    this.pendientes = new Map();
    ws.addEventListener('message', (e) => this.recibir(JSON.parse(String(e.data))));
    ws.addEventListener('close', () => {
      for (const p of this.pendientes.values()) p.rechazar(new Error('Chrome cerró la conexión.'));
      this.pendientes.clear();
    });
  }

  recibir(mensaje) {
    if (mensaje.id === undefined) return;
    const p = this.pendientes.get(mensaje.id);
    if (!p) return;
    this.pendientes.delete(mensaje.id);
    if (mensaje.error) p.rechazar(new Error(`${p.metodo}: ${mensaje.error.message}`));
    else p.resolver(mensaje.result);
  }

  enviar(metodo, params = {}, sesion = undefined) {
    this.siguiente += 1;
    const id = this.siguiente;
    return new Promise((resolver, rechazar) => {
      this.pendientes.set(id, { resolver, rechazar, metodo });
      this.ws.send(JSON.stringify({ id, method: metodo, params, ...(sesion ? { sessionId: sesion } : {}) }));
    });
  }

  cerrar() {
    try { this.ws.close(); } catch { /* ya cerrado */ }
  }
}

const TECLAS = {
  Tab: { key: 'Tab', code: 'Tab', vk: 9 },
  Enter: { key: 'Enter', code: 'Enter', vk: 13, texto: '\r' },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  Backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
};

class Pagina {
  constructor(cdp, sesion) {
    this.cdp = cdp;
    this.sesion = sesion;
    this.ancho = 1600;
    this.alto = 900;
  }

  enviar(metodo, params) { return this.cdp.enviar(metodo, params, this.sesion); }

  async tamano(ancho, alto) {
    this.ancho = ancho;
    this.alto = alto;
    await this.enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false });
  }

  async evaluar(funcion, ...argumentos) {
    const r = await this.enviar('Runtime.evaluate', { expression: `(${funcion})(...${JSON.stringify(argumentos)})`, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`la página lanzó un error: ${(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text || '').split('\n')[0]}`);
    return r.result.value;
  }

  async esperar(funcion, argumentos = [], que = 'la página', tiempo = 6000) {
    const fin = Date.now() + tiempo;
    let ultimo = '';
    while (Date.now() < fin) {
      try {
        const v = await this.evaluar(funcion, ...argumentos);
        if (v) return v;
      } catch (error) { ultimo = error.message; }
      await dormir(40);
    }
    throw new Detener(`se acabó el tiempo esperando ${que}${ultimo ? ` (${ultimo})` : ''}`);
  }

  async llega(funcion, argumentos = [], tiempo = 2500) {
    try { await this.esperar(funcion, argumentos, '', tiempo); return true; } catch { return false; }
  }

  llegaA(pantalla, paso = null) {
    return this.llega((p, s) => document.body.dataset.pantalla === p && (s === null || document.body.dataset.paso === String(s)), [pantalla, paso]);
  }

  /** Abre la dirección desde cero (pasa por una página en blanco: aunque solo cambie el #, la app arranca de nuevo). */
  async ir(url) {
    const destino = new URL(url).href;
    await this.enviar('Page.navigate', { url: 'about:blank' });
    await this.esperar(() => window.location.href === 'about:blank' && document.readyState === 'complete', [], 'la página en blanco');
    const r = await this.enviar('Page.navigate', { url: destino });
    if (r.errorText) throw new Detener(`no pude abrir ${destino}: ${r.errorText}`);
    await this.esperar((u) => window.location.href === u && document.readyState === 'complete' && Boolean(document.body.dataset.pantalla), [destino], `que cargue ${destino}`);
  }

  async caja(id) {
    const c = await this.evaluar((g) => {
      const el = [...document.querySelectorAll(`[data-guia="${g}"]`)].find((e) => e.getClientRects().length > 0);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }, id);
    if (!c) throw new Detener(`no encuentro @${id} en la pantalla`);
    return c;
  }

  async mover(x, y) {
    await this.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
  }

  /** Clic de verdad (mover, bajar, subir) en el centro del elemento. */
  async clic(id) {
    const c = await this.caja(id);
    const x = Math.round(c.x + c.w / 2);
    const y = Math.round(c.y + c.h / 2);
    await this.mover(x, y);
    await this.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await this.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  }

  /** Teclea letra por letra, como una persona (sin pegar el texto). */
  async escribir(texto) {
    for (const letra of texto) {
      await this.enviar('Input.dispatchKeyEvent', { type: 'keyDown', key: letra, text: letra, unmodifiedText: letra });
      await this.enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: letra });
    }
  }

  async tecla(nombre) {
    const t = TECLAS[nombre];
    const base = { key: t.key, code: t.code, windowsVirtualKeyCode: t.vk, nativeVirtualKeyCode: t.vk };
    await this.enviar('Input.dispatchKeyEvent', { ...base, type: t.texto ? 'keyDown' : 'rawKeyDown', ...(t.texto ? { text: t.texto, unmodifiedText: t.texto } : {}) });
    await this.enviar('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
  }

  /** Selecciona todo el campo con el teclado y lo borra. */
  async vaciarCampo() {
    const modificador = process.platform === 'darwin' ? 4 : 2;
    await this.enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: modificador, commands: ['selectAll'] });
    await this.enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: modificador });
    await this.tecla('Backspace');
  }

  texto(id) {
    return this.evaluar((g) => {
      const el = document.querySelector(`[data-guia="${g}"]`);
      return el ? el.innerText.replace(/\s+/g, ' ').trim() : null;
    }, id);
  }

  visible(id) {
    return this.evaluar((g) => [...document.querySelectorAll(`[data-guia="${g}"]`)].some((e) => e.getClientRects().length > 0), id);
  }

  async captura(escala = 1) {
    const r = await this.enviar('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: this.ancho, height: this.alto, scale: escala } });
    return Buffer.from(r.data, 'base64');
  }
}

// ---------------------------------------------------------------- funciones que corren dentro de la página
function leerEstado() {
  const visibles = [...document.querySelectorAll('[data-guia]')].filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
  const campos = [...document.querySelectorAll('input, textarea')]
    .filter((i) => !['password', 'hidden', 'radio', 'checkbox'].includes(i.type) && i.getClientRects().length > 0)
    .map((i) => `${i.value} ${i.placeholder || ''}`);
  return {
    pantalla: document.body.dataset.pantalla || '',
    sesion: document.body.dataset.sesion === '1',
    ancho: window.innerWidth,
    alto: window.innerHeight,
    anchoTotal: document.documentElement.scrollWidth,
    altoTotal: document.documentElement.scrollHeight,
    guias: visibles.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.guia, x: r.left, y: r.top, derecha: r.right, abajo: r.bottom };
    }),
    texto: `${document.body.innerText}\n${campos.join('\n')}`,
  };
}

function medirPagina() {
  const leer = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
  };
  const mezclar = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
  const luz = (c) => {
    const f = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const razon = (a, b) => { const x = luz(a); const y = luz(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fondo = (el) => {
    const capas = [];
    for (let n = el; n; n = n.parentElement) {
      const c = leer(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; }
    }
    let r = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = capas.length - 1; i >= 0; i -= 1) r = mezclar(capas[i], r);
    return r;
  };
  const guiaDe = (el) => { const g = el.closest('[data-guia]'); return g ? g.dataset.guia : ''; };
  const raiz = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const contraste = [];
  const cortados = [];
  const chicos = [];
  const vistos = new Set();
  const recorrer = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = recorrer.nextNode(); t; t = recorrer.nextNode()) {
    const el = t.parentElement;
    if (!el || !t.textContent.trim() || vistos.has(el) || el.closest('script, style, noscript')) continue;
    vistos.add(el);
    const caja = el.getBoundingClientRect();
    if (!el.getClientRects().length || caja.width <= 1 || caja.height <= 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const f = fondo(el);
    let tinta = leer(cs.color);
    if (tinta.a < 1) tinta = mezclar(tinta, f);
    const px = parseFloat(cs.fontSize);
    const grande = px >= 24 || (px >= 18.66 && (Number(cs.fontWeight) || 400) >= 700);
    const r = razon(tinta, f);
    if (r < (grande ? 3 : 4.5)) contraste.push({ texto: t.textContent.trim().slice(0, 50), razon: Math.round(r * 100) / 100, minimo: grande ? 3 : 4.5, guia: guiaDe(el) });
    if ((/(hidden|clip)/.test(cs.overflowX) || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) cortados.push({ texto: t.textContent.trim().slice(0, 50), guia: guiaDe(el) });
  }
  for (const el of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
    if (!el.getClientRects().length || el.value) continue;
    const c = leer(getComputedStyle(el, '::placeholder').color);
    if (!c) continue;
    const f = fondo(el);
    const r = razon(c.a < 1 ? mezclar(c, f) : c, f);
    if (r < 4.5) contraste.push({ texto: `(texto guía) ${el.placeholder}`, razon: Math.round(r * 100) / 100, minimo: 4.5, guia: guiaDe(el) });
  }
  const minimo = Math.max(24, 2.5 * raiz) - 0.5;
  for (const el of document.querySelectorAll('button, a[href], input:not([type="radio"]):not([type="checkbox"]), textarea, label.ficha, label.segmento, label.casilla')) {
    if (!el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 2 && r.height <= 2) continue;
    if (r.height < minimo || r.width < minimo) chicos.push({ guia: el.dataset.guia || guiaDe(el) || el.textContent.trim().slice(0, 30), ancho: Math.round(r.width), alto: Math.round(r.height), minimo: Math.round(minimo) });
  }
  return { contraste, cortados, chicos };
}

function medirFoco() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const escondido = el.matches('input[type="radio"], input[type="checkbox"]') && getComputedStyle(el).opacity === '0';
  const objetivo = escondido ? el.closest('label') : el;
  const cs = getComputedStyle(objetivo);
  return {
    quien: objetivo.dataset.guia || el.id || objetivo.textContent.trim().slice(0, 30) || el.tagName,
    visible: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
  };
}

// ---------------------------------------------------------------- revisar una pantalla
async function revisarEstado(p, clave, secciones, { soloMapa }) {
  const e = await p.evaluar(leerEstado);
  const donde = `${clave} (${e.ancho}x${e.alto})`;
  const lista = e.sesion && e.pantalla !== 'entrar' && e.pantalla !== 'error' ? ['comunes', ...secciones] : secciones;

  // 1. Lo que dice el mapa se ve
  for (const s of lista) {
    const seccion = MAPA.get(s);
    if (!ok(seccion, `${donde}: MAPA.md no tiene la sección «${s}»`)) continue;
    SECCIONES_VISTAS.add(s);
    for (const id of seccion.ids) {
      const re = aExpresion(id);
      const n = e.guias.filter((g) => (re ? re.test(g.id) : g.id === id)).length;
      ok(n > 0, re ? `${donde}: no se ve ningún ${id}` : `${donde}: falta ${id} (no está o no se ve)`);
    }
  }
  // 2. Lo que se ve está en el mapa, una sola vez
  const cuenta = new Map();
  for (const g of e.guias) cuenta.set(g.id, (cuenta.get(g.id) || 0) + 1);
  for (const [id, n] of cuenta) {
    ok(DOCUMENTADOS.some((d) => (d.re ? d.re.test(id) : d.id === id)), `${donde}: «${id}» se ve en pantalla pero no está en MAPA.md`);
    ok(n === 1, `${donde}: «${id}» sale ${n} veces en la misma pantalla`);
  }
  if (soloMapa) return e;

  // 3. Nada se sale ni obliga a desplazar
  ok(e.anchoTotal <= e.ancho, `${donde}: la página se sale a lo ancho (${e.anchoTotal} px en ${e.ancho})`);
  ok(e.altoTotal <= e.alto, `${donde}: la página no cabe a lo alto (${e.altoTotal} px en ${e.alto}): habría que desplazar`);
  for (const g of e.guias) ok(g.x >= -0.5 && g.y >= -0.5 && g.derecha <= e.ancho + 0.5 && g.abajo <= e.alto + 0.5, `${donde}: «${g.id}» queda fuera de la ventana`);

  // 4. Contraste, textos cortados, tamaño de lo que se toca
  const m = await p.evaluar(medirPagina);
  ok(m.contraste.length === 0, `${donde}: contraste bajo en ${m.contraste.map((c) => `«${c.texto}» ${c.razon}:1 (mínimo ${c.minimo})${c.guia ? ` [${c.guia}]` : ''}`).join('; ')}`);
  ok(m.cortados.length === 0, `${donde}: texto cortado en ${m.cortados.map((c) => `«${c.texto}»${c.guia ? ` [${c.guia}]` : ''}`).join('; ')}`);
  ok(m.chicos.length === 0, `${donde}: muy chico para tocar: ${m.chicos.map((c) => `${c.guia} ${c.ancho}x${c.alto} (mínimo ${c.minimo})`).join('; ')}`);

  // 5. Ninguna palabra prohibida en pantalla
  if (PROHIBIDAS.re) {
    const hallada = normalizar(e.texto).match(PROHIBIDAS.re);
    ok(!hallada, `${donde}: en pantalla sale «${hallada && hallada[0]}», que está en palabrasProhibidas`);
  }
  return e;
}

// ---------------------------------------------------------------- ayudas del recorrido
function oculto(g) {
  const el = document.querySelector(`[data-guia="${g}"]`);
  return !el || el.hidden || !el.getClientRects().length;
}

async function guardarCaptura(p, nombre) {
  await p.mover(1, p.alto - 1);   // el cursor fuera de todo: sin efectos de «pasar por encima»
  await dormir(200);              // los cambios de color duran 0.12 s
  const dir = path.join(CARPETA, 'capturas');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, nombre), await p.captura(800 / p.ancho));
  console.log(`  captura: capturas/${nombre}`);
}

async function mensajeCalendario(p) {
  return p.evaluar(() => {
    const el = document.querySelector('[data-guia="calendario-mensaje"]');
    return { tipo: el.dataset.tipo, texto: el.innerText.trim(), alto: Math.round(el.getBoundingClientRect().height * 10) / 10 };
  });
}

// Altos del mensaje del calendario en este recorrido: si cambia, lo de abajo brinca en el video.
let altosMensaje = [];

async function revisarMensaje(p, tipo, patrones, que) {
  const m = await mensajeCalendario(p);
  altosMensaje.push(m.alto);
  ok(m.tipo === tipo && patrones.every((re) => re.test(m.texto)), `Calendario: ${que}: el mensaje debía ser «${tipo}» y decir ${patrones.map(String).join(' y ')}; dice (${m.tipo}) «${m.texto}»`);
}

const elegido = (p) => p.evaluar(() => {
  const d = [...document.querySelectorAll('.dia[data-estado="elegido"]')];
  return d.map((b) => b.dataset.fecha).join(',');
});

/** Recorre todos los meses que deja ver el calendario y compara cada día con las reglas. */
async function revisarReglasCalendario(p, hoy, donde) {
  const motivo = motivoEsperado(hoy);
  const primero = primerDiaPosible(hoy);
  const altoInicial = (await mensajeCalendario(p)).alto;
  ok((await p.texto('calendario-mes')) === nombreMes(primero), `${donde}: el calendario debe abrir en el mes del primer día posible (${nombreMes(primero)})`);
  const deshabilitado = (id) => p.evaluar((g) => document.querySelector(`[data-guia="${g}"]`).getAttribute('aria-disabled') === 'true', id);
  for (let i = 0; i < 6 && !(await deshabilitado('calendario-anterior')); i += 1) await p.clic('calendario-anterior');
  const meses = [];
  let disponibles = [];
  for (let i = 0; i < 6; i += 1) {
    const mes = await p.texto('calendario-mes');
    meses.push(mes);
    const dias = await p.evaluar(() => [...document.querySelectorAll('[data-guia^="calendario-dia-"]')].map((b) => ({
      guia: b.dataset.guia, fecha: b.dataset.fecha, estado: b.dataset.estado, motivo: b.dataset.motivo, hoy: b.dataset.hoy === '1', bloqueado: b.getAttribute('aria-disabled') === 'true',
    })));
    let malos = 0;
    for (const d of dias) {
      const m = motivo(d.fecha);
      const estadoBien = m ? d.estado === 'bloqueado' && d.bloqueado : d.estado !== 'bloqueado' && !d.bloqueado;
      if (d.motivo !== m || !estadoBien || d.hoy !== (d.fecha === hoy) || d.guia !== `calendario-dia-${d.fecha}`) {
        malos += 1;
        if (malos <= 3) ok(false, `${donde}: el ${d.fecha} debía ser «${m || 'disponible'}» y es «${d.motivo || d.estado}»`);
      }
      if (!m) disponibles.push(d.fecha);
    }
    const largo = new Date(Date.UTC(Number(dias[0].fecha.slice(0, 4)), Number(dias[0].fecha.slice(5, 7)), 0)).getUTCDate();
    ok(dias.length === largo && dias.every((d, k) => Number(d.fecha.slice(8, 10)) === k + 1), `${donde}: ${mes} no muestra sus ${largo} días en orden`);
    ok(malos === 0, `${donde}: ${mes} tiene ${malos} días con la regla equivocada`);
    if (await deshabilitado('calendario-siguiente')) break;
    await p.clic('calendario-siguiente');
  }
  disponibles = disponibles.sort();
  ok(meses.length === 3, `${donde}: el calendario debe dejar ver 3 meses (el de hoy y dos más) y deja ${meses.length}: ${meses.join(', ')}`);
  ok(disponibles[0] === primero, `${donde}: el primer día que se puede elegir debía ser ${primero} y es ${disponibles[0]}`);
  // de regreso al mes del primer día posible
  for (let i = 0; i < 6 && (await p.texto('calendario-mes')) !== nombreMes(primero); i += 1) await p.clic('calendario-anterior');
  // Cada explicación cabe en el mismo alto: tocar un día que no se puede no mueve nada de lo de abajo
  for (const razon of ['muy-pronto', 'hoy', 'fin-de-semana', 'pasado']) {
    const id = await p.evaluar((r) => { const b = document.querySelector(`.dia[data-motivo="${r}"]`); return b ? b.dataset.guia : null; }, razon);
    if (!id) continue;
    await p.clic(id);
    const m = await mensajeCalendario(p);
    ok(m.tipo === 'aviso' && m.alto === altoInicial, `${donde}: al tocar un día «${razon}» el mensaje mide ${m.alto} px y al entrar medía ${altoInicial}: «${m.texto}»`);
  }
}

/** Llena el paso 1 rápido (para llegar al calendario). */
async function llenarPaso1(p) {
  await p.clic('nuevo-titulo');
  await p.escribir('Prueba de calendario');
  await p.clic('nuevo-categoria-otro');
  await p.clic('nuevo-prioridad-baja');
  await p.clic('nuevo-siguiente');
  debe(await p.llegaA('nuevo', 2), 'el paso 1 lleno debía pasar al paso 2');
}

// ---------------------------------------------------------------- el recorrido completo por la app
async function recorrido(p, base, { capturas, soloMapa }) {
  const R = (clave, secciones) => revisarEstado(p, clave, secciones, { soloMapa });
  const conDatos = `${base}/?hoy=${HOY}&reiniciar=1`;

  // ---- Entrar
  await p.ir(conDatos);
  debe(await p.llegaA('entrar'), 'con ?reiniciar=1 la app debe abrir en Entrar');
  await R('entrar', ['entrar']);
  await p.clic('entrar-boton');
  debe(await p.llega(() => !document.querySelector('[data-guia="entrar-correo-error"]').hidden), 'Entrar con los campos vacíos debe mostrar errores');
  await R('entrar-errores', ['entrar-errores']);
  // Primer clic después de escribir, SIN pulsar Tab: tiene que responder a la primera.
  await p.clic('entrar-correo');
  await p.escribir('ana@ejemplo.com');
  await p.clic('entrar-contrasena');
  ok(await p.evaluar(() => document.activeElement && document.activeElement.dataset.guia === 'entrar-contrasena'), 'Entrar: el primer clic después de escribir el correo no llegó a la contraseña');
  await p.escribir('cualquier-cosa');
  ok(await p.evaluar(() => { const c = document.querySelector('[data-guia="entrar-contrasena"]'); return c.type === 'password' && c.value.length > 0; }), 'Entrar: la contraseña debe verse con puntos (type=password)');
  ok(await p.evaluar(oculto, 'entrar-correo-error'), 'Entrar: el error del correo debe irse al escribir');
  await p.clic('entrar-boton');
  debe(await p.llegaA('inicio'), 'Entrar: el primer clic en Entrar después de escribir se perdió (no llegó al inicio)');

  // ---- Inicio
  await R('inicio', ['inicio']);
  ok((await p.texto('inicio-saludo')) === 'Hola, Ana', 'Inicio: el saludo debe decir «Hola, Ana»');
  ok((await p.texto('inicio-fecha')) === 'Lunes 2 de marzo de 2026', `Inicio: con ?hoy=${HOY} la fecha debe decir «Lunes 2 de marzo de 2026» y dice «${await p.texto('inicio-fecha')}»`);
  ok((await p.texto('inicio-aviso')).includes('La pantalla parpadea con el monitor externo'), 'Inicio: el aviso debe nombrar el pedido que espera respuesta');
  if (capturas) await guardarCaptura(p, '01-inicio.png');

  // ---- Nuevo pedido: paso 1
  await p.clic('inicio-nuevo');
  debe(await p.llegaA('nuevo', 1), 'Inicio: Nuevo pedido no abrió el paso 1');
  await R('nuevo-1', ['nuevo', 'nuevo-1']);
  await p.clic('nuevo-siguiente');
  debe(await p.llega(() => !document.querySelector('[data-guia="nuevo-titulo-error"]').hidden), 'Paso 1 vacío: Siguiente debe mostrar errores');
  ok(await p.evaluar(() => document.body.dataset.paso === '1'), 'Paso 1 vacío: no debe avanzar');
  await R('nuevo-1-errores', ['nuevo-1-errores']);
  await p.clic('nuevo-titulo');
  await p.escribir('La impresora no imprime a color');
  await p.clic('nuevo-categoria-impresoras');
  ok(await p.evaluar(() => document.querySelector('input[name="categoria"][value="impresoras"]').checked), 'Paso 1: el primer clic después de escribir el título no eligió la categoría');
  await p.clic('nuevo-prioridad-normal');
  ok(await p.evaluar(() => document.querySelector('input[name="prioridad"][value="normal"]').checked), 'Paso 1: no se eligió la prioridad');
  ok((await p.texto('nuevo-prioridad-ayuda')) === 'Normal: lo necesitas esta semana.', 'Paso 1: la ayuda de la prioridad debe explicar la elegida');
  ok(await p.evaluar(() => ['nuevo-titulo-error', 'nuevo-categoria-error', 'nuevo-prioridad-error'].every((g) => document.querySelector(`[data-guia="${g}"]`).hidden)), 'Paso 1: los errores deben irse al corregir');
  await p.clic('nuevo-siguiente');
  debe(await p.llegaA('nuevo', 2), 'Paso 1: Siguiente no llevó al paso 2');

  // ---- Paso 2: el calendario
  await R('nuevo-2', ['nuevo', 'nuevo-2']);
  altosMensaje = [];
  await revisarMensaje(p, 'info', [/jueves 5 de marzo/], 'al entrar');
  if (!soloMapa) await revisarReglasCalendario(p, HOY, `Calendario (hoy=${HOY})`);
  await p.clic('calendario-dia-2026-03-07');
  await revisarMensaje(p, 'aviso', [/sábado 7 de marzo/, /fin de semana/], 'tocar el sábado 7');
  ok((await elegido(p)) === '', 'Calendario: tocar un sábado no debe elegirlo');
  if (capturas) await guardarCaptura(p, '02-calendario.png');
  await p.clic('calendario-dia-2026-03-04');
  await revisarMensaje(p, 'aviso', [/miércoles 4 de marzo/, /muy pronto/, /3 días hábiles/, /jueves 5 de marzo/], 'tocar el miércoles 4 (muy pronto)');
  await p.clic('calendario-dia-2026-03-02');
  await revisarMensaje(p, 'aviso', [/^Hoy es muy pronto/, /jueves 5 de marzo/], 'tocar hoy');
  await p.clic('calendario-dia-2026-03-01');
  await revisarMensaje(p, 'aviso', [/domingo 1 de marzo ya pasó/], 'tocar un día que ya pasó');
  ok((await elegido(p)) === '', 'Calendario: tocar días que no se pueden no debe elegir ninguno');
  await p.clic('nuevo-siguiente');
  debe(await p.llega(() => !document.querySelector('[data-guia="nuevo-fecha-error"]').hidden), 'Paso 2 sin fecha: Siguiente debe mostrar el error');
  ok(await p.evaluar(() => document.body.dataset.paso === '2'), 'Paso 2 sin fecha: no debe avanzar');
  await R('nuevo-2-errores', ['nuevo-2-errores']);
  await p.clic('calendario-dia-2026-03-05');
  ok((await elegido(p)) === '2026-03-05', 'Calendario: el jueves 5 debe quedar elegido');
  await revisarMensaje(p, 'ok', [/Elegiste el jueves 5 de marzo/], 'elegir el jueves 5');
  ok((await p.texto('nuevo-fecha-elegida')).includes('Jueves 5 de marzo de 2026'), 'Calendario: «Fecha elegida» debe decir el jueves 5');
  ok(await p.evaluar(oculto, 'nuevo-fecha-error'), 'Calendario: el error de fecha debe irse al elegir');
  await p.clic('calendario-dia-2026-03-08');
  await revisarMensaje(p, 'aviso', [/domingo 8 de marzo/, /fin de semana/], 'tocar el domingo 8 con un día ya elegido');
  ok((await elegido(p)) === '2026-03-05', 'Calendario: tocar un domingo no debe cambiar lo elegido');
  // Meses: no deja ir atrás ni más de dos meses adelante
  await p.clic('calendario-anterior');
  await revisarMensaje(p, 'aviso', [/meses que ya pasaron/], 'ir a un mes que ya pasó');
  ok((await p.texto('calendario-mes')) === 'Marzo de 2026', 'Calendario: no debe ir a febrero');
  await p.clic('calendario-siguiente');
  ok((await p.texto('calendario-mes')) === 'Abril de 2026', 'Calendario: la flecha derecha debe ir a abril');
  await p.clic('calendario-siguiente');
  ok((await p.texto('calendario-mes')) === 'Mayo de 2026', 'Calendario: la flecha derecha debe ir a mayo');
  await p.clic('calendario-siguiente');
  await revisarMensaje(p, 'aviso', [/hasta mayo de 2026/], 'pasar del último mes');
  ok((await p.texto('calendario-mes')) === 'Mayo de 2026', 'Calendario: no debe pasar de mayo');
  await p.clic('calendario-anterior');
  await p.clic('calendario-anterior');
  ok((await p.texto('calendario-mes')) === 'Marzo de 2026' && (await elegido(p)) === '2026-03-05', 'Calendario: al volver a marzo debe seguir elegido el jueves 5');
  // Teclado: flechas entre días; un día que no se puede explica por qué y Enter no lo elige
  await p.evaluar(() => document.querySelector('[data-guia="calendario-dia-2026-03-05"]').focus());
  await p.tecla('ArrowRight');
  ok(await p.evaluar(() => document.activeElement.dataset.fecha === '2026-03-06'), 'Calendario: la flecha derecha debe mover el foco al viernes 6');
  await revisarMensaje(p, 'info', [/viernes 6 de marzo está disponible/], 'llegar al viernes 6 con el teclado');
  await p.tecla('ArrowRight');
  await revisarMensaje(p, 'aviso', [/sábado 7 de marzo/, /fin de semana/], 'llegar al sábado 7 con el teclado');
  await p.tecla('Enter');
  ok((await elegido(p)) === '2026-03-05', 'Calendario: Enter en un sábado no debe elegirlo');
  await p.tecla('ArrowLeft');
  await p.tecla('Enter');
  ok((await elegido(p)) === '2026-03-06', 'Calendario: Enter en el viernes 6 debe elegirlo');
  await p.clic('calendario-dia-2026-03-05');
  ok((await elegido(p)) === '2026-03-05', 'Calendario: un clic en el jueves 5 debe volver a elegirlo');
  ok(new Set(altosMensaje).size === 1, `Calendario: el mensaje cambió de alto según lo que decía (${[...new Set(altosMensaje)].join(', ')} px): lo de abajo se mueve`);
  await p.clic('nuevo-siguiente');
  debe(await p.llegaA('nuevo', 3), 'Paso 2: Siguiente no llevó al paso 3');

  // ---- Paso 3: detalles y archivos
  await R('nuevo-3', ['nuevo', 'nuevo-3']);
  await p.clic('nuevo-siguiente');
  debe(await p.llega(() => !document.querySelector('[data-guia="nuevo-descripcion-error"]').hidden), 'Paso 3 vacío: Siguiente debe mostrar el error');
  await R('nuevo-3-errores', ['nuevo-3-errores']);
  await p.clic('nuevo-adjuntar');
  debe(await p.llega(() => !document.querySelector('[data-guia="adjuntos-selector"]').hidden), 'Paso 3: Adjuntar archivo debe abrir el selector');
  await R('nuevo-3-selector', ['nuevo-3-selector']);
  await p.clic('adjuntos-archivo-1');
  ok(await p.evaluar(oculto, 'adjuntos-selector'), 'Paso 3: elegir un archivo debe cerrar el selector');
  ok((await p.texto('nuevo-adjunto-1') || '').includes('foto-de-la-impresora.jpg'), 'Paso 3: el archivo elegido debe salir en la lista');
  await R('nuevo-3-adjunto', ['nuevo-3-adjunto']);
  await p.clic('nuevo-adjuntar');
  ok(await p.evaluar(() => { const b = document.querySelector('[data-guia="adjuntos-archivo-1"]'); return b.getAttribute('aria-disabled') === 'true' && b.innerText.includes('Ya está adjunto'); }), 'Paso 3: un archivo ya adjunto debe decir «Ya está adjunto»');
  await p.tecla('Escape');
  ok(await p.evaluar(oculto, 'adjuntos-selector'), 'Paso 3: Escape debe cerrar el selector');
  // Un clic fuera del selector lo cierra Y llega a lo que tocaste
  await p.clic('nuevo-adjuntar');
  await p.clic('nuevo-descripcion');
  ok(await p.evaluar(() => document.querySelector('[data-guia="adjuntos-selector"]').hidden && document.activeElement.dataset.guia === 'nuevo-descripcion'), 'Paso 3: el clic fuera del selector debe cerrarlo y llegar a la descripción');
  const descripcion = 'Sale todo en gris, aunque el archivo es a color.';
  await p.escribir(descripcion);
  ok((await p.texto('nuevo-descripcion-contador')) === `${descripcion.length} de 500`, 'Paso 3: el contador debe contar las letras');
  await p.clic('nuevo-siguiente');
  debe(await p.llegaA('nuevo', 4), 'Paso 3: el primer clic en Siguiente después de escribir se perdió (no llegó al paso 4)');

  // ---- Paso 4: revisar
  await R('nuevo-4', ['nuevo', 'nuevo-4']);
  const resumen = await p.texto('revisar-resumen');
  for (const dato of ['La impresora no imprime a color', 'Impresoras', 'Normal', 'Jueves 5 de marzo de 2026', descripcion, 'foto-de-la-impresora.jpg']) ok(resumen.includes(dato), `Revisar: el resumen debe incluir «${dato}»`);
  await p.clic('revisar-enviar');
  debe(await p.llega(() => !document.querySelector('[data-guia="revisar-confirmo-error"]').hidden), 'Revisar: enviar sin la casilla debe mostrar el error');
  ok(await p.evaluar(() => document.body.dataset.pantalla === 'nuevo'), 'Revisar: sin la casilla no debe enviar');
  await R('nuevo-4-errores', ['nuevo-4-errores']);
  await p.clic('revisar-cambiar-1');
  debe(await p.llegaA('nuevo', 1), 'Revisar: Cambiar debe volver al paso 1');
  ok(await p.evaluar(() => document.querySelector('[data-guia="nuevo-titulo"]').value === 'La impresora no imprime a color' && document.querySelector('input[name="categoria"][value="impresoras"]').checked), 'Revisar: al volver con Cambiar no se debe perder lo escrito');
  for (const paso of [2, 3, 4]) {
    await p.clic('nuevo-siguiente');
    debe(await p.llegaA('nuevo', paso), `Revisar: después de Cambiar, Siguiente debía llegar al paso ${paso}`);
  }
  await p.clic('revisar-confirmo');
  ok(await p.evaluar(() => document.querySelector('input[name="confirmo"]').checked), 'Revisar: la casilla debe quedar marcada');
  await p.clic('revisar-enviar');
  debe(await p.llegaA('listo'), 'Revisar: Enviar pedido no llevó a la confirmación');

  // ---- Confirmación
  await R('listo', ['listo']);
  ok((await p.texto('listo-folio')).includes('MA-1048'), `Confirmación: el folio debe ser MA-1048 y es «${await p.texto('listo-folio')}»`);
  ok(await p.evaluar(() => window.location.hash === '#/listo/ma-1048'), 'Confirmación: la dirección debe terminar en #/listo/ma-1048');
  await p.clic('listo-ver-pedido');
  debe(await p.llegaA('detalle'), 'Confirmación: Ver mi pedido no abrió el detalle');
  await R('detalle-recien-creado', []);
  ok((await p.texto('detalle-folio')) === 'MA-1048', 'Detalle del pedido nuevo: el folio debe ser MA-1048');
  ok(await p.evaluar(() => document.querySelector('[data-guia="detalle-estatus"]').dataset.estatus === 'recibido'), 'Detalle del pedido nuevo: debe estar «Recibido»');
  ok((await p.texto('detalle-mensaje-1')).includes('foto-de-la-impresora.jpg'), 'Detalle del pedido nuevo: tu mensaje debe llevar el archivo adjunto');

  // ---- Mis pedidos
  await p.clic('menu-pedidos');
  debe(await p.llegaA('pedidos'), 'Menú: Mis pedidos no abrió la lista');
  await R('pedidos', ['pedidos']);
  ok(await p.evaluar(() => {
    const filas = [...document.querySelectorAll('[data-guia^="pedidos-fila-"]')];
    return filas.length === 8 && filas[0].dataset.guia === 'pedidos-fila-ma-1048' && document.querySelector('[data-guia="pedidos-estatus-ma-1048"]').dataset.estatus === 'recibido';
  }), 'Mis pedidos: deben salir 8 pedidos con MA-1048 «Recibido» hasta arriba');
  ok(await p.evaluar(() => {
    const vistos = new Set([...document.querySelectorAll('.filas .chip')].map((c) => c.dataset.estatus));
    return ['recibido', 'en-revision', 'requiere-respuesta', 'en-proceso', 'resuelto', 'cancelado'].every((s) => vistos.has(s));
  }), 'Mis pedidos: los datos de ejemplo deben mostrar los seis estatus');
  await p.clic('pedidos-buscar');
  await p.escribir('zzz');
  debe(await p.llega(() => !document.querySelector('[data-guia="pedidos-vacio"]').hidden), 'Mis pedidos: una búsqueda sin resultados debe decirlo');
  await R('pedidos-vacio', ['pedidos-vacio']);
  await p.vaciarCampo();
  await p.escribir('pantalla');
  ok(await p.evaluar(() => [...document.querySelectorAll('.filas .fila-pedido')].filter((f) => !f.hidden).map((f) => f.dataset.guia).join(',') === 'pedidos-fila-ma-1046'), 'Mis pedidos: buscar «pantalla» debe dejar solo MA-1046');
  ok((await p.texto('pedidos-conteo')) === '1 de 8', 'Mis pedidos: el conteo debe decir «1 de 8» al filtrar');
  await p.clic('pedidos-fila-ma-1046');
  debe(await p.llegaA('detalle'), 'Mis pedidos: el primer clic en la fila después de escribir en el buscador se perdió');

  // ---- Detalle de un pedido que espera respuesta
  await R('detalle', ['detalle']);
  ok(await p.evaluar(() => {
    const m = [...document.querySelectorAll('[data-guia^="detalle-mensaje-"]')];
    return m.length === 3 && m[2].dataset.pregunta === '1' && document.querySelectorAll('[data-guia^="detalle-evento-"]').length === 3
      && document.querySelector('[data-guia="detalle-estatus"]').dataset.estatus === 'requiere-respuesta';
  }), 'Detalle MA-1046: deben salir 3 mensajes (el último resaltado como pregunta), 3 pasos en la línea de tiempo y el estatus «Requiere tu respuesta»');
  if (capturas) await guardarCaptura(p, '03-detalle.png');
  await p.clic('detalle-enviar');
  debe(await p.llega(() => !document.querySelector('[data-guia="detalle-respuesta-error"]').hidden), 'Detalle: enviar la respuesta vacía debe mostrar el error');
  await R('detalle-errores', ['detalle-errores']);
  await p.clic('detalle-respuesta');
  await p.escribir('Uso un cable HDMI.');
  await p.clic('detalle-enviar');
  debe(await p.llega(() => document.querySelectorAll('[data-guia^="detalle-mensaje-"]').length === 4), 'Detalle: el primer clic en Enviar respuesta después de escribir se perdió');
  await R('detalle-enviado', ['detalle-enviado']);
  ok(await p.evaluar(() => {
    const ultimo = document.querySelector('[data-guia="detalle-mensaje-4"]');
    return ultimo.dataset.autor === 'yo' && ultimo.innerText.includes('Uso un cable HDMI.')
      && document.querySelector('[data-guia="detalle-estatus"]').dataset.estatus === 'en-revision'
      && document.querySelectorAll('[data-guia^="detalle-evento-"]').length === 4
      && !document.querySelector('[data-guia="detalle-aviso"]');
  }), 'Detalle: al responder, tu mensaje sale al final, el estatus pasa a «En revisión», la línea de tiempo suma un paso y el aviso se va');

  // ---- Un pedido cerrado
  await p.clic('detalle-volver');
  debe(await p.llegaA('pedidos'), 'Detalle: volver no llevó a Mis pedidos');
  await p.clic('pedidos-fila-ma-1043');
  debe(await p.llegaA('detalle'), 'Mis pedidos: la fila MA-1043 no abrió el detalle');
  await R('detalle-cerrado', ['detalle-cerrado']);
  ok(!(await p.visible('detalle-respuesta')), 'Detalle de un pedido resuelto: no debe dejar responder');

  // ---- De vuelta al inicio: el aviso se fue y el pedido nuevo está
  await p.clic('menu-inicio');
  debe(await p.llegaA('inicio'), 'Menú: Inicio no abrió el inicio');
  await R('inicio-despues', []);
  ok(!(await p.visible('inicio-aviso')), 'Inicio: después de responder, el aviso debe irse');
  ok(await p.visible('inicio-pedido-ma-1048'), 'Inicio: el pedido nuevo debe salir en recientes');

  // ---- Páginas de aviso
  await p.ir(`${base}/?hoy=${HOY}&sesion=1#/pedidos/ma-9999`);
  debe(await p.llegaA('no-encontrado'), 'Un folio que no existe debe dar «No encontramos esta página»');
  await R('no-encontrado', ['no-encontrado']);
  await p.ir(`${base}/?hoy=2026-02-30`);
  debe(await p.llegaA('error'), '?hoy=2026-02-30 no es fecha: la app debe detenerse y decirlo');
  await R('error-fecha', ['error-fecha']);
}

// ---------------------------------------------------------------- parámetros, determinismo y foco (una vez)
async function revisarParametros(p, base) {
  console.log('\nParámetros de la dirección');
  // Sin reiniciar, lo que hiciste se queda (el recorrido dejó MA-1048 y la sesión)
  await p.ir(`${base}/?hoy=${HOY}`);
  ok(await p.llegaA('inicio'), 'Sin ?reiniciar la sesión debe seguir abierta');
  ok(await p.visible('inicio-pedido-ma-1048'), 'Sin ?reiniciar el pedido que enviaste debe seguir ahí');
  // Con reiniciar, todo vuelve a los datos de ejemplo
  await p.ir(`${base}/?hoy=${HOY}&reiniciar=1`);
  ok(await p.llegaA('entrar'), '?reiniciar=1 debe cerrar la sesión');
  await p.ir(`${base}/?hoy=${HOY}&sesion=1#/pedidos`);
  ok(await p.llegaA('pedidos'), '?sesion=1#/pedidos debe abrir Mis pedidos sin pasar por Entrar');
  ok(await p.evaluar(() => {
    const filas = [...document.querySelectorAll('[data-guia^="pedidos-fila-"]')].map((f) => f.dataset.guia);
    return filas.length === 7 && !filas.includes('pedidos-fila-ma-1048') && document.querySelector('[data-guia="pedidos-estatus-ma-1046"]').dataset.estatus === 'requiere-respuesta';
  }), '?reiniciar=1 debe volver a los 7 pedidos de ejemplo, con MA-1046 esperando respuesta');
  await p.ir(`${base}/?hoy=${HOY}&reiniciar=1&sesion=1#/nuevo`);
  ok(await p.llegaA('nuevo', 1), '?sesion=1#/nuevo debe abrir el paso 1');

  // Misma dirección, misma pantalla (HTML e imagen idénticos)
  for (const q of [`hoy=${HOY}&reiniciar=1`, `hoy=${HOY}&reiniciar=1&sesion=1#/inicio`, `hoy=${HOY}&reiniciar=1&sesion=1#/pedidos/ma-1046`]) {
    const tomas = [];
    for (let i = 0; i < 2; i += 1) {
      await p.ir(`${base}/?${q}`);
      await p.mover(1, p.alto - 1);
      await dormir(200);
      tomas.push({ html: await p.evaluar(() => document.body.outerHTML), imagen: await p.captura() });
    }
    ok(tomas[0].html === tomas[1].html, `Determinismo: ?${q} dio HTML distinto en dos cargas`);
    ok(tomas[0].imagen.equals(tomas[1].imagen), `Determinismo: ?${q} dio una imagen distinta en dos cargas`);
  }

  // Otra fecha: todo se mueve con ella
  for (const otra of ['2026-07-15', '2026-12-30', '2026-09-25']) {
    await p.ir(`${base}/?hoy=${otra}&reiniciar=1&sesion=1#/inicio`);
    ok(await p.llegaA('inicio'), `?hoy=${otra}: debe abrir el inicio`);
    const esperado = nombreDia(otra).replace(/^./, (c) => c.toUpperCase()) + ` de ${otra.slice(0, 4)}`;
    ok((await p.texto('inicio-fecha')) === esperado, `?hoy=${otra}: la fecha debe decir «${esperado}» y dice «${await p.texto('inicio-fecha')}»`);
    await p.clic('inicio-nuevo');
    debe(await p.llegaA('nuevo', 1), `?hoy=${otra}: Nuevo pedido no abrió el formulario`);
    await llenarPaso1(p);
    await revisarReglasCalendario(p, otra, `Calendario (hoy=${otra})`);
  }
  await p.ir(`${base}/?hoy=2026-07-15&reiniciar=1&sesion=1#/pedidos`);
  ok((await p.texto('pedidos-fila-ma-1047')).includes('14 jul'), '?hoy=2026-07-15: los datos de ejemplo deben fecharse desde ese día (MA-1047 creado el 14 jul)');

  // Sin ?hoy, la fecha es la de la computadora
  const d = new Date();
  const real = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await p.ir(`${base}/?reiniciar=1&sesion=1`);
  const esperadoReal = nombreDia(real).replace(/^./, (c) => c.toUpperCase()) + ` de ${real.slice(0, 4)}`;
  ok((await p.texto('inicio-fecha')) === esperadoReal, `Sin ?hoy la fecha debe ser la de hoy («${esperadoReal}») y dice «${await p.texto('inicio-fecha')}»`);
}

async function revisarFoco(p, base) {
  console.log('\nFoco visible con el teclado');
  const casos = [
    ['Entrar', `hoy=${HOY}&reiniciar=1`, 4],
    ['Inicio', `hoy=${HOY}&reiniciar=1&sesion=1#/inicio`, 12],
    ['Paso 1', `hoy=${HOY}&reiniciar=1&sesion=1#/nuevo`, 10],
    ['Mis pedidos', `hoy=${HOY}&reiniciar=1&sesion=1#/pedidos`, 14],
    ['Detalle', `hoy=${HOY}&reiniciar=1&sesion=1#/pedidos/ma-1046`, 8],
  ];
  for (const [nombre, q, veces] of casos) {
    await p.ir(`${base}/?${q}`);
    let revisados = 0;
    for (let i = 0; i < veces; i += 1) {
      await p.tecla('Tab');
      const f = await p.evaluar(medirFoco);
      if (!f) continue;
      revisados += 1;
      ok(f.visible, `${nombre}: con el teclado no se ve el foco en «${f.quien}»`);
    }
    ok(revisados > 0, `${nombre}: Tab no llevó el foco a ningún lado`);
  }
  // En el calendario, el día que recibe el foco lleva su anillo
  await p.ir(`${base}/?hoy=${HOY}&reiniciar=1&sesion=1#/nuevo`);
  await llenarPaso1(p);
  let dia = null;
  for (let i = 0; i < 6 && !dia; i += 1) {
    await p.tecla('Tab');
    dia = await p.evaluar(() => (document.activeElement.classList.contains('dia') ? document.activeElement.dataset.fecha : null));
  }
  ok(dia === '2026-03-05', `Calendario: con Tab el foco debe llegar al primer día posible (llegó a ${dia})`);
  const f = await p.evaluar(medirFoco);
  ok(f && f.visible, 'Calendario: con el teclado no se ve el foco en el día');
}

/** Un revisor que nunca encuentra nada se ve igual de bien que uno roto: se prueba sembrando fallas. */
async function controlesPositivos(p, base) {
  console.log('\nControles (el revisor sí detecta lo que busca)');
  if (PROHIBIDAS.re) {
    for (const palabra of PROHIBIDAS.palabras) {
      const base2 = normalizar(String(palabra).replace(/\*$/, ''));
      ok(PROHIBIDAS.re.test(normalizar(`Equipo de ${base2.toUpperCase()}`)), `Control: el vigilante no detecta «${palabra}»`);
    }
    ok(!PROHIBIDAS.re.test('ventanas, eventos y prevendedores'), 'Control: el vigilante detecta palabras que solo se parecen');
  }
  await p.ir(`${base}/?hoy=${HOY}&reiniciar=1&sesion=1#/inicio`);
  await p.evaluar(() => {
    const extra = document.createElement('p');
    extra.dataset.guia = 'control-sin-mapa';
    extra.style.color = '#c9ced6';
    extra.textContent = 'Texto sembrado para el control';
    document.querySelector('main').append(extra);
  });
  const e = await p.evaluar(leerEstado);
  ok(e.guias.some((g) => g.id === 'control-sin-mapa') && !DOCUMENTADOS.some((d) => (d.re ? d.re.test('control-sin-mapa') : d.id === 'control-sin-mapa')), 'Control: el revisor no ve un data-guia sembrado fuera del mapa');
  const m = await p.evaluar(medirPagina);
  ok(m.contraste.some((c) => c.texto.startsWith('Texto sembrado')), 'Control: la medida de contraste no detecta un texto gris claro sembrado');
}

// ---------------------------------------------------------------- principal
async function principal() {
  const inicio = Date.now();
  let servidor = null;
  let chrome = null;
  let cdp = null;
  try {
    const rutaChrome = buscarChrome();
    if (!rutaChrome) throw new Error('No encontré Chrome. Instálalo, o dime dónde está con --chrome "<ruta>" o la variable CHROME.');
    let base = OPCIONES.url;
    if (!base) {
      servidor = await arrancarServidor();
      base = servidor.url;
    }
    console.log(`App: ${base}`);
    console.log(`Mapa: ${MAPA.size} pantallas, ${DOCUMENTADOS.length} data-guia`);
    console.log(`Palabras prohibidas (de ../proyecto.json): ${PROHIBIDAS.palabras.length ? PROHIBIDAS.palabras.join(', ') : 'ninguna'}`);
    chrome = await abrirChrome(rutaChrome);
    cdp = await Cdp.conectar(chrome.ws);
    const { targetInfos } = await cdp.enviar('Target.getTargets');
    const pagina = targetInfos.find((t) => t.type === 'page');
    const { targetId } = pagina || await cdp.enviar('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
    const p = new Pagina(cdp, sessionId);
    await p.enviar('Page.enable');
    await p.enviar('Emulation.setFocusEmulationEnabled', { enabled: true });

    const tamanos = OPCIONES.soloMapa ? [TAMANOS[0]] : TAMANOS;
    for (const [ancho, alto] of tamanos) {
      console.log(`\nRecorrido completo en ${ancho}x${alto}`);
      await p.tamano(ancho, alto);
      try {
        await recorrido(p, base, { capturas: OPCIONES.capturas && ancho === 1600, soloMapa: OPCIONES.soloMapa });
      } catch (error) {
        if (!(error instanceof Detener)) throw error;
        ok(false, `el recorrido en ${ancho}x${alto} se detuvo: ${error.message}`);
      }
    }
    await p.tamano(...TAMANOS[0]);
    if (!OPCIONES.soloMapa) {
      try {
        await revisarParametros(p, base);
        await revisarFoco(p, base);
        await controlesPositivos(p, base);
      } catch (error) {
        if (!(error instanceof Detener)) throw error;
        ok(false, `la revisión se detuvo: ${error.message}`);
      }
    }
    const sinVisitar = [...MAPA.keys()].filter((k) => !SECCIONES_VISTAS.has(k));
    ok(sinVisitar.length === 0, `MAPA.md tiene secciones que el recorrido no visitó: ${sinVisitar.join(', ')}`);
  } catch (error) {
    fallas.push(error.message);
    console.log(`\nERROR: ${error.message}`);
  } finally {
    if (chrome) await cerrarChrome(chrome, cdp);
    if (servidor) {
      servidor.hijo.kill();
      await esperarSalida(servidor.hijo, 3000);
    }
  }
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  if (fallas.length) {
    console.log(`\nFALLA: ${fallas.length} de ${revisiones} revisiones no pasaron (${segundos} s).`);
    process.exitCode = 1;
  } else {
    console.log(`\nTodo bien: ${revisiones} revisiones en ${segundos} s.`);
  }
}

await principal();
