# Kynus — contexto del proyecto

Kynus (antes "Polaris") es un llavero inteligente hecho por Ciro (5°C, Instituto Técnico El Obraje).
Le hablás al celular, el evento se agenda solo en Google Calendar y el llavero muestra en su
pantallita OLED lo que tenés ese día. "Como un tamagochi, pero que sirve para algo."

- **Nombre:** Kynus viene de *Kynosoura*, el nombre griego de la estrella polar: el punto fijo
  que no se mueve mientras todo el cielo gira. Lema: "Tu estrella guía para el día a día".
- **Idioma:** todo en español rioplatense (textos de la app, comentarios del código, nombres de variables).
- **Presupuesto:** todo tiene que ser gratis (Render free, Groq free, Google Cloud sin facturación).

## Arquitectura

```
App web (celular, Chrome Android)
  ├─ graba audio (MediaRecorder) ──POST /audio──▶ Backend Flask en Render
  │                                                 ├─ Groq Whisper (whisper-large-v3-turbo) → texto
  │                                                 ├─ Groq LLM (openai/gpt-oss-20b) → evento JSON
  │                                                 └─ Google Calendar API (cuenta de servicio) → inserta evento
  └─ botón Sincronizar ──GET /eventos──▶ eventos de hoy
        └─ Web Bluetooth ──▶ ESP32-C3 del llavero ──▶ OLED
```

### Backend (`app.py`, Flask + gunicorn en Render, deploy automático desde GitHub)
- Rutas: `/audio` (transcribe + extrae + agenda), `/transcribir`, `/eventos` (eventos de hoy),
  `/app` (sirve `index.html`), `/styles.css`, `/movil.css`, `/app.js`, `/iconos/<archivo>`, `/manifest.webmanifest`,
  `/` (página de presentación, carpeta `presentacion/`), `/presentacion/<archivo>` (sólo .css y .js), `/estado` (texto de estado).
- Variables de entorno en Render: `GROQ_API_KEY`, `GOOGLE_SERVICE_ACCOUNT` (JSON completo de la cuenta de servicio).
- El calendario de Ciro está compartido con la cuenta de servicio; el `CALENDAR_ID` está en `app.py`.
- Los archivos se sirven con ruta absoluta (`os.path.dirname(__file__)`), si no Render devuelve 0 bytes.
- `requirements.txt`: flask, google-auth, google-auth-oauthlib, google-api-python-client, requests, gunicorn.
- Render free se duerme a los 15 min: la primera petición tarda.
- **Pendiente de seguridad:** `/audio` y `/eventos` no tienen ninguna protección.
- Nunca subir `credentials.json`, `token.pickle` ni claves (ya pasó una vez; están en `.gitignore`).

### App web (`index.html`, `styles.css`, `app.js`)
- Barra de búsqueda arriba; abajo 3 botones: notas (izq.), botón redondo de grabar (centro), listas (der.).
- Notas con texto enriquecido (`contenteditable`) y listas, guardadas en `localStorage`
  con las claves `llavero_notas` y `llavero_listas` (**no renombrar**: se perderían los datos).
- BLE: `requestDevice({ filters:[{namePrefix:"Kynus"},{namePrefix:"Llavero"}], optionalServices:[SERVICE_UUID] })`
  - `SERVICE_UUID = 6e400001-b5a3-f393-e0a9-e50e24dcca9e`, `CHAR_UUID = 6e400002-b5a3-f393-e0a9-e50e24dcca9e`
  - Mensaje: `"HH:MM título|HH:MM título|..."`, enviado en trozos de 20 bytes. Vacío → "Sin eventos hoy".
- Web Bluetooth solo anda en Chrome: si se hace APK, usar PWA + Trusted Web Activity (PWABuilder),
  no Capacitor ni WebView.

### Firmware (ESP32-C3 Super Mini, Arduino IDE)
- OLED SSD1306 0.96" 128×64 por I2C: SDA=8, SCL=9 (`Wire.begin(8,9)`). Botón en GPIO 4 con `INPUT_PULLUP`
  (alternativas libres: 3, 5, 6, 7, 10). "USB CDC On Boot" activado.
- Ojos animados con FluxGarage RoboEyes: `RoboEyes<Adafruit_SSD1306> roboEyes(display);`
- Nombre BLE: `BLEDevice::init("Kynus")` (antes "Llavero..."; la app acepta los dos).
- Un solo botón: 1 clic prende · 2 clics muestra eventos · 1 clic sale de eventos ·
  mantener 3 s apaga · se apaga solo a los 5 min (`TIEMPO_APAGADO_AUTO 300000`). Ventana de clics 300 ms.
- Animación de arranque: punto → línea → estrella de 8 puntas que gira y se "sella" →
  se disuelve en partículas que forman los ojos (lógica en `animacion_inicio.h`).
- Hardware: LiPo 502030 + cargador TP4056 (USB-C) + interruptor. No usar pila de 9 V.

### Página de presentación (`presentacion/`, se sirve en `/`)
- Estética de los banners (cielo Y2K, marco de cuadritos, ventanas Win98) + 3D con three.js 0.160,
  GSAP 3.12.5 + ScrollTrigger y Lenis 1.1.13 (todo por CDN jsdelivr, versiones fijas).
- `oled.js`: la pantalla 128×64 simulada (arranque igual a `animacion_inicio.h`, ojos tipo RoboEyes, eventos).
- `escena3d.js`: estrella facetada + llavero "boom" con piezas que se separan (vista explotada).
- `principal.js`: un "director" calcula todo según el scroll en cada cuadro; intro de la tele una vez por visita.
- Para revisar una sección directo: `/?sinintro&ir=como&p=0.5` (`ir` = id de la sección, `p` = avance 0–1).

## Identidad visual

- **Símbolo:** estrella de 8 puntas (la estrella polar) con brillo, en blanco, rosa y lila.
- **App:** neobrutalismo oscuro + pasteles. Bordes negros de 3px, sombras duras (`4px 4px 0 #000`), sin desenfoques.
  - Fondo `--tinta #17161F`, superficies `#211F2D` / `#2C2939`, texto `#F2F0F7`, tenue `#9D98B0`.
  - Pasteles: menta `#9FE8C8`, lila `#C0AEF0`, durazno `#FFB59C`, manteca `#FFDD8F`, cielo `#A6D8F7`.
  - Tipografías: Space Grotesk (texto), Archivo Black (títulos).
- **Presentación y banners:** estilo Y2K. Cielo celeste con nubes (`#7FB9E6 → #A9D2F0 → #D7ECFA`),
  borde de cuadros rosa y blanco (`#F4B8E4`), ventanitas tipo Windows 98 ("kynus.exe") con barra rosa `#F9D3EE`
  y sombra lila `#C9A4F2`, acento rosa `#F49AD6`, texto `#111111`. Títulos en Archivo Black itálica.
- Material hecho: presentación de 5 min (10 diapositivas, `Kynus.pptx`), banners A4
  (opción A: 2 banners de 2 hojas apaisadas; opción B: 4 hojas verticales).

## Carcasas 3D (`Kynus_carcasas.zip`, scripts `geo.py` y `build.py`)
- Dos formas: **estrella** "boom" de cómic (5 puntas irregulares, todas redondeadas) y **gota**.
- Pantalla al centro, botón en la espalda, aro para llavero arriba.
- 3 piezas por forma: frente, tapa y tecla. Pared 1,8 mm, espesor total 18,7 mm, unidas con 2 tornillos M2.
- Componentes apilados en 3 capas: OLED; ESP32 + TP4056; batería + interruptor (sin choques verificados).
- La posición de la ventana del OLED varía según el fabricante: imprimir primero el frente para probar.

## Marca y legal
- "Polaris" en clase 9 está tomada en Argentina (Quae Argentina SRL, apps móviles, en trámite).
- "Kynus" se buscó en el INPI (nov 2026): sin marcas en ninguna clase. A registrar como marca
  denominativa en clase 9 (y después 14 y 42).
- El software no es patentable en Argentina. La forma de las carcasas se puede proteger como diseño industrial.

## Ideas pendientes
- `robots.txt` + `sitemap.xml` + Google Search Console para la presentación (ya está en `/`); proteger `/app` con contraseña.
- APK con PWABuilder (manifest, service worker, `/.well-known/assetlinks.json`).
- Dominio propio (`kynus.com.ar`).
