/* ============================================================
   KYNUS — pantalla OLED 128×64 simulada
   Misma lógica que el llavero:
   - arranque: llavero/animacion_inicio.h (punto → línea → estrella → ojos)
   - ojos: imitación de FluxGarage RoboEyes (parpadeo, humores, curiosidad)
   - eventos: igual que mostrarEventoActual() del firmware
   ============================================================ */
export const ANCHO = 128, ALTO = 64;
const BLANCO = 1, NEGRO = 0;
const PI = Math.PI, Q = PI / 4, R = Math.round;

const lim = v => v < 0 ? 0 : v > 1 ? 1 : v;
const tramo = (t, a, b) => lim((t - a) / (b - a));
const suave = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const salida = x => 1 - Math.pow(1 - x, 3);
const rebote = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

function ruido(x, y){
  let n = (Math.imul(x >>> 0, 374761393) + Math.imul(y >>> 0, 668265263)) >>> 0;
  n = Math.imul((n ^ (n >>> 13)) >>> 0, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) & 0xFF;
}
function dentroRedondeado(x, y, ox, oy, w, h, r){
  if (x < ox || y < oy || x >= ox + w || y >= oy + h) return false;
  const cx = x < ox + r ? ox + r : (x > ox + w - 1 - r ? ox + w - 1 - r : x);
  const cy = y < oy + r ? oy + r : (y > oy + h - 1 - r ? oy + h - 1 - r : y);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/* ---------- Pantalla monocromática (como Adafruit_SSD1306) ---------- */
export class Oled {
  constructor(){ this.px = new Uint8Array(ANCHO * ALTO); }
  clearDisplay(){ this.px.fill(0); }
  getPixel(x, y){ return x >= 0 && y >= 0 && x < ANCHO && y < ALTO ? this.px[y * ANCHO + x] : 0; }
  drawPixel(x, y, c){ x = R(x); y = R(y); if (x >= 0 && y >= 0 && x < ANCHO && y < ALTO) this.px[y * ANCHO + x] = c; }
  drawLine(x0, y0, x1, y1, c){
    x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (let i = 0; i < 400; i++){
      this.drawPixel(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy){ e += dy; x0 += sx; }
      if (e2 <= dx){ e += dx; y0 += sy; }
    }
  }
  drawFastHLine(x, y, w, c){ for (let i = 0; i < w; i++) this.drawPixel(x + i, y, c); }
  fillRect(x, y, w, h, c){ for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.drawPixel(x + i, y + j, c); }
  fillTriangle(x0, y0, x1, y1, x2, y2, c){
    x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1); x2 = R(x2); y2 = R(y2);
    const minX = Math.max(0, Math.min(x0, x1, x2)), maxX = Math.min(ANCHO - 1, Math.max(x0, x1, x2));
    const minY = Math.max(0, Math.min(y0, y1, y2)), maxY = Math.min(ALTO - 1, Math.max(y0, y1, y2));
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0){ this.drawLine(x0, y0, x1, y1, c); this.drawLine(x1, y1, x2, y2, c); return; }
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++){
      const w0 = (x1 - x) * (y2 - y) - (x2 - x) * (y1 - y);
      const w1 = (x2 - x) * (y0 - y) - (x0 - x) * (y2 - y);
      const w2 = (x0 - x) * (y1 - y) - (x1 - x) * (y0 - y);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) this.px[y * ANCHO + x] = c;
    }
  }
  fillCircle(cx, cy, r, c){ for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.drawPixel(cx + x, cy + y, c); }
  fillRoundRect(ox, oy, w, h, r, c){
    ox = R(ox); oy = R(oy); w = R(w); h = R(h); r = Math.max(0, Math.min(R(r), Math.floor(w / 2), Math.floor(h / 2)));
    const y0 = Math.max(0, oy), y1 = Math.min(ALTO, oy + h), x0 = Math.max(0, ox), x1 = Math.min(ANCHO, ox + w);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (dentroRedondeado(x, y, ox, oy, w, h, r)) this.px[y * ANCHO + x] = c;
  }
}

/* ============================================================
   ARRANQUE — igual que animacion_inicio.h
   ============================================================ */
const CXI = 64, CYI = 31, CX = CXI, CY = CYI;
export const T_PUNTO = 150, T_LINEA = 300, T_GIRO = 800, T_SELLO = 1700, T_DISUELVE = 2650, T_FIN = 3950;
const ESTRELLA = [[0, 36, 3.5], [PI, 36, 3.5], [-PI / 2, 28, 4.5], [PI / 2, 32, 4.5], [-Q, 15, 2.8], [-3 * Q, 13, 2.8], [Q, 13, 2.8], [3 * Q, 14, 2.8]];
const MOTAS = [[18,100,3],[32,92,2],[55,105,3],[70,88,2],[112,95,3],[128,102,2],[150,90,3],[165,104,2],[196,98,3],[212,90,2],[236,104,3],[250,92,2],[290,100,2],[305,94,3],[328,104,2],[342,90,3]];
const OJO = { w: 36, h: 36, r: 8, lx: 23, ly: 14, rx: 23 + 36 + 10, ry: 14 };
const MAX_PART = 160;

function brazo(d, ang, largo, ancho, pico = 0.3){
  if (largo < 0.5) return;
  const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
  const bx = CX + dx * largo * pico, by = CY + dy * largo * pico, tx = R(CX + dx * largo), ty = R(CY + dy * largo);
  d.fillTriangle(CXI, CYI, R(bx + px * ancho), R(by + py * ancho), tx, ty, BLANCO);
  d.fillTriangle(CXI, CYI, R(bx - px * ancho), R(by - py * ancho), tx, ty, BLANCO);
  d.drawLine(CXI, CYI, tx, ty, BLANCO);
}
function estrella(d, rot, esc, largoH, anchoH, kV, kD, pico = 0.3){
  ESTRELLA.forEach(([ang, largo, ancho], i) => {
    let L, g;
    if (i < 2){ L = largoH; g = anchoH; }
    else if (i < 4){ L = largo * kV; g = ancho * lim(kV * 1.3); }
    else { L = largo * kD; g = ancho * lim(kD); }
    brazo(d, ang + rot, L * esc, g * esc, pico);
  });
}
function grabado(d, k, esc){
  if (k <= 0) return;
  ESTRELLA.forEach(([ang, largo], i) => {
    const L = largo * esc * (i < 4 ? 0.55 : 0.6) * k; if (L < 1) return;
    d.drawLine(CXI, CYI, R(CX + Math.cos(ang) * L), R(CY + Math.sin(ang) * L), NEGRO);
  });
}
function grano(d){ for (let y = 0; y < 64; y++) for (let x = 24; x < 104; x++) if (ruido(x, y) < 9 && d.getPixel(x, y)) d.px[y * ANCHO + x] = NEGRO; }
function motas(d, t){
  MOTAS.forEach(([a, r, l], i) => {
    const k = salida(lim((t - i * 25) / 180)); if (k <= 0) return;
    const ar = a * PI / 180, dx = Math.cos(ar), dy = Math.sin(ar), e = 0.9 + 0.1 * k;
    const x = CX + dx * 50 * (r / 100) * e, y = CY + dy * 27 * (r / 100) * e, ll = l * k;
    d.drawLine(R(x), R(y), R(x + dx * ll), R(y + dy * ll * 0.6), BLANCO);
  });
}
function estrellaFinal(d){ estrella(d, 0, 1, 36, 3.5, 1, 1); grabado(d, 1, 1); grano(d); }

/** Estado de una animación de arranque (las partículas se sortean una sola vez). */
export function crearArranque(semilla = 7){ return { part: [], capturada: false, semilla: (semilla >>> 0) || 7 }; }
function azar(est, n){ est.semilla = (Math.imul(est.semilla, 1664525) + 1013904223) >>> 0; return est.semilla % n; }

/** Dibuja el cuadro del arranque en el momento t (ms). Sirve para reproducir o para "rebobinar" con el scroll. */
export function dibujarArranque(d, est, t){
  const { w, h, r, lx, ly, rx, ry } = OJO;
  d.clearDisplay();
  if (t >= T_FIN){ d.fillRoundRect(lx, ly, w, h, r, BLANCO); d.fillRoundRect(rx, ry, w, h, r, BLANCO); return; }
  if (t < T_PUNTO){ return; }
  if (t < T_LINEA){ d.fillCircle(CXI, CYI, R(salida(tramo(t, T_PUNTO, T_LINEA)) * 2), BLANCO); return; }
  if (t < T_GIRO){
    const k = salida(tramo(t, T_LINEA, T_LINEA + 300));
    const g = (t > T_LINEA + 300 && Math.floor(t / 45) % 2) ? 0.7 : 1.3;
    estrella(d, 0, 1, 2 + k * 56, g, 0, 0, 0.06);
    return;
  }
  if (t < T_SELLO){
    const u = suave(tramo(t, T_GIRO, T_SELLO));
    estrella(d, u * 2 * PI, 1, 58 + (36 - 58) * u, 1.3 + (3.5 - 1.3) * u, salida(lim((u - 0.1) / 0.8)), rebote(lim((u - 0.45) / 0.55)), 0.06 + 0.24 * u);
    return;
  }
  if (t < T_DISUELVE){
    const s = t - T_SELLO, esc = 1 + 0.10 * Math.exp(-s / 90) * Math.sin(s / 40);
    estrella(d, 0, esc, 36, 3.5, 1, 1);
    grabado(d, salida(tramo(t, T_SELLO + 80, T_SELLO + 400)), esc);
    if (s > 60) grano(d);
    if (s > 100) motas(d, s - 100);
    return;
  }
  const s = t - T_DISUELVE;
  if (!est.capturada){
    d.clearDisplay(); estrellaFinal(d);
    let vistos = 0; const part = est.part;
    for (let y = 0; y < 64; y++) for (let x = 16; x < 112; x++){
      if (!d.getPixel(x, y)) continue;
      const slot = vistos < MAX_PART ? vistos : azar(est, vistos + 1); vistos++;
      if (slot < MAX_PART) part[slot] = { sx: x, sy: y };
    }
    part.length = Math.min(vistos, MAX_PART);
    for (const p of part){
      const izq = p.sx < CX || (p.sx === CX && azar(est, 2));
      const ox = izq ? lx : rx, oy = izq ? ly : ry;
      let tx = ox + w / 2, ty = oy + h / 2;
      for (let i = 0; i < 6; i++){ const cx = ox + azar(est, w), cy = oy + azar(est, h); if (dentroRedondeado(cx, cy, ox, oy, w, h, r)){ tx = cx; ty = cy; break; } }
      p.tx = tx; p.ty = ty;
      const vx = tx - p.sx, vy = ty - p.sy; let m = Math.hypot(vx, vy); if (m < 0.01) m = 1;
      p.nx = -vy / m; p.ny = vx / m; p.arco = azar(est, 25) - 12;
      p.retraso = Math.floor(260 * (1 - lim(Math.hypot(p.sx - CX, p.sy - CY) / 36)) + azar(est, 90));
    }
    est.capturada = true; d.clearDisplay();
  }
  const f = tramo(t, T_DISUELVE, T_DISUELVE + 380);
  if (f < 1){
    estrellaFinal(d); if (s < 150) motas(d, 1000);
    const umbral = Math.floor(f * 255);
    for (let y = 0; y < 64; y++) for (let x = 16; x < 112; x++) if (ruido(x + 7, y + 3) < umbral && d.getPixel(x, y)) d.px[y * ANCHO + x] = NEGRO;
  }
  const o = tramo(t, T_DISUELVE + 650, T_DISUELVE + 1080);
  if (o >= 1){ d.fillRoundRect(lx, ly, w, h, r, BLANCO); d.fillRoundRect(rx, ry, w, h, r, BLANCO); }
  else if (o > 0){
    const umbral = Math.floor(o * 255);
    for (let y = ly; y < ly + h; y++) for (let x = 0; x < w; x++){
      if (ruido(lx + x, y) < umbral && dentroRedondeado(lx + x, y, lx, ly, w, h, r)) d.drawPixel(lx + x, y, BLANCO);
      if (ruido(rx + x, y) < umbral && dentroRedondeado(rx + x, y, rx, ry, w, h, r)) d.drawPixel(rx + x, y, BLANCO);
    }
  }
  for (const p of est.part){
    const a = (s - p.retraso) / 700;
    for (let k = 0; k < 2; k++){
      const q = suave(lim(a - k * 0.05)), bomba = p.arco * Math.sin(PI * q);
      d.drawPixel(R(p.sx + (p.tx - p.sx) * q + p.nx * bomba), R(p.sy + (p.ty - p.sy) * q + p.ny * bomba), BLANCO);
    }
  }
}

/** La estrella sellada, quieta (para pantallitas decorativas). */
export function dibujarEstrella(d){ d.clearDisplay(); estrellaFinal(d); motas(d, 1000); }

/* ============================================================
   OJOS — como FluxGarage RoboEyes
   ============================================================ */
export class Ojos {
  constructor(){
    this.ancho = 36; this.alto = 36; this.radio = 8; this.espacio = 10;
    this.xDef = (ANCHO - (this.ancho * 2 + this.espacio)) / 2;   // 23
    this.yDef = (ALTO - this.alto) / 2;                           // 14
    this.x = this.xDef; this.y = this.yDef; this.dx = this.xDef; this.dy = this.yDef;
    this.altoI = this.alto; this.altoD = this.alto;
    this.finParpadeo = 0; this.proximoParpadeo = 1500;
    this.animo = 'normal';
    this.cansado = 0; this.enojado = 0; this.feliz = 0;
    this.sacudida = null; this.cuadro = 0;
    this.ultimoMirar = -1e9; this.proximoPaseo = 0;
    this.paseo = true; this.curioso = true; this.autoParpadeo = true;
  }
  /** nx, ny entre -1 y 1 (hacia dónde mira) */
  mirar(nx, ny, ahora){
    nx = Math.max(-1, Math.min(1, nx)); ny = Math.max(-1, Math.min(1, ny));
    this.dx = this.xDef + nx * this.xDef; this.dy = this.yDef + ny * this.yDef;
    this.ultimoMirar = ahora;
  }
  centrar(){ this.dx = this.xDef; this.dy = this.yDef; }
  parpadear(ahora){ this.finParpadeo = ahora + 130; }
  ponerAnimo(animo){ this.animo = animo; }
  sacudir(tipo, ahora){ this.sacudida = { tipo, fin: ahora + 650 }; }   // 'confundido' (horizontal) o 'risa' (vertical)
  actualizar(ahora, dt = 16){
    if (this.autoParpadeo && ahora > this.proximoParpadeo){ this.parpadear(ahora); this.proximoParpadeo = ahora + 3000 + Math.random() * 2000; }
    if (this.paseo && ahora - this.ultimoMirar > 2600 && ahora > this.proximoPaseo){
      this.dx = Math.random() * this.xDef * 2; this.dy = Math.random() * this.yDef * 2;
      this.proximoPaseo = ahora + 1400 + Math.random() * 2200;
    }
    const k = 1 - Math.pow(0.5, dt / 16);            // RoboEyes: la mitad del camino por cuadro
    this.x += (this.dx - this.x) * k; this.y += (this.dy - this.y) * k;
    const cerrado = ahora < this.finParpadeo;
    let objI = cerrado ? 1 : this.alto, objD = cerrado ? 1 : this.alto;
    if (!cerrado && this.curioso){
      if (this.dx <= 10) objI += 8;
      if (this.dx >= this.xDef * 2 - 10) objD += 8;
    }
    this.altoI += (objI - this.altoI) * k; this.altoD += (objD - this.altoD) * k;
    const mitad = this.altoI / 2;
    this.cansado += ((this.animo === 'cansado' ? mitad : 0) - this.cansado) * k;
    this.enojado += ((this.animo === 'enojado' ? mitad : 0) - this.enojado) * k;
    this.feliz   += ((this.animo === 'feliz'   ? mitad : 0) - this.feliz) * k;
    this.cuadro++;
  }
  dibujar(d, ahora){
    d.clearDisplay();
    let x = this.x, y = this.y;
    if (this.sacudida){
      if (ahora > this.sacudida.fin) this.sacudida = null;
      else if (this.sacudida.tipo === 'confundido') x += (this.cuadro % 4 < 2 ? 10 : -10);
      else y += (this.cuadro % 4 < 2 ? 2.5 : -2.5);
    }
    const hI = Math.max(1, R(this.altoI)), hD = Math.max(1, R(this.altoD));
    const xI = R(x), xD = R(x + this.ancho + this.espacio);
    const yI = R(y + (this.alto - hI) / 2), yD = R(y + (this.alto - hD) / 2);
    const w = this.ancho;
    d.fillRoundRect(xI, yI, w, hI, this.radio, BLANCO);
    d.fillRoundRect(xD, yD, w, hD, this.radio, BLANCO);
    const tc = R(this.cansado), te = R(this.enojado), tf = R(this.feliz);
    if (tc > 0){
      d.fillTriangle(xI, yI - 1, xI + w, yI - 1, xI, yI + tc - 1, NEGRO);
      d.fillTriangle(xD, yD - 1, xD + w, yD - 1, xD + w, yD + tc - 1, NEGRO);
    }
    if (te > 0){
      d.fillTriangle(xI, yI - 1, xI + w, yI - 1, xI + w, yI + te - 1, NEGRO);
      d.fillTriangle(xD, yD - 1, xD + w, yD - 1, xD, yD + te - 1, NEGRO);
    }
    if (tf > 0){
      d.fillRoundRect(xI - 1, (yI + hI) - tf + 1, w + 2, this.alto, this.radio, NEGRO);
      d.fillRoundRect(xD - 1, (yD + hD) - tf + 1, w + 2, this.alto, this.radio, NEGRO);
    }
  }
}

/* ============================================================
   TEXTO Y EVENTOS (fuente pixelada "Press Start 2P", 8 px)
   ============================================================ */
let lienzoLetras = null, ctxLetras = null;
export function cargarLetraPixel(){
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return document.fonts.load('8px "Press Start 2P"').catch(() => {});
}
export function escribir(d, texto, x, y){
  if (!lienzoLetras){
    lienzoLetras = document.createElement('canvas'); lienzoLetras.width = ANCHO; lienzoLetras.height = ALTO;
    ctxLetras = lienzoLetras.getContext('2d', { willReadFrequently: true });
  }
  ctxLetras.clearRect(0, 0, ANCHO, ALTO);
  ctxLetras.font = '8px "Press Start 2P", monospace';
  ctxLetras.textBaseline = 'alphabetic';     // la línea de base en un píxel exacto: así las letras no quedan "entre" píxeles
  ctxLetras.fillStyle = '#fff';
  ctxLetras.fillText(texto, Math.round(x), Math.round(y) + 7);
  const datos = ctxLetras.getImageData(0, 0, ANCHO, ALTO).data;
  for (let i = 0; i < ANCHO * ALTO; i++) if (datos[i * 4 + 3] > 200) d.px[i] = BLANCO;   // sólo píxeles llenos (sin el borde suavizado)
}
function partir(texto, max){
  const lineas = []; let linea = '';
  for (const palabra of texto.split(' ')){
    const prueba = linea ? linea + ' ' + palabra : palabra;
    if (prueba.length > max && linea){ lineas.push(linea); linea = palabra; } else linea = prueba;
  }
  if (linea) lineas.push(linea);
  return lineas;
}
/** Igual que mostrarEventoActual() del llavero */
export function dibujarEvento(d, eventos, i){
  d.clearDisplay();
  if (!eventos.length){ escribir(d, 'Sin eventos hoy', 4, 28); return; }
  const ev = eventos[i % eventos.length];
  escribir(d, `EVENTO ${(i % eventos.length) + 1}/${eventos.length}`, 0, 2);
  d.drawFastHLine(0, 10, 128, BLANCO);
  escribir(d, `Hora: ${ev.hora}`, 0, 18);
  partir(ev.titulo, 16).slice(0, 3).forEach((l, k) => escribir(d, l, 0, 34 + k * 10));
}

/* ============================================================
   PINTOR — dibuja el búfer con grilla de píxeles (y brillo opcional)
   ============================================================ */
export class Pintor {
  constructor(lienzo, opciones = {}){
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d');
    this.color = opciones.color || '#EEEBFB';
    this.apagado = opciones.apagado || '#16151E';
    this.fondo = opciones.fondo || '#0A0A10';
    this.hueco = opciones.hueco ?? 0.14;
    this.brillo = opciones.brillo ?? false;
    this.escalaFija = opciones.escala || 0;
    this.chico = document.createElement('canvas'); this.chico.width = ANCHO; this.chico.height = ALTO;
    this.cctx = this.chico.getContext('2d');
    this.imagen = this.cctx.createImageData(ANCHO, ALTO);
    this.anterior = new Uint8Array(ANCHO * ALTO);
    this.yaPintado = false;
    this.s = 0;
    this.ajustar();
  }
  ajustar(){
    let s = this.escalaFija;
    if (!s){
      const ancho = this.lienzo.clientWidth || this.lienzo.parentElement?.clientWidth || 256;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      s = Math.max(2, Math.floor((ancho * dpr) / ANCHO));
    }
    if (s === this.s) return;
    this.s = s;
    this.yaPintado = false;
    this.lienzo.width = ANCHO * s; this.lienzo.height = ALTO * s;
    this.grilla = document.createElement('canvas');
    this.grilla.width = ANCHO * s; this.grilla.height = ALTO * s;
    const g = this.grilla.getContext('2d');
    g.fillStyle = this.fondo; g.fillRect(0, 0, ANCHO * s, ALTO * s);
    const h = s >= 4 ? Math.max(0.5, s * this.hueco / 2) : 0, t = s - 2 * h;
    g.fillStyle = this.apagado;
    for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) g.fillRect(x * s + h, y * s + h, t, t);
    this.h = h; this.t = t;
  }
  /** Dibuja el búfer. Si es igual al último que dibujó, no hace nada y devuelve false. */
  pintar(d){
    if (this.yaPintado){
      const a = this.anterior, b = d.px;
      let igual = true;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]){ igual = false; break; }
      if (igual) return false;
    }
    this.anterior.set(d.px);
    this.yaPintado = true;
    const { ctx, s, h, t } = this;
    ctx.drawImage(this.grilla, 0, 0);
    if (this.brillo){
      const datos = this.imagen.data;
      for (let i = 0; i < ANCHO * ALTO; i++){ const j = i * 4; datos[j] = 236; datos[j + 1] = 220; datos[j + 2] = 255; datos[j + 3] = d.px[i] ? 255 : 0; }
      this.cctx.putImageData(this.imagen, 0, 0);
      // Brillo barato: la imagen chiquita agrandada con suavizado (sin filtros de desenfoque, que son caros)
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      for (const [extra, alfa] of [[0, 0.45], [1.2, 0.22], [2.6, 0.12]]){
        const e = extra * s;
        ctx.globalAlpha = alfa;
        ctx.drawImage(this.chico, -e, -e * 0.5, ANCHO * s + 2 * e, ALTO * s + e);
      }
      ctx.restore();
    }
    ctx.fillStyle = this.color;
    const px = d.px;
    for (let y = 0; y < ALTO; y++){
      const fila = y * ANCHO;
      for (let x = 0; x < ANCHO; x++) if (px[fila + x]) ctx.fillRect(x * s + h, y * s + h, t, t);
    }
    return true;
  }
}
