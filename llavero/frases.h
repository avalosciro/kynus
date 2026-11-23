// ============================================================
//  KYNUS — la frase del arranque
//
//  Después de la estrella, la estrella se achica y queda como iconito
//  arriba a la izquierda, aparece el tipo de frase y la frase se escribe
//  letra por letra (con cursor, como máquina de escribir). Después se
//  desarma en los ojitos (animacion_inicio.h).
//
//  Hay citas con autor, tips para estudiar, recordatorios (agua, postura,
//  descanso) y frases de Kynus. Se guarda en la memoria cuáles ya
//  salieron, así no se repite ninguna hasta que pasen todas.
//
//  Para agregar frases: sumalas a LISTA (máximo 64). Que entren en la
//  pantalla: 21 letras por renglón, 4 renglones si tiene autor, 5 si no.
// ============================================================
#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>
#include "animacion_inicio.h"

namespace frases {

enum Tipo : uint8_t { FRASE, ESTUDIO, RECORDATORIO, KYNUS };
const char *const ETIQUETAS[] = { "FRASE", "PARA ESTUDIAR", "RECORDATORIO", "DE KYNUS" };

struct Frase { Tipo tipo; const char *texto; const char *autor; };

const Frase LISTA[] = {
  // --- Citas ---
  { FRASE, "La única forma de hacer un gran trabajo es amar lo que hacés.", "Steve Jobs" },
  { FRASE, "Stay hungry, stay foolish.", "Steve Jobs" },
  { FRASE, "Caminante, no hay camino, se hace camino al andar.", "Antonio Machado" },
  { FRASE, "Despacito y buena letra: hacer las cosas bien importa más que hacerlas.", "Antonio Machado" },
  { FRASE, "Lo esencial es invisible a los ojos.", "El Principito" },
  { FRASE, "Do or do not. There is no try.", "Yoda" },
  { FRASE, "Just keep swimming.", "Dory" },
  { FRASE, "To infinity and beyond!", "Buzz Lightyear" },
  { FRASE, "Mientras enseñamos, aprendemos.", "Séneca" },
  { FRASE, "El que lee mucho y anda mucho, ve mucho y sabe mucho.", "Cervantes" },
  { FRASE, "Lo urgente no deja tiempo para lo importante.", "Mafalda" },
  { FRASE, "Nothing in life is to be feared, it is only to be understood.", "Marie Curie" },
  { FRASE, "La imaginación es más importante que el conocimiento.", "Albert Einstein" },
  { FRASE, "Quien tiene un porqué para vivir soporta casi cualquier cómo.", "Nietzsche" },
  { FRASE, "Lo único que tenemos que decidir es qué hacer con el tiempo que se nos da.", "Gandalf" },
  { FRASE, "Ohana significa familia, y tu familia nunca te abandona.", "Lilo & Stitch" },
  { FRASE, "Be curious, not judgmental.", "Ted Lasso" },
  { FRASE, "Hakuna matata: vive y deja vivir.", "El Rey León" },
  { FRASE, "After all, tomorrow is another day.", "Scarlett O'Hara" },

  // --- Para estudiar ---
  { ESTUDIO, "Estudiá 25 minutos y descansá 5. Se llama Pomodoro y funciona.", nullptr },
  { ESTUDIO, "Arrancá por lo más difícil. Después es todo bajada.", nullptr },
  { ESTUDIO, "Un tema por vez. Tu cabeza te lo va a agradecer.", nullptr },
  { ESTUDIO, "¿No entendés algo? Preguntá: seguro alguien más tiene la misma duda.", nullptr },
  { ESTUDIO, "Si podés explicarlo en voz alta, lo entendiste.", nullptr },
  { ESTUDIO, "Una nota no te define. Lo que aprendiste, sí.", nullptr },
  { ESTUDIO, "Celu lejos mientras estudiás. (Menos yo, obvio.)", nullptr },
  { ESTUDIO, "Hecho es mejor que perfecto. ¡Entregalo!", nullptr },
  { ESTUDIO, "Resumí con tus palabras: copiar el libro no cuenta.", nullptr },
  { ESTUDIO, "Un poquito todos los días le gana a todo la noche anterior.", nullptr },
  { ESTUDIO, "Repasá un ratito antes de dormir: la memoria se arma de noche.", nullptr },

  // --- Recordatorios ---
  { RECORDATORIO, "Tomá agua. Sí, ahora.", nullptr },
  { RECORDATORIO, "Mantenete hidratado: tu cerebro funciona mejor con agua.", nullptr },
  { RECORDATORIO, "Stay hydrated! Drink some water.", nullptr },
  { RECORDATORIO, "Enderezá la espalda y bajá los hombros.", nullptr },
  { RECORDATORIO, "Respirá hondo: 4 segundos adentro, 4 afuera.", nullptr },
  { RECORDATORIO, "Mirá algo lejos 20 segundos. Tus ojos te lo agradecen.", nullptr },
  { RECORDATORIO, "¿Comiste algo hoy? Una fruta también cuenta.", nullptr },
  { RECORDATORIO, "Dormir bien también es estudiar.", nullptr },
  { RECORDATORIO, "Levantate y estirate un minuto.", nullptr },
  { RECORDATORIO, "Mandale un mensaje lindo a alguien.", nullptr },
  { RECORDATORIO, "Prepará la mochila a la noche y mañana arrancás tranqui.", nullptr },
  { RECORDATORIO, "Take a break. You earned it.", nullptr },

  // --- De Kynus ---
  { KYNUS, "Sé tu propia estrella polar.", "Kynus" },
  { KYNUS, "Un paso por vez. Yo te acompaño.", "Kynus" },
  { KYNUS, "Hoy es un buen día para tener un buen día.", "Kynus" },
  { KYNUS, "You got this!", "Kynus" },
  { KYNUS, "Las estrellas no brillan sin un poco de oscuridad.", "Kynus" },
  { KYNUS, "Nadie te apura. Vas a tu ritmo.", "Kynus" },
  { KYNUS, "Small steps every day.", "Kynus" },
  { KYNUS, "Lo estás haciendo mejor de lo que pensás.", "Kynus" },
};
const int TOTAL = sizeof(LISTA) / sizeof(LISTA[0]);
static_assert(TOTAL <= 64, "Como mucho 64 frases (se recuerdan en 64 bits)");

// ---------- Letras: la fuente del OLED usa la tabla CP437, no UTF-8 ----------
// Pasa tildes, ñ, ¿ y ¡ a sus códigos CP437 (hay que llamar a display.cp437(true))
inline int aCp437(const char *s, char *out, int max){
  int n = 0;
  while (*s && n < max - 1){
    uint8_t c = *s++;
    if (c < 0x80){ out[n++] = c; continue; }
    char r = '?';
    uint8_t c2 = *s ? (uint8_t)*s++ : 0;
    if (c == 0xC3){
      switch (c2){
        case 0xA1: r = 0xA0; break;  case 0x81: r = 'A';  break;   // á Á
        case 0xA9: r = 0x82; break;  case 0x89: r = 0x90; break;   // é É
        case 0xAD: r = 0xA1; break;  case 0x8D: r = 'I';  break;   // í Í
        case 0xB3: r = 0xA2; break;  case 0x93: r = 'O';  break;   // ó Ó
        case 0xBA: r = 0xA3; break;  case 0x9A: r = 'U';  break;   // ú Ú
        case 0xB1: r = 0xA4; break;  case 0x91: r = 0xA5; break;   // ñ Ñ
        case 0xBC: r = 0x81; break;  case 0x9C: r = 0x9A; break;   // ü Ü
      }
    } else if (c == 0xC2){
      if (c2 == 0xBF) r = 0xA8;        // ¿
      else if (c2 == 0xA1) r = 0xAD;   // ¡
      else if (c2 == 0xB0) r = 0xF8;   // °
    } else if (c == 0xE2){
      uint8_t c3 = *s ? (uint8_t)*s++ : 0;
      if (c2 == 0x80){
        if (c3 == 0x93 || c3 == 0x94) r = '-';         // – —
        else if (c3 == 0x9C || c3 == 0x9D) r = '"';    // “ ”
        else if (c3 == 0x98 || c3 == 0x99) r = '\'';   // ‘ ’
        else if (c3 == 0xA6) r = '.';                  // …
      }
    } else if (c >= 0xF0){
      for (int k = 0; k < 2 && *s; k++) s++;            // emojis: no hay cómo dibujarlos
    }
    out[n++] = r;
  }
  out[n] = 0;
  return n;
}

inline String aCp437(const String &s){
  static char tmp[160];
  aCp437(s.c_str(), tmp, sizeof tmp);
  return String(tmp);
}

// ---------- Renglones ----------
const int ANCHO = 21;        // letras por renglón (6 px cada una)
const int MAX_RENGLONES = 5;

// Corta el texto en renglones sin partir palabras. Devuelve cuántos renglones usó.
inline int envolver(const char *t, char lineas[][ANCHO + 1], int maxLineas){
  int n = 0, largo = 0;
  lineas[0][0] = 0;
  while (*t){
    while (*t == ' ') t++;
    if (!*t) break;
    const char *ini = t;
    while (*t && *t != ' ') t++;
    int p = t - ini;
    while (p > 0){
      int cabe = p > ANCHO ? ANCHO : p;   // palabras larguísimas: se cortan
      int extra = largo ? 1 : 0;
      if (largo + extra + cabe > ANCHO){
        if (n + 1 >= maxLineas) return n + 1;   // no entra más (las frases están medidas para que no pase)
        n++; largo = 0; lineas[n][0] = 0; extra = 0;
      }
      if (extra){ lineas[n][largo++] = ' '; }
      memcpy(lineas[n] + largo, ini, cabe);
      largo += cabe;
      lineas[n][largo] = 0;
      ini += cabe; p -= cabe;
    }
  }
  return largo ? n + 1 : n;
}

// ---------- Elegir una que no haya salido ----------
inline int elegir(){
  Preferences mem;
  mem.begin("kynus", false);
  const uint64_t todas = TOTAL >= 64 ? ~0ULL : ((1ULL << TOTAL) - 1);
  uint64_t usadas = mem.getULong64("frases", 0) & todas;
  if (usadas == todas) usadas = 0;                       // ya salieron todas: empieza otra vuelta
  int libres = TOTAL - __builtin_popcountll(usadas);
  int k = esp_random() % libres, i = 0;
  for (; i < TOTAL; i++){
    if (usadas & (1ULL << i)) continue;
    if (k-- == 0) break;
  }
  mem.putULong64("frases", usadas | (1ULL << i));
  mem.end();
  return i;
}

// ---------- Dibujo ----------
const int ICONO_X = 5, ICONO_Y = 5;         // dónde queda la estrellita chiquita
const float ICONO_ESC = 0.14f;

inline void iconito(Adafruit_SSD1306 &d, float rot = 0){
  intro::estrella(d, rot, ICONO_ESC, 36, 3.5f, 1, 1, 0.3f, ICONO_X, ICONO_Y);
}

// Tapa (borra) en trama los píxeles de un rectángulo: k = 0 no se ve nada, 1 se ve todo
inline void trama(Adafruit_SSD1306 &d, int x0, int y0, int w, int h, float k){
  if (k >= 1) return;
  uint8_t umbral = k * 255;
  for (int y = y0; y < y0 + h; y++)
    for (int x = x0; x < x0 + w; x++)
      if (intro::ruido(x, y + 11) >= umbral) d.drawPixel(x, y, SSD1306_BLACK);
}

} // namespace frases


// ---------- Parte 2 del arranque: la frase ----------
// Arranca con la estrella del sello en pantalla. Termina con la frase dibujada
// (para que desarmarEnOjos la convierta en ojos). Devuelve false si la saltearon.
inline bool mostrarFrase(Adafruit_SSD1306 &d, int pinBoton){
  using namespace intro;
  using namespace frases;

  const Frase &f = LISTA[elegir()];
  static char texto[160], autor[48], etiqueta[ANCHO + 1];
  static char lineas[MAX_RENGLONES][ANCHO + 1];
  aCp437(f.texto, texto, sizeof texto);
  autor[0] = 0;
  if (f.autor){ autor[0] = '-'; autor[1] = ' '; aCp437(f.autor, autor + 2, sizeof autor - 2); }
  aCp437(ETIQUETAS[f.tipo], etiqueta, sizeof etiqueta);
  const int nLineas = envolver(texto, lineas, autor[0] ? 4 : 5);

  int totalLetras = 0;
  for (int i = 0; i < nLineas; i++) totalLetras += strlen(lineas[i]);
  const int largoEtiqueta = strlen(etiqueta);

  // Ubicación del texto: centrado en el espacio que queda entre la rayita y el autor
  const int arriba = 14, abajo = autor[0] ? 53 : 63;
  const int altoTexto = nLineas * 9 - 2;
  const int y0 = arriba + (abajo - arriba + 1 - altoTexto) / 2;

  // Tiempos (ms)
  const uint32_t T_ACHICA  = 520;                               // la estrella se va al rincón
  const uint32_t T_ETIQ    = T_ACHICA + 40;                     // aparece "FRASE", "RECORDATORIO"…
  const uint32_t T_TEXTO   = T_ETIQ + largoEtiqueta * 22 + 120; // empieza a escribirse
  const uint32_t POR_LETRA = 26;
  const uint32_t T_AUTOR   = T_TEXTO + totalLetras * POR_LETRA + 150;
  const uint32_t LECTURA   = constrain(1400 + totalLetras * 48, 2400, 5600);
  const uint32_t T_FIN     = T_AUTOR + 350 + LECTURA;

  static uint8_t sello[128 * 64 / 8];
  memcpy(sello, d.getBuffer(), sizeof sello);   // la estrella tal cual quedó

  d.setTextSize(1);
  d.setTextColor(SSD1306_WHITE);
  d.setTextWrap(false);

  const uint32_t inicio = millis();
  while (true){
    const uint32_t t = millis() - inicio;
    if (t >= T_FIN) break;
    if (apretado(pinBoton, t + 300)) return false;
    d.clearDisplay();

    // 1. La estrella gira un cuarto de vuelta, se achica y se va al rincón; las motitas se borran
    if (t < T_ACHICA){
      float u = suave(tramo(t, 0, T_ACHICA));
      if (u < 0.08f){
        memcpy(d.getBuffer(), sello, sizeof sello);
      } else {
        float esc = 1 + (ICONO_ESC - 1) * u;
        estrella(d, u * HALF_PI, esc, 36, 3.5f, 1, 1, 0.3f, CX + (ICONO_X - CX) * u, CY + (ICONO_Y - CY) * u);
      }
    } else {
      // Un destello cuando llega: gira un toque más y se queda
      float g = tramo(t, T_ACHICA, T_ACHICA + 260);
      iconito(d, g < 1 ? HALF_PI * (1 - salida(g)) * 0.25f : 0);
    }

    // 2. Etiqueta letra por letra y la rayita punteada que se estira
    if (t >= T_ETIQ){
      int nE = min((int)((t - T_ETIQ) / 22) + 1, largoEtiqueta);
      d.setCursor(14, 2);
      for (int i = 0; i < nE; i++) d.write(etiqueta[i]);
      int largoRaya = 128 * salida(tramo(t, T_ETIQ, T_ETIQ + 420));
      for (int x = 0; x < largoRaya; x += 2) d.drawPixel(x, 11, SSD1306_WHITE);
    }

    // 3. La frase, letra por letra, cada renglón centrado
    if (t >= T_TEXTO){
      int quedan = min((int)((t - T_TEXTO) / POR_LETRA), totalLetras);
      bool completa = quedan >= totalLetras;
      int cursorX = -1, cursorY = 0;
      for (int i = 0; i < nLineas && quedan > 0; i++){
        int largo = strlen(lineas[i]);
        int x = (128 - (largo * 6 - 1)) / 2, y = y0 + i * 9;
        int n = min(quedan, largo);
        d.setCursor(x, y);
        for (int k = 0; k < n; k++) d.write(lineas[i][k]);
        quedan -= n;
        cursorX = x + n * 6; cursorY = y;
        if (n == largo && quedan > 0 && i + 1 < nLineas){   // el cursor salta al renglón de abajo
          int sig = strlen(lineas[i + 1]);
          cursorX = (128 - (sig * 6 - 1)) / 2; cursorY = y + 9;
        }
      }
      // Cursor de bloque: fijo mientras escribe, titila cuando terminó
      bool verCursor = !completa || (t < T_FIN - 400 && ((t / 380) % 2 == 0));
      if (cursorX >= 0 && verCursor && cursorX < 124) d.fillRect(cursorX, cursorY, 5, 7, SSD1306_WHITE);
    }

    // 4. El autor aparece en trama, abajo a la derecha
    if (autor[0] && t >= T_AUTOR){
      int largo = strlen(autor);
      int x = 128 - (largo * 6 - 1), y = 56;
      d.setCursor(x, y);
      d.print(autor);
      trama(d, x, y, largo * 6, 8, salida(tramo(t, T_AUTOR, T_AUTOR + 350)));
    }

    d.display();
    delay(4);
  }

  // Último cuadro sin cursor: esto es lo que se va a desarmar en los ojos
  d.clearDisplay();
  iconito(d);
  d.setCursor(14, 2);
  d.print(etiqueta);
  for (int x = 0; x < 128; x += 2) d.drawPixel(x, 11, SSD1306_WHITE);
  for (int i = 0; i < nLineas; i++){
    int largo = strlen(lineas[i]);
    d.setCursor((128 - (largo * 6 - 1)) / 2, y0 + i * 9);
    d.print(lineas[i]);
  }
  if (autor[0]){ d.setCursor(128 - (strlen(autor) * 6 - 1), 56); d.print(autor); }
  d.display();
  return true;
}


// ---------- El arranque completo: estrella → frase → ojos ----------
template<typename Ojos>
void animacionInicioConFrase(Adafruit_SSD1306 &d, Ojos &ojos, int pinBoton){
  if (!animacionEstrella(d, pinBoton) || !mostrarFrase(d, pinBoton)){ ojosListos(d, ojos); return; }
  desarmarEnOjos(d, ojos, pinBoton, false);
}
