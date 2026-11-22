"""Genera los SVG del logo de Kynus: la estrella-sello de la animación del llavero.

Misma geometría que llavero/animacion_inicio.h (brazos en rombo, pico al 30%,
líneas talladas desde el centro y motitas de tinta alrededor).
"""
import math, sys, os

FONDO  = "#1A1715"
ACENTO = "#C49A74"
ACENTO2 = "#D9B48F"
Q = math.pi / 4

# ángulo, largo, ancho (igual que ESTRELLA[8] del llavero)
ESTRELLA = [
    (0, 36, 3.5), (math.pi, 36, 3.5),
    (-math.pi / 2, 28, 4.5), (math.pi / 2, 32, 4.5),
    (-Q, 15, 2.8), (-3 * Q, 13, 2.8), (Q, 13, 2.8), (3 * Q, 14, 2.8),
]
MOTAS = [(18,100,3),(32,92,2),(55,105,3),(70,88,2),(112,95,3),(128,102,2),(150,90,3),(165,104,2),
         (196,98,3),(212,90,2),(236,104,3),(250,92,2),(290,100,2),(305,94,3),(328,104,2),(342,90,3)]


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def estrella(cx, cy, esc, ancho_extra=1.0):
    polis = []
    for ang, largo, ancho in ESTRELLA:
        dx, dy = math.cos(ang), math.sin(ang)
        px, py = -dy, dx
        L, w = largo * esc, ancho * esc * ancho_extra
        bx, by = cx + dx * L * 0.3, cy + dy * L * 0.3
        pts = [(cx, cy), (bx + px * w, by + py * w), (cx + dx * L, cy + dy * L), (bx - px * w, by - py * w)]
        polis.append(" ".join(f"{f(x)},{f(y)}" for x, y in pts))
    return "".join(f'<polygon points="{p}"/>' for p in polis)


def grabado(cx, cy, esc, grosor):
    lineas = []
    for i, (ang, largo, _) in enumerate(ESTRELLA):
        L = largo * esc * (0.55 if i < 4 else 0.6)
        lineas.append(f'<line x1="{f(cx)}" y1="{f(cy)}" x2="{f(cx + math.cos(ang) * L)}" y2="{f(cy + math.sin(ang) * L)}"/>')
    return f'<g stroke="{FONDO}" stroke-width="{f(grosor)}" stroke-linecap="round">' + "".join(lineas) + "</g>"


def motas(cx, cy, esc, grosor):
    lineas = []
    for a, r, l in MOTAS:
        ar = math.radians(a)
        dx, dy = math.cos(ar), math.sin(ar)
        x, y = cx + dx * 39 * esc * r / 100, cy + dy * 37 * esc * r / 100
        ll = l * esc * 0.9
        lineas.append(f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(x + dx * ll)}" y2="{f(y + dy * ll)}"/>')
    return f'<g stroke="{ACENTO}" stroke-width="{f(grosor)}" stroke-linecap="round" opacity=".75">' + "".join(lineas) + "</g>"


def svg_icono(tam=512):
    """Ícono de app (acceso directo): fondo a sangre, estrella completa con tallado y motitas.
    La estrella queda dentro del 80% central (zona segura de Android)."""
    c = tam / 2
    esc = tam / 100 * 0.95          # estrella ≈ 68% del ancho
    cy = c - 2 * esc                # la estrella va de -28 a +32 en alto: subir 2 para centrarla
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {tam} {tam}" width="{tam}" height="{tam}">
<defs>
  <radialGradient id="brillo" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="{ACENTO}" stop-opacity=".22"/>
    <stop offset="1" stop-color="{ACENTO}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="tinta" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{ACENTO2}"/>
    <stop offset="1" stop-color="{ACENTO}"/>
  </linearGradient>
</defs>
<rect width="{tam}" height="{tam}" fill="{FONDO}"/>
<circle cx="{f(c)}" cy="{f(c)}" r="{f(tam * 0.42)}" fill="url(#brillo)"/>
{motas(c, cy, esc, esc * 1.1)}
<g fill="url(#tinta)">{estrella(c, cy, esc, ancho_extra=1.15)}</g>
{grabado(c, cy, esc, esc * 0.6)}
</svg>
'''


def svg_favicon():
    """Mini logo de la pestaña: cuadrado redondeado, estrella grande y más gruesa
    (sin motitas: a 16-32 px no se ven)."""
    tam = 64
    c = tam / 2
    esc = tam / 76
    cy = c - 2 * esc
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {tam} {tam}">
<rect width="{tam}" height="{tam}" rx="14" fill="{FONDO}"/>
<g fill="{ACENTO2}">{estrella(c, cy, esc, ancho_extra=1.45)}</g>
{grabado(c, cy, esc, 1.6)}
</svg>
'''


if __name__ == "__main__":
    salida = sys.argv[1]
    os.makedirs(salida, exist_ok=True)
    with open(os.path.join(salida, "icono.svg"), "w", encoding="utf-8") as a:
        a.write(svg_icono())
    with open(os.path.join(salida, "favicon.svg"), "w", encoding="utf-8") as a:
        a.write(svg_favicon())
    print("ok")
