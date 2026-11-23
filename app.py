from flask import Flask, request, jsonify, send_file
import requests
import json
import os
import re
import datetime

# El servidor sólo ENTIENDE lo que dijiste (audio → texto → evento).
# Agendar lo hace el celular de cada usuario en SU Google Calendar
# (con su permiso, desde app.js), o con el botón "Agregar a Google Calendar".
# Por eso acá no hay ningún calendario ni cuenta de Google.

app = Flask(__name__)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
BASE = os.path.dirname(__file__)
ARGENTINA = datetime.timezone(datetime.timedelta(hours=-3))
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def transcribir_audio(archivo):
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    # El celular manda webm (Android/PC) o m4a (iPhone); Groq usa la extensión para decodificar
    files = {"file": (archivo.filename or "audio.webm", archivo.read(), archivo.mimetype or "audio/webm")}
    data = {"model": "whisper-large-v3-turbo"}
    respuesta = requests.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers=headers,
        files=files,
        data=data
    )
    print(f"Respuesta Groq: {respuesta.json()}")
    return respuesta.json().get("text", "")


def fecha_de_hoy():
    """La fecha del celular (así no falla cerca de la medianoche); si no vino, la de Argentina."""
    hoy = request.form.get('hoy', '')
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", hoy):
        try:
            return datetime.date.fromisoformat(hoy)
        except ValueError:
            pass
    return datetime.datetime.now(ARGENTINA).date()


def extraer_evento(texto, hoy):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "model": "openai/gpt-oss-20b",
        "messages": [
            {"role": "system", "content": f"""Extraé el evento del texto y respondé SOLO en este formato JSON sin ningún texto extra:
            {{"titulo": "...", "fecha": "YYYY-MM-DD", "hora": "HH:MM"}}
            Hoy es {DIAS[hoy.weekday()]} {hoy.isoformat()}. Si dice un día de la semana, usá el próximo que venga.
            Si no hay fecha específica usá la fecha de hoy. Si no hay hora usá 09:00.
            El título tiene que ser corto (como mucho 40 letras) y empezar con mayúscula."""},
            {"role": "user", "content": texto}
        ]
    }
    respuesta = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=headers,
        json=body
    )
    print(f"Respuesta Llama: {respuesta.json()}")
    contenido = respuesta.json()["choices"][0]["message"]["content"].strip()
    # A veces el modelo envuelve el JSON en ```json ... ```
    contenido = contenido.strip("`").removeprefix("json").strip()
    return json.loads(contenido)


# ---------- Grabar: entender el evento (agendar lo hace el celular) ----------
@app.route('/audio', methods=['POST'])
def recibir_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No se recibió audio'}), 400

    texto = transcribir_audio(request.files['audio'])
    print(f"Transcripción: {texto}")
    if not texto.strip():
        return jsonify({'error': 'No se entendió el audio'}), 400

    try:
        evento = extraer_evento(texto, fecha_de_hoy())
        titulo = str(evento.get('titulo', '')).strip()[:80]
        fecha, hora = str(evento.get('fecha', '')), str(evento.get('hora', '09:00'))
        datetime.date.fromisoformat(fecha)                       # que sea una fecha de verdad
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", hora):
            hora = '09:00'
        if not titulo:
            raise ValueError('sin título')
    except Exception as e:
        print(f"No se pudo extraer el evento: {e}")
        return jsonify({'error': 'No entendí qué agendar. Probá decir qué, qué día y a qué hora.'}), 400
    print(f"Evento: {titulo} {fecha} {hora}")

    return jsonify({
        'ok': True,
        'evento': titulo,
        'fecha': fecha,
        'hora': hora,
        'transcripcion': texto,
    })


# ---------- Solo transcribir (notas y listas) ----------
@app.route('/transcribir', methods=['POST'])
def solo_transcribir():
    if 'audio' not in request.files:
        return jsonify({'error': 'No se recibió audio'}), 400
    texto = transcribir_audio(request.files['audio'])
    print(f"Transcripción nota: {texto}")
    return jsonify({'ok': True, 'texto': texto})


# ---------- Archivos de la interfaz ----------
# max_age=0 + no-cache: el celular siempre revisa si hay una versión nueva
# (antes podía quedarse días con el CSS viejo guardado)
def archivo(nombre, tipo):
    resp = send_file(os.path.join(BASE, nombre), mimetype=tipo, max_age=0)
    resp.headers['Cache-Control'] = 'no-cache, must-revalidate'
    return resp


@app.route('/app')
def interfaz():
    return archivo('index.html', 'text/html')


@app.route('/styles.css')
def css():
    return archivo('styles.css', 'text/css')


@app.route('/movil.css')
def css_movil():
    return archivo('movil.css', 'text/css')


@app.route('/app.js')
def js():
    return archivo('app.js', 'application/javascript')


@app.route('/plantillas.js')
def plantillas_js():
    return archivo('plantillas.js', 'application/javascript')


@app.route('/tutorial.js')
def tutorial_js():
    return archivo('tutorial.js', 'application/javascript')


# Logo: pestaña del navegador, acceso directo del celular y manifest (Android)
TIPOS_ICONO = {'.svg': 'image/svg+xml', '.png': 'image/png'}


@app.route('/iconos/<nombre>')
def icono(nombre):
    ext = os.path.splitext(nombre)[1].lower()
    ruta = os.path.join(BASE, 'iconos', nombre)
    if ext not in TIPOS_ICONO or os.path.basename(nombre) != nombre or not os.path.isfile(ruta):
        return "No encontrado", 404
    return archivo(os.path.join('iconos', nombre), TIPOS_ICONO[ext])


@app.route('/favicon.ico')
def favicon():
    return archivo(os.path.join('iconos', 'favicon-32.png'), 'image/png')


@app.route('/manifest.webmanifest')
def manifest():
    return archivo('manifest.webmanifest', 'application/manifest+json')


# ---------- Página de presentación ----------
TIPOS_PRESENTACION = {'.css': 'text/css', '.js': 'application/javascript'}


@app.route('/')
def presentacion():
    return archivo(os.path.join('presentacion', 'index.html'), 'text/html')


@app.route('/presentacion/<nombre>')
def archivo_presentacion(nombre):
    ext = os.path.splitext(nombre)[1].lower()
    ruta = os.path.join(BASE, 'presentacion', nombre)
    if ext not in TIPOS_PRESENTACION or os.path.basename(nombre) != nombre or not os.path.isfile(ruta):
        return "No encontrado", 404
    return archivo(os.path.join('presentacion', nombre), TIPOS_PRESENTACION[ext])


@app.route('/estado')
def estado():
    return "Backend Kynus funcionando"


# ---------- Para que Google encuentre la página ----------
# La dirección se arma con la del pedido, así funciona igual si cambia el dominio de Render.
@app.route('/robots.txt')
def robots():
    base = request.host_url.rstrip('/').replace('http://', 'https://')
    texto = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /audio\n"
        "Disallow: /transcribir\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )
    return app.response_class(texto, mimetype='text/plain')


@app.route('/sitemap.xml')
def sitemap():
    base = request.host_url.rstrip('/').replace('http://', 'https://')
    hoy = datetime.date.today().isoformat()
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{base}/</loc><lastmod>{hoy}</lastmod><priority>1.0</priority></url>\n'
        f'  <url><loc>{base}/app</loc><lastmod>{hoy}</lastmod><priority>0.6</priority></url>\n'
        '</urlset>\n'
    )
    return app.response_class(xml, mimetype='application/xml')


if __name__ == '__main__':
    app.run(debug=True, port=5000)  