// ============================================================
//  KYNUS — animación de inicio (OLED SSD1306 128x64)
//
//  Está en tres partes para poder meter cosas en el medio (la frase):
//  1. animacionEstrella(): punto → línea de tele vieja → la línea gira y
//     se vuelve la estrella → la estrella "se estampa" como un sello
//  2. (frases.h) la estrella se achica, queda de iconito y se escribe la frase
//  3. desarmarEnOjos(): lo que haya en la pantalla (la estrella o la frase)
//     se desarma en granitos que viajan y forman los ojitos; desde ahí sigue
//     RoboEyes sin saltos
//
//  Uso simple (sin frase): animacionInicio(display, roboEyes, PIN_BOTON);
//  Apretar el botón durante la animación la saltea. Sin botón: pin = -1.
// ============================================================
#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>

namespace intro {

// Centro de la estrella en la pantalla
const int   CXI = 64, CYI = 31;
const float CX  = CXI, CY = CYI;
const float Q   = 0.78539816f;   // 45°

// Momentos de cada parte (ms desde que arranca)
const uint32_t T_PUNTO    = 150;   // pantalla negra → aparece el punto
const uint32_t T_LINEA    = 300;   // el punto se estira en línea
const uint32_t T_GIRO     = 800;   // la línea gira y se vuelve estrella
const uint32_t T_SELLO    = 1700;  // estrella estampada
const uint32_t T_DISUELVE = 2650;  // termina el sello

struct Brazo { float ang, largo, ancho; };

// La estrella del sello: brazo de abajo más largo y diagonales cortas, algo desparejas
const Brazo ESTRELLA[8] = {
  { 0,        36, 3.5f },   // derecha
  { PI,       36, 3.5f },   // izquierda
  { -HALF_PI, 28, 4.5f },   // arriba
  {  HALF_PI, 32, 4.5f },   // abajo
  { -Q,       15, 2.8f },   // diagonales
  { -3 * Q,   13, 2.8f },
  {  Q,       13, 2.8f },
  {  3 * Q,   14, 2.8f },
};

// Motitas de tinta alrededor: ángulo (°), distancia (%), largo (px)
const int16_t MOTAS[16][3] = {
  { 18,100,3}, { 32, 92,2}, { 55,105,3}, { 70, 88,2},
  {112, 95,3}, {128,102,2}, {150, 90,3}, {165,104,2},
  {196, 98,3}, {212, 90,2}, {236,104,3}, {250, 92,2},
  {290,100,2}, {305, 94,3}, {328,104,2}, {342, 90,3},
};

struct Particula { float sx, sy, tx, ty, nx, ny, arco; uint16_t retraso; };
const int MAX_PART = 180;

// ---------- Curvas de movimiento ----------
inline float lim(float v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }
inline float tramo(uint32_t t, uint32_t a, uint32_t b){ return lim(((float)t - (float)a) / (float)(b - a)); }
inline float suave(float x){ return x < 0.5f ? 4 * x * x * x : 1 - powf(-2 * x + 2, 3) / 2; }   // ease in-out
inline float salida(float x){ return 1 - powf(1 - x, 3); }                                       // ease out
inline float rebote(float x){ const float c1 = 1.70158f, c3 = c1 + 1;                            // ease out back
  return 1 + c3 * powf(x - 1, 3) + c1 * powf(x - 1, 2); }

// ¿Apretaron el botón para saltear? (pin = -1: no hay botón)
inline bool apretado(int pin, uint32_t t){ return pin >= 0 && t > 300 && digitalRead(pin) == LOW; }

// Ruido fijo por píxel (0-255): textura de tinta y disolución tramada
inline uint8_t ruido(int x, int y){
  uint32_t n = (uint32_t)x * 374761393u + (uint32_t)y * 668265263u;
  n = (n ^ (n >> 13)) * 1274126177u;
  return (n ^ (n >> 16)) & 0xFF;
}

inline bool dentroRedondeado(int x, int y, int ox, int oy, int w, int h, int r){
  if (x < ox || y < oy || x >= ox + w || y >= oy + h) return false;
  int cx = x < ox + r ? ox + r : (x > ox + w - 1 - r ? ox + w - 1 - r : x);
  int cy = y < oy + r ? oy + r : (y > oy + h - 1 - r ? oy + h - 1 - r : y);
  int dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// ---------- Dibujo ----------
// Un brazo = rombo alargado: angosto en el centro, más ancho en "pico" (30% del largo) y en punta al final
inline void brazo(Adafruit_SSD1306 &d, float ang, float largo, float ancho, float pico = 0.3f, float cx = CX, float cy = CY){
  if (largo < 0.5f) return;
  float dx = cosf(ang), dy = sinf(ang), px = -dy, py = dx;
  float bx = cx + dx * largo * pico, by = cy + dy * largo * pico;
  int16_t ox = lroundf(cx), oy = lroundf(cy);
  int16_t tx = lroundf(cx + dx * largo), ty = lroundf(cy + dy * largo);
  d.fillTriangle(ox, oy, lroundf(bx + px * ancho), lroundf(by + py * ancho), tx, ty, SSD1306_WHITE);
  d.fillTriangle(ox, oy, lroundf(bx - px * ancho), lroundf(by - py * ancho), tx, ty, SSD1306_WHITE);
  d.drawLine(ox, oy, tx, ty, SSD1306_WHITE);   // que los brazos finitos no desaparezcan
}

// largoH/anchoH: brazos horizontales (la línea). kV y kD: cuánto crecieron los verticales y diagonales.
// cx/cy: dónde va el centro (la frase la usa chiquita, de iconito)
inline void estrella(Adafruit_SSD1306 &d, float rot, float esc, float largoH, float anchoH, float kV, float kD,
                     float pico = 0.3f, float cx = CX, float cy = CY){
  for (int i = 0; i < 8; i++){
    const Brazo &b = ESTRELLA[i];
    float L, grosor;
    if (i < 2)      { L = largoH;          grosor = anchoH; }
    else if (i < 4) { L = b.largo * kV;    grosor = b.ancho * lim(kV * 1.3f); }
    else            { L = b.largo * kD;    grosor = b.ancho * lim(kD); }
    brazo(d, b.ang + rot, L * esc, grosor * esc, pico, cx, cy);
  }
}

// Las líneas blancas talladas que salen del centro (se "apagan" píxeles)
inline void grabado(Adafruit_SSD1306 &d, float k, float esc){
  if (k <= 0) return;
  for (int i = 0; i < 8; i++){
    const Brazo &b = ESTRELLA[i];
    float L = b.largo * esc * (i < 4 ? 0.55f : 0.6f) * k;
    if (L < 1) continue;
    d.drawLine(CXI, CYI, lroundf(CX + cosf(b.ang) * L), lroundf(CY + sinf(b.ang) * L), SSD1306_BLACK);
  }
}

// Textura de sello de goma: algunos poros sin tinta
inline void grano(Adafruit_SSD1306 &d){
  for (int y = 0; y < 64; y++)
    for (int x = 24; x < 104; x++)
      if (ruido(x, y) < 9 && d.getPixel(x, y)) d.drawPixel(x, y, SSD1306_BLACK);
}

inline void motas(Adafruit_SSD1306 &d, float t){
  for (int i = 0; i < 16; i++){
    float k = salida(lim((t - i * 25) / 180.f));
    if (k <= 0) continue;
    float a = MOTAS[i][0] * DEG_TO_RAD, r = MOTAS[i][1] / 100.f;
    float dx = cosf(a), dy = sinf(a), e = 0.9f + 0.1f * k;
    float x = CX + dx * 50 * r * e, y = CY + dy * 27 * r * e, l = MOTAS[i][2] * k;
    d.drawLine(lroundf(x), lroundf(y), lroundf(x + dx * l), lroundf(y + dy * l * 0.6f), SSD1306_WHITE);
  }
}

inline void estrellaFinal(Adafruit_SSD1306 &d){
  estrella(d, 0, 1, 36, 3.5f, 1, 1);
  grabado(d, 1, 1);
  grano(d);
}

} // namespace intro


// ---------- Parte 1: la estrella ----------
// Devuelve false si la saltearon con el botón
inline bool animacionEstrella(Adafruit_SSD1306 &d, int pinBoton){
  using namespace intro;
  randomSeed(micros());
  const uint32_t inicio = millis();

  while (true){
    const uint32_t t = millis() - inicio;
    if (t >= T_DISUELVE) break;
    if (apretado(pinBoton, t)) return false;
    d.clearDisplay();

    if (t < T_PUNTO){
      // negro
    }
    else if (t < T_LINEA){
      // Se enciende un punto en el medio
      d.fillCircle(CXI, CYI, lroundf(salida(tramo(t, T_PUNTO, T_LINEA)) * 2), SSD1306_WHITE);
    }
    else if (t < T_GIRO){
      // El punto se estira en una línea que titila, como un tubo de tele
      float k = salida(tramo(t, T_LINEA, T_LINEA + 300));
      float grosor = (t > T_LINEA + 300 && (t / 45) % 2) ? 0.7f : 1.3f;   // titila
      estrella(d, 0, 1, 2 + k * 56, grosor, 0, 0, 0.06f);   // gruesa en el centro, finita en las puntas
    }
    else if (t < T_SELLO){
      // Una vuelta completa: la línea se acorta y le crecen los otros brazos
      float u  = suave(tramo(t, T_GIRO, T_SELLO));
      float kV = salida(lim((u - 0.1f) / 0.8f));
      float kD = rebote(lim((u - 0.45f) / 0.55f));
      estrella(d, u * TWO_PI, 1, 58 + (36 - 58) * u, 1.3f + (3.5f - 1.3f) * u, kV, kD, 0.06f + 0.24f * u);
    }
    else {
      // Golpe de sello: rebotito, líneas talladas, textura y motitas
      float s   = t - T_SELLO;
      float esc = 1 + 0.10f * expf(-s / 90.f) * sinf(s / 40.f);
      estrella(d, 0, esc, 36, 3.5f, 1, 1);
      grabado(d, salida(tramo(t, T_SELLO + 80, T_SELLO + 400)), esc);
      if (s > 60)  grano(d);
      if (s > 100) motas(d, s - 100);
    }

    d.display();
    delay(2);
  }

  // Último cuadro del sello, quieto
  d.clearDisplay();
  estrellaFinal(d);
  motas(d, 1000);
  d.display();
  return true;
}


// RoboEyes sigue exactamente desde acá (ojos abiertos, en el centro)
template<typename Ojos>
void ojosListos(Adafruit_SSD1306 &d, Ojos &ojos){
  const int w = ojos.eyeLwidthDefault, h = ojos.eyeLheightDefault, r = ojos.eyeLborderRadiusDefault;
  const int lx = ojos.eyeLxDefault, ly = ojos.eyeLyDefault;
  const int rx = lx + w + ojos.spaceBetweenDefault, ry = ly;

  d.clearDisplay();
  d.fillRoundRect(lx, ly, w, h, r, SSD1306_WHITE);
  d.fillRoundRect(rx, ry, w, h, r, SSD1306_WHITE);
  d.display();

  ojos.eyeLwidthCurrent  = ojos.eyeLwidthNext  = w;
  ojos.eyeRwidthCurrent  = ojos.eyeRwidthNext  = ojos.eyeRwidthDefault;
  ojos.eyeLheightCurrent = ojos.eyeLheightNext = h;
  ojos.eyeRheightCurrent = ojos.eyeRheightNext = ojos.eyeRheightDefault;
  ojos.eyeLborderRadiusCurrent = ojos.eyeLborderRadiusNext = r;
  ojos.eyeRborderRadiusCurrent = ojos.eyeRborderRadiusNext = ojos.eyeRborderRadiusDefault;
  ojos.spaceBetweenCurrent = ojos.spaceBetweenNext = ojos.spaceBetweenDefault;
  ojos.eyeLx = ojos.eyeLxNext = lx;  ojos.eyeLy = ojos.eyeLyNext = ly;
  ojos.eyeRx = ojos.eyeRxNext = rx;  ojos.eyeRy = ojos.eyeRyNext = ry;
}


// ---------- Parte 3: lo que haya en pantalla se desarma en los ojos ----------
// desdeElCentro = true: se van primero las puntas (la estrella).
// false: se va desarmando de izquierda a derecha, como si se leyera (la frase).
template<typename Ojos>
void desarmarEnOjos(Adafruit_SSD1306 &d, Ojos &ojos, int pinBoton, bool desdeElCentro){
  using namespace intro;

  // Ojos tal como los dibuja RoboEyes
  const int w = ojos.eyeLwidthDefault, h = ojos.eyeLheightDefault, r = ojos.eyeLborderRadiusDefault;
  const int lx = ojos.eyeLxDefault, ly = ojos.eyeLyDefault;
  const int rx = lx + w + ojos.spaceBetweenDefault, ry = ly;

  // Copia de lo que se ve ahora: de acá salen los granitos y es lo que se va borrando
  static uint8_t fuente[128 * 64 / 8];
  uint8_t *buf = d.getBuffer();
  memcpy(fuente, buf, sizeof fuente);

  // Tomar granitos al azar de lo que está prendido
  static Particula part[MAX_PART];
  int vistos = 0;
  for (int y = 0; y < 64; y++)
    for (int x = 0; x < 128; x++){
      if (!d.getPixel(x, y)) continue;
      int slot = vistos < MAX_PART ? vistos : random(vistos + 1);
      vistos++;
      if (slot < MAX_PART){ part[slot].sx = x; part[slot].sy = y; }
    }
  const int nPart = vistos < MAX_PART ? vistos : MAX_PART;

  for (int i = 0; i < nPart; i++){
    Particula &p = part[i];
    bool izq = p.sx < CX || (p.sx == CX && random(2));
    int ox = izq ? lx : rx, oy = izq ? ly : ry;
    int tx = ox + w / 2, ty = oy + h / 2;
    for (int intento = 0; intento < 6; intento++){
      int cx = ox + random(w), cy = oy + random(h);
      if (dentroRedondeado(cx, cy, ox, oy, w, h, r)){ tx = cx; ty = cy; break; }
    }
    p.tx = tx; p.ty = ty;
    float vx = p.tx - p.sx, vy = p.ty - p.sy, m = sqrtf(vx * vx + vy * vy);
    if (m < 0.01f) m = 1;
    p.nx = -vy / m; p.ny = vx / m;
    p.arco = random(-12, 13);
    if (desdeElCentro){
      float dist = sqrtf((p.sx - CX) * (p.sx - CX) + (p.sy - CY) * (p.sy - CY));
      p.retraso = 260 * (1 - lim(dist / 36)) + random(90);   // las puntas se van primero
    } else {
      p.retraso = p.sx * 2.4f + p.sy * 0.8f + random(90);    // de izquierda a derecha, renglón por renglón
    }
  }

  const uint32_t inicio = millis();
  const uint32_t T_BORRA = desdeElCentro ? 380 : 520;   // cuánto tarda en borrarse lo de antes
  const uint32_t T_OJOS  = desdeElCentro ? 650 : 760;   // cuándo se empiezan a llenar los ojos
  const uint32_t T_FIN   = T_OJOS + 520;

  while (true){
    const uint32_t s = millis() - inicio;
    if (s >= T_FIN) break;
    if (apretado(pinBoton, s + 300)) break;
    d.clearDisplay();

    // Lo de antes se va borrando en trama
    float f = tramo(s, 0, T_BORRA);
    if (f < 1){
      memcpy(buf, fuente, sizeof fuente);
      uint8_t umbral = f * 255;
      for (int y = 0; y < 64; y++)
        for (int x = 0; x < 128; x++)
          if (ruido(x + 7, y + 3) < umbral && d.getPixel(x, y)) d.drawPixel(x, y, SSD1306_BLACK);
    }

    // Los ojos se van llenando
    float o = tramo(s, T_OJOS, T_OJOS + 430);
    if (o >= 1){
      d.fillRoundRect(lx, ly, w, h, r, SSD1306_WHITE);
      d.fillRoundRect(rx, ry, w, h, r, SSD1306_WHITE);
    } else if (o > 0){
      uint8_t umbral = o * 255;
      for (int y = ly; y < ly + h; y++)
        for (int x = 0; x < w; x++){
          if (ruido(lx + x, y) < umbral && dentroRedondeado(lx + x, y, lx, ly, w, h, r)) d.drawPixel(lx + x, y, SSD1306_WHITE);
          if (ruido(rx + x, y) < umbral && dentroRedondeado(rx + x, y, rx, ry, w, h, r)) d.drawPixel(rx + x, y, SSD1306_WHITE);
        }
    }

    // Granitos en viaje (con una estela de un píxel)
    for (int i = 0; i < nPart; i++){
      const Particula &p = part[i];
      float a = ((float)s - p.retraso) / 700.f;
      for (int k = 0; k < 2; k++){
        float q = suave(lim(a - k * 0.05f));
        float bomba = p.arco * sinf(PI * q);
        d.drawPixel(lroundf(p.sx + (p.tx - p.sx) * q + p.nx * bomba),
                    lroundf(p.sy + (p.ty - p.sy) * q + p.ny * bomba), SSD1306_WHITE);
      }
    }

    d.display();
    delay(2);
  }

  ojosListos(d, ojos);
}


// ---------- Todo junto, sin frase (como antes) ----------
template<typename Ojos>
void animacionInicio(Adafruit_SSD1306 &d, Ojos &ojos, int pinBoton){
  if (animacionEstrella(d, pinBoton)) desarmarEnOjos(d, ojos, pinBoton, true);
  else ojosListos(d, ojos);
}
