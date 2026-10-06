/*
  Mesa de ayuda: app de ejemplo de la skill video-tutorial.

  Todo vive en este navegador (localStorage). No hay base de datos ni
  nada que salga a internet. Los datos y las personas son inventados.

  Parámetros de la dirección:
    ?hoy=AAAA-MM-DD   congela la fecha de hoy (y el reloj en las 10:00).
    ?reiniciar=1      vuelve a los datos de ejemplo y cierra la sesión.
    ?sesion=1         entra directo como Ana Ejemplo.
  Rutas: #/entrar  #/inicio  #/nuevo  #/listo/<folio>  #/pedidos  #/pedidos/<folio>
  La lista de data-guia (lo que un video puede señalar) está en MAPA.md.

  Regla de la casa: ninguna pantalla se repinta al soltar el foco de un
  campo. Lo que escribes se guarda tecla por tecla y la pantalla solo cambia
  con un clic o al enviar un formulario. Así el primer clic después de
  escribir nunca se pierde.
*/
'use strict';

(function () {
  // ===================================================================
  // Utilidades
  // ===================================================================
  const $ = (selector, raiz = document) => raiz.querySelector(selector);
  const $$ = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));
  const guia = (id) => document.querySelector(`[data-guia="${id}"]`);
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => ESCAPES[c]);
  const dos = (n) => String(n).padStart(2, '0');
  const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
  const normalizar = (texto) => String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ===================================================================
  // Fechas. Siempre como texto 'AAAA-MM-DD' y con cuentas en UTC: así
  // no importan el huso horario ni el horario de verano de la máquina.
  // ===================================================================
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIA_MS = 86400000;

  function fechaValida(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto).trim());
    if (!m) return null;
    const anio = Number(m[1]);
    const mes = Number(m[2]);
    const dia = Number(m[3]);
    const f = new Date(Date.UTC(anio, mes - 1, dia));
    if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  function hoyDelReloj() {
    const d = new Date();
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  }

  const anioDe = (iso) => Number(iso.slice(0, 4));
  const mesDe = (iso) => Number(iso.slice(5, 7));
  const diaDe = (iso) => Number(iso.slice(8, 10));
  const numeroDeDia = (iso) => Date.UTC(anioDe(iso), mesDe(iso) - 1, diaDe(iso)) / DIA_MS;

  function deNumero(n) {
    const f = new Date(n * DIA_MS);
    return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
  }

  const sumarDias = (iso, n) => deNumero(numeroDeDia(iso) + n);
  const diaSemana = (iso) => new Date(numeroDeDia(iso) * DIA_MS).getUTCDay();
  const esFinDeSemana = (iso) => diaSemana(iso) === 0 || diaSemana(iso) === 6;

  /** Cuenta días hábiles (de lunes a viernes): n > 0 hacia adelante, n < 0 hacia atrás. */
  function moverHabiles(iso, n) {
    const paso = n < 0 ? -1 : 1;
    let fecha = iso;
    let falta = Math.abs(n);
    while (falta > 0) {
      fecha = sumarDias(fecha, paso);
      if (!esFinDeSemana(fecha)) falta -= 1;
    }
    return fecha;
  }

  /** Meses como 'AAAA-MM'. */
  function sumarMeses(mes, n) {
    const total = anioDe(mes) * 12 + (mesDe(mes) - 1) + n;
    return `${Math.floor(total / 12)}-${dos((total % 12) + 1)}`;
  }

  const diasDelMes = (mes) => new Date(Date.UTC(anioDe(mes), mesDe(mes), 0)).getUTCDate();
  const nombreMes = (mes) => `${mayuscula(MESES[mesDe(mes) - 1])} de ${anioDe(mes)}`;

  function fechaLarga(iso, conAnio = false) {
    const texto = `${DIAS[diaSemana(iso)]} ${diaDe(iso)} de ${MESES[mesDe(iso) - 1]}`;
    return conAnio ? `${texto} de ${anioDe(iso)}` : texto;
  }

  function fechaCorta(iso) {
    const texto = `${diaDe(iso)} ${MESES_CORTOS[mesDe(iso) - 1]}`;
    return anioDe(iso) === anioDe(HOY) ? texto : `${texto} ${anioDe(iso)}`;
  }

  function cuando(iso, hora) {
    if (iso === HOY) return `hoy, ${hora}`;
    if (iso === sumarDias(HOY, -1)) return `ayer, ${hora}`;
    return `${fechaCorta(iso)}, ${hora}`;
  }

  // ===================================================================
  // Parámetros de la dirección
  // ===================================================================
  const parametros = new URLSearchParams(window.location.search);
  const activado = (nombre) => {
    const valor = parametros.get(nombre);
    return valor !== null && !/^(0|no|false)$/i.test(valor.trim());
  };
  const HOY_TEXTO = parametros.get('hoy');
  const FECHA_FIJA = HOY_TEXTO !== null;
  const HOY = FECHA_FIJA ? fechaValida(HOY_TEXTO) : hoyDelReloj();

  // ===================================================================
  // Catálogos
  // ===================================================================
  const CATEGORIAS = [
    { id: 'equipo', nombre: 'Equipo de cómputo', ayuda: 'Computadora y monitor', icono: 'laptop' },
    { id: 'accesos', nombre: 'Accesos y contraseñas', ayuda: 'Cuentas, permisos, correo', icono: 'llave' },
    { id: 'programas', nombre: 'Programas', ayuda: 'Instalar o actualizar', icono: 'programas' },
    { id: 'impresoras', nombre: 'Impresoras', ayuda: 'Imprimir y escanear', icono: 'impresora' },
    { id: 'red', nombre: 'Internet y red', ayuda: 'Conexión, wifi, VPN', icono: 'wifi' },
    { id: 'otro', nombre: 'Otro', ayuda: 'Algo que no está aquí', icono: 'puntos' },
  ];

  const PRIORIDADES = [
    { id: 'baja', nombre: 'Baja', ayuda: 'Baja: puede esperar unos días.' },
    { id: 'normal', nombre: 'Normal', ayuda: 'Normal: lo necesitas esta semana.' },
    { id: 'alta', nombre: 'Alta', ayuda: 'Alta: algo te impide trabajar.' },
  ];

  const ESTATUS = {
    'recibido': { nombre: 'Recibido', icono: 'bandeja', explica: 'Ya llegó. Pronto alguien lo toma.' },
    'en-revision': { nombre: 'En revisión', icono: 'lupa', explica: 'Alguien de soporte lo está revisando.' },
    'requiere-respuesta': { nombre: 'Requiere tu respuesta', icono: 'alerta', explica: 'Te hicimos una pregunta. Sin tu respuesta no avanza.' },
    'en-proceso': { nombre: 'En proceso', icono: 'giro', explica: 'Ya estamos trabajando en él.' },
    'resuelto': { nombre: 'Resuelto', icono: 'check', explica: 'Quedó listo. Si vuelve a fallar, haz un pedido nuevo.' },
    'cancelado': { nombre: 'Cancelado', icono: 'x', explica: 'Se canceló y ya no sigue.' },
  };
  const ABIERTOS = new Set(['recibido', 'en-revision', 'requiere-respuesta', 'en-proceso']);

  const ARCHIVOS = [
    { nombre: 'foto-de-la-impresora.jpg', peso: '1.2 MB', icono: 'imagen' },
    { nombre: 'captura-de-pantalla.png', peso: '240 KB', icono: 'imagen' },
    { nombre: 'hoja-de-prueba.pdf', peso: '88 KB', icono: 'archivo' },
  ];

  const PERSONA = { nombre: 'Ana Ejemplo', correo: 'ana@ejemplo.com' };
  const AUTORES = {
    luis: { nombre: 'Luis Muestra', iniciales: 'LM', equipo: 'Soporte' },
    sofia: { nombre: 'Sofía Prueba', iniciales: 'SP', equipo: 'Soporte' },
    sistema: { nombre: 'Mesa de ayuda', iniciales: '', equipo: 'Aviso automático' },
  };

  const categoria = (id) => CATEGORIAS.find((c) => c.id === id) || { nombre: 'Sin categoría' };
  const prioridad = (id) => PRIORIDADES.find((p) => p.id === id) || { nombre: 'Sin prioridad' };

  // ===================================================================
  // Íconos (trazos propios, sin librerías)
  // ===================================================================
  const ICONOS = {
    logo: '<path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-7.5L7 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z"/><path d="m8.5 10.4 2.2 2.2 4.8-4.8"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    bandeja: '<path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/><path d="M6 5h12l2.5 8.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-4.5z"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
    alerta: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13"/><path d="M12 16.5v.01"/>',
    giro: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4.5V9h-4.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.75v.01"/>',
    clip: '<path d="m19.5 11.5-7.4 7.4a5 5 0 0 1-7.1-7.1l7.9-7.9a3.3 3.3 0 1 1 4.7 4.7l-7.9 7.9a1.7 1.7 0 0 1-2.4-2.4l7.2-7.2"/>',
    archivo: '<path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5z"/><path d="M14 3.5v4h4"/>',
    imagen: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.75"/><path d="m20.5 15.5-4.5-4.5-9 8.5"/>',
    izquierda: '<path d="m14.5 6-6 6 6 6"/>',
    derecha: '<path d="m9.5 6 6 6-6 6"/>',
    salir: '<path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
    enviar: '<path d="M20.5 3.5 10 14"/><path d="m20.5 3.5-6.5 17-4-6.5-6.5-4z"/>',
    laptop: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M2.5 19h19"/>',
    llave: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16.5 6.5 19 9M14 9l2 2"/>',
    programas: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17M7 6.75h.01M10 6.75h.01"/>',
    impresora: '<path d="M7 9V4h10v5"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.5"/><path d="M7 14h10v6H7z"/>',
    wifi: '<path d="M2.5 9.5a14 14 0 0 1 19 0"/><path d="M5.5 13a9.5 9.5 0 0 1 13 0"/><path d="M8.7 16.3a4.8 4.8 0 0 1 6.6 0"/><path d="M12 19.5v.01"/>',
    puntos: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
  };

  const icono = (nombre) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONOS[nombre] || ''}</svg>`;
  const logo = () => `<span class="marca-logo" aria-hidden="true">${icono('logo')}</span>`;

  // ===================================================================
  // Datos de ejemplo. Las fechas se cuentan desde «hoy», así que con el
  // mismo ?hoy= siempre salen iguales.
  // ===================================================================
  const VERSION_DATOS = 1;
  const PRIMER_FOLIO_NUEVO = 1048;

  function datosDeEjemplo() {
    const atras = (n) => moverHabiles(HOY, -n);
    const evento = (estatus, fecha, hora, nota) => ({ estatus, fecha, hora, nota });
    const mensaje = (autor, fecha, hora, texto, adjuntos = []) => ({ autor, fecha, hora, texto, adjuntos });
    const pedido = (folio, titulo, cat, prio, creado, hora, plazo, estatus, eventos, mensajes) => ({
      folio, titulo, categoria: cat, prioridad: prio, creado, hora, deseada: moverHabiles(creado, plazo), estatus, eventos, mensajes,
    });
    const RECIBIDO = 'Recibimos tu pedido. Lo revisamos en menos de un día hábil.';
    const d1 = atras(1);
    const d2 = atras(2);
    const d3 = atras(3);
    const d4 = atras(4);
    const d6 = atras(6);
    const d7 = atras(7);
    const d8 = atras(8);
    const d10 = atras(10);
    const d11 = atras(11);
    const d14 = atras(14);

    return {
      version: VERSION_DATOS,
      siguiente: PRIMER_FOLIO_NUEVO,
      reloj: 0,
      pedidos: [
        pedido('MA-1047', 'El internet se corta en la sala de juntas', 'red', 'normal', d1, '16:40', 3, 'recibido',
          [evento('recibido', d1, '16:40', 'Recibimos tu pedido.')],
          [mensaje('yo', d1, '16:40', 'En la sala de juntas del tercer piso el internet se corta cada diez minutos, más o menos.'),
            mensaje('sistema', d1, '16:41', RECIBIDO)]),
        pedido('MA-1046', 'La pantalla parpadea con el monitor externo', 'equipo', 'normal', d2, '09:14', 3, 'requiere-respuesta',
          [evento('recibido', d2, '09:14', 'Recibimos tu pedido.'),
            evento('en-revision', d2, '11:30', 'Luis Muestra tomó tu pedido.'),
            evento('requiere-respuesta', d1, '10:05', 'Luis Muestra te hizo una pregunta.')],
          [mensaje('yo', d2, '09:14', 'Cuando conecto el monitor externo, la pantalla parpadea y a veces se apaga unos segundos.', ['foto-del-monitor.jpg']),
            mensaje('luis', d2, '11:32', 'Hola, Ana. Soy Luis, de soporte. Ya estoy revisando tu caso.'),
            mensaje('luis', d1, '10:05', '¿Con qué cable conectas el monitor: HDMI o USB-C? Así sé qué adaptador llevarte.')]),
        pedido('MA-1045', 'Acceso a la carpeta compartida de Proyectos', 'accesos', 'alta', d3, '12:20', 3, 'en-proceso',
          [evento('recibido', d3, '12:20', 'Recibimos tu pedido.'),
            evento('en-revision', d3, '13:05', 'Sofía Prueba tomó tu pedido.'),
            evento('en-proceso', d2, '09:40', 'Sofía Prueba está dando el permiso.')],
          [mensaje('yo', d3, '12:20', 'Necesito entrar a la carpeta compartida de Proyectos para revisar los planos del mes.'),
            mensaje('sofia', d2, '09:41', 'Hola, Ana. Ya pedí el permiso. Te aviso en cuanto quede.')]),
        pedido('MA-1044', 'Instalar un lector de PDF', 'programas', 'baja', d4, '17:05', 5, 'en-revision',
          [evento('recibido', d4, '17:05', 'Recibimos tu pedido.'),
            evento('en-revision', d3, '09:10', 'Luis Muestra tomó tu pedido.')],
          [mensaje('yo', d4, '17:05', 'Necesito un programa para abrir y firmar archivos PDF.'),
            mensaje('sistema', d4, '17:06', RECIBIDO)]),
        pedido('MA-1043', 'La impresora no imprime a doble cara', 'impresoras', 'normal', d8, '10:30', 3, 'resuelto',
          [evento('recibido', d8, '10:30', 'Recibimos tu pedido.'),
            evento('en-revision', d8, '12:00', 'Luis Muestra tomó tu pedido.'),
            evento('en-proceso', d7, '09:15', 'Luis Muestra fue a revisar la impresora.'),
            evento('resuelto', d6, '13:15', 'Se ajustó la configuración de la impresora.')],
          [mensaje('yo', d8, '10:30', 'La impresora del segundo piso ya no imprime por los dos lados de la hoja.'),
            mensaje('luis', d6, '13:16', 'Listo, Ana. Ya imprime por los dos lados. Si vuelve a fallar, escríbeme aquí.')]),
        pedido('MA-1042', 'Pasar mis archivos a la laptop nueva', 'equipo', 'normal', d11, '09:00', 3, 'cancelado',
          [evento('recibido', d11, '09:00', 'Recibimos tu pedido.'),
            evento('cancelado', d10, '15:20', 'Cancelaste el pedido: ya no hacía falta.')],
          [mensaje('yo', d11, '09:00', 'Me llega una laptop nueva y necesito pasar mis archivos.'),
            mensaje('yo', d10, '15:19', 'Ya lo resolví, gracias. Lo pueden cancelar.')]),
        pedido('MA-1041', 'Recuperar el acceso a mi correo', 'accesos', 'alta', d14, '08:45', 3, 'resuelto',
          [evento('recibido', d14, '08:45', 'Recibimos tu pedido.'),
            evento('en-revision', d14, '09:02', 'Sofía Prueba tomó tu pedido.'),
            evento('resuelto', d14, '11:10', 'Ya puedes entrar a tu correo.')],
          [mensaje('yo', d14, '08:45', 'Olvidé la contraseña de mi correo y no puedo entrar.'),
            mensaje('sofia', d14, '11:10', 'Te mandé un enlace para crear una contraseña nueva. Ya puedes entrar.')]),
      ],
    };
  }

  // ===================================================================
  // Almacén (localStorage, o memoria si el navegador no deja guardar)
  // ===================================================================
  const CLAVE_DATOS = 'mesa-de-ayuda.datos';
  const CLAVE_SESION = 'mesa-de-ayuda.sesion';

  function abrirAlmacen() {
    try {
      const prueba = 'mesa-de-ayuda.prueba';
      window.localStorage.setItem(prueba, '1');
      window.localStorage.removeItem(prueba);
      return window.localStorage;
    } catch (e) {
      console.warn('Mesa de ayuda: este navegador no deja guardar datos; se guardan solo mientras la pestaña siga abierta.');
      const memoria = new Map();
      return {
        getItem: (clave) => (memoria.has(clave) ? memoria.get(clave) : null),
        setItem: (clave, valor) => { memoria.set(clave, String(valor)); },
        removeItem: (clave) => { memoria.delete(clave); },
      };
    }
  }

  const almacen = abrirAlmacen();

  function leerJson(clave) {
    try {
      const texto = almacen.getItem(clave);
      return texto ? JSON.parse(texto) : null;
    } catch (e) {
      return null;
    }
  }

  const guardarJson = (clave, valor) => almacen.setItem(clave, JSON.stringify(valor));

  // ===================================================================
  // Estado
  // ===================================================================
  let datos = null;
  let sesion = null;
  let borrador = null;            // el pedido que se está llenando
  let respuestaEnviada = null;    // folio al que acabas de responder (para el aviso de «enviada»)
  let pantallaAnterior = null;

  const guardarDatos = () => guardarJson(CLAVE_DATOS, datos);
  const buscarPedido = (folio) => datos.pedidos.find((p) => p.folio.toLowerCase() === String(folio).toLowerCase()) || null;

  /** Hora de lo que se crea ahora. Con ?hoy el reloj empieza en 10:00 y avanza unos minutos con cada cosa que haces: así se repite igual. */
  function horaDeAhora(minutos) {
    if (!FECHA_FIJA) {
      const d = new Date();
      return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
    }
    datos.reloj = (datos.reloj || 0) + minutos;
    const total = 10 * 60 + datos.reloj;
    return `${dos(Math.floor(total / 60) % 24)}:${dos(total % 60)}`;
  }

  function sesionPara(correo) {
    const limpio = correo.trim().toLowerCase();
    if (limpio === PERSONA.correo) return { nombre: PERSONA.nombre, correo: PERSONA.correo };
    const nombre = limpio.split('@')[0].split(/[._-]+/).filter(Boolean).map(mayuscula).join(' ');
    return { nombre: nombre || 'Persona invitada', correo: limpio };
  }

  const iniciales = (nombre) => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
  const primerNombre = (nombre) => nombre.split(/\s+/)[0];

  // ===================================================================
  // Mensajes de error junto a los campos
  // ===================================================================
  function mostrarError(idError, texto, campo) {
    const el = document.getElementById(idError);
    if (!el) return;
    el.innerHTML = `${icono('alerta')}<span>${esc(texto)}</span>`;
    el.hidden = false;
    if (campo) {
      campo.setAttribute('aria-invalid', 'true');
      const ids = (campo.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (!ids.includes(idError)) campo.setAttribute('aria-describedby', [...ids, idError].join(' '));
    }
  }

  function ocultarError(idError) {
    const el = document.getElementById(idError);
    if (el && !el.hidden) el.hidden = true;
    for (const campo of $$(`[data-error="${idError}"]`)) campo.removeAttribute('aria-invalid');
  }

  // ===================================================================
  // Pintar pantallas
  // ===================================================================
  function pintar({ pantalla, titulo, contenido, barra = true, activo = '', enfocar = true }) {
    document.getElementById('app').innerHTML = (barra ? htmlBarra(activo) : '') + `<main id="principal">${contenido}</main>`;
    document.title = `${titulo} · Mesa de ayuda`;
    document.body.dataset.pantalla = pantalla;
    document.body.dataset.sesion = sesion ? '1' : '0';
    delete document.body.dataset.paso;
    window.scrollTo(0, 0);
    // Al cambiar de pantalla el foco va al título (para lectores de pantalla). La primera vez no: la página empieza limpia.
    if (enfocar && pantallaAnterior !== null) {
      const h1 = $('main h1');
      if (h1) {
        h1.tabIndex = -1;
        h1.focus({ preventScroll: true });
      }
    }
    pantallaAnterior = pantalla;
  }

  function htmlBarra(activo) {
    const actual = (id) => (activo === id ? ' aria-current="page"' : '');
    return `<header class="barra"><div class="barra-interior">
      <a class="marca" href="#/inicio" data-guia="menu-marca">${logo()}<span>Mesa de ayuda</span></a>
      <nav class="menu" aria-label="Menú principal" data-guia="menu">
        <a href="#/inicio" data-guia="menu-inicio"${actual('inicio')}>Inicio</a>
        <a href="#/pedidos" data-guia="menu-pedidos"${actual('pedidos')}>Mis pedidos</a>
      </nav>
      <div class="usuario" data-guia="menu-usuario"><span class="avatar" aria-hidden="true">${esc(iniciales(sesion.nombre))}</span><span class="usuario-nombre">${esc(sesion.nombre)}</span></div>
      <button type="button" class="boton secundario" data-accion="salir" data-guia="menu-salir">${icono('salir')}Salir</button>
    </div></header>`;
  }

  function chip(estatus, idGuia, grande = false) {
    const e = ESTATUS[estatus] || { nombre: estatus, icono: 'info' };
    return `<span class="chip${grande ? ' chip-grande' : ''}" data-estatus="${esc(estatus)}"${idGuia ? ` data-guia="${idGuia}"` : ''}>${icono(e.icono)}${esc(e.nombre)}</span>`;
  }

  // ---------- Entrar ----------
  function pintarEntrar() {
    pintar({
      pantalla: 'entrar',
      titulo: 'Entrar',
      barra: false,
      contenido: `
      <div class="entrar">
        <div class="entrar-caja">
          <section class="tarjeta entrar-tarjeta" data-guia="entrar-tarjeta" aria-labelledby="entrar-titulo">
            <div class="marca">${logo()}<span>Mesa de ayuda</span></div>
            <h1 id="entrar-titulo">Entra a tu cuenta</h1>
            <p class="bajada">Pide ayuda y sigue tus pedidos en un solo lugar.</p>
            <form data-form="entrar" novalidate>
              <div class="campo">
                <label class="etiqueta" for="correo">Correo</label>
                <input class="entrada" id="correo" name="correo" type="email" autocomplete="username" inputmode="email" spellcheck="false" placeholder="nombre@ejemplo.com" data-error="correo-error" data-guia="entrar-correo">
                <p class="error" id="correo-error" data-guia="entrar-correo-error" hidden></p>
              </div>
              <div class="campo">
                <label class="etiqueta" for="contrasena">Contraseña</label>
                <input class="entrada" id="contrasena" name="contrasena" type="password" autocomplete="current-password" data-error="contrasena-error" data-guia="entrar-contrasena">
                <p class="error" id="contrasena-error" data-guia="entrar-contrasena-error" hidden></p>
              </div>
              <button type="submit" class="boton primario ancho" data-guia="entrar-boton">Entrar</button>
            </form>
          </section>
          <p class="entrar-ayuda" data-guia="entrar-ayuda">¿No puedes entrar? Escribe a soporte@ejemplo.com</p>
        </div>
      </div>`,
    });
  }

  function enviarEntrar(form) {
    const campoCorreo = form.elements.correo;
    const campoContrasena = form.elements.contrasena;
    const correo = campoCorreo.value.trim();
    let primero = null;
    if (!correo) {
      mostrarError('correo-error', 'Escribe tu correo.', campoCorreo);
      primero = campoCorreo;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      mostrarError('correo-error', 'Revisa tu correo: debe verse como nombre@ejemplo.com.', campoCorreo);
      primero = campoCorreo;
    }
    if (!campoContrasena.value) {
      mostrarError('contrasena-error', 'Escribe tu contraseña.', campoContrasena);
      primero = primero || campoContrasena;
    }
    if (primero) {
      primero.focus();
      return;
    }
    // Es una app de ejemplo: cualquier contraseña sirve.
    sesion = sesionPara(correo);
    guardarJson(CLAVE_SESION, sesion);
    const ruta = leerRuta();
    const quedarse = window.location.hash && ruta.nombre !== 'entrar' && ruta.nombre !== 'no-encontrado';
    ir(quedarse ? window.location.hash : '#/inicio');
  }

  function salir() {
    sesion = null;
    almacen.removeItem(CLAVE_SESION);
    ir('#/entrar');
  }

  // ---------- Inicio ----------
  function pintarInicio() {
    const pendientes = datos.pedidos.filter((p) => p.estatus === 'requiere-respuesta');
    const abiertos = datos.pedidos.filter((p) => ABIERTOS.has(p.estatus)).length;
    const resueltos = datos.pedidos.filter((p) => p.estatus === 'resuelto').length;
    pintar({
      pantalla: 'inicio',
      titulo: 'Inicio',
      activo: 'inicio',
      contenido: `
      <div class="contenedor">
        <div class="encabezado">
          <div>
            <h1 data-guia="inicio-saludo">Hola, ${esc(primerNombre(sesion.nombre))}</h1>
            <p data-guia="inicio-fecha">${esc(mayuscula(fechaLarga(HOY, true)))}</p>
          </div>
          <a class="boton primario" href="#/nuevo" data-guia="inicio-nuevo">${icono('mas')}Nuevo pedido</a>
        </div>
        ${htmlAvisoInicio(pendientes)}
        <section class="resumen" data-guia="inicio-resumen" aria-label="Resumen de tus pedidos">
          ${htmlDato('inicio-resumen-abiertos', abiertos, abiertos === 1 ? 'Pedido abierto' : 'Pedidos abiertos', 'bandeja', 'info')}
          ${htmlDato('inicio-resumen-respuesta', pendientes.length, pendientes.length === 1 ? 'Espera tu respuesta' : 'Esperan tu respuesta', 'alerta', 'aviso')}
          ${htmlDato('inicio-resumen-resueltos', resueltos, resueltos === 1 ? 'Resuelto' : 'Resueltos', 'check', 'exito')}
        </section>
        <section class="tarjeta" data-guia="inicio-recientes" aria-labelledby="recientes-titulo">
          <div class="tarjeta-cabeza">
            <h2 id="recientes-titulo">Pedidos recientes</h2>
            <a class="boton secundario" href="#/pedidos" data-guia="inicio-ver-todos">Ver todos</a>
          </div>
          <div class="filas filas-inicio">${datos.pedidos.slice(0, 4).map((p) => htmlFila(p, 'inicio')).join('')}</div>
        </section>
      </div>`,
    });
  }

  function htmlAvisoInicio(pendientes) {
    if (!pendientes.length) return '';
    if (pendientes.length === 1) {
      const p = pendientes[0];
      return `<section class="aviso" data-guia="inicio-aviso" aria-labelledby="aviso-titulo">
        <span class="aviso-icono">${icono('alerta')}</span>
        <div class="aviso-texto">
          <h2 id="aviso-titulo">Un pedido requiere tu respuesta</h2>
          <p>${esc(quienPregunta(p))} te hizo una pregunta sobre «${esc(p.titulo)}».</p>
        </div>
        <a class="boton primario" href="#/pedidos/${p.folio.toLowerCase()}" data-guia="inicio-aviso-boton">Responder</a>
      </section>`;
    }
    return `<section class="aviso" data-guia="inicio-aviso" aria-labelledby="aviso-titulo">
      <span class="aviso-icono">${icono('alerta')}</span>
      <div class="aviso-texto">
        <h2 id="aviso-titulo">${pendientes.length} pedidos requieren tu respuesta</h2>
        <p>Soporte te hizo preguntas. Sin tu respuesta esos pedidos no avanzan.</p>
      </div>
      <a class="boton primario" href="#/pedidos" data-guia="inicio-aviso-boton">Ver mis pedidos</a>
    </section>`;
  }

  function htmlDato(idGuia, numero, texto, nombreIcono, tono) {
    return `<div class="tarjeta dato" data-guia="${idGuia}">
      <span class="dato-icono" data-tono="${tono}">${icono(nombreIcono)}</span>
      <div><p class="dato-numero">${numero}</p><p class="dato-texto">${esc(texto)}</p></div>
    </div>`;
  }

  function htmlFila(p, donde) {
    const f = p.folio.toLowerCase();
    const cat = categoria(p.categoria).nombre;
    const enLista = donde === 'pedidos';
    const idFila = enLista ? `pedidos-fila-${f}` : `inicio-pedido-${f}`;
    const idChip = enLista ? `pedidos-estatus-${f}` : `inicio-estatus-${f}`;
    const sub = enLista ? `${cat} · Prioridad ${prioridad(p.prioridad).nombre.toLowerCase()}` : cat;
    const busqueda = enLista ? ` data-busqueda="${esc(normalizar(`${p.folio} ${p.titulo} ${cat}`))}"` : '';
    return `<a class="fila-pedido" href="#/pedidos/${f}" data-guia="${idFila}"${busqueda}>
        <span class="fila-folio">${esc(p.folio)}</span>
        <span class="fila-principal"><span class="fila-titulo">${esc(p.titulo)}</span><span class="fila-sub">${esc(sub)}</span></span>
        <span class="fila-fecha"><span class="sr-only">Creado el </span>${esc(fechaCorta(p.creado))}</span>
        ${chip(p.estatus, idChip)}
      </a>`;
  }

  // ---------- Mis pedidos ----------
  const conteo = (visibles, total) => (visibles === total ? `${total} ${total === 1 ? 'pedido' : 'pedidos'}` : `${visibles} de ${total}`);

  function pintarPedidos() {
    const total = datos.pedidos.length;
    pintar({
      pantalla: 'pedidos',
      titulo: 'Mis pedidos',
      activo: 'pedidos',
      contenido: `
      <div class="contenedor">
        <div class="encabezado">
          <div>
            <h1>Mis pedidos</h1>
            <p>Aquí ves en qué va cada pedido. Elige uno para ver el detalle.</p>
          </div>
          <a class="boton primario" href="#/nuevo" data-guia="pedidos-nuevo">${icono('mas')}Nuevo pedido</a>
        </div>
        <div class="dos-columnas">
          <section class="tarjeta" data-guia="pedidos-lista" aria-label="Lista de pedidos">
            <div class="herramientas">
              <div class="buscador">
                ${icono('lupa')}
                <label class="sr-only" for="buscar">Buscar pedidos</label>
                <input class="entrada" id="buscar" type="search" autocomplete="off" spellcheck="false" placeholder="Busca por título o folio" data-guia="pedidos-buscar">
              </div>
              <p class="conteo" data-guia="pedidos-conteo" aria-live="polite">${conteo(total, total)}</p>
            </div>
            <div class="filas-cabeza" aria-hidden="true"><span>Folio</span><span>Pedido</span><span>Creado</span><span>Estatus</span></div>
            <div class="filas">${datos.pedidos.map((p) => htmlFila(p, 'pedidos')).join('')}</div>
            <p class="vacio" data-guia="pedidos-vacio" hidden></p>
          </section>
          <aside class="tarjeta leyenda" data-guia="pedidos-leyenda" aria-labelledby="leyenda-titulo">
            <h2 id="leyenda-titulo">Qué significa cada estatus</h2>
            <ul class="leyenda-lista">
              ${Object.keys(ESTATUS).map((id) => `<li data-guia="estatus-${id}">${chip(id)}<p>${esc(ESTATUS[id].explica)}</p></li>`).join('')}
            </ul>
          </aside>
        </div>
      </div>`,
    });
  }

  /** Filtra la lista mientras escribes: solo muestra u oculta filas, no repinta nada. */
  function filtrarPedidos(texto) {
    const buscado = normalizar(texto.trim());
    const filas = $$('.filas .fila-pedido');
    let visibles = 0;
    for (const fila of filas) {
      const coincide = !buscado || fila.dataset.busqueda.includes(buscado);
      fila.hidden = !coincide;
      if (coincide) visibles += 1;
    }
    const vacio = guia('pedidos-vacio');
    if (vacio) {
      vacio.hidden = visibles > 0;
      if (!visibles) vacio.textContent = `No encontramos pedidos con «${texto.trim()}».`;
    }
    const cuenta = guia('pedidos-conteo');
    if (cuenta) cuenta.textContent = conteo(visibles, filas.length);
  }

  // ---------- Detalle ----------
  const esSoporte = (autor) => autor !== 'yo' && autor !== 'sistema';

  function ultimaPregunta(p) {
    for (let i = p.mensajes.length - 1; i >= 0; i -= 1) if (esSoporte(p.mensajes[i].autor)) return i;
    return -1;
  }

  function quienPregunta(p) {
    const i = ultimaPregunta(p);
    return i >= 0 && AUTORES[p.mensajes[i].autor] ? AUTORES[p.mensajes[i].autor].nombre : 'Soporte';
  }

  function pintarDetalle(folio) {
    const p = buscarPedido(folio);
    if (!p) return pintarNoEncontrado();
    const recien = respuestaEnviada === p.folio;
    respuestaEnviada = null;
    const espera = p.estatus === 'requiere-respuesta';
    const cerrado = p.estatus === 'resuelto' || p.estatus === 'cancelado';
    const pregunta = espera ? ultimaPregunta(p) : -1;
    pintar({
      pantalla: 'detalle',
      titulo: `${p.folio} ${p.titulo}`,
      activo: 'pedidos',
      enfocar: !recien,
      contenido: `
      <div class="contenedor">
        <a class="volver" href="#/pedidos" data-guia="detalle-volver">${icono('izquierda')}Mis pedidos</a>
        <div class="detalle-cabeza">
          <div>
            <p class="detalle-folio" data-guia="detalle-folio">${esc(p.folio)}</p>
            <h1 data-guia="detalle-titulo">${esc(p.titulo)}</h1>
          </div>
          ${chip(p.estatus, 'detalle-estatus', true)}
        </div>
        <div class="detalle-cuerpo">
          <div class="columna">
            <section class="tarjeta seccion" data-guia="detalle-datos" aria-labelledby="datos-titulo">
              <h2 id="datos-titulo">Datos del pedido</h2>
              <dl class="datos">
                <div><dt>Categoría</dt><dd>${esc(categoria(p.categoria).nombre)}</dd></div>
                <div><dt>Prioridad</dt><dd>${esc(prioridad(p.prioridad).nombre)}</dd></div>
                <div><dt>Para cuándo</dt><dd>${esc(fechaCorta(p.deseada))}</dd></div>
                <div><dt>Creado</dt><dd>${esc(cuando(p.creado, p.hora))}</dd></div>
              </dl>
            </section>
            <section class="tarjeta seccion" data-guia="detalle-linea-tiempo" aria-labelledby="linea-titulo">
              <h2 id="linea-titulo">Línea de tiempo</h2>
              <ol class="linea">${p.eventos.map((ev, i) => htmlEvento(ev, i, i === p.eventos.length - 1)).join('')}</ol>
            </section>
          </div>
          <section class="tarjeta seccion" data-guia="detalle-conversacion" aria-labelledby="conversacion-titulo">
            <h2 id="conversacion-titulo">Conversación</h2>
            ${espera ? `<p class="aviso-chico" data-guia="detalle-aviso">${icono('alerta')}<span>${esc(quienPregunta(p))} espera tu respuesta. Contesta abajo.</span></p>` : ''}
            <ol class="mensajes">${p.mensajes.map((m, i) => htmlMensaje(m, i, i === pregunta)).join('')}</ol>
            ${cerrado ? htmlCerrado(p) : htmlResponder(recien)}
          </section>
        </div>
      </div>`,
    });
    if (recien) {
      const enviada = guia('detalle-respuesta-enviada');
      if (enviada) {
        enviada.tabIndex = -1;
        enviada.focus({ preventScroll: true });
      }
    }
    return undefined;
  }

  function htmlEvento(ev, indice, actual) {
    const e = ESTATUS[ev.estatus] || { nombre: ev.estatus };
    return `<li class="evento" data-estatus="${esc(ev.estatus)}"${actual ? ' data-actual="1"' : ''} data-guia="detalle-evento-${indice + 1}">
      <div class="evento-cabeza"><span class="evento-estatus">${esc(e.nombre)}</span><span class="evento-fecha">${esc(cuando(ev.fecha, ev.hora))}</span></div>
      <p class="evento-nota">${esc(ev.nota)}</p>
    </li>`;
  }

  function htmlMensaje(m, indice, esPregunta) {
    const mio = m.autor === 'yo';
    const autor = AUTORES[m.autor] || { nombre: 'Soporte', iniciales: 'S', equipo: 'Soporte' };
    const tipo = mio ? 'yo' : m.autor === 'sistema' ? 'sistema' : 'soporte';
    const avatar = m.autor === 'sistema'
      ? `<span class="avatar avatar-sistema" aria-hidden="true">${icono('logo')}</span>`
      : `<span class="avatar" aria-hidden="true">${esc(mio ? iniciales(sesion.nombre) : autor.iniciales)}</span>`;
    const adjuntos = (m.adjuntos || []).length
      ? `<ul class="adjuntos-mensaje">${m.adjuntos.map((a) => `<li class="adjunto-mini">${icono(/\.(jpe?g|png)$/i.test(a) ? 'imagen' : 'archivo')}${esc(a)}</li>`).join('')}</ul>`
      : '';
    return `<li class="mensaje" data-autor="${tipo}"${esPregunta ? ' data-pregunta="1"' : ''} data-guia="detalle-mensaje-${indice + 1}">
      ${avatar}
      <div>
        <p class="mensaje-cabeza"><strong>${esc(mio ? 'Tú' : autor.nombre)}</strong>${mio ? '' : `<span>${esc(autor.equipo)}</span>`}<span>· ${esc(cuando(m.fecha, m.hora))}</span></p>
        <div class="burbuja"><p>${esc(m.texto)}</p>${adjuntos}</div>
      </div>
    </li>`;
  }

  function htmlResponder(recien) {
    return `<form class="responder" data-form="responder" data-guia="detalle-responder" novalidate>
      <label class="etiqueta" for="respuesta">Tu respuesta</label>
      <textarea class="entrada" id="respuesta" name="respuesta" rows="3" maxlength="1000" placeholder="Escribe aquí tu respuesta" data-error="respuesta-error" data-guia="detalle-respuesta"></textarea>
      <p class="error" id="respuesta-error" data-guia="detalle-respuesta-error" hidden></p>
      <div class="responder-pie">
        ${recien ? `<p class="enviado" data-guia="detalle-respuesta-enviada">${icono('check')}Enviamos tu respuesta. Te avisamos cuando haya novedades.</p>` : ''}
        <button type="submit" class="boton primario" data-guia="detalle-enviar">${icono('enviar')}Enviar respuesta</button>
      </div>
    </form>`;
  }

  function htmlCerrado(p) {
    const texto = p.estatus === 'resuelto' ? 'Este pedido ya está resuelto.' : 'Este pedido se canceló.';
    return `<div class="cerrado" data-guia="detalle-cerrado">
      <p>${texto} Si necesitas algo más, haz un pedido nuevo.</p>
      <a class="boton secundario" href="#/nuevo" data-guia="detalle-nuevo">${icono('mas')}Nuevo pedido</a>
    </div>`;
  }

  function enviarRespuesta(form) {
    const p = buscarPedido(leerRuta().folio);
    if (!p) return;
    const campo = form.elements.respuesta;
    const texto = campo.value.trim();
    if (!texto) {
      mostrarError('respuesta-error', 'Escribe tu respuesta antes de enviarla.', campo);
      campo.focus();
      return;
    }
    const hora = horaDeAhora(3);
    p.mensajes.push({ autor: 'yo', fecha: HOY, hora, texto, adjuntos: [] });
    if (p.estatus === 'requiere-respuesta') {
      p.estatus = 'en-revision';
      p.eventos.push({ estatus: 'en-revision', fecha: HOY, hora, nota: 'Respondiste. Soporte revisa tu respuesta.' });
    }
    guardarDatos();
    respuestaEnviada = p.folio;
    pintarDetalle(p.folio);
  }

  // ---------- Nuevo pedido ----------
  const PASOS = ['Qué necesitas', 'Fecha', 'Detalles', 'Revisar'];

  const primerDiaPosible = () => moverHabiles(HOY, 3);
  const primerMes = () => HOY.slice(0, 7);
  const ultimoMes = () => sumarMeses(HOY.slice(0, 7), 2);
  const mesPermitido = (mes) => mes >= primerMes() && mes <= ultimoMes();

  function borradorNuevo() {
    return { paso: 1, titulo: '', categoria: '', prioridad: '', fecha: '', mes: primerDiaPosible().slice(0, 7), descripcion: '', adjuntos: [], confirmo: false };
  }

  function pintarNuevo() {
    pintar({
      pantalla: 'nuevo',
      titulo: 'Nuevo pedido',
      contenido: `
      <div class="contenedor angosto">
        <div class="encabezado encabezado-chico">
          <h1>Nuevo pedido</h1>
          <a class="boton secundario" href="#/inicio" data-guia="nuevo-cancelar">Cancelar</a>
        </div>
        <ol class="pasos" data-guia="nuevo-pasos" aria-label="Pasos del pedido">
          ${PASOS.map((nombre, i) => `<li class="paso" data-guia="nuevo-paso-${i + 1}"><span class="paso-num"></span><span class="paso-nombre">${nombre}</span><span class="sr-only paso-estado"></span></li>`).join('')}
        </ol>
        <form class="tarjeta formulario" data-form="nuevo" data-guia="nuevo-formulario" novalidate></form>
      </div>`,
    });
    pintarPaso(false);
  }

  /** Cambia el contenido del formulario al paso actual. Solo pasa con un clic en Siguiente, Atrás o Cambiar. */
  function pintarPaso(enfocar = true) {
    const form = $('form[data-form="nuevo"]');
    if (!form) return;
    document.body.dataset.paso = String(borrador.paso);
    $$('.paso').forEach((li, i) => {
      const n = i + 1;
      const estado = n < borrador.paso ? 'hecho' : n === borrador.paso ? 'actual' : 'pendiente';
      li.dataset.estado = estado;
      if (estado === 'actual') li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
      $('.paso-num', li).innerHTML = estado === 'hecho' ? icono('check') : String(n);
      $('.paso-estado', li).textContent = estado === 'hecho' ? ': hecho' : estado === 'actual' ? ': aquí vas' : '';
    });
    const contenido = [htmlPaso1, htmlPaso2, htmlPaso3, htmlPaso4][borrador.paso - 1]();
    form.innerHTML = contenido + htmlPie();
    if (borrador.paso === 2) {
      pintarCalendario();
      mensajeCalendario(...mensajeInicial());
      pintarFechaElegida();
    }
    if (enfocar) {
      const titulo = $('.titulo-paso', form);
      titulo.tabIndex = -1;
      titulo.focus({ preventScroll: true });
    }
  }

  function irAPaso(n) {
    borrador.paso = Math.min(4, Math.max(1, n));
    pintarPaso(true);
  }

  const textoPrioridad = () => (borrador.prioridad ? prioridad(borrador.prioridad).ayuda : 'Elige qué tan urgente es.');

  function htmlPaso1() {
    return `<h2 class="titulo-paso">¿Qué necesitas?</h2>
      <div class="campo bloque">
        <label class="etiqueta" for="titulo">Título</label>
        <input class="entrada" id="titulo" name="titulo" maxlength="80" autocomplete="off" aria-describedby="titulo-ayuda" data-campo="titulo" data-error="titulo-error" data-guia="nuevo-titulo" value="${esc(borrador.titulo)}">
        <p class="ayuda" id="titulo-ayuda">En pocas palabras. Por ejemplo: «No enciende el monitor».</p>
        <p class="error" id="titulo-error" data-guia="nuevo-titulo-error" hidden></p>
      </div>
      <fieldset class="bloque" data-guia="nuevo-categoria" aria-describedby="categoria-error">
        <legend class="etiqueta">Categoría</legend>
        <div class="mosaico">
          ${CATEGORIAS.map((c) => `<label class="ficha" data-guia="nuevo-categoria-${c.id}">
            <input type="radio" name="categoria" value="${c.id}" data-error="categoria-error"${borrador.categoria === c.id ? ' checked' : ''}>
            <span class="ficha-icono">${icono(c.icono)}</span>
            <span class="ficha-texto"><span class="ficha-nombre">${c.nombre}</span><span class="ficha-ayuda">${c.ayuda}</span></span>
            <span class="ficha-marca">${icono('check')}</span>
          </label>`).join('')}
        </div>
        <p class="error" id="categoria-error" data-guia="nuevo-categoria-error" hidden></p>
      </fieldset>
      <fieldset class="bloque" data-guia="nuevo-prioridad" aria-describedby="prioridad-ayuda prioridad-error">
        <legend class="etiqueta">Prioridad</legend>
        <div class="fila-prioridad">
          <div class="segmentos">
            ${PRIORIDADES.map((p) => `<label class="segmento" data-guia="nuevo-prioridad-${p.id}"><input type="radio" name="prioridad" value="${p.id}" data-error="prioridad-error"${borrador.prioridad === p.id ? ' checked' : ''}>${p.nombre}</label>`).join('')}
          </div>
          <p class="ayuda" id="prioridad-ayuda" data-guia="nuevo-prioridad-ayuda">${esc(textoPrioridad())}</p>
        </div>
        <p class="error" id="prioridad-error" data-guia="nuevo-prioridad-error" hidden></p>
      </fieldset>`;
  }

  function htmlPaso2() {
    const columnas = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    return `<h2 class="titulo-paso">¿Para cuándo lo necesitas?</h2>
      <div class="fila-calendario">
        <div class="calendario" data-guia="calendario">
          <div class="cal-cabeza">
            <button type="button" class="boton secundario boton-icono" data-accion="mes" data-delta="-1" aria-label="Mes anterior" data-guia="calendario-anterior">${icono('izquierda')}</button>
            <h3 class="cal-mes" id="cal-mes" aria-live="polite" data-guia="calendario-mes"></h3>
            <button type="button" class="boton secundario boton-icono" data-accion="mes" data-delta="1" aria-label="Mes siguiente" data-guia="calendario-siguiente">${icono('derecha')}</button>
          </div>
          <table class="cal-tabla" role="grid" aria-labelledby="cal-mes">
            <thead><tr>${columnas.map((d) => `<th scope="col" abbr="${d}">${d.slice(0, 3)}</th>`).join('')}</tr></thead>
            <tbody></tbody>
          </table>
          <p class="cal-mensaje" aria-live="polite" data-guia="calendario-mensaje"></p>
          <ul class="cal-leyenda" data-guia="calendario-leyenda" aria-label="Qué significa cada color">
            <li><span class="muestra"></span>Disponible</li>
            <li><span class="muestra bloqueado"></span>No disponible</li>
            <li><span class="muestra hoy"></span>Hoy</li>
            <li><span class="muestra elegido"></span>Elegido</li>
          </ul>
        </div>
        <aside class="nota" data-guia="nuevo-fecha-reglas" aria-labelledby="reglas-titulo">
          <h3 id="reglas-titulo">Cómo se elige la fecha</h3>
          <ul class="nota-lista">
            <li>${icono('check')}<span>Solo días hábiles: de lunes a viernes.</span></li>
            <li>${icono('check')}<span>Al menos 3 días hábiles después de hoy, para tener tiempo de conseguir lo que haga falta.</span></li>
            <li>${icono('check')}<span>Si un día no se puede, tócalo y el calendario te dice por qué.</span></li>
          </ul>
          <div class="fecha-elegida" data-guia="nuevo-fecha-elegida"><span>Fecha elegida</span><strong></strong></div>
          <p class="error" id="fecha-error" data-guia="nuevo-fecha-error" hidden></p>
        </aside>
      </div>`;
  }

  function htmlPaso3() {
    return `<h2 class="titulo-paso">Cuéntanos más</h2>
      <div class="campo bloque">
        <label class="etiqueta" for="descripcion">Descripción</label>
        <textarea class="entrada" id="descripcion" name="descripcion" rows="4" maxlength="500" aria-describedby="descripcion-ayuda" data-campo="descripcion" data-error="descripcion-error" data-guia="nuevo-descripcion">${esc(borrador.descripcion)}</textarea>
        <div class="campo-pie">
          <p class="ayuda" id="descripcion-ayuda">Qué pasa, desde cuándo y dónde.</p>
          <span class="contador" data-guia="nuevo-descripcion-contador">${borrador.descripcion.length} de 500</span>
        </div>
        <p class="error" id="descripcion-error" data-guia="nuevo-descripcion-error" hidden></p>
      </div>
      <div class="bloque" data-guia="nuevo-adjuntos">
        <p class="etiqueta">Archivos <span class="opcional">(opcional)</span></p>
        <div class="zona">
          <span class="zona-icono">${icono('clip')}</span>
          <p class="zona-texto">Si ayuda, agrega una foto o una captura de pantalla.</p>
          <button type="button" class="boton secundario" data-accion="adjuntar" aria-expanded="false" aria-controls="selector" data-guia="nuevo-adjuntar">${icono('mas')}Adjuntar archivo</button>
          <div class="selector" id="selector" role="dialog" aria-label="Elegir un archivo" data-guia="adjuntos-selector" hidden>
            <p class="selector-titulo">Archivos recientes</p>
            <ul>
              ${ARCHIVOS.map((a, i) => `<li><button type="button" class="archivo" data-accion="elegir-archivo" data-indice="${i}" data-guia="adjuntos-archivo-${i + 1}">${icono(a.icono)}<span class="archivo-nombre">${a.nombre}</span><span class="archivo-peso">${a.peso}</span></button></li>`).join('')}
            </ul>
            <div class="selector-pie"><button type="button" class="boton fantasma" data-accion="cerrar-selector" data-guia="adjuntos-cerrar">Cerrar</button></div>
          </div>
        </div>
        <ul class="adjuntos" data-guia="nuevo-adjuntos-lista"${borrador.adjuntos.length ? '' : ' hidden'}>${htmlAdjuntos()}</ul>
      </div>`;
  }

  function htmlAdjuntos() {
    return borrador.adjuntos.map((a, i) => `<li class="adjunto" data-guia="nuevo-adjunto-${i + 1}">
      ${icono(a.icono)}<span>${esc(a.nombre)}</span><span class="archivo-peso">${esc(a.peso)}</span>
      <button type="button" class="boton fantasma boton-icono" data-accion="quitar-adjunto" data-indice="${i}" aria-label="Quitar ${esc(a.nombre)}" data-guia="nuevo-adjunto-quitar-${i + 1}">${icono('x')}</button>
    </li>`).join('');
  }

  function htmlPaso4() {
    const b = borrador;
    const archivos = b.adjuntos.length ? b.adjuntos.map((a) => a.nombre).join(', ') : 'Sin archivos';
    return `<h2 class="titulo-paso">Revisa tu pedido</h2>
      <div class="revisar" data-guia="revisar-resumen">
        ${htmlSeccionRevisar(1, 'Qué necesitas', [['Título', b.titulo.trim()], ['Categoría', categoria(b.categoria).nombre], ['Prioridad', prioridad(b.prioridad).nombre]])}
        ${htmlSeccionRevisar(2, 'Fecha', [['Para cuándo', mayuscula(fechaLarga(b.fecha, true))]])}
        ${htmlSeccionRevisar(3, 'Detalles', [['Descripción', b.descripcion.trim()], ['Archivos', archivos]])}
      </div>
      <label class="casilla" data-guia="revisar-confirmo">
        <input type="checkbox" name="confirmo" data-error="confirmo-error"${b.confirmo ? ' checked' : ''}>
        <span>Revisé mi pedido y los datos están bien.</span>
      </label>
      <p class="error" id="confirmo-error" data-guia="revisar-confirmo-error" hidden></p>`;
  }

  function htmlSeccionRevisar(n, titulo, filas) {
    return `<section class="revisar-seccion" data-guia="revisar-seccion-${n}" aria-labelledby="revisar-titulo-${n}">
      <div class="revisar-cabeza">
        <h3 id="revisar-titulo-${n}">${titulo}</h3>
        <button type="button" class="boton fantasma" data-accion="ir-paso" data-paso="${n}" data-guia="revisar-cambiar-${n}">Cambiar<span class="sr-only"> ${titulo.toLowerCase()}</span></button>
      </div>
      <dl class="revisar-datos">${filas.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    </section>`;
  }

  function htmlPie() {
    const p = borrador.paso;
    const atras = p > 1 ? `<button type="button" class="boton secundario" data-accion="atras" data-guia="nuevo-atras">${icono('izquierda')}Atrás</button>` : '';
    const avanzar = p < 4
      ? `<button type="submit" class="boton primario empuja" data-guia="nuevo-siguiente">Siguiente${icono('derecha')}</button>`
      : `<button type="submit" class="boton primario empuja" data-guia="revisar-enviar">${icono('enviar')}Enviar pedido</button>`;
    return `<div class="pie">${atras}${avanzar}</div>`;
  }

  /** Revisa el paso actual al pulsar Siguiente (nunca al soltar el foco). */
  function pasoCompleto() {
    const b = borrador;
    const fallas = [];
    if (b.paso === 1) {
      const titulo = b.titulo.trim();
      if (titulo.length < 5) fallas.push(['titulo-error', titulo ? 'El título es muy corto: usa al menos 5 letras.' : 'Escribe un título.', $('#titulo')]);
      if (!b.categoria) fallas.push(['categoria-error', 'Elige una categoría.', $('input[name="categoria"]')]);
      if (!b.prioridad) fallas.push(['prioridad-error', 'Elige la prioridad.', $('input[name="prioridad"]')]);
    } else if (b.paso === 2) {
      if (!b.fecha) fallas.push(['fecha-error', 'Elige una fecha en el calendario.', $('.dia[tabindex="0"]')]);
    } else if (b.paso === 3) {
      const texto = b.descripcion.trim();
      if (texto.length < 10) fallas.push(['descripcion-error', texto ? 'Cuéntanos un poco más: al menos 10 letras.' : 'Escribe qué pasa.', $('#descripcion')]);
    } else if (!b.confirmo) {
      fallas.push(['confirmo-error', 'Marca la casilla para confirmar que revisaste tu pedido.', $('input[name="confirmo"]')]);
    }
    for (const [id, texto, campo] of fallas) mostrarError(id, texto, campo && campo.matches('input[type="text"], input:not([type]), textarea') ? campo : null);
    if (fallas.length && fallas[0][2]) fallas[0][2].focus();
    return fallas.length === 0;
  }

  function enviarPaso() {
    if (!borrador || !pasoCompleto()) return;
    if (borrador.paso < 4) {
      irAPaso(borrador.paso + 1);
      return;
    }
    crearPedido();
  }

  function crearPedido() {
    const b = borrador;
    const folio = `MA-${datos.siguiente}`;
    datos.siguiente += 1;
    const hora = horaDeAhora(2);
    const horaAviso = horaDeAhora(1);
    datos.pedidos.unshift({
      folio,
      titulo: b.titulo.trim(),
      categoria: b.categoria,
      prioridad: b.prioridad,
      creado: HOY,
      hora,
      deseada: b.fecha,
      estatus: 'recibido',
      eventos: [{ estatus: 'recibido', fecha: HOY, hora, nota: 'Recibimos tu pedido.' }],
      mensajes: [
        { autor: 'yo', fecha: HOY, hora, texto: b.descripcion.trim(), adjuntos: b.adjuntos.map((a) => a.nombre) },
        { autor: 'sistema', fecha: HOY, hora: horaAviso, texto: 'Recibimos tu pedido. Lo revisamos en menos de un día hábil.', adjuntos: [] },
      ],
    });
    guardarDatos();
    borrador = null;
    ir(`#/listo/${folio.toLowerCase()}`);
  }

  // ---------- Calendario ----------
  function motivoDia(iso) {
    const n = numeroDeDia(iso);
    const hoy = numeroDeDia(HOY);
    if (n < hoy) return 'pasado';
    if (n === hoy) return 'hoy';
    if (esFinDeSemana(iso)) return 'fin-de-semana';
    if (n < numeroDeDia(primerDiaPosible())) return 'muy-pronto';
    return '';
  }

  function explicarMotivo(iso, motivo) {
    const dia = fechaLarga(iso);
    const primero = fechaLarga(primerDiaPosible());
    if (motivo === 'pasado') return `El ${dia} ya pasó. Elige desde el ${primero}.`;
    if (motivo === 'hoy') return `Hoy es muy pronto. Pide con al menos 3 días hábiles: el primero libre es el ${primero}.`;
    if (motivo === 'fin-de-semana') return `El ${dia} no se puede: en fin de semana no hay servicio.`;
    return `El ${dia} es muy pronto. Pide con al menos 3 días hábiles: el primero libre es el ${primero}.`;
  }

  const mensajeLimite = (mes) => (mes < primerMes()
    ? 'No puedes ir a meses que ya pasaron.'
    : `Por ahora puedes pedir hasta ${nombreMes(ultimoMes()).toLowerCase()}.`);

  function mensajeInicial() {
    if (borrador.fecha) return ['ok', `Elegiste el ${fechaLarga(borrador.fecha)}.`];
    return ['info', `Elige un día de lunes a viernes, desde el ${fechaLarga(primerDiaPosible())}.`];
  }

  function mensajeCalendario(tipo, texto) {
    const el = guia('calendario-mensaje');
    if (!el) return;
    el.dataset.tipo = tipo;
    el.innerHTML = `${icono(tipo === 'aviso' ? 'alerta' : tipo === 'ok' ? 'check' : 'info')}<span>${esc(texto)}</span>`;
  }

  function htmlDia(iso) {
    const motivo = motivoDia(iso);
    const elegido = borrador.fecha === iso;
    const estado = motivo ? 'bloqueado' : elegido ? 'elegido' : 'disponible';
    const nombre = mayuscula(fechaLarga(iso, true));
    const etiqueta = motivo ? `${nombre}. No disponible` : elegido ? `${nombre}. Elegido` : nombre;
    return `<button type="button" class="dia" data-accion="dia" data-fecha="${iso}" data-estado="${estado}" data-motivo="${motivo}"${iso === HOY ? ' data-hoy="1"' : ''}${motivo ? ' aria-disabled="true"' : ''} aria-pressed="${elegido}" aria-label="${esc(etiqueta)}" tabindex="-1" data-guia="calendario-dia-${iso}">${diaDe(iso)}</button>`;
  }

  /** Pinta el mes que se ve. Solo pasa al entrar al paso o al cambiar de mes. */
  function pintarCalendario() {
    const cal = guia('calendario');
    if (!cal) return;
    const mes = borrador.mes;
    guia('calendario-mes').textContent = nombreMes(mes);
    guia('calendario-anterior').setAttribute('aria-disabled', String(!mesPermitido(sumarMeses(mes, -1))));
    guia('calendario-siguiente').setAttribute('aria-disabled', String(!mesPermitido(sumarMeses(mes, 1))));
    const celdas = [];
    const hueco = (diaSemana(`${mes}-01`) + 6) % 7;
    for (let i = 0; i < hueco; i += 1) celdas.push('<td></td>');
    for (let d = 1; d <= diasDelMes(mes); d += 1) celdas.push(`<td>${htmlDia(`${mes}-${dos(d)}`)}</td>`);
    while (celdas.length < 42) celdas.push('<td></td>');   // siempre seis semanas: el calendario no cambia de alto
    let filas = '';
    for (let i = 0; i < 42; i += 7) filas += `<tr>${celdas.slice(i, i + 7).join('')}</tr>`;
    $('tbody', cal).innerHTML = filas;
    activarDiaEnfocable();
  }

  /** Solo un día recibe el foco con Tab; las flechas mueven entre días. */
  function activarDiaEnfocable(preferido) {
    const dias = $$('.dia', guia('calendario'));
    const objetivo = (preferido && dias.find((b) => b.dataset.fecha === preferido))
      || dias.find((b) => b.dataset.estado === 'elegido')
      || dias.find((b) => b.dataset.estado === 'disponible')
      || dias[0];
    for (const b of dias) b.tabIndex = b === objetivo ? 0 : -1;
    return objetivo;
  }

  function pintarFechaElegida() {
    const el = guia('nuevo-fecha-elegida');
    if (el) $('strong', el).textContent = borrador.fecha ? mayuscula(fechaLarga(borrador.fecha, true)) : 'Aún no eliges un día';
  }

  function elegirDia(boton) {
    const iso = boton.dataset.fecha;
    const motivo = motivoDia(iso);
    activarDiaEnfocable(iso);
    if (motivo) {
      mensajeCalendario('aviso', explicarMotivo(iso, motivo));
      return;
    }
    borrador.fecha = iso;
    for (const b of $$('.dia', guia('calendario'))) {
      if (b.dataset.motivo) continue;
      const este = b.dataset.fecha === iso;
      const nombre = mayuscula(fechaLarga(b.dataset.fecha, true));
      b.dataset.estado = este ? 'elegido' : 'disponible';
      b.setAttribute('aria-pressed', String(este));
      b.setAttribute('aria-label', este ? `${nombre}. Elegido` : nombre);
    }
    mensajeCalendario('ok', `Elegiste el ${fechaLarga(iso)}.`);
    pintarFechaElegida();
    ocultarError('fecha-error');
  }

  function cambiarMes(delta) {
    const destino = sumarMeses(borrador.mes, delta);
    if (!mesPermitido(destino)) {
      mensajeCalendario('aviso', mensajeLimite(destino));
      return;
    }
    borrador.mes = destino;
    pintarCalendario();
    mensajeCalendario(...mensajeInicial());
  }

  function teclaCalendario(evento, boton) {
    const desde = boton.dataset.fecha;
    const posicion = (diaSemana(desde) + 6) % 7;   // lunes = 0
    const destinos = {
      ArrowLeft: sumarDias(desde, -1),
      ArrowRight: sumarDias(desde, 1),
      ArrowUp: sumarDias(desde, -7),
      ArrowDown: sumarDias(desde, 7),
      Home: sumarDias(desde, -posicion),
      End: sumarDias(desde, 6 - posicion),
    };
    let destino = destinos[evento.key];
    if (evento.key === 'PageUp' || evento.key === 'PageDown') {
      const mes = sumarMeses(desde.slice(0, 7), evento.key === 'PageUp' ? -1 : 1);
      destino = `${mes}-${dos(Math.min(diaDe(desde), diasDelMes(mes)))}`;
    }
    if (!destino) return;
    evento.preventDefault();
    const mes = destino.slice(0, 7);
    if (!mesPermitido(mes)) {
      mensajeCalendario('aviso', mensajeLimite(mes));
      return;
    }
    if (mes !== borrador.mes) {
      borrador.mes = mes;
      pintarCalendario();
    }
    activarDiaEnfocable(destino).focus();
    const motivo = motivoDia(destino);
    if (motivo) mensajeCalendario('aviso', explicarMotivo(destino, motivo));
    else if (borrador.fecha === destino) mensajeCalendario('ok', `Elegiste el ${fechaLarga(destino)}.`);
    else mensajeCalendario('info', `El ${fechaLarga(destino)} está disponible. Pulsa Enter para elegirlo.`);
  }

  // ---------- Archivos (simulados: no se sube nada) ----------
  function abrirSelector() {
    const selector = guia('adjuntos-selector');
    for (const boton of $$('.archivo', selector)) {
      const a = ARCHIVOS[Number(boton.dataset.indice)];
      const ya = borrador.adjuntos.some((x) => x.nombre === a.nombre);
      boton.setAttribute('aria-disabled', String(ya));
      $('.archivo-peso', boton).textContent = ya ? 'Ya está adjunto' : a.peso;
    }
    selector.hidden = false;
    guia('nuevo-adjuntar').setAttribute('aria-expanded', 'true');
  }

  function cerrarSelector(devolverFoco) {
    const selector = guia('adjuntos-selector');
    if (!selector || selector.hidden) return;
    selector.hidden = true;
    const boton = guia('nuevo-adjuntar');
    boton.setAttribute('aria-expanded', 'false');
    if (devolverFoco) boton.focus();
  }

  function alternarSelector() {
    const selector = guia('adjuntos-selector');
    if (!selector) return;
    if (selector.hidden) abrirSelector();
    else cerrarSelector(true);
  }

  function pintarAdjuntos() {
    const lista = guia('nuevo-adjuntos-lista');
    lista.innerHTML = htmlAdjuntos();
    lista.hidden = borrador.adjuntos.length === 0;
  }

  function elegirArchivo(boton) {
    if (boton.getAttribute('aria-disabled') === 'true') return;
    borrador.adjuntos.push({ ...ARCHIVOS[Number(boton.dataset.indice)] });
    cerrarSelector(false);
    pintarAdjuntos();
  }

  function quitarAdjunto(indice) {
    borrador.adjuntos.splice(indice, 1);
    pintarAdjuntos();
    guia('nuevo-adjuntar').focus();
  }

  // ---------- Listo ----------
  function pintarListo(folio) {
    const p = buscarPedido(folio);
    if (!p) return pintarNoEncontrado();
    pintar({
      pantalla: 'listo',
      titulo: 'Pedido enviado',
      contenido: `
      <div class="contenedor angosto">
        <section class="tarjeta listo" data-guia="listo-tarjeta" aria-labelledby="listo-titulo">
          <div class="listo-icono">${icono('check')}</div>
          <h1 id="listo-titulo" data-guia="listo-titulo">¡Listo! Recibimos tu pedido</h1>
          <p class="bajada">Guarda tu folio: con él das seguimiento a tu pedido.</p>
          <div class="folio" data-guia="listo-folio"><span class="folio-etiqueta">Tu folio</span><span class="folio-numero">${esc(p.folio)}</span></div>
          <dl class="listo-datos" data-guia="listo-datos">
            <div><dt>Pedido</dt><dd>${esc(p.titulo)}</dd></div>
            <div><dt>Para cuándo</dt><dd>${esc(mayuscula(fechaLarga(p.deseada)))}</dd></div>
            <div><dt>Estatus</dt><dd>${chip(p.estatus, 'listo-estatus')}</dd></div>
          </dl>
          <p class="listo-correo" data-guia="listo-correo">Te avisamos a <strong>${esc(sesion.correo)}</strong> cuando haya novedades.</p>
          <div class="acciones">
            <a class="boton primario" href="#/pedidos/${p.folio.toLowerCase()}" data-guia="listo-ver-pedido">Ver mi pedido</a>
            <a class="boton secundario" href="#/inicio" data-guia="listo-inicio">Ir al inicio</a>
          </div>
        </section>
      </div>`,
    });
    return undefined;
  }

  // ---------- Pantallas de aviso ----------
  function pintarNoEncontrado() {
    pintar({
      pantalla: 'no-encontrado',
      titulo: 'No encontrado',
      contenido: `
      <div class="contenedor angosto">
        <section class="tarjeta mensaje-pantalla" data-guia="no-encontrado">
          <h1>No encontramos esta página</h1>
          <p>Puede que el enlace esté mal escrito o que ese pedido no exista.</p>
          <a class="boton primario" href="#/inicio" data-guia="no-encontrado-inicio">Ir al inicio</a>
        </section>
      </div>`,
    });
  }

  function pintarFechaMala() {
    document.getElementById('app').innerHTML = `
      <main class="contenedor angosto">
        <section class="tarjeta mensaje-pantalla" data-guia="error-fecha">
          <h1>No pude leer la fecha</h1>
          <p>La dirección dice <code>hoy=${esc(HOY_TEXTO)}</code>. Usa el formato AAAA-MM-DD, por ejemplo <code>?hoy=2026-03-02</code>.</p>
        </section>
      </main>`;
    document.title = 'Fecha no válida · Mesa de ayuda';
    document.body.dataset.pantalla = 'error';
    document.body.dataset.sesion = '0';
    console.error(`Mesa de ayuda: hoy=«${HOY_TEXTO}» no es una fecha válida. Usa AAAA-MM-DD.`);
  }

  // ===================================================================
  // Rutas
  // ===================================================================
  function leerRuta() {
    let partes;
    try {
      partes = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    } catch (e) {
      return { nombre: 'no-encontrado' };
    }
    const [a = 'inicio', b, sobra] = partes;
    if (sobra !== undefined) return { nombre: 'no-encontrado' };
    if (a === 'entrar' && !b) return { nombre: 'entrar' };
    if (a === 'inicio' && !b) return { nombre: 'inicio' };
    if (a === 'nuevo' && !b) return { nombre: 'nuevo' };
    if (a === 'pedidos' && !b) return { nombre: 'pedidos' };
    if (a === 'pedidos') return { nombre: 'detalle', folio: b };
    if (a === 'listo' && b) return { nombre: 'listo', folio: b };
    return { nombre: 'no-encontrado' };
  }

  function ir(destino) {
    if (window.location.hash === destino) render();
    else window.location.hash = destino;
  }

  function render() {
    const ruta = leerRuta();
    if (!sesion) {
      borrador = null;
      pintarEntrar();
      return;
    }
    if (ruta.nombre === 'entrar') {
      ir('#/inicio');
      return;
    }
    borrador = ruta.nombre === 'nuevo' ? borradorNuevo() : null;
    if (ruta.nombre === 'inicio') pintarInicio();
    else if (ruta.nombre === 'nuevo') pintarNuevo();
    else if (ruta.nombre === 'pedidos') pintarPedidos();
    else if (ruta.nombre === 'detalle') pintarDetalle(ruta.folio);
    else if (ruta.nombre === 'listo') pintarListo(ruta.folio);
    else pintarNoEncontrado();
  }

  // ===================================================================
  // Eventos. Todos delegados en el documento: pintar no tiene que volver
  // a conectar nada. Ninguno reacciona a soltar el foco (blur).
  // ===================================================================
  function escuchar() {
    window.addEventListener('hashchange', render);

    document.addEventListener('click', (evento) => {
      const el = evento.target instanceof Element ? evento.target.closest('[data-accion]') : null;
      if (!el) return;
      const accion = el.dataset.accion;
      if (accion === 'salir') salir();
      else if (!borrador) return;
      else if (accion === 'atras') irAPaso(borrador.paso - 1);
      else if (accion === 'ir-paso') irAPaso(Number(el.dataset.paso));
      else if (accion === 'dia') elegirDia(el);
      else if (accion === 'mes') cambiarMes(Number(el.dataset.delta));
      else if (accion === 'adjuntar') alternarSelector();
      else if (accion === 'cerrar-selector') cerrarSelector(true);
      else if (accion === 'elegir-archivo') elegirArchivo(el);
      else if (accion === 'quitar-adjunto') quitarAdjunto(Number(el.dataset.indice));
    });

    document.addEventListener('submit', (evento) => {
      const form = evento.target.closest('form[data-form]');
      if (!form) return;
      evento.preventDefault();
      if (form.dataset.form === 'entrar') enviarEntrar(form);
      else if (form.dataset.form === 'nuevo') enviarPaso();
      else if (form.dataset.form === 'responder') enviarRespuesta(form);
    });

    // Tecla por tecla: guarda lo escrito y actualiza solo lo pequeño (contador, filtro). Nada más se repinta.
    document.addEventListener('input', (evento) => {
      const el = evento.target;
      if (el.dataset.error) ocultarError(el.dataset.error);
      if (el.id === 'buscar') {
        filtrarPedidos(el.value);
        return;
      }
      if (!borrador) return;
      if (el.dataset.campo === 'titulo') borrador.titulo = el.value;
      if (el.dataset.campo === 'descripcion') {
        borrador.descripcion = el.value;
        const contador = guia('nuevo-descripcion-contador');
        if (contador) contador.textContent = `${el.value.length} de 500`;
      }
    });

    // Solo opciones y casillas. Un campo de texto no hace nada al soltar el foco.
    document.addEventListener('change', (evento) => {
      const el = evento.target;
      if (!borrador || (el.type !== 'radio' && el.type !== 'checkbox')) return;
      if (el.name === 'categoria') {
        borrador.categoria = el.value;
        ocultarError('categoria-error');
      } else if (el.name === 'prioridad') {
        borrador.prioridad = el.value;
        ocultarError('prioridad-error');
        const ayuda = guia('nuevo-prioridad-ayuda');
        if (ayuda) ayuda.textContent = textoPrioridad();
      } else if (el.name === 'confirmo') {
        borrador.confirmo = el.checked;
        if (el.checked) ocultarError('confirmo-error');
      }
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') {
        const selector = guia('adjuntos-selector');
        if (selector && !selector.hidden) {
          evento.preventDefault();
          cerrarSelector(true);
        }
        return;
      }
      const dia = evento.target instanceof Element ? evento.target.closest('.dia') : null;
      if (dia && borrador) teclaCalendario(evento, dia);
    });

    // Un clic fuera del selector de archivos lo cierra, y el clic sigue su camino.
    document.addEventListener('pointerdown', (evento) => {
      const selector = guia('adjuntos-selector');
      if (!selector || selector.hidden || !(evento.target instanceof Element)) return;
      if (selector.contains(evento.target) || evento.target.closest('[data-accion="adjuntar"]')) return;
      cerrarSelector(false);
    });
  }

  // ===================================================================
  // Arranque
  // ===================================================================
  function arrancar() {
    if (!HOY) {
      pintarFechaMala();
      return;
    }
    if (activado('reiniciar')) {
      almacen.removeItem(CLAVE_DATOS);
      almacen.removeItem(CLAVE_SESION);
    }
    datos = leerJson(CLAVE_DATOS);
    if (!datos || datos.version !== VERSION_DATOS || !Array.isArray(datos.pedidos)) {
      datos = datosDeEjemplo();
      guardarDatos();
    }
    sesion = leerJson(CLAVE_SESION);
    if (sesion && (typeof sesion.nombre !== 'string' || typeof sesion.correo !== 'string')) sesion = null;
    if (activado('sesion')) {
      sesion = sesionPara(PERSONA.correo);
      guardarJson(CLAVE_SESION, sesion);
    }
    escuchar();
    render();
  }

  arrancar();
}());
