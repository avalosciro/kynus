#!/usr/bin/env bash
# Arma la carpeta dist/ con lo público del sitio (sin app.py, claves, zips, etc.).
# La usa Cloudflare Pages (comando de compilación: bash armar_sitio.sh, carpeta de salida: dist).
#   /        → presentación   (dist/index.html)
#   /app     → la aplicación  (dist/app.html; Cloudflare sirve /app sin el .html)
#   /guia    → guía para quienes prueban Kynus
# El servidor (/audio, /transcribir) sigue en Render: la app le habla directo.
set -e
rm -rf dist
mkdir -p dist
cp -r presentacion iconos guia dist/
cp styles.css movil.css app.js plantillas.js tutorial.js manifest.webmanifest dist/
cp index.html dist/app.html
cp presentacion/index.html dist/index.html
cp iconos/favicon-32.png dist/favicon.ico
echo "Sitio armado en dist/"
