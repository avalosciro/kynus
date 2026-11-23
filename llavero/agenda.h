// ============================================================
//  KYNUS — agenda del llavero (eventos de hoy y de los próximos días)
//
//  El llavero no tiene reloj: la app le manda la fecha y la hora cuando
//  sincroniza, y desde ahí las cuenta solo con millis(). Si se apaga,
//  pierde la hora hasta la próxima sincronización.
//
//  Mensaje que manda la app (versión 2), en trozos de 20 bytes:
//    K2|AAAA-MM-DD HH:MM|AAAA-MM-DD HH:MM título|AAAA-MM-DD --:-- título|...
//    (la primera fecha es "ahora"; --:-- = todo el día)
//  También entiende el formato viejo: "HH:MM título|HH:MM título|..." (todo de hoy).
// ============================================================
#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include "frases.h"   // aCp437() e iconito()

namespace agenda {

const int MAX = 24;              // eventos guardados (hoy + próximos 7 días)
const int LARGO_TITULO = 40;     // letras, ya pasadas a la fuente del OLED
const int DIAS_ADELANTE = 7;     // cuántos días para adelante se muestran
const int SIN_RELOJ = -1;        // "dia" de los eventos del formato viejo (son de hoy)

struct Evento { int32_t dia; int16_t minuto; char titulo[LARGO_TITULO + 1]; };   // minuto -1 = todo el día

Evento lista[MAX];
int total = 0;
bool hayReloj = false;
int32_t relojMinutos = 0;        // minutos desde 1970 (hora local) en el momento de la sincronización
uint32_t relojMillis = 0;

// ---------- Fechas (algoritmos de Howard Hinnant, días desde 1970-01-01) ----------
inline int32_t diasDesdeCivil(int y, int m, int d){
  y -= m <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const int yoe = y - era * 400;
  const int doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const int doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + doe - 719468;
}
inline void civilDesdeDias(int32_t z, int &y, int &m, int &d){
  z += 719468;
  const int32_t era = (z >= 0 ? z : z - 146096) / 146097;
  const int32_t doe = z - era * 146097;
  const int32_t yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  const int32_t doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const int32_t mp = (5 * doy + 2) / 153;
  d = doy - (153 * mp + 2) / 5 + 1;
  m = mp < 10 ? mp + 3 : mp - 9;
  y = yoe + era * 400 + (m <= 2);
}

inline int32_t minutosAhora(){ return relojMinutos + (int32_t)((millis() - relojMillis) / 60000UL); }
inline int32_t hoy(){ return hayReloj ? minutosAhora() / 1440 : SIN_RELOJ; }
inline int minutoDelDia(){ return hayReloj ? minutosAhora() % 1440 : 0; }

// "AAAA-MM-DD"
inline bool leerFecha(const char *s, int32_t &dia){
  if (strlen(s) < 10 || s[4] != '-' || s[7] != '-') return false;
  int y = atoi(s), m = atoi(s + 5), d = atoi(s + 8);
  if (y < 2000 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  dia = diasDesdeCivil(y, m, d);
  return true;
}
// "HH:MM" → minutos; "--:--" → -1 (todo el día); cualquier otra cosa → -2
inline int leerHora(const char *s){
  if (strlen(s) < 5) return -2;
  if (s[0] == '-') return -1;
  if (!isdigit(s[0]) || !isdigit(s[1]) || s[2] != ':' || !isdigit(s[3]) || !isdigit(s[4])) return -2;
  int h = (s[0] - '0') * 10 + (s[1] - '0'), m = (s[3] - '0') * 10 + (s[4] - '0');
  return (h < 24 && m < 60) ? h * 60 + m : -2;
}

inline void agregar(int32_t dia, int minuto, const char *tituloUtf8){
  if (total >= MAX) return;
  while (*tituloUtf8 == ' ') tituloUtf8++;
  static char tmp[160];
  frases::aCp437(tituloUtf8, tmp, sizeof tmp);
  Evento &e = lista[total];
  strncpy(e.titulo, tmp[0] ? tmp : "Sin titulo", LARGO_TITULO);
  e.titulo[LARGO_TITULO] = 0;
  e.dia = dia;
  e.minuto = minuto;
  total++;
}

// Lee el mensaje que llegó por Bluetooth
inline void cargar(const String &mensaje){
  total = 0;
  const char *s = mensaje.c_str();
  static char item[200];

  if (strncmp(s, "K2|", 3) == 0){
    s += 3;
    int32_t dia;
    int minuto = leerHora(strlen(s) >= 16 ? s + 11 : "");
    if (leerFecha(s, dia) && minuto >= 0){
      relojMinutos = dia * 1440 + minuto;
      relojMillis = millis();
      hayReloj = true;
    }
    s = strchr(s, '|');
    while (s && *s == '|' && total < MAX){
      s++;
      const char *fin = strchr(s, '|');
      if (!fin) fin = s + strlen(s);
      int largo = min((int)(fin - s), (int)sizeof item - 1);
      memcpy(item, s, largo);
      item[largo] = 0;
      int32_t d;
      int m = largo >= 17 ? leerHora(item + 11) : -2;
      if (m >= -1 && leerFecha(item, d)) agregar(d, m, item + 17);
      s = *fin ? fin : nullptr;
    }
    return;
  }

  // Formato viejo: "HH:MM título|..." — todo es de hoy y no hay reloj
  hayReloj = false;
  while (*s && total < MAX){
    const char *fin = strchr(s, '|');
    if (!fin) fin = s + strlen(s);
    int largo = min((int)(fin - s), (int)sizeof item - 1);
    memcpy(item, s, largo);
    item[largo] = 0;
    char *p = item;
    while (*p == ' ') p++;
    int m = leerHora(p);
    if (m >= -1) agregar(SIN_RELOJ, m, p + 5);    // "Sin eventos hoy" no tiene hora: se ignora
    s = *fin ? fin + 1 : fin;
  }
}

// Índices de los eventos de hoy que todavía no terminaron (un evento dura 1 h)
inline int deHoy(int *idx){
  int n = 0;
  const int32_t h = hoy();
  const int ahora = minutoDelDia();
  for (int i = 0; i < total; i++){
    const Evento &e = lista[i];
    if (e.dia != h) continue;
    if (hayReloj && e.minuto >= 0 && e.minuto + 60 <= ahora) continue;
    idx[n++] = i;
  }
  return n;
}

// Cuántos eventos de hoy llegaron en total (incluidos los que ya terminaron)
inline int cuantosHoy(){
  int n = 0;
  const int32_t h = hoy();
  for (int i = 0; i < total; i++) if (lista[i].dia == h) n++;
  return n;
}

// Para el Monitor Serie: qué llegó y qué se va a mostrar
inline void contarPorSerie(){
  Serial.printf("Agenda: %d eventos (%s)\n", total, hayReloj ? "con fecha" : "formato viejo, sin fecha");
  if (hayReloj){
    int y, m, d;
    civilDesdeDias(hoy(), y, m, d);
    Serial.printf("  Ahora en el llavero: %04d-%02d-%02d %02d:%02d\n", y, m, d, minutoDelDia() / 60, minutoDelDia() % 60);
  }
  for (int i = 0; i < total; i++){
    const Evento &e = lista[i];
    int y = 0, m = 0, d = 0;
    if (e.dia >= 0) civilDesdeDias(e.dia, y, m, d);
    const bool paso = hayReloj && e.dia == hoy() && e.minuto >= 0 && e.minuto + 60 <= minutoDelDia();
    if (e.minuto >= 0) Serial.printf("  %04d-%02d-%02d %02d:%02d  %s%s\n", y, m, d, e.minuto / 60, e.minuto % 60, e.titulo, paso ? "  (ya pasó)" : "");
    else               Serial.printf("  %04d-%02d-%02d todo el día  %s\n", y, m, d, e.titulo);
  }
}

// Días de la semana que viene (después de hoy) que tienen algo, en orden
inline int diasProximos(int32_t *dias, int max){
  if (!hayReloj) return 0;
  const int32_t h = hoy();
  int n = 0;
  for (int32_t dia = h + 1; dia <= h + DIAS_ADELANTE && n < max; dia++)
    for (int i = 0; i < total; i++)
      if (lista[i].dia == dia){ dias[n++] = dia; break; }
  return n;
}

// "MAÑANA", "PASADO MAÑANA" o "JUEVES 27"
inline void nombreDelDia(int32_t dia, char *out, int max){
  static const char *const SEMANA[] = { "DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO" };
  char tmp[32];
  const int32_t h = hoy();
  if (dia == h + 1) strcpy(tmp, "MAÑANA");
  else if (dia == h + 2) strcpy(tmp, "PASADO MAÑANA");
  else {
    int y, m, d;
    civilDesdeDias(dia, y, m, d);
    snprintf(tmp, sizeof tmp, "%s %d", SEMANA[(dia + 4) % 7], d);   // 1970-01-01 fue jueves
  }
  frases::aCp437(tmp, out, max);
}

// Una pantalla por día: iconito + nombre del día + hasta 4 renglones "HH:MM título"
inline void dibujarDia(Adafruit_SSD1306 &d, int32_t dia, int pagina, int paginas){
  d.clearDisplay();
  d.setTextSize(1);
  d.setTextColor(SSD1306_WHITE);
  d.setTextWrap(false);

  frases::iconito(d);
  char nombre[24];
  nombreDelDia(dia, nombre, sizeof nombre);
  d.setCursor(14, 2);
  d.print(nombre);
  if (paginas > 1){
    char cuenta[8];
    snprintf(cuenta, sizeof cuenta, "%d/%d", pagina + 1, paginas);
    d.setCursor(128 - (strlen(cuenta) * 6 - 1), 2);
    d.print(cuenta);
  }
  for (int x = 0; x < 128; x += 2) d.drawPixel(x, 11, SSD1306_WHITE);

  int cuantos = 0;
  for (int i = 0; i < total; i++) if (lista[i].dia == dia) cuantos++;
  const int renglones = cuantos > 4 ? 3 : cuantos;   // si no entran, el 4° dice "+N más"

  int y = 15, puestos = 0;
  for (int i = 0; i < total && puestos < renglones; i++){
    const Evento &e = lista[i];
    if (e.dia != dia) continue;
    char hora[6];
    if (e.minuto >= 0) snprintf(hora, sizeof hora, "%02d:%02d", e.minuto / 60, e.minuto % 60);
    else strcpy(hora, "Todo");
    d.setCursor(0, y);
    d.print(hora);
    char titulo[16];                                  // 15 letras entran al lado de la hora
    strncpy(titulo, e.titulo, 15);
    titulo[15] = 0;
    if (strlen(e.titulo) > 15) titulo[14] = '.';
    d.setCursor(36, y);
    d.print(titulo);
    y += 12;
    puestos++;
  }
  if (cuantos > renglones){
    char mas[16];
    snprintf(mas, sizeof mas, "+%d m%cs", cuantos - renglones, (char)0xA0);   // á en la fuente del OLED
    d.setCursor(36, y);
    d.print(mas);
  }
  d.display();
}

} // namespace agenda
