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
  ├─ graba audio (MediaRecorder) ──POST /audio (+ fecha del celu)──▶ Backend Flask en Render
  │                                                 ├─ Groq Whisper (whisper-large-v3-turbo) → texto
  │                                                 └─ Groq LLM (openai/gpt-oss-20b) → evento JSON (no agenda)
  ├─ agendar, en el calendario DE CADA USUARIO (desde el celular, app.js):
  │     ├─ con Google conectado (Google Identity Services, permiso calendar.events) → Calendar API
  │     └─ sin conectar → tarjeta con "Agregar a Google Calendar" (enlace calendar.google.com/…?action=TEMPLATE)
  │     y siempre se guarda en localStorage `llavero_eventos` (el llavero lo muestra aunque no haya Google)
  └─ botón Sincronizar → eventos de hoy (Google si está conectado; si no, los guardados en Kynus)
        └─ Web Bluetooth ──▶ ESP32-C3 del llavero ──▶ OLED
```

### Backend (`app.py`, Flask + gunicorn en Render, deploy automático desde GitHub)
- Rutas: `/audio` (transcribe + extrae, NO agenda; recibe `hoy` = fecha del celular), `/transcribir`,
  `/app` (sirve `index.html`), `/styles.css`, `/movil.css`, `/app.js`, `/iconos/<archivo>`, `/manifest.webmanifest`,
  `/` (página de presentación, carpeta `presentacion/`), `/presentacion/<archivo>` (sólo .css y .js), `/estado` (texto de estado), `/guia` (guía para quienes prueban Kynus, carpeta `guia/`). Los logs no guardan lo que dice cada usuario.
- El servidor no toca ningún calendario: no hay cuenta de servicio ni `CALENDAR_ID` (se sacaron en la v13).
- Variable de entorno en Render: `GROQ_API_KEY` (`GOOGLE_SERVICE_ACCOUNT` ya no se usa).
- Los archivos se sirven con ruta absoluta (`os.path.dirname(__file__)`), si no Render devuelve 0 bytes.
- `requirements.txt`: flask, requests, gunicorn.
- Render free se duerme a los 15 min: la primera petición tarda hasta ~1 min. La app lo despierta al abrirse y al
  empezar a grabar (`despertarServidor`: un GET a `/audio`, que pasa por Netlify, despierta a Render y responde 405 sin
  gastar cuota; la regla de Netlify para `/estado` no funcionó) y si Netlify devuelve 502/503/504 avisa
  "Despertando el servidor…" y reintenta hasta 80 s (`pedirServidor`). Opcional: un monitor gratis (UptimeRobot)
  que pida `/estado` cada 10 min lo mantiene despierto.
- Cuota de Groq (v17): `/audio` y `/transcribir` siguen abiertos pero con límites en memoria (`app.py`):
  30 por hora y 150 por día por IP (Netlify la pasa en `X-Nf-Client-Connection-Ip`), tope total de 18 por
  minuto y 800 por día, audio de 3 MB como mucho (413). Responden 429 con un mensaje para la app. Los
  rechazados no cuentan. Se reinician si Render reinicia. La app corta la grabación del botón rosa y del
  dictado al minuto (`MAX_GRABACION`); los audios guardados en notas no van al servidor y no tienen límite.
  Plan gratis de Groq: no cobra, sólo se agota la cuota. Opción más fuerte para después: exigir login de Google.

### Google Calendar de cada usuario (app.js, sección "GOOGLE CALENDAR")
- `GOOGLE_CLIENT_ID` en `app.js` (ID de cliente OAuth tipo "Aplicación web"; no es secreto). Vacío = sólo la opción
  del enlace. Orígenes autorizados: el dominio de Netlify (y el de Render si se usa).
- Pantalla de consentimiento en modo "Prueba": hasta 100 usuarios de prueba cargados a mano; sale el cartel
  "app no verificada". Verificarla pide política de privacidad y dominio propio.
- El token dura 1 h (sessionStorage `llavero_google_token`); la cuenta conectada en `llavero_google`.
  La ventanita del permiso tiene que abrirse dentro de un toque: por eso se pide al terminar de grabar y,
  en Sincronizar, un toque renueva el permiso y otro busca el llavero.
- Nunca subir `credentials.json`, `token.pickle` ni claves (ya pasó una vez; están en `.gitignore`).

### App web (`index.html`, `styles.css`, `movil.css`, `app.js`, `plantillas.js`, `tutorial.js`) — versión 13
- Estética Y2K pastel (cielo con nubes, ventanas Win98). `movil.css` sólo se aplica en celulares (`html.movil`).
- Panel con notas y tareas; abajo: Notas · grabar (→ Calendar) · Tareas · Llavero. Al editar, esa barra se cambia
  por la de la nota: deshacer/rehacer · QR · buscar · grabar · menú "···" · mostrar/ocultar herramientas.
- Menú "···": foto, archivo (PDF/TXT/DOCX), presentación, exportar (PDF/Word/HTML/MD/TXT), fondo, fuente,
  tabla, efectos de texto y 25 plantillas (`plantillas.js`, se carga sólo al abrirlas). Estado de la nota
  (borrador/en curso/terminada), contador con límite de 35.000 caracteres y casillas dentro de las notas.
- Todo se guarda en `localStorage` con la clave `llavero_docs` (las claves viejas `llavero_notas` y
  `llavero_listas` se migran solas; **no renombrar** claves: se perderían los datos). Fotos, audios, archivos
  y fotos de portada van en IndexedDB (`llavero_media`).
- BLE: `requestDevice({ filters:[{namePrefix:"Kynus"},{namePrefix:"Llavero"}], optionalServices:[SERVICE_UUID] })`
  - `SERVICE_UUID = 6e400001-b5a3-f393-e0a9-e50e24dcca9e`, `CHAR_UUID = 6e400002-b5a3-f393-e0a9-e50e24dcca9e`
  - Mensaje (v14): `"K2|AAAA-MM-DD HH:MM|AAAA-MM-DD HH:MM título|AAAA-MM-DD --:-- título|..."`: la primera
    fecha es "ahora" (el llavero no tiene reloj), después hoy (máx. 10) y los próximos 7 días (máx. 20 en total);
    `--:--` = todo el día; títulos de hasta 32 letras sin `|`. Trozos de 20 bytes. El firmware también
    entiende el formato viejo `"HH:MM título|..."` (todo de hoy).
  - Envío automático (v14): después de la primera sincronización, la app recuerda el `BluetoothDevice`
    mientras está abierta (puntito menta en el botón Llavero) y le manda la agenda sola al grabar un evento,
    al volver a la app (si pasaron 20 s) y cada 30 min; si está lejos, reintenta cada 5 min. Conecta, escribe
    y desconecta. Google tarda unos segundos en listar un evento recién creado: por eso los recién
    agendados se suman igual al mensaje durante 5 min (`sumarRecientes`, sin duplicar).
    Si Google está conectado con el permiso vencido, no manda (no pisa la agenda con sólo lo de Kynus).
    `getDevices()` (recordarlo entre sesiones) viene apagado en Chrome Android: al reabrir la app hay que
    tocar Sincronizar una vez.
- Web Bluetooth solo anda en Chrome: si se hace APK, usar PWA + Trusted Web Activity (PWABuilder),
  no Capacitor ni WebView.

### Firmware (ESP32-C3 Super Mini, Arduino IDE)
- OLED SSD1306 0.96" 128×64 por I2C: SDA=8, SCL=9 (`Wire.begin(8,9)`). Botón en GPIO 4 con `INPUT_PULLUP`
  (alternativas libres: 3, 5, 6, 7, 10). "USB CDC On Boot" activado.
- Ojos animados con FluxGarage RoboEyes: `RoboEyes<Adafruit_SSD1306> roboEyes(display);`
- Nombre BLE: cada llavero se llama `Kynus-XXXX` (últimos 2 bytes de su MAC, `armarNombre()`); se ve arriba a
  la izquierda los primeros 8 s después de prenderse. La app acepta "Kynus" y "Llavero" (los viejos "Llavero C3").
- Batería (está siempre prendido): CPU a 80 MHz, brillo 0x50, ojos a 40 cuadros/s, aviso BLE cada 0,5–1 s
  (`CPU_MHZ`, `BRILLO`, `CUADROS_POR_SEG`, `AVISO_*_MS` en `llavero.ino`). Falta medir cuánto dura.
- Un solo botón: 1 clic prende · 2 clics muestra eventos · 1 clic sale de eventos ·
  mantener 3 s apaga · se apaga solo a los 5 min (`TIEMPO_APAGADO_AUTO 300000`). Ventana de clics 300 ms.
- Animación de arranque: punto → línea → estrella de 8 puntas que gira y se "sella" →
  la estrella se achica a iconito y se escribe una frase (máquina de escribir) → la frase se
  desarma en partículas que forman los ojos (`animacion_inicio.h` + `frases.h`).
- `frases.h`: 50 frases (citas con autor, estudio, recordatorios, de Kynus), máx. 64; 21 letras por
  renglón, 4 renglones con autor / 5 sin. No se repiten hasta que salen todas (Preferences "kynus").
  Tildes/ñ/¿/¡ se pasan a CP437 (`display.cp437(true)`); los títulos de eventos también.
- `animos.h`: moods al azar (feliz, cansado, triste, enojado, sorprendido, curioso, enamorado,
  dormido, nervioso, confundido, pícaro, emocionado). `PantallaKynus` deja dibujar extras
  (lágrima, corazones, Zzz, ?, !, estrellitas) antes de cada cuadro de RoboEyes.
- `agenda.h`: lee el mensaje, guarda hasta 24 eventos y cuenta la hora desde la sincronización (se pierde al
  apagar). El mensaje se procesa cuando pasan 700 ms sin trozos nuevos (antes se cortaba si era largo).
- El código actual es la versión **sin botón**. Al prenderse, la frase sale 1 de cada 5 veces
  (`CHANCE_FRASE`). Al sincronizar: eventos de hoy y después los próximos días. Al terminar un mood, 35% de
  chance (`PROXIMOS_CHANCE`, como mucho cada 3 min) de mostrar los próximos días (hasta 3, uno por pantalla).
  Cada 1 min repasa lo que queda de hoy (los eventos que ya terminaron no se muestran). Si todos los de hoy
  ya pasaron dice "¡Listo por hoy! / Ya pasaron los N" (no "Sin eventos hoy"); la app cuenta igual
  (pendientes / ya pasaron). Al recibir la agenda, el Monitor Serie lista cada evento y marca "(ya pasó)".
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
