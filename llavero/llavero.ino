#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <FluxGarage_RoboEyes.h>
#include "animos.h"            // PantallaKynus y los estados de ánimo
#include "animacion_inicio.h"
#include "frases.h"
#include "agenda.h"            // eventos de hoy y de los próximos días, y el reloj

// ============================================================
//  KYNUS — llavero (versión sin botón). Cada uno se llama "Kynus-XXXX" (ver armarNombre)
//  - Al encender: estrella → (1 de cada 5 veces) una frase → los ojitos
//  - Los ojitos cambian de mood solos cada tanto (feliz, cansado, triste,
//    enojado, sorprendido, curioso, enamorado, dormido, nervioso,
//    confundido, pícaro, emocionado)
//  - Entre mood y mood, de vez en cuando muestra los eventos de los próximos días
//  - Cuando sincronizás: eventos de hoy uno por uno y después los próximos días
//  - Cada 1 minuto vuelve a mostrar lo que queda de hoy
// ============================================================

#define SERVICE_UUID        "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

// Mapeo de pines para ESP32-C3 SuperMini
#define PIN_SDA 8
#define PIN_SCL 9

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

#define CHANCE_FRASE        5        // 1 de cada 5 veces que se prende muestra una frase
#define TIEMPO_POR_EVENTO   3000     // cada evento de hoy se ve 3 segundos
#define TIEMPO_POR_DIA      4000     // cada día de "próximos días" se ve 4 segundos
#define CADA_CUANTO_EVENTOS 60000    // cada 1 minuto vuelve a mostrar lo que queda de hoy
#define PROXIMOS_CHANCE     35       // % de las veces que, al terminar un mood, muestra los próximos días
#define PROXIMOS_PAUSA      180000   // y nunca antes de 3 minutos desde la última vez
#define MAX_DIAS_PROXIMOS   3        // cuántos días muestra (los que tengan algo, dentro de una semana)
#define SILENCIO_BLE        700      // ms sin trozos nuevos = el mensaje terminó de llegar

// Batería: el llavero está siempre prendido, así que se cuida lo que más gasta
#define CPU_MHZ             80       // el ESP32-C3 viene a 160 MHz; 80 alcanza (es el mínimo con Bluetooth)
#define BRILLO              0x50     // brillo de la pantalla, de 0x00 a 0xFF (venía en 0xCF): menos brillo = menos consumo
#define CUADROS_POR_SEG     40       // cuadros por segundo de los ojos (venía en 100, aunque la pantalla no llegaba)
#define AVISO_MIN_MS        500      // cada cuánto avisa "acá estoy" por Bluetooth: entre 0,5 y 1 segundo
#define AVISO_MAX_MS        1000
#define MOSTRAR_NOMBRE_MS   8000     // al prenderse, el nombre del llavero se ve arriba a la izquierda 8 s

// Cada llavero tiene su nombre (con el final de su dirección Bluetooth): así, si hay varios
// cerca, en la lista del celular se distingue cuál es el tuyo. La app acepta los que empiezan con "Kynus".
char nombreLlavero[16];
unsigned long momentoDespierto = 0;

PantallaKynus display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
RoboEyes<PantallaKynus> roboEyes(display);
Animos<PantallaKynus, RoboEyes<PantallaKynus>> animos(display, roboEyes);

// Mensaje que llega por Bluetooth en trozos de 20 bytes
String mensajeCompleto = "";
volatile bool hayMensaje = false;
volatile unsigned long ultimoTrozo = 0;

// Qué se ve en la pantalla
enum Modo { OJOS, HOY, PROXIMOS };
Modo modo = OJOS;
int paso = 0;                        // evento o día que se está mostrando
unsigned long ultimoCambio = 0;
unsigned long ultimaVezHoy = 0;
unsigned long ultimaVezProximos = 0;
bool despuesProximos = false;        // después de "hoy", seguir con los próximos días (al sincronizar)

int idxHoy[agenda::MAX];
int totalHoy = 0;
int32_t diasProx[MAX_DIAS_PROXIMOS];
int totalDias = 0;

// ---------- Eventos de hoy (uno por pantalla) ----------
void mostrarEventoDeHoy() {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setTextWrap(true);

    if (totalHoy == 0) {
        // Nada pendiente: si hubo eventos hoy que ya pasaron, decirlo (si no, parece que no llegaron)
        const int pasaron = agenda::cuantosHoy();
        frases::iconito(display);
        display.setTextWrap(false);
        display.setCursor(14, 2);
        display.print("HOY");
        for (int x = 0; x < 128; x += 2) display.drawPixel(x, 11, SSD1306_WHITE);
        char linea1[24], linea2[24];
        if (pasaron > 0) {
            frases::aCp437("¡Listo por hoy!", linea1, sizeof linea1);
            if (pasaron == 1) frases::aCp437("Ya pasó el de hoy", linea2, sizeof linea2);
            else { char tmp[32]; snprintf(tmp, sizeof tmp, "Ya pasaron los %d", pasaron); frases::aCp437(tmp, linea2, sizeof linea2); }
        } else {
            frases::aCp437("Sin eventos hoy", linea1, sizeof linea1);
            linea2[0] = 0;
        }
        display.setCursor((128 - ((int)strlen(linea1) * 6 - 1)) / 2, linea2[0] ? 26 : 32);
        display.print(linea1);
        if (linea2[0]) {
            display.setCursor((128 - ((int)strlen(linea2) * 6 - 1)) / 2, 40);
            display.print(linea2);
        }
        display.display();
        return;
    }

    const agenda::Evento &e = agenda::lista[idxHoy[paso]];
    display.setCursor(0, 0);
    display.println("EVENTO " + String(paso + 1) + "/" + String(totalHoy));
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

    display.setCursor(0, 18);
    if (e.minuto >= 0) {
        char hora[6];
        snprintf(hora, sizeof hora, "%02d:%02d", e.minuto / 60, e.minuto % 60);
        display.println(String("Hora: ") + hora);
    } else {
        display.println(frases::aCp437(String("Todo el día")));
    }
    display.setCursor(0, 36);
    display.println(e.titulo);   // ya está en la fuente del OLED
    display.display();
}

void empezarHoy(bool seguirConProximos) {
    totalHoy = agenda::deHoy(idxHoy);
    modo = HOY;
    paso = 0;
    despuesProximos = seguirConProximos;
    ultimoCambio = millis();
    mostrarEventoDeHoy();
    Serial.printf("Eventos de hoy: %d\n", totalHoy);
}

// ---------- Próximos días (un día por pantalla) ----------
void empezarProximos() {
    totalDias = agenda::diasProximos(diasProx, MAX_DIAS_PROXIMOS);
    if (totalDias == 0) { volverAOjos(false); return; }
    modo = PROXIMOS;
    paso = 0;
    ultimoCambio = millis();
    ultimaVezProximos = millis();
    agenda::dibujarDia(display, diasProx[0], 0, totalDias);
    Serial.printf("Proximos dias: %d\n", totalDias);
}

void volverAOjos(bool contento) {
    modo = OJOS;
    ultimaVezHoy = millis();
    if (contento) animos.poner(FELIZ, 6000);   // contento después de mostrarte el día
    else          animos.poner(NEUTRO, random(NEUTRO_DURA_MIN, NEUTRO_DURA_MAX));
    Serial.println("Modo ojos");
}

// Cuando termina un mood: a veces, en vez de volver a la normalidad, muestra los próximos días
bool alTerminarAnimo() {
    if (millis() - ultimaVezProximos < PROXIMOS_PAUSA) return false;
    if ((int)(esp_random() % 100) >= PROXIMOS_CHANCE) return false;
    if (agenda::diasProximos(diasProx, MAX_DIAS_PROXIMOS) == 0) return false;
    empezarProximos();
    return true;
}

// Los dibujitos de cada mood se pintan encima de los ojos, justo antes de mostrar el cuadro
void dibujarExtras() {
    animos.dibujarExtras();
    // Los primeros segundos después de prenderse, el nombre del llavero arriba a la izquierda
    if (millis() - momentoDespierto < MOSTRAR_NOMBRE_MS) {
        display.fillRect(0, 0, strlen(nombreLlavero) * 6 + 2, 9, SSD1306_BLACK);
        display.setTextSize(1);
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(1, 1);
        display.print(nombreLlavero);
    }
}

void armarNombre() {
    const uint64_t mac = ESP.getEfuseMac();   // los últimos 2 bytes de la dirección, como "A1B2"
    snprintf(nombreLlavero, sizeof nombreLlavero, "Kynus-%02X%02X", (uint8_t)(mac >> 32), (uint8_t)(mac >> 40));
}

// Prender: estrella → (a veces) frase → ojos
void despertar() {
    if (esp_random() % CHANCE_FRASE == 0) animacionInicioConFrase(display, roboEyes, -1);   // -1 = sin botón
    else                                  animacionInicio(display, roboEyes, -1);
    animos.empezar();
}

class MiCallback : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        String valor = pCharacteristic->getValue().c_str();
        if (mensajeCompleto.length() < 3000) mensajeCompleto += valor;
        ultimoTrozo = millis();
        hayMensaje = true;
    }
};

class MiServidor : public BLEServerCallbacks {
    void onConnect(BLEServer *pServer) {
        Serial.println("Celular conectado");
    }
    void onDisconnect(BLEServer *pServer) {
        Serial.println("Celular desconectado, vuelvo a publicar");
        pServer->getAdvertising()->start();   // para poder reconectar sin reiniciar
    }
};

void setup() {
    setCpuFrequencyMhz(CPU_MHZ);   // ahorra batería (tiene que ir antes que el Bluetooth)
    Serial.begin(115200);
    armarNombre();
    Serial.printf("Soy %s\n", nombreLlavero);

    // Inicialización explícita de I2C en la ESP32-C3 SuperMini
    Wire.begin(PIN_SDA, PIN_SCL);

    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("Error: OLED SSD1306 no encontrada.");
    }
    display.ssd1306_command(SSD1306_SETCONTRAST);   // menos brillo = menos consumo
    display.ssd1306_command(BRILLO);
    display.cp437(true);   // tabla de letras correcta (tildes, ñ, ¿, ¡)
    display.clearDisplay();
    display.display();

    roboEyes.begin(SCREEN_WIDTH, SCREEN_HEIGHT, CUADROS_POR_SEG);
    roboEyes.setAutoblinker(ON, 3, 2);
    roboEyes.setIdleMode(ON, 3, 2);
    animos.alTerminar = alTerminarAnimo;

    // Inicializar Servidor Bluetooth LE
    BLEDevice::init(nombreLlavero);
    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MiServidor());
    BLEService *pService = pServer->createService(SERVICE_UUID);
    BLECharacteristic *pChar = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pChar->addDescriptor(new BLE2902());
    pChar->setCallbacks(new MiCallback());
    pService->start();
    BLEAdvertising *aviso = pServer->getAdvertising();
    aviso->setMinInterval(AVISO_MIN_MS * 8 / 5);   // en unidades de 0,625 ms
    aviso->setMaxInterval(AVISO_MAX_MS * 8 / 5);
    aviso->start();
    Serial.println("BLE iniciado y publicando.");

    // Se prende solo: estrella, a veces una frase y después los ojitos (con el nombre arriba un ratito)
    despertar();
    momentoDespierto = millis();
    ultimaVezHoy = millis();
    ultimaVezProximos = millis();
    Serial.println("Pantalla encendida");
}

void loop() {
    // El mensaje llega en trozos: se procesa cuando dejan de llegar (así no se corta si es largo)
    if (hayMensaje && millis() - ultimoTrozo > SILENCIO_BLE) {
        hayMensaje = false;
        String mensaje = mensajeCompleto;
        mensajeCompleto = "";
        agenda::cargar(mensaje);
        agenda::contarPorSerie();
        empezarHoy(true);   // apenas llegan: hoy y después los próximos días
    }

    const unsigned long ahora = millis();
    if (modo == HOY) {
        // Pasar al siguiente evento cada 3 segundos; al terminar, los próximos días o los ojos
        if (ahora - ultimoCambio > TIEMPO_POR_EVENTO) {
            paso++;
            if (paso >= totalHoy) {
                if (despuesProximos && agenda::diasProximos(diasProx, MAX_DIAS_PROXIMOS) > 0) empezarProximos();
                else volverAOjos(true);
            } else {
                ultimoCambio = ahora;
                mostrarEventoDeHoy();
            }
        }
    } else if (modo == PROXIMOS) {
        if (ahora - ultimoCambio > TIEMPO_POR_DIA) {
            paso++;
            if (paso >= totalDias) {
                volverAOjos(despuesProximos);
                despuesProximos = false;
            } else {
                ultimoCambio = ahora;
                agenda::dibujarDia(display, diasProx[paso], paso, totalDias);
            }
        }
    } else {
        animos.actualizar();
        if (modo == OJOS) {   // (al terminar un mood puede haber pasado a "próximos días")
            display.antesDeMostrar = dibujarExtras;   // sólo mientras se dibujan los ojos
            roboEyes.update();
            display.antesDeMostrar = nullptr;
        }

        // Cada tanto, recordar lo que queda de hoy (sólo si hay algo)
        if (modo == OJOS && millis() - ultimaVezHoy > CADA_CUANTO_EVENTOS) {
            int idx[agenda::MAX];
            if (agenda::deHoy(idx) > 0) empezarHoy(false);
            else ultimaVezHoy = millis();
        }
    }

    delay(10);
}
