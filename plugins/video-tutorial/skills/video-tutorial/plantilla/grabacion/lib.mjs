// Biblioteca del grabador: abre el Chrome instalado en la máquina con Playwright y graba la página cuadro por cuadro
// (screencast de Chrome), con la hora de cada cuadro. No sabe nada de ninguna app: la dirección sale de proyecto.json.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // carpeta del proyecto
export const PROYECTO = JSON.parse(fs.readFileSync(path.join(RAIZ, 'proyecto.json'), 'utf8'));
export const VP = { width: 1366, height: 768 };   // tamaño de la ventana grabada, en píxeles CSS (el de una laptop común)
export const DPR = 1.5;                            // densidad: la grabación sale a 2050 x 1152, nítida aunque la cámara se acerque
export const FPS = PROYECTO.video?.fps || 30;
export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Idioma de la página: el de la voz si es español (es-ES, es-AR...), si no es-MX. */
function idioma() {
  const m = String(PROYECTO.voz?.id || '').match(/^(es-[A-Z]{2})-/);
  return m ? m[1] : 'es-MX';
}

/** Abre Chrome sin ventana: el de la variable CHROME si existe, si no el Chrome instalado y, si no hay, Edge. Lo usan grabar y medir. */
export async function lanzarChrome(args = []) {
  const intentos = [];
  if (process.env.CHROME) intentos.push({ executablePath: process.env.CHROME });
  intentos.push({ channel: 'chrome' }, { channel: 'msedge' });
  let ultimo = null;
  for (const o of intentos) {
    try { return await chromium.launch({ ...o, headless: true, args }); } catch (e) { ultimo = e; }
  }
  throw new Error('No pude abrir Chrome. Instala Google Chrome o apunta la variable CHROME a su ejecutable. Detalle: ' + String(ultimo?.message || ultimo).split('\n')[0]);
}

/** Abre Chrome (sin ventana) con el tamaño de la grabación. `sesion` = archivo de sesión de otro capítulo (cookies y almacenamiento). */
export async function abrir({ sesion = null } = {}) {
  // --force-device-scale-factor: sin él, Chrome sin ventana manda los cuadros del screencast a 1366 x 768 aunque la página tenga
  //   densidad 1.5, y el video sale estirado (medido: 1366 x 768 sin él, 2049 x 1152 con él).
  // --disable-lcd-text: el suavizado de subpíxel pinta bordes de color en las letras que se notan al escalar la grabación
  //   (medido en texto oscuro sobre blanco: 32% de los píxeles de letra con color; con la opción, 0%).
  const browser = await lanzarChrome([`--force-device-scale-factor=${DPR}`, '--disable-lcd-text', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-features=Translate,MediaRouter', '--no-first-run', '--no-default-browser-check']);
  const ctx = await browser.newContext({
    viewport: VP, deviceScaleFactor: DPR, locale: idioma(), colorScheme: 'light',
    storageState: sesion || undefined,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  error de la página:', e.message.split('\n')[0]));
  return { browser, ctx, page };
}

/** Ancho y alto de un JPEG (del marcador SOF), sin decodificarlo. */
export function medidaJpeg(b) {
  for (let i = 2; i < b.length - 9; i++) if (b[i] === 0xFF && b[i + 1] >= 0xC0 && b[i + 1] <= 0xC3) return { ancho: b.readUInt16BE(i + 7), alto: b.readUInt16BE(i + 5) };
  return null;
}

/** Graba una escena: cuadros JPEG por screencast, cada uno con su segundo. */
export class Grabadora {
  constructor(page, ctx, dir) { this.page = page; this.ctx = ctx; this.dir = dir; this.frames = []; this.n = 0; this.inicio = null; }
  async iniciar() {
    fs.rmSync(this.dir, { recursive: true, force: true }); fs.mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.ctx.newCDPSession(this.page);
    this.pend = [];
    this.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const ahora = Date.now();
      // el segundo del cuadro: el de Chrome si es creíble (llega unos ms antes que el aviso), si no, el de llegada
      const ts = metadata && metadata.timestamp ? metadata.timestamp * 1000 : null;
      const t = ts && Math.abs(ts - ahora) < 1500 ? ts : ahora;
      const i = this.n++;
      const f = path.join(this.dir, String(i).padStart(6, '0') + '.jpg');
      const buf = Buffer.from(data, 'base64');
      if (i === 0) this.medida = medidaJpeg(buf);
      this.pend.push(fs.promises.writeFile(f, buf));
      this.frames.push({ f, ms: t });
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: Math.round(VP.width * DPR), maxHeight: Math.round(VP.height * DPR), everyNthFrame: 1 });
    for (let k = 0; k < 100 && this.n === 0; k++) await sleep(20);   // espera el primer cuadro
    // Falla ruidoso: si Chrome manda cuadros más chicos que la densidad pedida, el video saldría estirado y borroso al acercarse.
    const esperado = Math.round(VP.width * DPR);
    if (this.medida && this.medida.ancho < esperado - 2) throw new Error(`Chrome manda cuadros de ${this.medida.ancho} x ${this.medida.alto} y se esperaban ${esperado} x ${Math.round(VP.height * DPR)}: el video saldría estirado. Revisa que grabacion/lib.mjs abra Chrome con --force-device-scale-factor.`);
    this.inicio = Date.now();          // el segundo cero es este, no el del primer cuadro
  }
  /** Segundos desde que empezó la escena. */
  ahora() { return (Date.now() - this.inicio) / 1000; }
  /** Deja de grabar. `hasta`: el segundo donde termina el video (el final del capítulo); sin él, ahora. */
  async detener(hasta = null) {
    this.fin = hasta ?? this.ahora();
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await Promise.all(this.pend);
    return this.fin;
  }
  /** Arma un MP4 a FPS constantes: cada cuadro se sostiene hasta el siguiente. Después borra los cuadros. */
  aVideo(salida, { crf = 16 } = {}) {
    // los cuadros que llegaron después del final no entran (el primero siempre: cubre desde el segundo 0)
    const fr = this.frames.map(x => ({ f: x.f, t: Math.max(0, (x.ms - this.inicio) / 1000) })).filter((x, i) => i === 0 || x.t < this.fin);
    if (!fr.length) throw new Error('La grabación no tiene cuadros: Chrome no mandó imagen.');
    fr[0].t = 0;   // el primer cuadro (anterior al cero) cubre desde el inicio
    const lineas = [];
    for (let i = 0; i < fr.length; i++) {
      const sig = i + 1 < fr.length ? fr[i + 1].t : this.fin;
      lineas.push(`file '${fr[i].f.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`, `duration ${Math.max(0.001, sig - fr[i].t).toFixed(4)}`);
    }
    lineas.push(`file '${fr.at(-1).f.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`);
    const lista = path.join(this.dir, 'lista.txt');
    fs.writeFileSync(lista, lineas.join('\n'));
    const w = Math.round(VP.width * DPR / 2) * 2, h = Math.round(VP.height * DPR / 2) * 2;
    // un cuadro clave por segundo (-g): HyperFrames busca cuadros sueltos en el video y, con cuadros clave cada 6 u 8 s (lo que
    // deja x264 por omisión en una pantalla que casi no cambia), avisa que la imagen se puede congelar
    const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista,
      '-vf', `fps=${FPS},scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-t', this.fin.toFixed(3),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-g', String(FPS), '-keyint_min', String(FPS), '-movflags', '+faststart', salida], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('FFmpeg no pudo armar el video: ' + (r.stderr || '').slice(-800));
    const cuadros = fr.length;
    fs.rmSync(this.dir, { recursive: true, force: true });   // los cuadros sueltos pesan mucho: ya están en el MP4
    return { cuadros, duracion: +this.fin.toFixed(3), fpsReal: +(cuadros / this.fin).toFixed(1), ancho: w, alto: h, cuadroOriginal: this.medida };
  }
}
