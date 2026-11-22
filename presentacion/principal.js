/* ============================================================
   KYNUS — presentación
   Lenis (scroll suave) + GSAP (entradas) + un "director" que en
   cada cuadro calcula qué pasa según dónde está el scroll:
   la estrella 3D, el llavero, las pantallitas, la noche, etc.
   ============================================================ */
import { Oled, Ojos, Pintor, crearArranque, dibujarArranque, dibujarEvento, dibujarEstrella, cargarLetraPixel, T_FIN } from './oled.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, Lenis = window.Lenis;
const hayGsap = Boolean(gsap && ScrollTrigger);
if (hayGsap) gsap.registerPlugin(ScrollTrigger);

const raiz = document.documentElement;
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const punteroFino = matchMedia('(hover: hover) and (pointer: fine)').matches;
const parametros = new URLSearchParams(location.search);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const tramo = (v, a, b) => lim((v - a) / (b - a));
const suave = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const salida = x => 1 - Math.pow(1 - x, 3);
const mezcla = (a, b, t) => a + (b - a) * t;

/* ============================================================
   SCROLL SUAVE
   ============================================================ */
let lenis = null;
if (Lenis && !sinMovimiento){
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  if (hayGsap){
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const bucle = t => { lenis.raf(t); requestAnimationFrame(bucle); };
    requestAnimationFrame(bucle);
  }
}
const posScroll = () => (lenis ? lenis.scroll : window.scrollY);

function irA(destino){
  const el = typeof destino === 'string' ? document.querySelector(destino) : destino;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.7, easing: t => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const destino = a.getAttribute('href');
  if (destino.length < 2) return;
  e.preventDefault();
  cerrarMenu();
  irA(destino);
});

/* ============================================================
   BARRA DE TAREAS: menú Inicio y reloj
   ============================================================ */
const botonInicio = $('#botonInicio'), menuInicio = $('#menuInicio');
function abrirMenu(){
  menuInicio.hidden = false;
  botonInicio.setAttribute('aria-expanded', 'true');
  if (hayGsap && !sinMovimiento) gsap.fromTo(menuInicio, { y: 18, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
  menuInicio.querySelector('a').focus({ preventScroll: true });
}
function cerrarMenu(){
  if (menuInicio.hidden) return;
  menuInicio.hidden = true;
  botonInicio.setAttribute('aria-expanded', 'false');
}
botonInicio.addEventListener('click', e => { e.stopPropagation(); menuInicio.hidden ? abrirMenu() : cerrarMenu(); });
document.addEventListener('click', e => { if (!menuInicio.hidden && !menuInicio.contains(e.target) && !botonInicio.contains(e.target)) cerrarMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menuInicio.hidden){ cerrarMenu(); botonInicio.focus(); } });

const reloj = $('#reloj');
function ponerHora(){
  const d = new Date();
  reloj.textContent = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  reloj.dateTime = d.toISOString();
}
ponerHora(); setInterval(ponerHora, 15000);
const enlacesBarra = $$('.barra-ventanas a');

/* ============================================================
   PUNTERO
   ============================================================ */
const puntero = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, ultimo: -1e9 };
function moverPuntero(e){
  puntero.x = e.clientX; puntero.y = e.clientY;
  puntero.nx = e.clientX / innerWidth * 2 - 1; puntero.ny = e.clientY / innerHeight * 2 - 1;
  puntero.ultimo = performance.now();
}
addEventListener('pointermove', moverPuntero, { passive: true });
addEventListener('pointerdown', moverPuntero, { passive: true });

/* ============================================================
   TÍTULOS LETRA POR LETRA
   ============================================================ */
function partirLetras(el){
  const texto = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', texto);
  el.textContent = '';
  texto.split(' ').forEach((p, i, todas) => {
    const palabra = document.createElement('span');
    palabra.className = 'p-palabra'; palabra.setAttribute('aria-hidden', 'true');
    for (const letra of p){
      const mascara = document.createElement('span'); mascara.className = 'p-mascara';
      const l = document.createElement('span'); l.className = 'p-letra'; l.textContent = letra;
      mascara.appendChild(l); palabra.appendChild(mascara);
    }
    el.appendChild(palabra);
    if (i < todas.length - 1) el.appendChild(document.createTextNode(' '));
  });
}
$$('[data-partir]').forEach(partirLetras);

/* ============================================================
   PANTALLITAS OLED
   ============================================================ */
const buf = new Oled();                       // búfer de trabajo compartido
const pintores = [];
const nuevoPintor = (lienzo, op) => { const p = new Pintor(lienzo, op); pintores.push(p); return p; };
const visibles = new Set();
const observador = new IntersectionObserver(entradas => entradas.forEach(en => (en.isIntersecting ? visibles.add(en.target) : visibles.delete(en.target))), { rootMargin: '120px' });

const oledHeroe = $('#oledHeroe'), oledRespaldo = $('#oledRespaldo'), oledPaso = $('#oledPaso'),
      oledOjos = $('#oledOjos'), oledBento = $('#oledBento'), oledApp = $('#oledApp');
[oledHeroe, oledRespaldo, oledPaso, oledOjos, oledBento, oledApp].forEach(c => observador.observe(c));

const pintorHeroe = nuevoPintor(oledHeroe);
const pintorRespaldo = nuevoPintor(oledRespaldo, { brillo: true });
const pintorPaso = nuevoPintor(oledPaso);
const pintorOjos = nuevoPintor(oledOjos, { brillo: true });
const pintorBento = nuevoPintor(oledBento);
const pintorApp = nuevoPintor(oledApp);
const lienzoPantalla = document.createElement('canvas');      // textura de la pantalla 3D
const pintorPantalla = new Pintor(lienzoPantalla, { escala: 8, color: '#FFFFFF', apagado: '#1B1926', fondo: '#06060A', hueco: 0.1 });

const ojosHeroe = new Ojos(); ojosHeroe.paseo = false;
const ojosLlavero = new Ojos();
const ojosPaso = new Ojos();
const ojosDemo = new Ojos();
const ojosBento = new Ojos();
const ojosApp = new Ojos();
const arranqueLlavero = crearArranque(11);

const eventosHoy = [{ hora: '17:00', titulo: 'Dentista' }];
const eventosDemo = [{ hora: '09:00', titulo: 'Gimnasio' }, { hora: '13:30', titulo: 'Almuerzo con Juli' }, { hora: '17:00', titulo: 'Dentista' }];

function mirarHacia(ojos, el, ahora){
  if (ahora - puntero.ultimo > 2500) return;
  const r = el.getBoundingClientRect();
  ojos.mirar((puntero.x - (r.left + r.width / 2)) / (vw * 0.35), (puntero.y - (r.top + r.height / 2)) / (vh * 0.35), ahora);
}

/* ---------- Demo interactiva del botón (igual que el firmware) ---------- */
const botonFisico = $('#botonFisico'), estadoOjos = $('#estadoOjos');
const demo = { modo: 'apagado', est: null, inicio: 0, idx: 0, ultimoCambio: 0, clics: 0, ultimoClic: 0, esperando: false, presionado: false, tPresion: 0, largo: false, prendioSolo: false };
const ponerEstado = texto => { if (estadoOjos.textContent !== texto) estadoOjos.textContent = texto; };
function prenderDemo(ahora){
  demo.modo = 'arranque'; demo.est = crearArranque((Math.random() * 1e9) | 0); demo.inicio = ahora;
  ojosDemo.centrar(); ponerEstado('prendiendo…'); oledOjos.classList.remove('apagada');
}
function apagarDemo(){ demo.modo = 'apagado'; ponerEstado('apagado'); oledOjos.classList.add('apagada'); }
function apretar(ahora){
  demo.presionado = true; demo.tPresion = ahora; demo.largo = false;
  botonFisico.classList.add('apretado');
  if (demo.modo === 'arranque' && ahora - demo.inicio > 300){ demo.modo = 'ojos'; ponerEstado('ojos'); }   // saltea la animación
}
function soltar(ahora){
  if (!demo.presionado) return;
  demo.presionado = false;
  botonFisico.classList.remove('apretado');
  botonFisico.style.setProperty('--carga', 0);
  if (ahora - demo.tPresion < 800 && !demo.largo){ demo.clics++; demo.ultimoClic = ahora; demo.esperando = true; }
}
botonFisico.addEventListener('pointerdown', e => { e.preventDefault(); botonFisico.setPointerCapture?.(e.pointerId); apretar(performance.now()); });
botonFisico.addEventListener('pointerup', () => soltar(performance.now()));
botonFisico.addEventListener('pointercancel', () => soltar(performance.now()));
botonFisico.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat){ e.preventDefault(); apretar(performance.now()); } });
botonFisico.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); soltar(performance.now()); } });
oledOjos.classList.add('apagada');

$$('.animos button').forEach(b => {
  if (b.dataset.animo) b.setAttribute('aria-pressed', String(b.classList.contains('activo')));
  b.addEventListener('click', () => {
    const ahora = performance.now();
    if (demo.modo === 'apagado') prenderDemo(ahora);
    else if (demo.modo === 'eventos'){ demo.modo = 'ojos'; ponerEstado('ojos'); }
    if (b.dataset.animo){
      ojosDemo.ponerAnimo(b.dataset.animo);
      $$('.animos [data-animo]').forEach(x => { x.classList.toggle('activo', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    } else {
      ojosDemo.sacudir(b.dataset.accion, ahora);
    }
  });
});

function logicaDemo(ahora){
  if (demo.presionado && demo.modo !== 'apagado'){
    const c = (ahora - demo.tPresion) / 3000;
    botonFisico.style.setProperty('--carga', lim(c));
    if (c >= 1 && !demo.largo){ demo.largo = true; demo.clics = 0; demo.esperando = false; apagarDemo(); }
  }
  if (demo.esperando && ahora - demo.ultimoClic > 300){
    demo.esperando = false;
    if (demo.clics === 1){
      if (demo.modo === 'apagado') prenderDemo(ahora);
      else if (demo.modo === 'eventos'){ demo.modo = 'ojos'; ponerEstado('ojos'); }
      else if (demo.modo === 'ojos') ojosDemo.parpadear(ahora);
    } else if (demo.clics >= 2 && demo.modo !== 'apagado'){
      demo.modo = 'eventos'; demo.idx = 0; demo.ultimoCambio = ahora; ponerEstado('eventos de hoy');
    }
    demo.clics = 0;
  }
  if (demo.modo === 'arranque' && ahora - demo.inicio >= T_FIN){ demo.modo = 'ojos'; ponerEstado('ojos'); }
  if (demo.modo === 'eventos' && ahora - demo.ultimoCambio > 3000){ demo.idx++; demo.ultimoCambio = ahora; }
}

/* ============================================================
   ESTADO 3D (lo carga el director, lo dibuja escena3d.js)
   ============================================================ */
const estado3d = {
  estrella: { x: 0, y: 0, z: 0, escala: 0, giro: 0 },
  llavero: { x: 0, y: -10, z: 0, escala: 1, rotX: 0, rotY: 0, rotZ: 0, explosion: 0, visible: false, seguir: 0 },
  camara: { x: 0, y: 0, z: 14 },
  raton: { x: 0, y: 0 },
};
const aparicion = { v: 0 };            // entrada de la estrella del héroe
let escena = null, lienzoActivo = true, tiempoLlavero = 0, ultimoTiempoDibujado = -1;
const lienzo3d = $('#lienzo3d');

// three.js se descarga ya, pero la escena (que es lo pesado) se arma cuando termina la intro
const cargaEscena = import('./escena3d.js');
cargaEscena.catch(() => {});        // el error se maneja en armarEscena3d
function armarEscena3d(){
  return cargaEscena
    .then(m => {
      escena = m.crearEscena(lienzo3d, { lienzoPantalla, movil: !punteroFino });
      dibujarArranque(buf, arranqueLlavero, 0); pintorPantalla.pintar(buf); escena.pantallaCambiada();
    })
    .catch(err => { console.warn('Kynus: sin 3D', err); raiz.classList.add('sin3d'); });
}

/* ============================================================
   MEDIDAS
   ============================================================ */
let vw = innerWidth, vh = innerHeight;
let disposicion = calcularDisposicion();
function calcularDisposicion(){
  const aspecto = vw / vh;
  return { aspecto, W: 4.414 * aspecto, movil: aspecto < 0.85 || vw < 700, k: lim(aspecto / 0.6, 0.75, 1) };
}
const secciones = {};
const pista = $('#pistaComo'), seccionComo = $('#como');
let extraPista = 0, piezasPista = [];
function medirPista(){
  pista.style.transform = 'none';
  extraPista = Math.max(0, pista.offsetWidth - vw);
  seccionComo.style.height = `${Math.round(extraPista + vh * 1.3)}px`;
  piezasPista = $$(':scope > *', pista).map((el, i) => ({ el, i, izq: el.offsetLeft, ancho: el.offsetWidth, activo: false, local: -1 }));
}
function medir(){
  vw = innerWidth; vh = innerHeight; disposicion = calcularDisposicion();
  medirPista();
  const y = window.scrollY;
  for (const el of $$('main > section')){
    const r = el.getBoundingClientRect();
    secciones[el.id] = { el, top: r.top + y, alto: r.height, fin: r.top + y + r.height - vh };
  }
  pintores.forEach(p => p.ajustar());
  escena?.redimensionar();
  prepararCieloNoche();
  prepararCintas();
  nubes.forEach(n => { n.base = n.nube.offsetTop; });
}

/* ============================================================
   NUBES (parallax infinito)
   ============================================================ */
const nubes = $$('.nube').map((nube, i) => {
  const pos = document.createElement('span'); pos.className = 'nube-pos';
  nube.replaceWith(pos); pos.appendChild(nube);
  return { el: pos, nube, vel: 0.035 + i * 0.02, base: 0 };
});
function moverNubes(y){
  const rango = vh * 1.7;
  for (const n of nubes){
    let t = -((y * n.vel) % rango);
    if (n.base + t < -vh * 0.4) t += rango;
    n.el.style.transform = `translate3d(0, ${t.toFixed(1)}px, 0)`;
  }
}

/* ============================================================
   CINTAS DEL FINAL (marquesina que reacciona a la velocidad)
   ============================================================ */
const cintas = $('#cintas');
const pistasCinta = $$('.cinta-pista').map((el, i) => ({ el, x: 0, mitad: 1, dir: i === 0 ? -1 : 1, original: el.innerHTML }));
function prepararCintas(){
  for (const c of pistasCinta){
    c.el.innerHTML = c.original;
    let n = 0;
    while (c.el.scrollWidth < innerWidth * 1.3 && n++ < 10) c.el.innerHTML += c.original;
    c.el.innerHTML += c.el.innerHTML;
    c.mitad = c.el.scrollWidth / 2;
    c.x = c.dir > 0 ? -c.mitad : 0;
  }
}
function moverCintas(dt, velocidad){
  const v = 70 + Math.min(900, Math.abs(velocidad) * 22);
  for (const c of pistasCinta){
    c.x += c.dir * v * dt / 1000;
    if (c.x < -c.mitad) c.x += c.mitad;
    if (c.x > 0) c.x -= c.mitad;
    c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, 0, 0) skewX(${lim(-velocidad * 0.5, -14, 14).toFixed(2)}deg)`;
  }
}

/* ============================================================
   CIELO DE NOCHE (estrellas girando alrededor de la polar)
   ============================================================ */
const lienzoNoche = $('#cieloNoche'), ctxNoche = lienzoNoche.getContext('2d'), polarEl = $('.polar');
let estrellasNoche = [], polo = { x: 0, y: 0 }, dprNoche = 1;
function prepararCieloNoche(){
  dprNoche = Math.min(window.devicePixelRatio || 1, 1.75);
  const w = lienzoNoche.clientWidth || vw, h = lienzoNoche.clientHeight || vh;
  lienzoNoche.width = Math.round(w * dprNoche); lienzoNoche.height = Math.round(h * dprNoche);
  const px = disposicion.movil ? 0.5 : 0.64, py = disposicion.movil ? 0.2 : 0.34;
  polo = { x: px * w * dprNoche, y: py * h * dprNoche };
  polarEl.style.left = `${px * 100}%`; polarEl.style.top = `${py * 100}%`;
  const maxR = Math.hypot(w, h) * dprNoche;
  const colores = ['255,255,255', '255,255,255', '255,255,255', '201,164,242', '244,154,214', '166,216,247'];
  const cantidad = disposicion.movil ? 170 : 320;
  estrellasNoche = Array.from({ length: cantidad }, (_, i) => ({
    r: 30 * dprNoche + Math.pow(Math.random(), 0.8) * maxR,
    a: Math.random() * Math.PI * 2,
    t: (0.6 + Math.random() * 1.7) * dprNoche,
    c: colores[i % colores.length],
    b: 0.35 + Math.random() * 0.65,
  }));
}
function dibujarNoche(p, ahora){
  const ctx = ctxNoche;
  ctx.clearRect(0, 0, lienzoNoche.width, lienzoNoche.height);
  const giro = p * 1.9 + ahora * 0.00003;
  const rastro = 0.012 + 1.2 * suave(tramo(p, 0, 0.75));
  ctx.lineCap = 'round';
  for (const s of estrellasNoche){
    const fin = s.a + giro;
    ctx.lineWidth = s.t;
    ctx.strokeStyle = `rgba(${s.c},${(0.16 * s.b).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(polo.x, polo.y, s.r, fin - rastro, fin); ctx.stroke();
    ctx.strokeStyle = `rgba(${s.c},${(0.42 * s.b).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(polo.x, polo.y, s.r, fin - rastro * 0.3, fin); ctx.stroke();
    ctx.fillStyle = `rgba(${s.c},${s.b.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(polo.x + Math.cos(fin) * s.r, polo.y + Math.sin(fin) * s.r, s.t * 0.85, 0, Math.PI * 2); ctx.fill();
  }
}
const palabrasNombre = $$('.frase-gira .palabra'), ventanaPolar = $('.ventana-polar'), finalNombre = $('.nombre-final');

/* ============================================================
   CÓMO FUNCIONA: mini animaciones de cada tarjeta
   ============================================================ */
function tipear(el, f){
  const texto = el.dataset.tipear, n = Math.round(texto.length * lim(f));
  if (el._n !== n){ el.textContent = texto.slice(0, n); el._n = n; }
}
const lineasJson = $$('.json .l');
const miniCal = $('#miniCal');
const accionesPaso = [
  null,
  f => tipear($('.ilus-grabar [data-tipear]'), tramo(f, 0.2, 0.9)),
  f => tipear($('.consola [data-tipear]'), tramo(f, 0.15, 0.85)),
  f => { const n = Math.floor(tramo(f, 0.1, 0.85) * (lineasJson.length + 0.99)); lineasJson.forEach((l, i) => l.classList.toggle('visible', i < n)); },
  f => miniCal.classList.toggle('caido', f > 0.62),
  null,
  null,
];
let localPaso5 = 0;
function armarCalendario(){
  const hoy = new Date();
  const faltan = ((4 - hoy.getDay()) + 7) % 7 || 7;
  const jueves = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + faltan);
  const dos = n => String(n).padStart(2, '0');
  $('#jsonFecha').textContent = `"${jueves.getFullYear()}-${dos(jueves.getMonth() + 1)}-${dos(jueves.getDate())}"`;
  const primero = new Date(jueves.getFullYear(), jueves.getMonth(), 1);
  const dias = new Date(jueves.getFullYear(), jueves.getMonth() + 1, 0).getDate();
  const corrimiento = (primero.getDay() + 6) % 7;                       // la semana empieza el lunes
  const mes = jueves.toLocaleDateString('es-AR', { month: 'long' });
  let html = `<div class="cal-cabeza"><b>${mes}</b><span>${jueves.getFullYear()}</span></div><div class="cal-grilla">`;
  for (const d of ['L', 'M', 'M', 'J', 'V', 'S', 'D']) html += `<span class="cal-nombre" aria-hidden="true">${d}</span>`;
  for (let i = 0; i < corrimiento; i++) html += '<span></span>';
  for (let d = 1; d <= dias; d++){
    const esEvento = d === jueves.getDate();
    const esHoy = d === hoy.getDate() && hoy.getMonth() === jueves.getMonth();
    html += `<span class="cal-dia${esEvento ? ' cal-evento' : esHoy ? ' cal-hoy' : ''}">${d}${esEvento ? '<em class="cal-chip">17:00 Dentista</em>' : ''}</span>`;
  }
  miniCal.innerHTML = html + '</div>';
}

/* ============================================================
   DIRECTOR: todo lo que depende del scroll, en cada cuadro
   ============================================================ */
const E = estado3d.estrella, K = estado3d.llavero, C = estado3d.camara;
const noche = $('.noche');
const palabraLlavero = $('#palabraLlavero'), palabraAdentro = $('#palabraAdentro');
const fasesEl = $$('.fase'), tiempoEl = $('#tiempoOled'), medidorEl = $('#medidorOled'), progresoComo = $('#progresoComo');
const ventanaOjos = $('#ventanaOjos');
const telefono = $('#telefono'), pasosApp = $$('.app-pasos li'), appLlavero = $('.app-llavero');
const etiquetas = $$('.etiqueta3d').map(el => ({ el, parte: el.dataset.parte, visible: false, lado: el.dataset.lado, ladoFijo: el.dataset.lado }));
let faseActual = 0, nocheActual = -1, seccionActiva = '', pasoApp = 0, yPrevio = 0, velocidad = 0;
let palabraLlaveroOp = -1, palabraAdentroOp = -1, cintasOp = -1;

function director(ahora, dt){
  const S = secciones;
  if (!S.inicio) return;
  const y = posScroll();
  velocidad = lenis ? lenis.velocity : (y - yPrevio);
  yPrevio = y;
  const { W, movil, k } = disposicion;
  estado3d.raton.x = puntero.nx; estado3d.raton.y = puntero.ny;
  const enVista = s => y + vh > s.top && y < s.top + s.alto;

  moverNubes(y);

  /* ---- héroe: la estrella, que después se mete en la pantalla del llavero ---- */
  const e1 = tramo(y, S.llavero.top - vh, S.llavero.top);
  const p1 = tramo(y, S.llavero.top, S.llavero.fin);
  const s1 = tramo(y, S.llavero.fin, S.llavero.fin + vh * 0.9);
  const posEstrella = movil ? { x: 0, y: 2.25, e: 0.66 * k } : { x: Math.max(2.8, W * 0.5), y: 0.35, e: 1.3 };
  const posLlavero = movil ? { x: 0, y: 1.2, e: 0.5 * k } : { x: W * 0.3, y: -0.45, e: 0.64 };
  const ap = salida(aparicion.v), va = suave(e1);
  E.x = mezcla(posEstrella.x, posLlavero.x, va);
  E.y = mezcla(posEstrella.y, posLlavero.y, va);
  E.z = mezcla(0, 1.3, va);
  E.escala = posEstrella.e * ap * (1 - suave(tramo(e1, 0.45, 0.97)));
  E.giro = (1 - ap) * -Math.PI * 2 + e1 * Math.PI * 4;

  /* ---- final: la estrella vuelve ---- */
  const e8 = tramo(y, S.abrir.top - vh, S.abrir.top - vh * 0.1);
  if (e8 > 0){
    const pf = movil ? { y: 2.4, e: 0.64 * k } : { y: 1.75, e: 1.0 };
    const v8 = salida(e8);
    E.x = 0; E.y = mezcla(-7, pf.y, v8); E.z = 0; E.escala = pf.e * v8; E.giro = (1 - v8) * Math.PI * 3;
  }

  /* ---- el llavero ---- */
  let veLlavero = false;
  C.x = 0; C.y = 0; C.z = 14;
  if (e1 > 0.001 && s1 < 1){
    veLlavero = true;
    const v1 = salida(e1);
    K.x = posLlavero.x; K.y = mezcla(-10, posLlavero.y, v1) + s1 * s1 * 12;
    K.escala = posLlavero.e;
    K.rotX = mezcla(0.5, 0, v1) - 0.6 * s1;
    K.rotY = mezcla(-2.8, -0.6, v1) + 0.6 * suave(tramo(p1, 0, 0.3));
    K.rotZ = mezcla(-0.3, 0, v1);
    K.explosion = 0;
    K.seguir = tramo(p1, 0.78, 0.88);
    C.z = 14 - (movil ? 1.4 : 2.4) * suave(tramo(p1, 0.04, 0.3)) * (1 - suave(tramo(p1, 0.6, 0.9)));
    tiempoLlavero = tramo(p1, 0.03, 0.8) * T_FIN;
  }
  const e5 = tramo(y, S.adentro.top - vh, S.adentro.top);
  const p5 = tramo(y, S.adentro.top, S.adentro.fin);
  const s5 = tramo(y, S.adentro.fin, S.adentro.fin + vh);
  if (e5 > 0.001 && s5 < 1){
    veLlavero = true;
    const pa = movil ? { x: 0, y: 0.1, e: 0.5 * k, rx: -1.0, ry: 0.4 } : { x: W * 0.2, y: -0.5, e: 0.6, rx: -0.36, ry: 0.8 };
    const v5 = salida(e5);
    K.x = pa.x; K.y = mezcla(-11, pa.y, v5) + s5 * s5 * 12;
    K.escala = pa.e;
    K.rotX = mezcla(0.6, pa.rx, v5);
    K.rotY = mezcla(-1.6, pa.ry, v5) + 0.55 * suave(tramo(p5, 0.62, 1));
    K.rotZ = 0;
    K.explosion = suave(tramo(p5, 0.08, 0.6));
    K.seguir = 0.35;
    tiempoLlavero = T_FIN;
  }
  K.visible = veLlavero;

  const activa3d = E.escala > 0.003 || K.visible;
  if (activa3d !== lienzoActivo){ lienzoActivo = activa3d; lienzo3d.style.opacity = activa3d ? '1' : '0'; }

  /* ---- palabras gigantes y cintas (detrás) ---- */
  const opL = tramo(e1, 0.5, 1) * (1 - tramo(s1, 0, 0.6));
  if (Math.abs(opL - palabraLlaveroOp) > 0.001 || opL > 0){
    palabraLlaveroOp = opL;
    palabraLlavero.style.opacity = opL.toFixed(3);
    palabraLlavero.style.transform = `translate3d(${mezcla(8, -62, p1).toFixed(2)}%, -50%, 0)`;
  }
  const opA = tramo(e5, 0.5, 1) * (1 - tramo(s5, 0, 0.6));
  if (Math.abs(opA - palabraAdentroOp) > 0.001 || opA > 0){
    palabraAdentroOp = opA;
    palabraAdentro.style.opacity = opA.toFixed(3);
    palabraAdentro.style.transform = `translate3d(${mezcla(4, -58, p5).toFixed(2)}%, -50%, 0)`;
  }
  const opC = e8;
  if (opC !== cintasOp){ cintasOp = opC; cintas.style.opacity = opC.toFixed(3); }
  if (opC > 0) moverCintas(dt, velocidad);

  /* ---- noche ---- */
  const n = tramo(y, S.nombre.top - vh * 0.75, S.nombre.top - vh * 0.05) * (1 - tramo(y, S.nombre.fin + vh * 0.1, S.nombre.fin + vh * 0.8));
  if (Math.abs(n - nocheActual) > 0.002){ nocheActual = n; noche.style.opacity = n.toFixed(3); }

  /* ---- 1 · llavero: textos ---- */
  if (enVista(S.llavero)){
    const t = tiempoLlavero;
    const fase = t < 300 ? 0 : t < 800 ? 1 : t < 1700 ? 2 : t < 2650 ? 3 : t < T_FIN ? 4 : 5;
    if (fase !== faseActual){ fasesEl[faseActual].classList.remove('activa'); fasesEl[fase].classList.add('activa'); faseActual = fase; }
    tiempoEl.textContent = String(Math.round(t)).padStart(4, '0');
    medidorEl.style.transform = `scaleX(${p1.toFixed(4)})`;
  }

  /* ---- 2 · cómo funciona: pista horizontal ---- */
  if (enVista(S.como)){
    const p2 = tramo(tramo(y, S.como.top, S.como.fin), 0.06, 0.96);   // se queda un ratito en el título antes de arrancar
    pista.style.transform = `translate3d(${(-p2 * extraPista).toFixed(1)}px, 0, 0)`;
    progresoComo.style.transform = `scaleX(${p2.toFixed(4)})`;
    for (const pieza of piezasPista){
      const centro = pieza.izq - p2 * extraPista + pieza.ancho / 2;
      const d = (centro - vw / 2) / vw;
      if (pieza.el.classList.contains('paso')){
        pieza.el.style.transform = `translateY(${(Math.abs(d) * 46).toFixed(1)}px) rotate(${(d * 5).toFixed(2)}deg)`;
        const activo = Math.abs(d) < 0.42;
        if (activo !== pieza.activo){ pieza.activo = activo; pieza.el.classList.toggle('activo', activo); }
      }
      const local = tramo(centro, vw * 1.02, vw * 0.45);
      if (Math.abs(local - pieza.local) > 0.002){ pieza.local = local; accionesPaso[pieza.i]?.(local); }
      if (pieza.i === 5) localPaso5 = local;
    }
  }

  /* ---- 3 · los ojos: la ventana se inclina al entrar ---- */
  if (enVista(S.ojos)){
    const e3 = tramo(y, S.ojos.top - vh * 0.6, S.ojos.top + vh * 0.25);
    const se3 = suave(e3);
    ventanaOjos.style.transform = `translateY(${((1 - se3) * 90).toFixed(1)}px) rotateX(${((1 - se3) * 34).toFixed(2)}deg) scale(${(0.84 + 0.16 * se3).toFixed(4)})`;
    if (e3 > 0.85 && !demo.prendioSolo && demo.modo === 'apagado'){ demo.prendioSolo = true; prenderDemo(ahora); }
  }

  /* ---- 4 · el nombre ---- */
  if (enVista(S.nombre)){
    const p4 = tramo(y, S.nombre.top, S.nombre.fin);
    dibujarNoche(p4, ahora);
    palabrasNombre.forEach((w, i) => w.classList.toggle('visible', p4 > 0.03 + i * 0.055));
    ventanaPolar.classList.toggle('visible', p4 > 0.42);
    finalNombre.classList.toggle('visible', p4 > 0.6);
    polarEl.style.transform = `scale(${(1 + 0.25 * suave(tramo(p4, 0.3, 1)) + Math.sin(ahora / 600) * 0.03).toFixed(4)})`;
  }

  /* ---- 6 · la app ---- */
  if (enVista(S.app)){
    const p6 = tramo(y, S.app.top, S.app.fin), e6 = salida(tramo(y, S.app.top - vh, S.app.top));
    telefono.style.transform = `translateY(${((1 - e6) * 140).toFixed(1)}px) rotateY(${mezcla(-28, 16, p6).toFixed(2)}deg) rotateX(${mezcla(10, -4, p6).toFixed(2)}deg) rotateZ(${mezcla(-4, 2, p6).toFixed(2)}deg)`;
    const paso = p6 < 0.22 ? 0 : p6 < 0.47 ? 1 : p6 < 0.7 ? 2 : 3;
    if (paso !== pasoApp){
      pasoApp = paso; telefono.dataset.paso = paso;
      pasosApp.forEach((li, i) => li.classList.toggle('activo', i === paso));
      appLlavero.classList.toggle('visible', paso === 3);
    }
  }

  /* ---- barra de tareas: qué sección está a la vista ---- */
  const centro = y + vh * 0.5;
  let activa = '';
  for (const id of ['llavero', 'como', 'ojos', 'nombre', 'adentro', 'ficha', 'app']){
    const s = S[id]; if (centro >= s.top && centro < s.top + s.alto) activa = id === 'ficha' ? 'adentro' : id;
  }
  if (activa !== seccionActiva){ seccionActiva = activa; enlacesBarra.forEach(a => a.classList.toggle('activa', a.dataset.sec === activa)); }
}

/* ---------- Etiquetas pegadas a las piezas 3D ---------- */
const leyenda3d = $('.leyenda3d');
let leyendaVisible = false;
function moverEtiquetas(){
  const S = secciones.adentro;
  const y = posScroll();
  const enSeccion = y > S.top - vh * 0.2 && y < S.fin + vh * 0.3;
  const conLeyenda = enSeccion && K.visible && K.explosion > 0.3;
  if (conLeyenda !== leyendaVisible){ leyendaVisible = conLeyenda; leyenda3d.classList.toggle('visible', conLeyenda); }
  etiquetas.forEach((et, i) => {
    const mostrar = Boolean(escena) && enSeccion && K.visible && K.explosion > 0.35 + i * 0.08;
    if (mostrar !== et.visible){ et.visible = mostrar; et.el.classList.toggle('visible', mostrar); }
    if (!mostrar) return;
    const pr = escena.proyectar(et.parte);
    if (!pr) return;
    // En la compu cada etiqueta tiene su lado (alternados, para que no se pisen).
    // En el celular, hacia afuera según de qué lado de la pantalla quedó la pieza.
    const lado = disposicion.movil ? (pr.x > vw * 0.5 ? 'der' : 'izq') : et.ladoFijo;
    if (lado !== et.lado){ et.lado = lado; et.el.dataset.lado = lado; }
    et.el.style.transform = `translate3d(${pr.x.toFixed(1)}px, ${pr.y.toFixed(1)}px, 0)`;
  });
}

/* ============================================================
   PANTALLITAS: se dibujan sólo las que están a la vista
   ============================================================ */
function actualizarPantallas(ahora, dt){
  // Pantalla del llavero 3D (o la de respaldo si no hay 3D)
  const sin3d = raiz.classList.contains('sin3d');
  if ((escena && K.visible) || (sin3d && visibles.has(oledRespaldo))){
    let cambio = false;
    if (tiempoLlavero < T_FIN){
      if (Math.abs(tiempoLlavero - ultimoTiempoDibujado) > 0.5){ dibujarArranque(buf, arranqueLlavero, tiempoLlavero); ultimoTiempoDibujado = tiempoLlavero; cambio = true; }
    } else {
      if (ahora - puntero.ultimo < 2500){
        const pr = escena?.proyectar('pantalla');
        const cx = pr ? pr.x : vw * 0.7, cy = pr ? pr.y : vh * 0.5;
        ojosLlavero.mirar((puntero.x - cx) / (vw * 0.35), (puntero.y - cy) / (vh * 0.35), ahora);
      }
      ojosLlavero.actualizar(ahora, dt); ojosLlavero.dibujar(buf, ahora);
      ultimoTiempoDibujado = -1; cambio = true;
    }
    if (cambio){
      if (escena && pintorPantalla.pintar(buf)) escena.pantallaCambiada();   // sólo se sube la textura si cambió algo
      if (sin3d) pintorRespaldo.pintar(buf);
    }
  }
  if (visibles.has(oledHeroe)){
    if (ahora - puntero.ultimo < 2500) mirarHacia(ojosHeroe, oledHeroe, ahora);
    else { ojosHeroe.dx = ojosHeroe.xDef + Math.sin(ahora / 1300) * 8; ojosHeroe.dy = ojosHeroe.yDef * 1.9; }   // mira para abajo: "bajá"
    ojosHeroe.actualizar(ahora, dt); ojosHeroe.dibujar(buf, ahora); pintorHeroe.pintar(buf);
  }
  if (visibles.has(oledPaso)){
    if (localPaso5 > 0.55) dibujarEvento(buf, eventosHoy, 0);
    else { ojosPaso.mirar(-0.9, 0, ahora); ojosPaso.actualizar(ahora, dt); ojosPaso.dibujar(buf, ahora); }
    pintorPaso.pintar(buf);
  }
  if (visibles.has(oledOjos)){
    logicaDemo(ahora);
    if (demo.modo === 'apagado') buf.clearDisplay();
    else if (demo.modo === 'arranque') dibujarArranque(buf, demo.est, ahora - demo.inicio);
    else if (demo.modo === 'eventos') dibujarEvento(buf, eventosDemo, demo.idx);
    else { mirarHacia(ojosDemo, oledOjos, ahora); ojosDemo.actualizar(ahora, dt); ojosDemo.dibujar(buf, ahora); }
    pintorOjos.pintar(buf);
  }
  if (visibles.has(oledBento)){
    mirarHacia(ojosBento, oledBento, ahora); ojosBento.actualizar(ahora, dt); ojosBento.dibujar(buf, ahora); pintorBento.pintar(buf);
  }
  if (visibles.has(oledApp)){
    if (pasoApp === 3) dibujarEvento(buf, eventosHoy, 0);
    else { ojosApp.actualizar(ahora, dt); ojosApp.dibujar(buf, ahora); }
    pintorApp.pintar(buf);
  }
}

/* ============================================================
   CURSOR ESTRELLA (sólo con mouse)
   ============================================================ */
let moverCursor = () => {};
if (punteroFino && !sinMovimiento){
  const cursor = $('.cursor');
  addEventListener('pointermove', () => raiz.classList.add('con-cursor'), { once: true });   // aparece cuando se mueve el mouse
  let cx = puntero.x, cy = puntero.y, escalaC = 1, objetivo = 1, giro = 0;
  document.addEventListener('pointerover', e => { objetivo = e.target.closest('a, button') ? 1.9 : 1; });
  moverCursor = dt => {
    cx += (puntero.x - cx) * 0.38; cy += (puntero.y - cy) * 0.38;
    escalaC += (objetivo - escalaC) * 0.18;
    giro += dt * (objetivo > 1 ? 0.12 : 0.03);
    cursor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) rotate(${giro.toFixed(1)}deg) scale(${escalaC.toFixed(3)})`;
  };
  const colores = ['var(--rosa)', 'var(--lila)', '#fff', 'var(--celeste)'];
  const estela = Array.from({ length: 16 }, () => { const s = document.createElement('span'); s.className = 'chispita'; document.body.appendChild(s); return s; });
  let iEstela = 0, ux = 0, uy = 0;
  addEventListener('pointermove', e => {
    if (Math.hypot(e.clientX - ux, e.clientY - uy) < 30) return;
    ux = e.clientX; uy = e.clientY;
    const s = estela[iEstela++ % estela.length];
    s.style.left = `${ux - 6}px`; s.style.top = `${uy - 6}px`;
    s.style.setProperty('--c', colores[iEstela % colores.length]);
    s.animate([
      { transform: 'scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translateY(${14 + Math.random() * 18}px) scale(0) rotate(${Math.random() > 0.5 ? 140 : -140}deg)`, opacity: 0 },
    ], { duration: 760, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }, { passive: true });
}

/* ============================================================
   BOTONES "IMÁN"
   ============================================================ */
if (punteroFino && !sinMovimiento && hayGsap){
  $$('.iman').forEach(b => {
    const aX = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' });
    const aY = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); aX((e.clientX - r.left - r.width / 2) * 0.3); aY((e.clientY - r.top - r.height / 2) * 0.4); });
    b.addEventListener('pointerleave', () => { aX(0); aY(0); });
  });
}

/* ============================================================
   ENTRADAS CON GSAP
   ============================================================ */
function prepararEntradaHeroe(){
  if (!hayGsap || sinMovimiento){ aparicion.v = 1; return { play(){} }; }
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  tl.fromTo('.heroe-titulo .p-letra', { yPercent: 118, rotation: 14 }, { yPercent: 0, rotation: 0, duration: 1.3, stagger: 0.08 }, 0.1)
    .to(aparicion, { v: 1, duration: 2.4, ease: 'power3.out' }, 0)
    .from('.heroe-etiqueta', { y: 20, autoAlpha: 0, duration: 0.8 }, 0.15)
    .from('.heroe-lema', { y: 36, autoAlpha: 0, duration: 1 }, 0.5)
    .from('.heroe-sub', { y: 36, autoAlpha: 0, duration: 1 }, 0.6)
    .from('.heroe-botones .boton', { y: 30, scale: 0.7, autoAlpha: 0, duration: 0.9, ease: 'back.out(2)', stagger: 0.09 }, 0.7)
    .from('.heroe-ventana', { y: 90, rotation: -8, autoAlpha: 0, duration: 1.1 }, 0.75)
    .from('.heroe-chispas .chispa', { scale: 0, rotation: -120, duration: 1.2, ease: 'back.out(1.8)', stagger: 0.07 }, 0.3);
  return tl;
}
function armarAnimaciones(){
  if (!hayGsap || sinMovimiento) return;
  // El héroe se desarma al irse
  gsap.to('.heroe-titulo .p-mascara', { y: i => -(60 + (i % 3) * 55), rotation: i => (i % 2 ? 7 : -7), ease: 'none', scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.heroe-texto', { yPercent: -16, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#inicio', start: '15% top', end: '80% top', scrub: true } });
  gsap.to('.heroe-ventana', { yPercent: 60, xPercent: 20, ease: 'none', scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.heroe-chispas', { yPercent: -30, ease: 'none', scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom top', scrub: true } });
  // Títulos letra por letra
  $$('.titulo-cinetico').forEach(t => gsap.fromTo($$('.p-letra', t), { yPercent: 120, rotation: 12 }, {
    yPercent: 0, rotation: 0, duration: 1.1, ease: 'expo.out', stagger: 0.035,
    scrollTrigger: { trigger: t, start: 'top 90%', once: true },
  }));
  $$('.revelar').forEach(el => gsap.from(el, { y: 40, autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } }));
  gsap.from('.ojos-controles > *', { x: 60, autoAlpha: 0, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.ojos-cuerpo', start: 'top 80%', once: true } });
  gsap.from('.bento-item', { y: 90, rotation: i => (i % 2 ? 5 : -5), autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.bento', start: 'top 88%', once: true } });
  gsap.from('.abrir-centro > :not(h2)', { y: 40, autoAlpha: 0, stagger: 0.12, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.abrir-centro', start: 'top 90%', once: true } });
}

/* ============================================================
   INTRO: la pantallita se prende y se apaga como una tele vieja
   ============================================================ */
function correrIntro(){
  const capa = $('#arranque');
  if (!raiz.classList.contains('con-intro')){ capa.remove(); return Promise.resolve(); }
  try { sessionStorage.setItem('kynus_intro', '1'); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  const pintor = new Pintor($('#arranqueLienzo'), { brillo: true });
  const d = new Oled(), est = crearArranque(5), ojos = new Ojos();
  ojos.paseo = false; ojos.autoParpadeo = false;
  return new Promise(resolver => {
    const inicio = performance.now();
    let cerrado = false;
    const paso = () => {
      if (cerrado) return;
      const ahora = performance.now(), t = ahora - inicio;
      if (t < T_FIN) dibujarArranque(d, est, t);
      else {
        const s = t - T_FIN;
        if (s > 280 && !ojos._parpadeo){ ojos._parpadeo = true; ojos.parpadear(ahora); }
        if (s > 520) ojos.mirar(s < 860 ? -0.9 : s < 1200 ? 0.9 : 0, 0, ahora);
        ojos.actualizar(ahora, 16); ojos.dibujar(d, ahora);
      }
      pintor.pintar(d);
      if (t > T_FIN + 1500){ cerrar(); return; }
      requestAnimationFrame(paso);
    };
    function cerrar(){
      if (cerrado) return;
      cerrado = true;
      raiz.classList.remove('con-intro');       // la página de atrás vuelve a moverse mientras la tele se apaga
      capa.style.display = 'grid';
      resolver();
      const fin = () => { capa.remove(); };
      if (!hayGsap){ fin(); return; }
      gsap.set(capa, { clipPath: 'inset(0% 0% 0% 0%)' });
      gsap.timeline({ onComplete: fin })
        .to(capa.querySelectorAll('.arranque-pantalla, .arranque-pie, .arranque-saltear'), { opacity: 0, duration: 0.14 })
        .to(capa, { clipPath: 'inset(49.6% 0% 49.6% 0%)', backgroundColor: '#ffffff', duration: 0.38, ease: 'power3.in' }, 0.05)
        .to(capa, { clipPath: 'inset(49.6% 50% 49.6% 50%)', duration: 0.24, ease: 'power3.in' })
        .to(capa, { opacity: 0, duration: 0.12 });
    }
    capa.addEventListener('click', cerrar);
    addEventListener('keydown', function tecla(e){ if (['Escape', 'Enter', ' '].includes(e.key)){ removeEventListener('keydown', tecla); cerrar(); } });
    requestAnimationFrame(paso);
  });
}

/* ============================================================
   BUCLE PRINCIPAL
   ============================================================ */
let ultimo = performance.now();
function cuadro(){
  const ahora = performance.now(), dt = Math.min(64, ahora - ultimo);
  ultimo = ahora;
  if (raiz.classList.contains('con-intro')) return;   // mientras está la intro no se dibuja nada detrás
  director(ahora, dt);
  actualizarPantallas(ahora, dt);
  if (escena && lienzoActivo) escena.actualizar(estado3d, ahora);
  if (escena && secciones.adentro) moverEtiquetas();
  moverCursor(dt);
}
function arrancarBucle(){
  if (hayGsap) gsap.ticker.add(cuadro);
  else { const bucle = () => { cuadro(); requestAnimationFrame(bucle); }; requestAnimationFrame(bucle); }
}

/* ---------- Redimensionar ---------- */
let anchoPrevio = innerWidth, altoPrevio = innerHeight, temporizador = 0;
addEventListener('resize', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    const cambioAncho = innerWidth !== anchoPrevio, cambioAlto = Math.abs(innerHeight - altoPrevio) > 150;
    escena?.redimensionar();
    if (!cambioAncho && !cambioAlto) return;            // la barra del navegador del celular: no recalcular todo
    anchoPrevio = innerWidth; altoPrevio = innerHeight;
    medir();
    if (hayGsap) ScrollTrigger.refresh();
  }, 160);
});

/* ---------- Para revisar una sección directo: ?ir=como&p=0.5 ---------- */
function saltoDePrueba(){
  const id = parametros.get('ir');
  const S = id && secciones[id];
  if (!S) return;
  const p = parseFloat(parametros.get('p') || '0') || 0;
  const destino = S.top + Math.max(0, S.fin - S.top) * p;
  if (lenis) lenis.scrollTo(destino, { immediate: true, force: true });
  else window.scrollTo(0, destino);
}

/* ============================================================
   INICIO
   ============================================================ */
async function iniciar(){
  armarCalendario();
  cargarLetraPixel();
  medir();
  armarAnimaciones();
  const entrada = prepararEntradaHeroe();
  const conIntro = raiz.classList.contains('con-intro');
  if (lenis && conIntro) lenis.stop();
  arrancarBucle();
  await correrIntro();
  armarEscena3d();
  entrada.play();
  lenis?.start();
  if (document.fonts?.ready) await document.fonts.ready;
  medir();
  if (hayGsap) ScrollTrigger.refresh();
  saltoDePrueba();
}
iniciar();
