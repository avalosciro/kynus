#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <FluxGarage_RoboEyes.h>
#include "animacion_inicio.h"

// ============================================================
//  LLAVERO — versión sin botón
//  - Al encender: animación de inicio (línea → estrella → ojitos)
//  - Siempre muestra los ojitos
//  - Cuando llegan eventos por Bluetooth los muestra uno por uno
//  - Cada 1 minuto vuelve a mostrar los eventos del día
// ============================================================

#define SERVICE_UUID        "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

// Mapeo de pines para ESP32-C3 SuperMini
#define PIN_SDA 8
#define PIN_SCL 9

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

#define TIEMPO_POR_EVENTO   3000    // cada evento se ve 3 segundos
#define CADA_CUANTO_EVENTOS 60000   // cada 1 minuto vuelve a mostrar los eventos

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
RoboEyes<Adafruit_SSD1306> roboEyes(display);

String mensajeCompleto = "";
volatile bool hayEvento = false;
String eventos[10];
int totalEventos = 0;
int eventoActual = 0;

bool mostrandoEventos = false;
unsigned long ultimoCambioEvento = 0;
unsigned long ultimaVezEventos = 0;

// Parser robusto para eventos separados por '|'
void parsearEventos(String mensaje) {
    totalEventos = 0;
    int inicio = 0;
    int fin = mensaje.indexOf('|');

    while (fin != -1 && totalEventos < 10) {
        eventos[totalEventos] = mensaje.substring(inicio, fin);
        eventos[totalEventos].trim();
        if (eventos[totalEventos].length() > 0) totalEventos++;
        inicio = fin + 1;
        fin = mensaje.indexOf('|', inicio);
    }

    // Capturar el último fragmento si no termina en '|'
    if (inicio < (int)mensaje.length() && totalEventos < 10) {
        String ultimo = mensaje.substring(inicio);
        ultimo.trim();
        if (ultimo.length() > 0) {
            eventos[totalEventos] = ultimo;
            totalEventos++;
        }
    }
}

void mostrarEventoActual() {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);

    if (totalEventos == 0) {
        display.setCursor(10, 28);
        display.println("Sin eventos hoy");
        display.display();
        return;
    }

    String evento = eventos[eventoActual % totalEventos];
    String hora = "";
    String titulo = evento;

    // Formato "HH:MM titulo"
    int espacioIdx = evento.indexOf(' ');
    if (espacioIdx != -1) {
        hora = evento.substring(0, espacioIdx);
        titulo = evento.substring(espacioIdx + 1);
    }

    // Encabezado
    display.setCursor(0, 0);
    display.println("EVENTO " + String(eventoActual + 1) + "/" + String(totalEventos));
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

    // Hora y título
    display.setCursor(0, 18);
    display.println("Hora: " + hora);
    display.setCursor(0, 36);
    display.println(titulo);

    display.display();
}

void empezarEventos() {
    mostrandoEventos = true;
    eventoActual = 0;
    ultimoCambioEvento = millis();
    mostrarEventoActual();
    Serial.println("Mostrando eventos");
}

void volverAOjos() {
    mostrandoEventos = false;
    ultimaVezEventos = millis();
    Serial.println("Modo ojos");
}

class MiCallback : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        String valor = pCharacteristic->getValue().c_str();
        Serial.println("BLE Chunk recibido: " + valor);
        mensajeCompleto += valor;
        hayEvento = true;
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
    Serial.begin(115200);

    // Inicialización explícita de I2C en la ESP32-C3 SuperMini
    Wire.begin(PIN_SDA, PIN_SCL);

    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("Error: OLED SSD1306 no encontrada.");
    }
    display.clearDisplay();
    display.display();

    roboEyes.begin(SCREEN_WIDTH, SCREEN_HEIGHT, 100);
    roboEyes.setAutoblinker(ON, 3, 2);
    roboEyes.setIdleMode(ON, 3, 2);

    // Inicializar Servidor Bluetooth LE
    BLEDevice::init("Llavero C3");
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
    pServer->getAdvertising()->start();
    Serial.println("BLE iniciado y publicando.");

    // Se prende solo: animación de inicio y después los ojitos
    animacionInicio(display, roboEyes, -1);   // -1 = sin botón
    ultimaVezEventos = millis();
    Serial.println("Pantalla encendida");
}

void loop() {
    // Procesar acumulación de paquetes BLE
    if (hayEvento) {
        delay(500); // Espera a que terminen de llegar los paquetes fragmentados
        hayEvento = false;
        parsearEventos(mensajeCompleto);
        mensajeCompleto = "";
        Serial.println("Total eventos cargados: " + String(totalEventos));
        empezarEventos();   // apenas llegan, se muestran
    }

    if (mostrandoEventos) {
        // Pasar al siguiente evento cada 3 segundos; después del último vuelve a los ojos
        if (millis() - ultimoCambioEvento > TIEMPO_POR_EVENTO) {
            eventoActual++;
            if (eventoActual >= totalEventos) {
                volverAOjos();
            } else {
                ultimoCambioEvento = millis();
                mostrarEventoActual();
            }
        }
    } else {
        roboEyes.update();

        // Cada tanto, recordar los eventos del día (solo si hay)
        if (totalEventos > 0 && millis() - ultimaVezEventos > CADA_CUANTO_EVENTOS) {
            empezarEventos();
        }
    }

    delay(10);
}
