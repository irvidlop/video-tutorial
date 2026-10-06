#!/usr/bin/env node
// Servidor de la Mesa de ayuda de ejemplo (skill video-tutorial).
//
// Sirve solo los tres archivos de la app (index.html, app.js y estilos.css)
// y solo en 127.0.0.1: nadie más en la red la ve. Cualquier otra ruta da 404,
// así que no expone ningún otro archivo de la carpeta ni de la computadora.
// No necesita instalar nada: solo Node.
//
// Uso:      node servidor.mjs --puerto 8810
// Cerrarlo: Ctrl+C

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CARPETA = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const PUERTO_POR_OMISION = 8810;

// Lo único que se sirve. Se lee del disco en cada pedido: si cambias un archivo, basta recargar.
const PUBLICOS = new Map([
  ['/', { archivo: 'index.html', tipo: 'text/html; charset=utf-8' }],
  ['/index.html', { archivo: 'index.html', tipo: 'text/html; charset=utf-8' }],
  ['/app.js', { archivo: 'app.js', tipo: 'text/javascript; charset=utf-8' }],
  ['/estilos.css', { archivo: 'estilos.css', tipo: 'text/css; charset=utf-8' }],
]);

function fallar(mensaje) {
  console.error(`Error: ${mensaje}`);
  process.exit(1);
}

function ayuda() {
  console.log([
    'Mesa de ayuda de ejemplo',
    '',
    'Uso:  node servidor.mjs --puerto 8810',
    '',
    'Opciones:',
    `  --puerto N   puerto donde escucha (si no lo pones: ${PUERTO_POR_OMISION})`,
    '  --ayuda      muestra esta ayuda',
    '',
    'Después abre http://127.0.0.1:8810/?hoy=2026-03-02&reiniciar=1',
  ].join('\n'));
}

function leerOpciones(argumentos) {
  let puerto = String(PUERTO_POR_OMISION);
  for (let i = 0; i < argumentos.length; i += 1) {
    const a = argumentos[i];
    if (a === '--ayuda' || a === '--help' || a === '-h') {
      ayuda();
      process.exit(0);
    } else if (a === '--puerto') {
      puerto = argumentos[i + 1];
      i += 1;
    } else if (a.startsWith('--puerto=')) {
      puerto = a.slice('--puerto='.length);
    } else {
      fallar(`no conozco la opción «${a}». Usa --puerto N (o --ayuda).`);
    }
  }
  const numero = Number(puerto);
  if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
    fallar(`el puerto «${puerto ?? ''}» no sirve: usa un número entre 1 y 65535.`);
  }
  return { puerto: numero };
}

const { puerto } = leerOpciones(process.argv.slice(2));
// Solo se contesta a quien pide la app por su nombre local (evita que otra página la lea con trucos de DNS).
const hostsPermitidos = new Set([`${HOST}:${puerto}`, `localhost:${puerto}`]);

const servidor = http.createServer(async (pedido, respuesta) => {
  const cabeceras = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  const texto = (codigo, mensaje, extra = {}) => {
    respuesta.writeHead(codigo, { ...cabeceras, ...extra, 'Content-Type': 'text/plain; charset=utf-8' });
    respuesta.end(pedido.method === 'HEAD' ? undefined : mensaje);
  };

  if (!hostsPermitidos.has(String(pedido.headers.host || '').toLowerCase())) {
    texto(421, 'Esta app solo responde en 127.0.0.1.');
    return;
  }
  if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
    texto(405, 'Método no permitido.', { Allow: 'GET, HEAD' });
    return;
  }

  let ruta = '';
  try {
    ruta = new URL(pedido.url, `http://${HOST}`).pathname;
  } catch {
    ruta = '';
  }
  const publico = PUBLICOS.get(ruta);
  if (!publico) {
    texto(404, 'No encontrado.');
    return;
  }

  try {
    const contenido = await readFile(path.join(CARPETA, publico.archivo));
    respuesta.writeHead(200, { ...cabeceras, 'Content-Type': publico.tipo, 'Content-Length': contenido.length });
    respuesta.end(pedido.method === 'HEAD' ? undefined : contenido);
  } catch (error) {
    console.error(`No pude leer ${publico.archivo}: ${error.message}`);
    texto(500, 'No pude leer el archivo.');
  }
});

servidor.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    fallar(`el puerto ${puerto} ya está ocupado. Cierra lo que lo usa o arranca con otro: --puerto ${puerto === 65535 ? puerto - 1 : puerto + 1}`);
  }
  fallar(`no pude arrancar el servidor: ${error.message}`);
});

servidor.listen(puerto, HOST, () => {
  console.log(`Mesa de ayuda lista en http://${HOST}:${puerto}/`);
  console.log('Para cerrarla pulsa Ctrl+C.');
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.close();
    process.exit(0);
  });
}
