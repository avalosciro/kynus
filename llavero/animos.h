// ============================================================
//  KYNUS — estados de ánimo de los ojos
//
//  Cada tanto los ojos cambian de mood solos y después vuelven a la
//  normalidad un rato. Algunos usan lo que ya trae RoboEyes (feliz,
//  cansado, enojado, sudor, mirar para los costados) y otros agregan
//  dibujitos encima de los ojos: lágrima, corazones, Zzz, "?", "!" y
//  estrellitas de 8 puntas (las de Kynus).
//
//  PantallaKynus: es la misma pantalla de siempre, pero justo antes de
//  mandar cada cuadro al OLED deja dibujar algo encima (los extras).
// ============================================================
#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <FluxGarage_RoboEyes.h>   // HAPPY, TIRED, ON, OFF…

class PantallaKynus : public Adafruit_SSD1306 {
public:
  PantallaKynus(uint8_t w, uint8_t h, TwoWire *twi, int8_t rst) : Adafruit_SSD1306(w, h, twi, rst) {}
  void (*antesDeMostrar)() = nullptr;   // se llama justo antes de mandar el cuadro
  void display(){
    if (antesDeMostrar) antesDeMostrar();
    Adafruit_SSD1306::display();
  }
};

// Ojo: FluxGarage_RoboEyes.h define macros de una letra (N, E, S, W) y ON/OFF/DEFAULT,
// por eso acá no se usan esos nombres para nada más.

enum Animo : uint8_t {
  NEUTRO, FELIZ, CANSADO, TRISTE, ENOJADO, SORPRENDIDO, CURIOSO,
  ENAMORADO, DORMIDO, NERVIOSO, CONFUNDIDO, PICARO, EMOCIONADO, CANT_ANIMOS
};
const char *const NOMBRE_ANIMO[CANT_ANIMOS] = {
  "neutro", "feliz", "cansado", "triste", "enojado", "sorprendido", "curioso",
  "enamorado", "dormido", "nervioso", "confundido", "picaro", "emocionado"
};
// Qué tan seguido sale cada uno (los alegres un poco más)
const uint8_t PESO_ANIMO[CANT_ANIMOS] = { 0, 5, 2, 1, 1, 2, 4, 2, 1, 1, 2, 3, 3 };

// Cuánto dura cada cosa (ms)
#define ANIMO_DURA_MIN   9000    // un mood dura entre 9 y 20 s
#define ANIMO_DURA_MAX  20000
#define NEUTRO_DURA_MIN 15000    // y entre moods, 15 a 35 s normal
#define NEUTRO_DURA_MAX 35000

template<typename Pantalla, typename Ojos>
class Animos {
public:
  Animos(Pantalla &d, Ojos &o) : d(d), o(o) {}

  Animo actual = NEUTRO;

  // Se llama cuando termina un mood. Si devuelve true, el llavero se ocupa de la pantalla
  // (por ejemplo, para mostrar los próximos días) y después vuelve con poner().
  bool (*alTerminar)() = nullptr;

  // Después del arranque: un rato normal y después empiezan los cambios
  void empezar(){
    poner(NEUTRO, random(8000, 14000));
  }

  void poner(Animo a, uint32_t dura){
    reiniciar();
    actual = a;
    desde = millis();
    hasta = desde + dura;
    proximo = desde + 600;
    paso = 0;
    Serial.printf("Animo: %s (%lu s)\n", NOMBRE_ANIMO[a], (unsigned long)(dura / 1000));

    switch (a){
      case FELIZ:
        o.setMood(HAPPY); o.anim_laugh(); break;
      case CANSADO:
        o.setMood(TIRED); tam(36, 26, 7); o.setAutoblinker(ON, 2, 2); o.setIdleMode(OFF); centrar(6); break;
      case TRISTE:
        o.setMood(TIRED); tam(34, 30, 8); o.setIdleMode(OFF); centrar(2); break;
      case ENOJADO:
        o.setMood(ANGRY); tam(38, 30, 6); o.setIdleMode(OFF); centrar(2); temblar(450); break;
      case SORPRENDIDO:
        tam(30, 44, 14); o.setSpacebetween(16); o.setAutoblinker(OFF); o.setIdleMode(OFF); centrar(0); break;
      case CURIOSO:
        o.setCuriosity(ON); o.setIdleMode(ON, 1, 2); break;
      case ENAMORADO:
        o.setIdleMode(OFF); centrar(0); break;
      case DORMIDO:
        o.setAutoblinker(OFF); o.setIdleMode(OFF); tam(36, 4, 1); centrar(8); break;
      case NERVIOSO:
        o.setSweat(ON); tam(32, 32, 8); o.setIdleMode(ON, 1, 1); o.setAutoblinker(ON, 1, 2); break;
      case CONFUNDIDO:
        o.setHeight(36, 24); o.setIdleMode(OFF); centrar(0); o.anim_confused(); break;
      case PICARO:
        o.setMood(HAPPY); o.setIdleMode(OFF); mirarCostado(); break;
      case EMOCIONADO:
        o.setMood(HAPPY); tam(38, 38, 10); o.setIdleMode(OFF); centrar(0); o.anim_laugh(); break;
      default: break;
    }
  }

  // Va en el loop, antes de roboEyes.update()
  void actualizar(){
    const uint32_t ahora = millis();
    if ((int32_t)(ahora - hasta) >= 0){
      if (actual == NEUTRO) poner(sortear(), random(ANIMO_DURA_MIN, ANIMO_DURA_MAX));
      else if (!(alTerminar && alTerminar())) poner(NEUTRO, random(NEUTRO_DURA_MIN, NEUTRO_DURA_MAX));
      return;
    }
    if (finTemblor && (int32_t)(ahora - finTemblor) >= 0){ o.setHFlicker(OFF); finTemblor = 0; }
    if ((int32_t)(ahora - proximo) < 0) return;

    // Lo que hace cada mood de vez en cuando
    switch (actual){
      case FELIZ:      o.anim_laugh(); proximo = ahora + random(4000, 7000); break;
      case EMOCIONADO: o.anim_laugh(); proximo = ahora + random(2500, 4500); break;
      case PICARO:     o.blink(true, false); mirarCostado(); proximo = ahora + random(2200, 3800); break;
      case CONFUNDIDO: o.anim_confused(); proximo = ahora + random(2800, 4500); break;
      case ENOJADO:    temblar(350); proximo = ahora + random(3000, 5000); break;
      case CANSADO:
        // Bostezo: los ojos se cierran despacito hasta la mitad y vuelven
        // (se baja el ojo para que el párpado cierre desde arriba)
        if (paso == 0){ o.setHeight(10, 10); o.eyeLyNext += 16; paso = 1; proximo = ahora + 1300; }
        else          { o.setHeight(26, 26); o.eyeLyNext -= 16; paso = 0; proximo = ahora + random(4000, 7000); }
        break;
      case DORMIDO:
        // Respira: los ojitos cerrados se abren y cierran apenas
        paso = !paso; o.setHeight(paso ? 6 : 3, paso ? 6 : 3); proximo = ahora + 900;
        break;
      case SORPRENDIDO:
        if (paso == 0){ o.blink(); paso = 1; } proximo = ahora + 99999; break;
      default: proximo = ahora + 99999; break;
    }
  }

  // Va justo antes de que el cuadro salga a la pantalla (encima de los ojos)
  void dibujarExtras(){
    const uint32_t t = millis() - desde;
    switch (actual){
      case TRISTE:      lagrima(t); break;
      case ENAMORADO:   corazones(t); break;
      case DORMIDO:     zetas(t, true); break;
      case CANSADO:     if (paso == 1) zetas(t, false); break;
      case SORPRENDIDO: signo('!', t); break;
      case CONFUNDIDO:  signo('?', t); break;
      case EMOCIONADO:  chispitas(t, 4); break;
      case FELIZ:       chispitas(t, 2); break;
      default: break;
    }
  }

private:
  Pantalla &d;
  Ojos &o;
  uint32_t desde = 0, hasta = 0, proximo = 0, finTemblor = 0;
  uint8_t paso = 0;
  Animo anterior = NEUTRO;

  // Vuelve todo a como lo deja RoboEyes por defecto
  void reiniciar(){
    o.setMood(DEFAULT);
    o.setCuriosity(OFF);
    o.setSweat(OFF);
    o.setHFlicker(OFF);
    o.setVFlicker(OFF);
    tam(36, 36, 8);
    o.setSpacebetween(10);
    o.setAutoblinker(ON, 3, 2);
    o.setIdleMode(ON, 3, 2);
    o.open();
    finTemblor = 0;
  }

  void tam(int ancho, int alto, int radio){
    o.setWidth(ancho, ancho);
    o.setHeight(alto, alto);
    o.setBorderradius(radio, radio);
  }

  // Ojos en el medio (bajar = cuántos píxeles más abajo)
  void centrar(int bajar){
    int anchoTotal = o.eyeLwidthDefault + o.spaceBetweenDefault + o.eyeRwidthDefault;
    o.eyeLxNext = (128 - anchoTotal) / 2;
    o.eyeLyNext = constrain((64 - o.eyeLheightDefault) / 2 + bajar, 0, 64 - o.eyeLheightDefault);
  }

  void mirarCostado(){
    int anchoTotal = o.eyeLwidthDefault + o.spaceBetweenDefault + o.eyeRwidthDefault;
    o.eyeLxNext = random(2) ? 128 - anchoTotal - 4 : 4;
    o.eyeLyNext = (64 - o.eyeLheightDefault) / 2 + random(-4, 5);
  }

  void temblar(uint32_t ms){ o.setHFlicker(ON, 2); finTemblor = millis() + ms; }

  Animo sortear(){
    int total = 0;
    for (int i = 1; i < CANT_ANIMOS; i++) if (i != anterior) total += PESO_ANIMO[i];
    int k = random(total);
    for (int i = 1; i < CANT_ANIMOS; i++){
      if (i == anterior) continue;
      k -= PESO_ANIMO[i];
      if (k < 0){ anterior = (Animo)i; return (Animo)i; }
    }
    return FELIZ;
  }

  // ---------- Dibujitos ----------
  // Una lágrima que cae del costado de afuera del ojo izquierdo
  void lagrima(uint32_t t){
    const uint32_t ciclo = 2300;
    float p = (t % ciclo) / (float)ciclo;
    if (p < 0.25f){                       // se va formando
      int r = 1 + p * 6;
      d.fillCircle(o.eyeLx + 5, o.eyeLy + o.eyeLheightCurrent, r > 2 ? 2 : r, SSD1306_WHITE);
      return;
    }
    float q = (p - 0.25f) / 0.75f;        // y cae, cada vez más rápido
    int x = o.eyeLx + 5;
    int y = o.eyeLy + o.eyeLheightCurrent + q * q * (70 - o.eyeLy - o.eyeLheightCurrent);
    d.fillCircle(x, y, 2, SSD1306_WHITE);
    d.fillTriangle(x - 2, y - 1, x + 2, y - 1, x, y - 5, SSD1306_WHITE);
  }

  // Los ojos se vuelven corazones que laten
  void corazon(int cx, int cy, float s){
    int r = s / 4;
    if (r < 2) r = 2;
    d.fillCircle(cx - r, cy - r / 2, r, SSD1306_WHITE);
    d.fillCircle(cx + r, cy - r / 2, r, SSD1306_WHITE);
    d.fillTriangle(cx - 2 * r, cy - r / 2 + 1, cx + 2 * r, cy - r / 2 + 1, cx, cy + 2 * r, SSD1306_WHITE);
  }
  void corazones(uint32_t t){
    float latido = 1 + 0.10f * sinf(t / 140.f) * (sinf(t / 140.f) > 0 ? 1 : 0.3f);   // pum-pum
    int hL = o.eyeLheightCurrent < 4 ? 4 : o.eyeLheightCurrent;
    int hR = o.eyeRheightCurrent < 4 ? 4 : o.eyeRheightCurrent;
    d.fillRect(o.eyeLx - 1, o.eyeLy - 1, o.eyeLwidthCurrent + 2, o.eyeLheightCurrent + 2, SSD1306_BLACK);
    d.fillRect(o.eyeRx - 1, o.eyeRy - 1, o.eyeRwidthCurrent + 2, o.eyeRheightCurrent + 2, SSD1306_BLACK);
    float sL = o.eyeLwidthCurrent * latido * min(1.0f, hL / 18.f);   // si parpadea, el corazón se achica
    float sR = o.eyeRwidthCurrent * latido * min(1.0f, hR / 18.f);
    corazon(o.eyeLx + o.eyeLwidthCurrent / 2, o.eyeLy + o.eyeLheightCurrent / 2, sL);
    corazon(o.eyeRx + o.eyeRwidthCurrent / 2, o.eyeRy + o.eyeRheightCurrent / 2, sR);
  }

  // Zzz que suben desde arriba a la derecha (grandes = dormido, una sola chiquita = cansado)
  void zetas(uint32_t t, bool tres){
    d.setTextColor(SSD1306_WHITE);
    d.setTextWrap(false);
    int cuantas = tres ? 3 : 1;
    for (int i = 0; i < cuantas; i++){
      float p = fmodf(t / 2700.f + i / 3.f, 1.f);
      if (p < 0.06f || p > 0.94f) continue;
      bool grande = tres && p > 0.66f;
      int x = 98 + p * 20, y = (grande ? 30 : 34) - p * 32;
      d.setTextSize(grande ? 2 : 1);
      d.setCursor(x, y);
      d.write(grande ? 'Z' : 'z');
    }
    d.setTextSize(1);
  }

  // "!" o "?" arriba a la derecha, flotando un poquito
  void signo(char c, uint32_t t){
    if (t < 250) return;
    d.setTextColor(SSD1306_WHITE);
    d.setTextSize(2);
    d.setCursor(114, 2 + lroundf(sinf(t / 260.f) * 1.5f));
    d.write(c);
    d.setTextSize(1);
  }

  // Estrellitas de 8 puntas que titilan en las esquinas
  void estrellita(int x, int y, int r){
    if (r <= 0) return;
    d.drawFastHLine(x - r, y, 2 * r + 1, SSD1306_WHITE);
    d.drawFastVLine(x, y - r, 2 * r + 1, SSD1306_WHITE);
    int q = r * 2 / 3;
    if (q > 0){ d.drawLine(x - q, y - q, x + q, y + q, SSD1306_WHITE); d.drawLine(x - q, y + q, x + q, y - q, SSD1306_WHITE); }
  }
  void chispitas(uint32_t t, int cuantas){
    static const int8_t LUGAR[4][2] = { {8, 9}, {119, 13}, {11, 53}, {116, 50} };
    for (int i = 0; i < cuantas; i++){
      float s = sinf(t / 230.f + i * 1.9f);
      if (s > 0) estrellita(LUGAR[i][0], LUGAR[i][1], lroundf(s * 4));
    }
  }
};
