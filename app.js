/* ============================================================
   KYNUS — app.js
   Notas + tareas (localStorage), fotos, audios y archivos (IndexedDB),
   dictado, modo lectura, fijar, exportar y grabar → Google Calendar.
   Versión 10: barra de la nota (deshacer, QR, buscar, menú), plantillas,
   tablas, efectos de texto, fondo, fuente, estado, presentación,
   casillas dentro de las notas y los ojitos de Kynus.
   ============================================================ */

const BACKEND = window.location.origin;
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHAR_UUID    = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const VERSION = 11;
const LIMITE = 35000;                    // caracteres por nota
const esMovil = () => document.documentElement.classList.contains("movil");
const sinMovimiento = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = id => document.getElementById(id);
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const escapar = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

/* ---------- Estado ---------- */
let docs = [];          // { id, tipo:"nota"|"tarea", titulo, cuerpo, items, fijada, creada, editada, adjuntos, estado, portada, fuente }
let tab = "notas";      // notas | tareas
let abierto = null;     // id del doc en el editor
let filtro = "";
let orden = leer("llavero_orden") || "recientes";

const ESTADOS = [
  { id:"borrador", txt:"Borrador" },
  { id:"progreso", txt:"En curso" },
  { id:"lista",    txt:"Terminada" },
];
const PORTADAS = [
  { id:"cielo", nombre:"Cielo" }, { id:"atardecer", nombre:"Atardecer" }, { id:"lila", nombre:"Lila" },
  { id:"menta", nombre:"Menta" }, { id:"manteca", nombre:"Manteca" }, { id:"cuadritos", nombre:"Cuadritos" },
  { id:"noche", nombre:"Noche" }, { id:"estrellas", nombre:"Estrellitas" },
];
const FUENTES = [
  { id:"",      nombre:"Archivo", sub:"La de siempre" },
  { id:"serif", nombre:"Serif",   sub:"Para leer tranquilo" },
  { id:"mono",  nombre:"Mono",    sub:"Como máquina de escribir" },
  { id:"pixel", nombre:"Pixel",   sub:"Como la pantallita del llavero" },
];

const ico = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONOS = {
  foto:     ico('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>'),
  clip:     ico('<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>'),
  diapo:    ico('<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M12 16v4M8 20h8M7 8h6M7 11h9"/>'),
  exportar: ico('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  fondo:    ico('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="m7 7 2-2 2 2 3-3 3 3" stroke-width="1.4"/>'),
  fuente:   ico('<path d="M5 20 11 4h2l6 16M8 14h8"/>'),
  tabla:    ico('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>'),
  efectos:  ico('<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>'),
  plantillas: ico('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
  fijar:    ico('<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>'),
  lectura:  ico('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  duplicar: ico('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
  eliminar: ico('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>'),
  flecha:   ico('<path d="m9 6 6 6-6 6"/>'),
  atras:    ico('<path d="m15 6-6 6 6 6"/>'),
  archivo:  ico('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  sacar:    ico('<path d="M6 6l12 12M18 6 6 18"/>'),
};

const ICONO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>';
const ICONO_X     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/* ============================================================
   ALMACENAMIENTO
   ============================================================ */
function leer(clave){ try{ return localStorage.getItem(clave); }catch{ return null; } }
function escribir(clave, valor){ try{ localStorage.setItem(clave, valor); return true; }catch{ return false; } }

function cargar(){
  try{ docs = JSON.parse(leer("llavero_docs") || "[]"); }catch{ docs = []; }
  if (!leer("llavero_docs")) migrarViejo();
  docs.forEach(d => { d.adjuntos = d.adjuntos || []; d.items = d.items || []; d.estado = d.estado || "borrador"; });
}

// Pasa las notas y listas de la versión anterior al formato nuevo
function migrarViejo(){
  let notas = [], listas = [];
  try{ notas  = JSON.parse(leer("llavero_notas")  || "[]"); }catch{}
  try{ listas = JSON.parse(leer("llavero_listas") || "[]"); }catch{}
  notas.forEach(n => docs.push(nuevoDoc("nota", { id:n.id, titulo:n.titulo, cuerpo:n.cuerpo, creada:n.editado, editada:n.editado })));
  listas.forEach(l => docs.push(nuevoDoc("tarea", {
    id:l.id, titulo:l.titulo, creada:l.editado, editada:l.editado,
    items:(l.items || []).map(i => ({ id:nuevoId(), texto:i.texto, hecho:!!i.hecho }))
  })));
  if (docs.length) guardar();
}

function guardar(){
  if (!escribir("llavero_docs", JSON.stringify(docs))) avisar("No se pudo guardar en este navegador", "error");
}

function nuevoDoc(tipo, extra = {}){
  const ahora = Date.now();
  return { id:nuevoId(), tipo, titulo:"", cuerpo:"", items:[], fijada:false, creada:ahora, editada:ahora, adjuntos:[],
           estado:"borrador", portada:"", fuente:"", ...extra };
}

const docAbierto = () => docs.find(d => d.id === abierto);

/* ---------- Fotos, audios y archivos en IndexedDB ---------- */
const media = (() => {
  let conexion;
  const abrir = () => conexion || (conexion = new Promise((ok, mal) => {
    const r = indexedDB.open("llavero_media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("blobs");
    r.onsuccess = () => ok(r.result);
    r.onerror   = () => mal(r.error);
  }));
  const tx = async (modo, fn) => {
    const db = await abrir();
    return new Promise((ok, mal) => {
      const t = db.transaction("blobs", modo);
      const req = fn(t.objectStore("blobs"));
      t.oncomplete = () => ok(req.result);
      t.onerror    = () => mal(t.error);
    });
  };
  return {
    get: id      => tx("readonly",  s => s.get(id)),
    put: (id, b) => tx("readwrite", s => s.put(b, id)),
    del: id      => tx("readwrite", s => s.delete(id)),
  };
})();

/* ============================================================
   UTILIDADES
   ============================================================ */
// Texto sin formato; entre párrafos, títulos y celdas deja un espacio (si no, quedan las palabras pegadas)
const textoPlano = html => {
  const t = document.createElement("div");
  t.innerHTML = (html || "").replace(/<(\/(?:p|div|h[1-6]|li|blockquote|td|tr|ul|ol|table)|br\s*\/?)>/gi, " <$1>");
  return (t.textContent || "").replace(/\s+/g, " ").trim();
};

function fechaCorta(ts){
  const d = new Date(ts), hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });
  return d.toLocaleDateString("es-AR", { day:"numeric", month:"short" });
}
function fechaLarga(ts){
  return new Date(ts).toLocaleString("es-AR", { day:"numeric", month:"long", hour:"2-digit", minute:"2-digit" });
}
const tamanio = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

let timerAviso;
function avisar(texto, tipo = "", ms = 2800){
  const el = $("aviso");
  el.textContent = texto;
  el.className = "aviso mostrar " + tipo;
  clearTimeout(timerAviso);
  if (ms) timerAviso = setTimeout(() => el.className = "aviso " + tipo, ms);
}

function descargar(nombre, contenido, tipo){
  const url = URL.createObjectURL(contenido instanceof Blob ? contenido : new Blob([contenido], { type:tipo }));
  const a = Object.assign(document.createElement("a"), { href:url, download:nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const nombreArchivo = t => (t || "sin-titulo").replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 60) || "sin-titulo";

/* ============================================================
   DETALLES: CHISPITAS Y LOS OJITOS DE KYNUS
   ============================================================ */
const COLORES_CHISPA = ["#F49AD6", "#C9A4F2", "#FFDD8F", "#9FE8C8", "#A6D8F7", "#FFFFFF"];
function chispas(x, y, cantidad = 10){
  if (sinMovimiento || !Element.prototype.animate) return;
  for (let i = 0; i < cantidad; i++){
    const s = document.createElement("span");
    s.className = "chispa";
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.background = COLORES_CHISPA[i % COLORES_CHISPA.length];
    document.body.appendChild(s);
    const ang = (i / cantidad) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 26 + Math.random() * 34;
    const a = s.animate([
      { transform:"translate(0,0) scale(.4) rotate(0deg)", opacity:1 },
      { transform:`translate(${(Math.cos(ang) * dist).toFixed(1)}px, ${(Math.sin(ang) * dist).toFixed(1)}px) scale(1) rotate(${Math.random() > .5 ? 120 : -120}deg)`, opacity:0 },
    ], { duration:650 + Math.random() * 300, easing:"cubic-bezier(.2,.7,.3,1)" });
    a.onfinish = () => s.remove();
  }
}
const chispasEn = (el, n) => { if (!el) return; const r = el.getBoundingClientRect(); chispas(r.left + r.width / 2, r.top + r.height / 2, n); };

// Los ojitos miran hacia el puntero; en el celular miran para cualquier lado de vez en cuando
const ojitos = [...document.querySelectorAll(".ojitos")];
let pX = innerWidth / 2, pY = innerHeight / 2, rafOjos = 0, ultimoPuntero = 0;
function moverOjos(){
  rafOjos = 0;
  for (const o of ojitos){
    if (!o.offsetParent) continue;
    const r = o.getBoundingClientRect();
    const max = o.classList.contains("grande") ? 10 : 3;
    const dx = pX - (r.left + r.width / 2), dy = pY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / 260);
    o.style.setProperty("--ox", (dx / dist * max * k).toFixed(1) + "px");
    o.style.setProperty("--oy", (dy / dist * max * 0.7 * k).toFixed(1) + "px");
  }
}
addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  pX = e.clientX; pY = e.clientY; ultimoPuntero = Date.now();
  if (!rafOjos) rafOjos = requestAnimationFrame(moverOjos);
}, { passive:true });
setInterval(() => {
  if (Date.now() - ultimoPuntero < 4000 || document.hidden) return;
  for (const o of ojitos){
    const max = o.classList.contains("grande") ? 10 : 3;
    o.style.setProperty("--ox", ((Math.random() * 2 - 1) * max).toFixed(1) + "px");
    o.style.setProperty("--oy", ((Math.random() * 2 - 1) * max * 0.6).toFixed(1) + "px");
  }
}, 3200);
let timerAnimo;
function animo(clase, ms = 1500){
  ojitos.forEach(o => { o.classList.remove("feliz", "sorpresa"); void o.offsetWidth; o.classList.add(clase); });
  clearTimeout(timerAnimo);
  timerAnimo = setTimeout(() => ojitos.forEach(o => o.classList.remove(clase)), ms);
}

/* ============================================================
   MENÚ FLOTANTE CHICO (panel, ordenar, crear…)
   ============================================================ */
function abrirMenu(ancla, opciones){
  const m = $("menu");
  m.innerHTML = "";
  opciones.forEach(o => {
    if (o === "-"){ m.appendChild(document.createElement("hr")); return; }
    const b = document.createElement("button");
    b.textContent = o.txt;
    if (o.peligro) b.className = "peligro";
    b.onclick = () => { cerrarMenu(); o.fn(); };
    m.appendChild(b);
  });
  m.hidden = false;
  const r = ancla.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  let x = Math.min(r.right - w, window.innerWidth - w - 10);
  x = Math.max(10, x);
  let y = r.bottom + 6;
  if (y + h > window.innerHeight - 10) y = Math.max(10, r.top - h - 6);
  m.style.left = x + "px";
  m.style.top  = y + "px";
}
const cerrarMenu = () => { $("menu").hidden = true; };

document.addEventListener("pointerdown", e => {
  if (document.body.classList.contains("tutorial")) return;    // el tutorial maneja sus propios menús
  if (!$("menu").hidden && !$("menu").contains(e.target)) cerrarMenu();
  if (!$("menuRico").hidden && !$("menuRico").contains(e.target) && !$("btnNotaMenu").contains(e.target)) cerrarMenuRico();
}, true);

/* ============================================================
   LISTA DEL PANEL
   ============================================================ */
function visibles(){
  const tipo = tab === "notas" ? "nota" : "tarea";
  const f = filtro.toLowerCase();
  const lista = docs.filter(d => d.tipo === tipo && (!f ||
    (d.titulo + " " + textoPlano(d.cuerpo) + " " + d.items.map(i => i.texto).join(" ") +
     " " + d.adjuntos.map(a => (a.transcripcion || "") + " " + (a.nombre || "")).join(" ")).toLowerCase().includes(f)));
  if (orden === "az")      lista.sort((a, b) => (a.titulo || "￿").localeCompare(b.titulo || "￿", "es"));
  else if (orden === "viejas") lista.sort((a, b) => a.creada - b.creada);
  else                     lista.sort((a, b) => b.editada - a.editada);
  return lista;
}

function fila(d){
  const li = document.createElement("li");
  li.className = "fila" + (d.id === abierto ? " activa" : "");
  li.dataset.estado = d.estado || "borrador";
  const titulo = document.createElement("span");
  titulo.className = "fila-titulo";
  titulo.textContent = d.titulo || (d.tipo === "nota" ? "Sin título" : "Lista sin título");
  const meta = document.createElement("span");
  meta.className = "fila-meta";
  const cuando = document.createElement("span");
  cuando.textContent = fechaCorta(d.editada);
  const resumen = document.createElement("span");
  if (d.tipo === "nota"){
    const cuenta = tipo => d.adjuntos.filter(a => a.tipo === tipo).length;
    const fotos = cuenta("foto"), audios = cuenta("audio"), archivos = cuenta("archivo");
    const extra = [fotos && `${fotos} foto${fotos > 1 ? "s" : ""}`, audios && `${audios} audio${audios > 1 ? "s" : ""}`,
                   archivos && `${archivos} archivo${archivos > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
    resumen.textContent = textoPlano(d.cuerpo).slice(0, 80) || extra;
  } else {
    const hechas = d.items.filter(i => i.hecho).length;
    resumen.textContent = `${hechas}/${d.items.length} hechas`;
  }
  meta.append(cuando, document.createTextNode("·"), resumen);
  li.append(titulo, meta);
  if (d.tipo === "tarea" && d.items.length){
    const p = document.createElement("div");
    p.className = "progreso";
    p.innerHTML = `<i style="width:${Math.round(d.items.filter(i => i.hecho).length / d.items.length * 100)}%"></i>`;
    li.appendChild(p);
  }
  li.onclick = () => abrir(d.id);
  return li;
}

function pintarLista(){
  const esNotas = tab === "notas";
  const vs = visibles();
  const fijadas = vs.filter(d => d.fijada);
  const resto   = vs.filter(d => !d.fijada);

  $("listaFijadas").replaceChildren(...fijadas.map(fila));
  $("listaTodas").replaceChildren(...resto.map(fila));
  $("vaciaFijadas").hidden = fijadas.length > 0;
  $("vaciaTodas").hidden   = resto.length > 0;
  $("vaciaFijadas").textContent = filtro ? "Sin resultados" : "Nada fijado";
  $("vaciaTodas").textContent   = filtro ? "Sin resultados" : (esNotas ? "Todavía no hay notas" : "Todavía no hay listas");

  // Textos que cambian según la pestaña
  $("sideTitulo").textContent = $("tituloPagina").textContent = $("tituloTodas").textContent = esNotas ? "Notas" : "Tareas";
  $("txtCrear").textContent = $("txtCrearVacio").textContent = esNotas ? "Crear nota" : "Crear lista";
  const hayDelTipo = docs.some(d => d.tipo === (esNotas ? "nota" : "tarea"));
  $("vacioTitulo").textContent = hayDelTipo ? (esNotas ? "Elegí una nota" : "Elegí una lista") : (esNotas ? "Todavía no hay notas" : "Todavía no hay listas");
  $("vacioSub").textContent    = hayDelTipo ? "O empezá una nueva." : (esNotas ? "Escribí ahora. Organizá después." : "Anotá lo que hay que hacer.");

  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle(b.classList.contains("tab") ? "activa" : "activo", b.dataset.tab === tab));
}

function cambiarTab(t){
  if (abierto) volver();
  tab = t;
  pintarLista();
}

/* ============================================================
   EDITOR
   ============================================================ */
function crear(tipo, despues){
  if (abierto) cerrar(true);
  const d = nuevoDoc(tipo);
  docs.push(d);
  guardar();
  tab = tipo === "nota" ? "notas" : "tareas";
  abrir(d.id);
  animo("feliz", 1200);
  if (despues) despues(d);
  else if (tipo === "tarea") $("nuevoItem").focus();
  else if (!esMovil()) $("edTitulo").focus();
}

function abrir(id){
  const d = docs.find(x => x.id === id);
  if (!d) return;
  if (abierto && abierto !== id) limpiarVacio(docAbierto());
  abierto = id;
  salirZen();
  cerrarBusqueda();
  cerrarMenuRico();

  const esNota = d.tipo === "nota";
  $("edVentana").textContent = esNota ? "nota.txt" : "lista.txt";
  $("edTitulo").value = d.titulo;
  $("edTitulo").placeholder = esNota ? "Sin título" : "Nombre de la lista";
  $("edCuerpo").hidden = !esNota;
  $("edTareas").hidden = esNota;
  // En las listas sólo quedan foto, audio y dictado: sin formato ni separadores
  document.querySelectorAll("#toolbar [data-cmd], #toolbar [data-block], #toolbar [data-check], #toolbar .sep")
    .forEach(b => b.hidden = !esNota);
  if (esNota) $("edCuerpo").innerHTML = d.cuerpo;
  else pintarItems();
  pintarCabecera();
  pintarPortada(d);
  pintarFuente(d);
  pintarContador();
  pintarAdjuntos();

  $("vistaVacia").hidden = true;
  $("vistaEditor").hidden = false;
  $("principal").scrollTop = 0;
  document.body.classList.add("editando");
  if (esMovil() && !(history.state && history.state.editor)) history.pushState({ editor:true }, "");
  pintarLista();
}

function cerrar(sinPintar){
  if (!$("presentacion").hidden) cerrarPresentacion();
  limpiarVacio(docAbierto());
  abierto = null;
  salirZen();
  cerrarBusqueda();
  cerrarMenuRico();
  $("vistaEditor").hidden = true;
  $("vistaVacia").hidden = false;
  document.body.classList.remove("editando");
  if (!sinPintar) pintarLista();
}

// En celular el editor ocupa una "página": volver usa el historial (botón atrás de Android incluido)
function volver(){
  if (history.state && history.state.editor) history.back();
  else cerrar();
}
window.addEventListener("popstate", () => {
  if (!$("presentacion").hidden){ cerrarPresentacion(); return; }   // "atrás" con la presentación abierta: sólo la cierra
  if (abierto) cerrar();
});

// Borra notas que quedaron completamente vacías
function limpiarVacio(d){
  if (!d) return;
  const vacio = !d.titulo.trim() && !textoPlano(d.cuerpo) && !d.items.length && !d.adjuntos.length;
  if (vacio){
    docs = docs.filter(x => x.id !== d.id); guardar();
    if (d.portada === "foto") media.del("portada-" + d.id).catch(() => {});
  }
}

function tocar(d){ d.editada = Date.now(); guardar(); pintarCabecera(); pintarLista(); }

function pintarCabecera(){
  const d = docAbierto();
  if (!d) return;
  $("edFecha").textContent = "Editado " + fechaLarga(d.editada);
  $("btnFijar").classList.toggle("activo", d.fijada);
  $("btnFijar").title = d.fijada ? "Desfijar" : "Fijar";
  const est = ESTADOS.find(e => e.id === d.estado) || ESTADOS[0];
  $("edEstado").dataset.estado = est.id;
  $("edEstado").querySelector("span").textContent = est.txt;
}

$("edTitulo").oninput = () => { const d = docAbierto(); if (d){ d.titulo = $("edTitulo").value; tocar(d); } };
$("edTitulo").onkeydown = e => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const d = docAbierto();
  if (d && d.tipo === "nota") $("edCuerpo").focus(); else $("nuevoItem").focus();
};
function sincronizarCuerpo(){
  const d = docAbierto();
  if (!d || d.tipo !== "nota") return;
  d.cuerpo = $("edCuerpo").innerHTML;
  tocar(d);
  pintarContador();
}
$("edCuerpo").oninput = () => { sincronizarCuerpo(); if (!$("buscaNota").hidden) reBuscar(); };

/* ---------- Estado (borrador · en curso · terminada) ---------- */
$("edEstado").onclick = () => {
  const d = docAbierto();
  if (!d) return;
  const i = ESTADOS.findIndex(e => e.id === d.estado);
  d.estado = ESTADOS[(i + 1) % ESTADOS.length].id;
  tocar(d);
  if (d.estado === "lista"){ chispasEn($("edEstado"), 12); animo("feliz"); }
};

/* ---------- Contador de caracteres (límite 35.000) ---------- */
let rafContador = 0;
const caracteres = d => d.tipo === "nota" ? ($("edCuerpo").textContent || "").length : d.items.reduce((s, i) => s + i.texto.length, 0);
function pintarContador(){
  cancelAnimationFrame(rafContador);
  rafContador = requestAnimationFrame(() => {
    const d = docAbierto();
    if (!d) return;
    const n = caracteres(d);
    $("edContador").textContent = `${n.toLocaleString("es-AR")} / ${LIMITE.toLocaleString("es-AR")} caracteres`;
    $("edContador").classList.toggle("pasado", n >= LIMITE);
  });
}
$("edCuerpo").addEventListener("beforeinput", e => {
  if (!e.inputType.startsWith("insert")) return;
  if (($("edCuerpo").textContent || "").length >= LIMITE){
    e.preventDefault();
    avisar(`La nota llegó al máximo de ${LIMITE.toLocaleString("es-AR")} caracteres. Seguí en otra nota.`, "error", 4000);
  }
});

/* ---------- Selección guardada (para que los menús apliquen donde estabas) ---------- */
let rangoGuardado = null, ultimoCampo = "cuerpo";
document.addEventListener("selectionchange", () => {
  const s = getSelection();
  if (s.rangeCount && $("edCuerpo").contains(s.anchorNode)) rangoGuardado = s.getRangeAt(0).cloneRange();
});
$("edTitulo").addEventListener("focus", () => ultimoCampo = "titulo");
$("edCuerpo").addEventListener("focus", () => ultimoCampo = "cuerpo");
function restaurarSeleccion(){
  const c = $("edCuerpo");
  c.focus({ preventScroll:true });
  const s = getSelection();
  s.removeAllRanges();
  if (rangoGuardado && c.contains(rangoGuardado.startContainer)) s.addRange(rangoGuardado);
  else { const r = document.createRange(); r.selectNodeContents(c); r.collapse(false); s.addRange(r); }
}
function insertarHTML(html){
  restaurarSeleccion();
  document.execCommand("insertHTML", false, html);
  sincronizarCuerpo();
}

/* ---------- Barra de formato ---------- */
document.querySelectorAll("#toolbar button").forEach(b => b.addEventListener("mousedown", e => e.preventDefault()));
document.querySelectorAll("#toolbar [data-cmd]").forEach(b => b.onclick = () => {
  document.execCommand(b.dataset.cmd, false, null);
  sincronizarCuerpo();
});
document.querySelectorAll("#toolbar [data-block]").forEach(b => b.onclick = () => {
  const actual = (document.queryCommandValue("formatBlock") || "").toUpperCase();
  document.execCommand("formatBlock", false, actual === b.dataset.block ? "P" : b.dataset.block);
  sincronizarCuerpo();
});

/* ---------- Casillas dentro de las notas ---------- */
function ulDeSeleccion(){
  const s = getSelection();
  if (!s.rangeCount) return null;
  const n = s.anchorNode;
  const el = n && (n.nodeType === 1 ? n : n.parentElement);
  const ul = el && el.closest("ul");
  return ul && $("edCuerpo").contains(ul) ? ul : null;
}
document.querySelector("#toolbar [data-check]").onclick = () => {
  restaurarSeleccion();
  let ul = ulDeSeleccion();
  if (ul && ul.classList.contains("lista-check")) ul.classList.remove("lista-check");
  else {
    if (!ul){ document.execCommand("insertUnorderedList"); ul = ulDeSeleccion(); }
    ul?.classList.add("lista-check");
  }
  sincronizarCuerpo();
};
$("edCuerpo").addEventListener("click", e => {
  const li = e.target.closest(".lista-check > li");
  if (!li) return;
  const r = li.getBoundingClientRect();
  if (e.clientX - r.left > 30) return;          // sólo si tocaste la casilla
  e.preventDefault();
  li.classList.toggle("hecho");
  if (li.classList.contains("hecho")) chispas(r.left + 12, r.top + 13, 8);
  sincronizarCuerpo();
});

/* ---------- Tareas ---------- */
function pintarItems(enfocar){
  const d = docAbierto();
  if (!d) return;
  const zen = document.body.classList.contains("zen");
  $("items").replaceChildren(...d.items.map((it, i) => {
    const li = document.createElement("li");
    li.className = "item" + (it.hecho ? " hecho" : "");
    li.innerHTML = `<button class="check" aria-label="Marcar">${ICONO_CHECK}</button>
      <input class="item-txt" type="text"><button class="item-borrar" aria-label="Borrar">${ICONO_X}</button>`;
    const inp = li.querySelector(".item-txt");
    inp.value = it.texto;
    inp.readOnly = zen;
    li.querySelector(".check").onclick = e => {
      it.hecho = !it.hecho;
      if (it.hecho){ chispasEn(e.currentTarget, 9); if (d.items.every(x => x.hecho)) animo("feliz"); }
      tocar(d); pintarItems(); pintarContador();
    };
    li.querySelector(".item-borrar").onclick = () => { d.items.splice(i, 1); tocar(d); pintarItems(); pintarContador(); };
    inp.oninput = () => { it.texto = inp.value; tocar(d); pintarContador(); };
    inp.onkeydown = e => {
      if (e.key === "Enter"){ e.preventDefault(); $("nuevoItem").focus(); }
      if (e.key === "Backspace" && !inp.value){ e.preventDefault(); d.items.splice(i, 1); tocar(d); pintarItems(i - 1); }
    };
    return li;
  }));
  if (enfocar >= 0) $("items").children[enfocar]?.querySelector("input").focus();
}

function agregarItems(textos){
  const d = docAbierto();
  if (!d) return;
  textos.map(t => t.trim()).filter(Boolean).forEach(t => d.items.push({ id:nuevoId(), texto:t, hecho:false }));
  tocar(d);
  pintarItems();
  pintarContador();
}
const partirEnTareas = texto => texto.split(/[,;\n]| y luego | después | y /i);

$("formItem").onsubmit = e => {
  e.preventDefault();
  agregarItems([$("nuevoItem").value]);
  $("nuevoItem").value = "";
};

/* ---------- Fijar / zen ---------- */
function alternarFijada(d = docAbierto()){
  if (!d) return;
  d.fijada = !d.fijada;
  guardar(); pintarCabecera(); pintarLista();
  avisar(d.fijada ? "Fijada arriba" : "Desfijada");
}
$("btnFijar").onclick = () => alternarFijada();

function alternarZen(){
  const on = document.body.classList.toggle("zen");
  $("btnZen").classList.toggle("activo", on);
  $("btnZen").title = on ? "Salir del modo lectura" : "Modo lectura";
  $("edCuerpo").contentEditable = on ? "false" : "true";
  $("edTitulo").readOnly = on;
  document.querySelectorAll(".item-txt").forEach(i => i.readOnly = on);
}
function salirZen(){ if (document.body.classList.contains("zen")) alternarZen(); }
$("btnZen").onclick = alternarZen;

function duplicar(d){
  const copia = nuevoDoc(d.tipo, {
    titulo: (d.titulo || "Sin título") + " (copia)", cuerpo:d.cuerpo, fijada:false,
    estado:d.estado, fuente:d.fuente, portada: d.portada === "foto" ? "" : d.portada,
    items: d.items.map(i => ({ ...i, id:nuevoId() })),
  });
  docs.push(copia); guardar(); abrir(copia.id);
  avisar("Duplicada (sin fotos, audios ni archivos)");
}

async function eliminar(d){
  if (!confirm(`¿Eliminar "${d.titulo || "Sin título"}"?`)) return;
  docs = docs.filter(x => x.id !== d.id);
  guardar();
  d.adjuntos.forEach(a => media.del(a.id).catch(() => {}));
  if (d.portada === "foto") media.del("portada-" + d.id).catch(() => {});
  volver();
  avisar("Eliminada");
}

/* ============================================================
   FONDO DE LA NOTA (portada) Y FUENTE
   ============================================================ */
let urlPortada = null;
async function pintarPortada(d){
  const el = $("edPortada");
  if (urlPortada){ URL.revokeObjectURL(urlPortada); urlPortada = null; }
  el.className = "ed-portada";
  el.style.backgroundImage = "";
  el.hidden = !d.portada;
  if (!d.portada) return;
  if (d.portada === "foto"){
    try{
      const blob = await media.get("portada-" + d.id);
      if (!blob || abierto !== d.id){ el.hidden = true; return; }
      urlPortada = URL.createObjectURL(blob);
      el.style.backgroundImage = `url("${urlPortada}")`;
      el.classList.add("portada-foto");
    }catch{ el.hidden = true; }
  } else el.classList.add("portada-" + d.portada);
}
async function ponerPortada(id){
  const d = docAbierto();
  if (!d) return;
  if (d.portada === "foto" && id !== "foto") media.del("portada-" + d.id).catch(() => {});
  d.portada = id;
  tocar(d);
  pintarPortada(d);
}
$("inpPortada").onchange = async e => {
  const archivo = e.target.files[0];
  e.target.value = "";
  const d = docAbierto();
  if (!archivo || !d) return;
  try{ await media.put("portada-" + d.id, await comprimir(archivo)); }
  catch{ avisar("No hay espacio para guardar la foto", "error"); return; }
  ponerPortada("foto");
  avisar("Fondo puesto", "ok");
};

function pintarFuente(d){
  const hoja = $("edHoja");
  FUENTES.forEach(f => f.id && hoja.classList.remove("fuente-" + f.id));
  if (d.fuente) hoja.classList.add("fuente-" + d.fuente);
}

/* ============================================================
   EXPORTAR
   ============================================================ */
// Copia del cuerpo donde las casillas pasan a ☐ / ☑ (para Word, PDF, texto…)
function cuerpoExportable(d){
  const raiz = document.createElement("div");
  if (d.tipo === "nota") raiz.innerHTML = d.cuerpo || "";
  else raiz.innerHTML = `<ul class="lista-check">${d.items.map(i => `<li class="${i.hecho ? "hecho" : ""}">${escapar(i.texto)}</li>`).join("")}</ul>`;
  raiz.querySelectorAll(".lista-check > li").forEach(li => li.prepend(li.classList.contains("hecho") ? "☑ " : "☐ "));
  return raiz;
}

function htmlAMarkdown(raiz){
  const rec = n => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1) return "";
    const hijos = () => [...n.childNodes].map(rec).join("");
    switch (n.tagName){
      case "B": case "STRONG": return `**${hijos()}**`;
      case "I": case "EM":     return `_${hijos()}_`;
      case "S": case "STRIKE": case "DEL": return `~~${hijos()}~~`;
      case "BR": return "\n";
      case "HR": return "\n---\n";
      case "H1": case "H2": case "H3": return `\n## ${hijos()}\n`;
      case "BLOCKQUOTE": return "\n" + hijos().split("\n").map(l => "> " + l).join("\n") + "\n";
      case "UL":
        if (n.classList.contains("lista-check"))
          return "\n" + [...n.children].map(li => `- [${li.classList.contains("hecho") ? "x" : " "}] ` + rec(li).replace(/^[☐☑] /, "").trim()).join("\n") + "\n";
        return "\n" + [...n.children].map(li => "- " + rec(li).trim()).join("\n") + "\n";
      case "OL": return "\n" + [...n.children].map((li, i) => `${i + 1}. ` + rec(li).trim()).join("\n") + "\n";
      case "TABLE": {
        const filas = [...n.querySelectorAll("tr")].map(tr => [...tr.children].map(td => rec(td).replace(/\n/g, " ").trim() || " "));
        if (!filas.length) return "";
        const linea = f => "| " + f.join(" | ") + " |";
        return "\n" + [linea(filas[0]), linea(filas[0].map(() => "---")), ...filas.slice(1).map(linea)].join("\n") + "\n";
      }
      case "A":  return `[${hijos()}](${n.getAttribute("href")})`;
      case "DIV": case "P": return "\n" + hijos();
      default:   return hijos();
    }
  };
  return rec(raiz).replace(/\n{3,}/g, "\n\n").trim();
}

const ESTILO_EXPORTAR = `
  body{ font-family: Archivo, Arial, sans-serif; color:#111; max-width:760px; margin:40px auto; padding:0 20px; line-height:1.6; }
  h1{ font-family:"Archivo Black", Arial Black, sans-serif; font-style:italic; font-size:34px; margin:0 0 6px; }
  .meta{ color:#6C6585; font-size:13px; margin-bottom:24px; }
  h2{ font-size:22px; margin:22px 0 6px; }
  blockquote{ border-left:5px solid #F49AD6; background:#FBF7FF; margin:12px 0; padding:8px 14px; font-style:italic; }
  ul.lista-check{ list-style:none; padding-left:0; }
  li.hecho{ text-decoration:line-through; color:#6C6585; }
  table{ border-collapse:collapse; margin:10px 0; }
  td{ border:2px solid #111; padding:6px 10px; min-width:60px; }
  tr:first-child td{ background:#F9D3EE; font-weight:700; }
  .fx-brillo{ color:#D63F9B; text-shadow:0 0 8px #F49AD6; }
  .fx-arcoiris{ color:#7B45C6; font-weight:700; }
  footer{ margin-top:40px; font-size:12px; color:#9A94AE; }`;
function htmlDeDoc(d){
  const titulo = escapar(d.titulo || "Sin título");
  const est = (ESTADOS.find(e => e.id === d.estado) || ESTADOS[0]).txt;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>${ESTILO_EXPORTAR}</style></head>
<body><h1>${titulo}</h1><p class="meta">${est} · ${escapar(fechaLarga(d.editada))}</p>${cuerpoExportable(d).innerHTML}
<footer>Hecho con Kynus ✦ tu estrella guía para el día a día</footer></body></html>`;
}
function textoDeDoc(d){
  const md = htmlAMarkdown(cuerpoExportable(d));
  const transcripciones = d.adjuntos.filter(a => a.transcripcion).map(a => "- " + a.transcripcion);
  return md + (transcripciones.length ? "\n\n## Audios\n\n" + transcripciones.join("\n") : "");
}

function exportarDoc(d, formato){
  const titulo = d.titulo || "Sin título";
  const base = nombreArchivo(titulo);
  if (formato === "md")  return descargar(`${base}.md`, `# ${titulo}\n\n${textoDeDoc(d)}\n`, "text/markdown");
  if (formato === "txt"){
    const txt = textoDeDoc(d).replace(/\*\*|~~|(^|\s)_|_(\s|$)/g, "$1$2").replace(/^## /gm, "").replace(/^- \[x\] /gm, "☑ ").replace(/^- \[ \] /gm, "☐ ");
    return descargar(`${base}.txt`, `${titulo}\n\n${txt}\n`, "text/plain");
  }
  if (formato === "html") return descargar(`${base}.html`, htmlDeDoc(d), "text/html");
  if (formato === "doc")  return descargar(`${base}.doc`, "﻿" + htmlDeDoc(d), "application/msword");
  if (formato === "pdf"){
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    f.srcdoc = htmlDeDoc(d);
    f.onload = () => {
      try{ f.contentWindow.focus(); f.contentWindow.print(); }
      catch{ avisar("No se pudo abrir la impresión", "error"); }
      setTimeout(() => f.remove(), 60000);
    };
    document.body.appendChild(f);
    avisar('Elegí "Guardar como PDF" en la ventana de impresión', "", 4500);
  }
}
async function copiarTexto(d){
  const texto = `${d.titulo || "Sin título"}\n\n${textoDeDoc(d)}`;
  try{ await navigator.clipboard.writeText(texto); avisar("Texto copiado", "ok"); }
  catch{ avisar("No se pudo copiar", "error"); }
}

function exportarTodo(){
  const datos = { app:"llavero", version:1, exportado:new Date().toISOString(), docs };
  descargar(`kynus-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(datos, null, 2), "application/json");
  avisar("Copia descargada (las fotos, audios y archivos quedan en este dispositivo)", "", 4000);
}

$("inpImportar").onchange = async e => {
  const archivo = e.target.files[0];
  e.target.value = "";
  if (!archivo) return;
  try{
    const datos = JSON.parse(await archivo.text());
    const entrantes = (datos.docs || []).filter(d => d && d.id && (d.tipo === "nota" || d.tipo === "tarea"));
    let nuevos = 0;
    entrantes.forEach(d => {
      const limpio = nuevoDoc(d.tipo, { ...d, adjuntos:[], portada: d.portada === "foto" ? "" : (d.portada || "") });
      const i = docs.findIndex(x => x.id === d.id);
      if (i >= 0){ if (limpio.editada > docs[i].editada) docs[i] = { ...limpio, adjuntos:docs[i].adjuntos }; }
      else { docs.push(limpio); nuevos++; }
    });
    guardar(); pintarLista();
    avisar(`Importado: ${nuevos} nuevas, ${entrantes.length - nuevos} actualizadas`, "ok");
  }catch{ avisar("Ese archivo no es una copia válida", "error"); }
};

/* ============================================================
   ADJUNTOS: FOTOS, AUDIOS Y ARCHIVOS
   ============================================================ */
let urlsVivas = [];
const vivo = blob => { const u = URL.createObjectURL(blob); urlsVivas.push(u); return u; };

async function pintarAdjuntos(){
  const d = docAbierto();
  const cont = $("adjuntos");
  urlsVivas.forEach(u => URL.revokeObjectURL(u));
  urlsVivas = [];
  cont.innerHTML = "";
  if (!d || !d.adjuntos.length) return;
  const idDoc = d.id;

  const fotos = d.adjuntos.filter(a => a.tipo === "foto");
  const audios = d.adjuntos.filter(a => a.tipo === "audio");
  const archivos = d.adjuntos.filter(a => a.tipo === "archivo");

  if (fotos.length){
    const grilla = document.createElement("div");
    grilla.className = "fotos";
    for (const a of fotos){
      const caja = document.createElement("div");
      caja.className = "foto";
      caja.innerHTML = `<img alt=""><button class="quitar" aria-label="Quitar foto">${ICONO_X}</button>`;
      caja.querySelector(".quitar").onclick = () => quitarAdjunto(a);
      grilla.appendChild(caja);
      media.get(a.id).then(blob => {
        if (!blob || abierto !== idDoc) return;
        const url = vivo(blob);
        const img = caja.querySelector("img");
        img.src = url;
        img.onclick = () => verFoto(url);
      }).catch(() => {});
    }
    cont.appendChild(grilla);
  }

  for (const a of archivos){
    const ext = (a.nombre || "").split(".").pop().toLowerCase();
    const esTexto = ["txt", "md"].includes(ext) || (a.mime || "").startsWith("text/");
    const caja = document.createElement("div");
    caja.className = "caja archivo";
    caja.innerHTML = `
      <span class="archivo-tipo" data-ext="${escapar(ext)}">${escapar(ext.slice(0, 4).toUpperCase() || "ARCH")}</span>
      <div class="archivo-info"><b></b><small>${tamanio(a.tam || 0)}</small></div>
      <div class="archivo-acciones">
        ${esTexto ? '<button class="chip" data-a="texto">Pasar al texto</button>' : ""}
        <button class="chip" data-a="abrir">Abrir</button>
        <button class="chip" data-a="bajar">Descargar</button>
      </div>
      <button class="quitar" aria-label="Quitar archivo">${ICONO_X}</button>`;
    caja.querySelector("b").textContent = a.nombre || "archivo";
    caja.querySelector(".quitar").onclick = () => quitarAdjunto(a);
    caja.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
      const blob = await media.get(a.id).catch(() => null);
      if (!blob){ avisar("No se encontró el archivo en este dispositivo", "error"); return; }
      if (b.dataset.a === "bajar") descargar(a.nombre || "archivo", blob);
      else if (b.dataset.a === "abrir"){ const u = vivo(blob); if (!window.open(u, "_blank")) descargar(a.nombre || "archivo", blob); }
      else {
        const texto = await blob.text();
        insertarHTML(texto.split(/\n{2,}/).map(par => `<p>${escapar(par).replace(/\n/g, "<br>")}</p>`).join(""));
        avisar("Texto agregado a la nota", "ok");
      }
    });
    cont.appendChild(caja);
  }

  for (const a of audios){
    const caja = document.createElement("div");
    caja.className = "caja audio";
    caja.innerHTML = `
      <div class="audio-fila"><audio controls preload="metadata"></audio>
        <button class="quitar" aria-label="Quitar audio">${ICONO_X}</button></div>
      <div class="audio-acciones"></div>`;
    caja.querySelector(".quitar").onclick = () => quitarAdjunto(a);
    const acciones = caja.querySelector(".audio-acciones");

    if (a.transcripcion){
      const t = document.createElement("p");
      t.className = "transcripcion";
      t.textContent = a.transcripcion;
      caja.appendChild(t);
      const ins = document.createElement("button");
      ins.className = "chip";
      ins.textContent = d.tipo === "nota" ? "Pasar al texto" : "Agregar como tareas";
      ins.onclick = () => d.tipo === "nota" ? insertarEnNota(a.transcripcion) : agregarItems(partirEnTareas(a.transcripcion));
      acciones.appendChild(ins);
    } else {
      const tr = document.createElement("button");
      tr.className = "chip";
      tr.textContent = "Transcribir";
      tr.onclick = async () => {
        tr.disabled = true; tr.textContent = "Transcribiendo…";
        try{
          const blob = await media.get(a.id);
          a.transcripcion = await transcribir(blob) || "(No se entendió el audio)";
          tocar(d);
          if (abierto === idDoc) pintarAdjuntos();
        }catch{
          tr.disabled = false; tr.textContent = "Transcribir";
          avisar("No se pudo transcribir", "error");
        }
      };
      acciones.appendChild(tr);
    }
    cont.appendChild(caja);
    media.get(a.id).then(blob => {
      if (!blob || abierto !== idDoc) return;
      caja.querySelector("audio").src = vivo(blob);
    }).catch(() => {});
  }
}

function verFoto(url){
  const v = document.createElement("div");
  v.className = "visor";
  v.innerHTML = `<img alt="">`;
  v.querySelector("img").src = url;
  v.onclick = () => v.remove();
  document.body.appendChild(v);
}

async function quitarAdjunto(a){
  const d = docAbierto();
  const que = { foto:"esta foto", audio:"este audio", archivo:"este archivo" }[a.tipo] || "esto";
  if (!d || !confirm(`¿Quitar ${que}?`)) return;
  d.adjuntos = d.adjuntos.filter(x => x.id !== a.id);
  tocar(d);
  media.del(a.id).catch(() => {});
  pintarAdjuntos();
}

async function agregarAdjunto(tipo, blob, extra = {}){
  const d = docAbierto();
  if (!d) return false;
  const id = nuevoId();
  try{ await media.put(id, blob); }
  catch{ avisar("No hay espacio para guardar el archivo", "error"); return false; }
  d.adjuntos.push({ id, tipo, creada:Date.now(), ...extra });
  tocar(d);
  pintarAdjuntos();
  return true;
}

// Achica la foto para no llenar el almacenamiento del celular
async function comprimir(archivo){
  try{
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return await new Promise(ok => c.toBlob(b => ok(b || archivo), "image/jpeg", 0.85));
  }catch{ return archivo; }
}

$("tbFoto").onclick = () => $("inpFoto").click();
$("inpFoto").onchange = async e => {
  const archivo = e.target.files[0];
  e.target.value = "";
  if (!archivo) return;
  avisar("Guardando foto…", "", 0);
  if (await agregarAdjunto("foto", await comprimir(archivo))) avisar("Foto agregada", "ok");
};

$("inpArchivo").onchange = async e => {
  const archivo = e.target.files[0];
  e.target.value = "";
  if (!archivo) return;
  if (archivo.size > 20 * 1024 * 1024){ avisar("El archivo es muy grande (máximo 20 MB)", "error"); return; }
  avisar("Guardando archivo…", "", 0);
  if (await agregarAdjunto("archivo", archivo, { nombre:archivo.name, mime:archivo.type, tam:archivo.size })) avisar("Archivo adjuntado", "ok");
};

/* ============================================================
   GRABACIÓN (una sola a la vez)
   ============================================================ */
let grabadora = null;
let botonGrabando = null;

function tipoAudio(){
  if (!window.MediaRecorder) return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"])
    if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}
const extension = mime => mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";

async function grabar(boton, alTerminar){
  if (grabadora){
    const mismo = botonGrabando === boton;
    grabadora.stop();
    if (mismo) return;
  }
  if (!navigator.mediaDevices || !window.MediaRecorder){
    avisar("Este navegador no puede grabar audio", "error"); return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const mime = tipoAudio();
    const rec = mime ? new MediaRecorder(stream, { mimeType:mime }) : new MediaRecorder(stream);
    const trozos = [];
    rec.ondataavailable = e => e.data.size && trozos.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      boton.classList.remove("grabando");
      grabadora = botonGrabando = null;
      const blob = new Blob(trozos, { type:rec.mimeType || mime || "audio/webm" });
      if (blob.size) alTerminar(blob);
    };
    rec.start();
    grabadora = rec;
    botonGrabando = boton;
    boton.classList.add("grabando");
    avisar("Grabando… tocá de nuevo para terminar", "", 0);
  }catch{
    avisar("No se pudo usar el micrófono. Revisá los permisos.", "error", 4000);
  }
}

async function transcribir(blob){
  const fd = new FormData();
  fd.append("audio", blob, "audio." + extension(blob.type));
  const res = await fetch(`${BACKEND}/transcribir`, { method:"POST", body:fd });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Falló la transcripción");
  return (data.texto || "").trim();
}

function insertarEnNota(texto){
  const d = docAbierto();
  if (!d) return;
  const p = document.createElement("p");
  p.textContent = texto;
  $("edCuerpo").appendChild(p);
  sincronizarCuerpo();
}

/* ---------- Audio adjunto ---------- */
$("tbAudio").onclick = () => grabar($("tbAudio"), async blob => {
  if (await agregarAdjunto("audio", blob)) avisar("Audio guardado", "ok");
});

/* ---------- Dictado: voz → texto ---------- */
function dictar(boton){
  grabar(boton, async blob => {
    avisar("Transcribiendo…", "", 0);
    try{
      const texto = await transcribir(blob);
      if (!texto){ avisar("No se entendió el audio", "error"); return; }
      const d = docAbierto();
      if (d && d.tipo === "tarea") agregarItems(partirEnTareas(texto));
      else insertarEnNota(texto);
      avisar("Texto agregado", "ok");
    }catch{ avisar("No se pudo transcribir", "error"); }
  });
}
$("tbDictar").onclick = () => dictar($("tbDictar"));

/* ---------- Botón central: grabar y agendar en Google Calendar ---------- */
$("btnGrabar").onclick = () => grabar($("btnGrabar"), async blob => {
  const btn = $("btnGrabar");
  btn.classList.add("ocupado");
  avisar("Agendando en el calendario…", "", 0);
  const fd = new FormData();
  fd.append("audio", blob, "audio." + extension(blob.type));
  try{
    const res  = await fetch(`${BACKEND}/audio`, { method:"POST", body:fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);
    const cuando = data.fecha ? ` · ${new Date(data.fecha + "T12:00").toLocaleDateString("es-AR", { weekday:"short", day:"numeric", month:"short" })} ${data.hora || ""}` : "";
    avisar(`Agendado: ${data.evento}${cuando}`, "ok", 4500);
    animo("feliz", 2000);
  }catch(e){
    avisar(e && e.message ? e.message : "No se pudo agendar. Probá de nuevo.", "error", 4000);
  }finally{
    btn.classList.remove("ocupado");
  }
});
// El mismo botón, dentro de la barra de la nota (copia el estado del original)
$("bnGrabar").onclick = () => $("btnGrabar").click();
const espejo = new MutationObserver(() => {
  ["grabando", "ocupado"].forEach(c => $("bnGrabar").classList.toggle(c, $("btnGrabar").classList.contains(c)));
  const escuchando = ["btnGrabar", "tbAudio", "tbDictar"].some(id => $(id).classList.contains("grabando"));
  ojitos.forEach(o => o.classList.toggle("escuchando", escuchando));
});
["btnGrabar", "tbAudio", "tbDictar"].forEach(id => espejo.observe($(id), { attributes:true, attributeFilter:["class"] }));

/* ============================================================
   SINCRONIZAR CON EL LLAVERO (BLE)
   ============================================================ */
async function sincronizar(){
  if (!navigator.bluetooth){
    avisar("Este navegador no soporta Bluetooth. Usá Chrome en Android o PC (en iPhone no se puede).", "error", 4500);
    return;
  }
  const btn = $("btnSync");
  btn.classList.remove("listo");
  btn.classList.add("ocupado");
  try{
    avisar("Buscando el llavero…", "", 0);
    const device = await navigator.bluetooth.requestDevice({
      filters:[{ namePrefix:"Kynus" }, { namePrefix:"Llavero" }],
      optionalServices:[SERVICE_UUID]
    });
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const car     = await service.getCharacteristic(CHAR_UUID);

    avisar("Buscando los eventos de hoy…", "", 0);
    const res  = await fetch(`${BACKEND}/eventos`);
    const data = await res.json();
    const evs  = data.eventos || [];
    const mensaje = evs.length ? evs.map(e => `${e.hora} ${e.titulo}`).join("|") + "|" : "Sin eventos hoy";

    const bytes = new TextEncoder().encode(mensaje);
    for (let i = 0; i < bytes.length; i += 20){
      await car.writeValue(bytes.slice(i, i + 20));
      await new Promise(r => setTimeout(r, 50));
    }
    avisar(evs.length ? `Llavero al día · ${evs.length} evento(s)` : "Llavero al día · sin eventos hoy", "ok");
    btn.classList.add("listo");
    chispasEn(btn, 10);
    animo("feliz", 2000);
    setTimeout(() => btn.classList.remove("listo"), 3000);
  }catch(e){
    if (e.name === "NotFoundError") $("aviso").className = "aviso";   // cerró el selector sin elegir
    else avisar("No se pudo sincronizar. ¿Está prendido el llavero y cerca?", "error", 4000);
  }finally{
    btn.classList.remove("ocupado");
  }
}
$("btnSync").onclick = sincronizar;

/* ============================================================
   BARRA DE LA NOTA: deshacer, rehacer, QR, buscar, menú, herramientas
   ============================================================ */
document.querySelectorAll("#barraNota button").forEach(b => b.addEventListener("mousedown", e => e.preventDefault()));

function deshacer(rehacer){
  const d = docAbierto();
  if (!d) return;
  if (ultimoCampo === "titulo") $("edTitulo").focus();
  else if (d.tipo === "nota") restaurarSeleccion();
  else { avisar("En las listas podés borrar o desmarcar a mano"); return; }
  document.execCommand(rehacer ? "redo" : "undo");
  if (ultimoCampo === "titulo"){ d.titulo = $("edTitulo").value; tocar(d); }
  else sincronizarCuerpo();
}
$("bnDeshacer").onclick = () => deshacer(false);
$("bnRehacer").onclick = () => deshacer(true);

function aplicarHerramientas(ocultas){
  document.body.classList.toggle("sin-herramientas", ocultas);
  $("bnHerramientas").title = ocultas ? "Mostrar las herramientas" : "Ocultar las herramientas";
}
$("bnHerramientas").onclick = () => {
  const ocultas = !document.body.classList.contains("sin-herramientas");
  aplicarHerramientas(ocultas);
  escribir("llavero_herramientas", ocultas ? "ocultas" : "");
};

/* ---------- Buscar dentro de la nota ---------- */
const hayResaltado = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
let busqueda = { rangos:[], actual:-1 };
function abrirBusqueda(){
  if (!abierto) return;
  $("buscaNota").hidden = false;
  document.body.classList.add("buscando");
  $("inpBuscaNota").focus();
  $("inpBuscaNota").select();
  if ($("inpBuscaNota").value) buscarEnNota($("inpBuscaNota").value);
}
function cerrarBusqueda(){
  $("buscaNota").hidden = true;
  document.body.classList.remove("buscando");
  limpiarBusqueda();
}
function limpiarBusqueda(){
  busqueda = { rangos:[], actual:-1 };
  if (hayResaltado){ CSS.highlights.delete("kynus-busqueda"); CSS.highlights.delete("kynus-actual"); }
  document.querySelectorAll(".item.coincide, .item.actual").forEach(li => li.classList.remove("coincide", "actual"));
  $("buscaCuenta").textContent = "0/0";
}
function buscarEnNota(q){
  limpiarBusqueda();
  const d = docAbierto();
  q = q.trim().toLowerCase();
  if (!d || !q) return;
  if (d.tipo === "nota"){
    const w = document.createTreeWalker($("edCuerpo"), NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())){
      const t = n.textContent.toLowerCase();
      for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + q.length)){
        const r = new Range(); r.setStart(n, i); r.setEnd(n, i + q.length);
        busqueda.rangos.push(r);
      }
    }
    if (hayResaltado && busqueda.rangos.length) CSS.highlights.set("kynus-busqueda", new Highlight(...busqueda.rangos));
  } else {
    [...$("items").children].forEach(li => {
      if (li.querySelector(".item-txt").value.toLowerCase().includes(q)){ li.classList.add("coincide"); busqueda.rangos.push(li); }
    });
  }
  irACoincidencia(0);
}
let timerReBuscar;
const reBuscar = () => { clearTimeout(timerReBuscar); timerReBuscar = setTimeout(() => buscarEnNota($("inpBuscaNota").value), 250); };
function irACoincidencia(i){
  const n = busqueda.rangos.length;
  if (!n){ $("buscaCuenta").textContent = "0/0"; return; }
  busqueda.actual = (i + n) % n;
  const r = busqueda.rangos[busqueda.actual];
  if (r instanceof Range){
    if (hayResaltado) CSS.highlights.set("kynus-actual", new Highlight(r));
    r.startContainer.parentElement?.scrollIntoView({ block:"center", behavior: sinMovimiento ? "auto" : "smooth" });
  } else {
    document.querySelectorAll(".item.actual").forEach(li => li.classList.remove("actual"));
    r.classList.add("actual");
    r.scrollIntoView({ block:"center", behavior: sinMovimiento ? "auto" : "smooth" });
  }
  $("buscaCuenta").textContent = `${busqueda.actual + 1}/${n}`;
}
$("bnBuscar").onclick = () => $("buscaNota").hidden ? abrirBusqueda() : cerrarBusqueda();
$("inpBuscaNota").oninput = e => buscarEnNota(e.target.value);
$("inpBuscaNota").onkeydown = e => {
  if (e.key === "Enter"){ e.preventDefault(); irACoincidencia(busqueda.actual + (e.shiftKey ? -1 : 1)); }
  if (e.key === "Escape"){ e.preventDefault(); cerrarBusqueda(); }
};
$("buscaSiguiente").onclick = () => irACoincidencia(busqueda.actual + 1);
$("buscaAnterior").onclick = () => irACoincidencia(busqueda.actual - 1);
$("buscaCerrar").onclick = cerrarBusqueda;

/* ---------- QR: llevarte la nota a otro celular ---------- */
let cargaQR = null;
function cargarQR(){
  return cargaQR || (cargaQR = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
    s.onload = () => window.qrcode ? ok(window.qrcode) : mal();
    s.onerror = () => { cargaQR = null; mal(); };
    document.head.appendChild(s);
  }));
}
function abrirModal(titulo, html){
  $("modalTitulo").textContent = titulo;
  $("modalCuerpo").innerHTML = html;
  $("modal").hidden = false;
}
const cerrarModal = () => { $("modal").hidden = true; };
$("modalCerrar").onclick = cerrarModal;
$("modal").onclick = e => { if (e.target === $("modal")) cerrarModal(); };

async function mostrarQR(){
  const d = docAbierto();
  if (!d) return;
  let texto = `${d.titulo || "Sin título"}\n\n${textoDeDoc(d)}`.trim();
  if (!textoDeDoc(d).trim() && !d.titulo.trim()){ avisar("La nota está vacía"); return; }
  const codificar = new TextEncoder();
  let cortado = false;
  while (codificar.encode(texto).length > 1500){ texto = texto.slice(0, Math.floor(texto.length * 0.9)); cortado = true; }
  if (cortado) texto += "…";
  abrirModal("compartir.exe", '<p class="modal-cargando">Armando el código…</p>');
  try{
    const qrcode = await cargarQR();
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    const qr = qrcode(0, "L");
    qr.addData(texto, "Byte");
    qr.make();
    $("modalCuerpo").innerHTML = `
      <div class="qr">${qr.createSvgTag({ cellSize:4, margin:2, scalable:true })}</div>
      <p>Escaneá el código con la cámara de otro celular para llevarte el texto de la nota.</p>
      ${cortado ? '<p class="modal-nota">La nota es larga: el código tiene sólo el principio. Para la nota completa usá Exportar.</p>' : ""}
      <div class="modal-botones"><button class="btn-sec ancho" id="qrCopiar">Copiar texto</button><button class="btn-sec" id="qrBajar">Guardar imagen</button></div>`;
    $("qrCopiar").onclick = () => copiarTexto(d);
    $("qrBajar").onclick = () => {
      const a = Object.assign(document.createElement("a"), { href: qr.createDataURL(8, 16), download: `${nombreArchivo(d.titulo)}-qr.gif` });
      document.body.appendChild(a); a.click(); a.remove();
    };
  }catch{
    $("modalCuerpo").innerHTML = '<p>No se pudo armar el código. Revisá la conexión a internet y probá de nuevo.</p>';
  }
}
$("bnQR").onclick = mostrarQR;

/* ============================================================
   MENÚ GRANDE DE LA NOTA (con submenús)
   ============================================================ */
const menuRico = { pila:[] };
function abrirMenuRico(vista){
  menuRico.pila = [vista];
  pintarMenuRico();
  $("menuRico").hidden = false;
  $("btnNotaMenu").classList.add("activo");
  posicionarMenuRico();
}
// En la compu queda pegado arriba del botón "···"; en el celular es una hoja que sube desde abajo (CSS)
function posicionarMenuRico(){
  const m = $("menuRico");
  if (esMovil()){ m.style.left = m.style.bottom = ""; return; }
  const r = $("btnNotaMenu").getBoundingClientRect();
  const w = m.offsetWidth;
  if (!r.width){ m.style.left = Math.max(16, (innerWidth - w) / 2) + "px"; m.style.bottom = "100px"; return; }
  m.style.left = Math.max(16, Math.min(r.right + 10 - w, innerWidth - w - 16)) + "px";
  m.style.bottom = (innerHeight - r.top + 14) + "px";
}
function cerrarMenuRico(){
  $("menuRico").hidden = true;
  $("btnNotaMenu").classList.remove("activo");
}
function irAVista(vista){ menuRico.pila.push(vista); pintarMenuRico(); }
function pintarMenuRico(){
  const v = menuRico.pila[menuRico.pila.length - 1];
  const m = $("menuRico");
  m.innerHTML = "";
  if (v.titulo){
    const cab = document.createElement("div");
    cab.className = "mr-cabeza";
    cab.innerHTML = (menuRico.pila.length > 1 ? `<button class="mr-atras" aria-label="Volver">${ICONOS.atras}</button>` : "") + `<div><b></b><small></small></div>`;
    cab.querySelector("b").textContent = v.titulo;
    cab.querySelector("small").textContent = v.sub || "";
    const atras = cab.querySelector(".mr-atras");
    if (atras){ atras.addEventListener("mousedown", e => e.preventDefault()); atras.onclick = () => { menuRico.pila.pop(); pintarMenuRico(); }; }
    m.appendChild(cab);
  }
  const cuerpo = document.createElement("div");
  cuerpo.className = "mr-cuerpo";
  if (v.pintar) v.pintar(cuerpo);
  else v.items.forEach(it => {
    if (!it) return;
    if (it === "-"){ cuerpo.appendChild(document.createElement("hr")); return; }
    const b = document.createElement("button");
    b.className = "mr-item" + (it.peligro ? " peligro" : "") + (it.activo ? " activo" : "");
    b.innerHTML = `<span class="mr-ico">${it.icono || ""}</span><span class="mr-txt"><b></b>${it.sub ? "<small></small>" : ""}</span>` +
      (it.badge ? `<span class="mr-badge">${it.badge}</span>` : "") + (it.vista ? `<span class="mr-flecha">${ICONOS.flecha}</span>` : "");
    b.querySelector("b").textContent = it.txt;
    if (it.sub) b.querySelector("small").textContent = it.sub;
    if (it.estilo) b.querySelector("b").setAttribute("style", it.estilo);
    b.addEventListener("mousedown", e => e.preventDefault());
    b.onclick = () => { if (it.vista) irAVista(it.vista()); else { cerrarMenuRico(); it.fn(); } };
    cuerpo.appendChild(b);
  });
  m.appendChild(cuerpo);
  m.scrollTop = 0;
}

function vistaPrincipal(){
  const d = docAbierto();
  const esNota = d.tipo === "nota";
  return { items:[
    { icono:ICONOS.foto, txt:"Agregar una foto", sub:"De la galería o de la cámara", fn: () => $("inpFoto").click() },
    { icono:ICONOS.clip, txt:"Adjuntar un archivo", sub:"PDF, TXT o DOCX", fn: () => $("inpArchivo").click() },
    esNota && { icono:ICONOS.diapo, txt:"Crear presentación", sub:"Diapositivas con esta nota", badge:"nuevo", fn: abrirPresentacion },
    { icono:ICONOS.exportar, txt:"Exportar", sub:"Elegí un formato", vista: vistaExportar },
    { icono:ICONOS.fondo, txt:"Fondo de la nota", sub:"Una portada arriba del título", vista: vistaFondo },
    { icono:ICONOS.fuente, txt:"Fuente", sub:"Para toda la nota", vista: vistaFuente },
    esNota && { icono:ICONOS.tabla, txt:"Insertar tabla", sub:"Elegí filas y columnas", vista: vistaTabla },
    esNota && { icono:ICONOS.efectos, txt:"Efectos de texto", sub:"Resaltar, colorear y brillar", vista: vistaEfectos },
    esNota && { icono:ICONOS.plantillas, txt:"Plantillas", sub:"Empezá más rápido sin salir de la nota", vista: vistaPlantillas },
    "-",
    { icono:ICONOS.fijar, txt: d.fijada ? "Desfijar" : "Fijar arriba", fn: () => alternarFijada(d) },
    { icono:ICONOS.lectura, txt:"Modo lectura", fn: alternarZen },
    { icono:ICONOS.duplicar, txt:"Duplicar", fn: () => duplicar(d) },
    { icono:ICONOS.eliminar, txt:"Eliminar", peligro:true, fn: () => eliminar(d) },
  ]};
}
function vistaExportar(){
  const d = docAbierto();
  return { titulo:"Exportar", sub:"Elegí un formato", items:[
    { icono:ICONOS.archivo, txt:"PDF", sub:"Para imprimir o mandar", fn: () => exportarDoc(d, "pdf") },
    { icono:ICONOS.archivo, txt:"Word (.doc)", sub:"Se abre con Word o Google Docs", fn: () => exportarDoc(d, "doc") },
    { icono:ICONOS.archivo, txt:"Página web (.html)", sub:"Con estilos, se abre en cualquier navegador", fn: () => exportarDoc(d, "html") },
    { icono:ICONOS.archivo, txt:"Markdown (.md)", sub:"Para Notion, Obsidian o GitHub", fn: () => exportarDoc(d, "md") },
    { icono:ICONOS.archivo, txt:"Texto (.txt)", sub:"Sólo el texto", fn: () => exportarDoc(d, "txt") },
    { icono:ICONOS.duplicar, txt:"Copiar todo el texto", sub:"Para pegarlo donde quieras", fn: () => copiarTexto(d) },
  ]};
}
function vistaFondo(){
  return { titulo:"Fondo de la nota", sub:"Una portada arriba del título", pintar: cont => {
    const d = docAbierto();
    const grilla = document.createElement("div");
    grilla.className = "mr-muestras";
    PORTADAS.forEach(p => {
      const b = document.createElement("button");
      b.className = "mr-muestra portada-" + p.id + (d.portada === p.id ? " activo" : "");
      b.innerHTML = `<span>${p.nombre}</span>`;
      b.onclick = () => { ponerPortada(p.id); cerrarMenuRico(); };
      grilla.appendChild(b);
    });
    cont.appendChild(grilla);
    const foto = document.createElement("button");
    foto.className = "mr-item";
    foto.innerHTML = `<span class="mr-ico">${ICONOS.foto}</span><span class="mr-txt"><b>Una foto mía</b><small>De la galería o la cámara</small></span>`;
    foto.onclick = () => { cerrarMenuRico(); $("inpPortada").click(); };
    cont.appendChild(foto);
    if (d.portada){
      const sacar = document.createElement("button");
      sacar.className = "mr-item";
      sacar.innerHTML = `<span class="mr-ico">${ICONOS.sacar}</span><span class="mr-txt"><b>Sin fondo</b></span>`;
      sacar.onclick = () => { ponerPortada(""); cerrarMenuRico(); };
      cont.appendChild(sacar);
    }
  }};
}
function vistaFuente(){
  const d = docAbierto();
  return { titulo:"Fuente", sub:"Para toda la nota", items: FUENTES.map(f => ({
    icono: d.fuente === f.id ? ICONO_CHECK : "", txt:f.nombre, sub:f.sub, activo: d.fuente === f.id,
    estilo: { "":"", serif:"font-family:Georgia,serif", mono:"font-family:ui-monospace,Consolas,monospace", pixel:"font-family:'Press Start 2P',monospace;font-size:11px" }[f.id],
    fn: () => { d.fuente = f.id; tocar(d); pintarFuente(d); },
  }))};
}
function vistaTabla(){
  return { titulo:"Insertar tabla", sub:"Elegí filas y columnas", pintar: cont => {
    const FILAS = 7, COLS = 6;
    const etiqueta = document.createElement("p");
    etiqueta.className = "mr-tabla-txt";
    etiqueta.textContent = "Pasá por encima o tocá un cuadrito";
    const grilla = document.createElement("div");
    grilla.className = "mr-tabla";
    const marcar = (f, c) => {
      grilla.querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.f <= f && +b.dataset.c <= c));
      etiqueta.textContent = `${f} fila${f > 1 ? "s" : ""} × ${c} columna${c > 1 ? "s" : ""}`;
    };
    for (let f = 1; f <= FILAS; f++) for (let c = 1; c <= COLS; c++){
      const b = document.createElement("button");
      b.dataset.f = f; b.dataset.c = c;
      b.setAttribute("aria-label", `${f} por ${c}`);
      b.onpointerenter = () => marcar(f, c);
      b.addEventListener("mousedown", e => e.preventDefault());
      b.onclick = () => { cerrarMenuRico(); insertarTabla(f, c); };
      grilla.appendChild(b);
    }
    cont.append(grilla, etiqueta);
  }};
}
function insertarTabla(filas, cols){
  const fila = "<tr>" + "<td><br></td>".repeat(cols) + "</tr>";
  insertarHTML(`<table class="tabla"><tbody>${fila.repeat(filas)}</tbody></table><p><br></p>`);
  avisar(`Tabla de ${filas} × ${cols} agregada`, "ok");
}
function vistaEfectos(){
  return { titulo:"Efectos de texto", sub:"Primero seleccioná el texto", pintar: cont => {
    const grupo = (titulo, botones) => {
      const t = document.createElement("p"); t.className = "mr-subtitulo"; t.textContent = titulo; cont.appendChild(t);
      const g = document.createElement("div"); g.className = "mr-efectos";
      botones.forEach(([txt, clase, fn]) => {
        const b = document.createElement("button");
        b.className = "mr-efecto " + clase;
        b.textContent = txt;
        b.addEventListener("mousedown", e => e.preventDefault());
        b.onclick = () => { cerrarMenuRico(); fn(); };
        g.appendChild(b);
      });
      cont.appendChild(g);
    };
    grupo("Resaltador", [["Rosa", "re-rosa", () => colorear("hiliteColor", "#F9D3EE")], ["Menta", "re-menta", () => colorear("hiliteColor", "#C9F5E1")],
                         ["Manteca", "re-manteca", () => colorear("hiliteColor", "#FFE9B0")], ["Celeste", "re-celeste", () => colorear("hiliteColor", "#CFE9FB")]]);
    grupo("Color de letra", [["Rosa", "co-rosa", () => colorear("foreColor", "#D63F9B")], ["Lila", "co-lila", () => colorear("foreColor", "#7B45C6")],
                             ["Azul", "co-azul", () => colorear("foreColor", "#2F6FD6")], ["Negro", "co-negro", () => colorear("foreColor", "#111111")]]);
    grupo("Especiales", [["✦ Brillo", "fx-brillo", () => envolver("fx-brillo")], ["Arcoíris", "fx-arcoiris", () => envolver("fx-arcoiris")],
                         ["Pixel", "fx-pixel", () => envolver("fx-pixel")], ["Quitar efectos", "quitar-fx", quitarEfectos]]);
  }};
}
function haySeleccion(){
  restaurarSeleccion();
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed){ avisar("Primero seleccioná el texto que querés cambiar"); return false; }
  return true;
}
function colorear(comando, color){
  if (!haySeleccion()) return;
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(comando, false, color);
  document.execCommand("styleWithCSS", false, false);
  sincronizarCuerpo();
}
function envolver(clase){
  if (!haySeleccion()) return;
  const s = getSelection(), r = s.getRangeAt(0);
  const span = document.createElement("span");
  span.className = clase;
  span.appendChild(r.extractContents());
  r.insertNode(span);
  s.removeAllRanges();
  const nr = document.createRange(); nr.selectNodeContents(span); s.addRange(nr);
  sincronizarCuerpo();
  if (clase === "fx-brillo") chispasEn(span, 8);
}
function quitarEfectos(){
  if (!haySeleccion()) return;
  const s = getSelection();
  document.execCommand("removeFormat");
  $("edCuerpo").querySelectorAll("span.fx-brillo, span.fx-arcoiris, span.fx-pixel, span[style]").forEach(sp => {
    if (s.containsNode(sp, true)) sp.replaceWith(...sp.childNodes);
  });
  sincronizarCuerpo();
}

/* ---------- Plantillas (se cargan sólo cuando las abrís) ---------- */
let cargaPlantillas = null;
function vistaPlantillas(){
  return { titulo:"Plantillas", sub:"Empezá más rápido sin salir de la nota", pintar: cont => {
    cont.innerHTML = '<p class="mr-subtitulo">Cargando…</p>';
    (cargaPlantillas || (cargaPlantillas = import(`/plantillas.js?v=${VERSION}`)))
      .then(({ PLANTILLAS }) => {
        cont.innerHTML = "";
        PLANTILLAS.forEach(p => {
          const b = document.createElement("button");
          b.className = "mr-item sin-ico";
          b.innerHTML = `<span class="mr-txt"><b></b><small></small></span>`;
          b.querySelector("b").textContent = p.titulo;
          b.querySelector("small").textContent = p.sub;
          b.onclick = () => { cerrarMenuRico(); aplicarPlantilla(p); };
          cont.appendChild(b);
        });
      })
      .catch(() => { cargaPlantillas = null; cont.innerHTML = '<p class="mr-subtitulo">No se pudieron cargar. Revisá la conexión.</p>'; });
  }};
}
function aplicarPlantilla(p){
  const d = docAbierto();
  if (!d || d.tipo !== "nota") return;
  const hoy = new Date();
  const html = p.html(hoy);
  if (textoPlano(d.cuerpo)){
    if (!confirm(`La nota ya tiene texto. ¿Agregar "${p.titulo}" al final?`)) return;
    d.cuerpo += "<hr>" + html;
  } else d.cuerpo = html;
  if (!d.titulo.trim()){ d.titulo = p.nombre(hoy); $("edTitulo").value = d.titulo; }
  $("edCuerpo").innerHTML = d.cuerpo;
  tocar(d);
  pintarContador();
  chispasEn($("edTitulo"), 12);
  animo("feliz");
  avisar(`Plantilla "${p.titulo}" lista`, "ok");
}

$("btnNotaMenu").onclick = () => {
  if (!$("menuRico").hidden){ cerrarMenuRico(); return; }
  if (docAbierto()) abrirMenuRico(vistaPrincipal());
};

/* ============================================================
   PRESENTACIÓN: cada título de la nota es una diapositiva
   ============================================================ */
let diapos = [], diapoActual = 0;
function armarDiapositivas(d){
  const raiz = document.createElement("div");
  raiz.innerHTML = d.cuerpo || "";
  const lista = [{ portada:true }];
  let actual = null;
  for (const n of [...raiz.childNodes]){
    if (n.nodeType === 1 && /^H[1-3]$/.test(n.tagName)){ actual = { titulo:n.textContent, html:"", largo:0 }; lista.push(actual); continue; }
    if (n.nodeType === 1 && n.tagName === "HR"){ actual = null; continue; }
    const html = n.nodeType === 3 ? escapar(n.textContent) : n.nodeType === 1 ? n.outerHTML : "";
    const largo = (n.textContent || "").trim().length;
    if (!largo && !(n.nodeType === 1 && n.querySelector("img, table"))) continue;
    // Diapositivas muy largas se parten en dos
    if (!actual || actual.largo > 520){ actual = { titulo: actual ? actual.titulo + " (sigue)" : "", html:"", largo:0 }; lista.push(actual); }
    actual.html += html; actual.largo += largo;
  }
  return lista.filter(s => s.portada || s.titulo || s.html);
}
function abrirPresentacion(){
  const d = docAbierto();
  if (!d || d.tipo !== "nota") return;
  diapos = armarDiapositivas(d);
  if (diapos.length < 2){ avisar("Escribí algo primero. Cada título (botón H) arranca una diapositiva nueva.", "", 4500); return; }
  diapoActual = 0;
  $("presentacion").hidden = false;
  document.body.classList.add("presentando");
  if (esMovil()) history.pushState({ editor:true, presentacion:true }, "");
  mostrarDiapo(0);
}
function cerrarPresentacion(){
  $("presentacion").hidden = true;
  document.body.classList.remove("presentando");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function mostrarDiapo(i){
  const d = docAbierto();
  if (!d) return;
  diapoActual = Math.max(0, Math.min(diapos.length - 1, i));
  const s = diapos[diapoActual];
  const el = $("diapo");
  if (s.portada){
    el.className = "diapo diapo-portada";
    el.innerHTML = `<svg class="diapo-estrella" aria-hidden="true"><use href="#estrella"/></svg><h1></h1><p></p>`;
    el.querySelector("h1").textContent = d.titulo || "Sin título";
    el.querySelector("p").textContent = new Date().toLocaleDateString("es-AR", { day:"numeric", month:"long", year:"numeric" }) + " · hecho con Kynus";
  } else {
    el.className = "diapo";
    el.innerHTML = (s.titulo ? "<h2></h2>" : "") + `<div class="diapo-contenido">${s.html}</div>`;
    if (s.titulo) el.querySelector("h2").textContent = s.titulo;
  }
  $("diapoCuenta").textContent = `${diapoActual + 1} / ${diapos.length}`;
  $("diapoTitulo").textContent = `diapositiva_${diapoActual + 1}.exe`;
  $("diapoAnterior").disabled = diapoActual === 0;
  $("diapoSiguiente").disabled = diapoActual === diapos.length - 1;
  if (!sinMovimiento && el.animate) el.animate([{ opacity:0, transform:"translateY(16px) scale(.98)" }, { opacity:1, transform:"none" }], { duration:320, easing:"cubic-bezier(.2,.8,.2,1)" });
}
$("diapoAnterior").onclick = () => mostrarDiapo(diapoActual - 1);
$("diapoSiguiente").onclick = () => mostrarDiapo(diapoActual + 1);
$("diapoCerrar").onclick = () => { if (history.state && history.state.presentacion) history.back(); else cerrarPresentacion(); };
$("diapoPantalla").onclick = () => {
  const p = $("presentacion");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (p.requestFullscreen) p.requestFullscreen().catch(() => avisar("Este navegador no deja usar pantalla completa"));
};
let toqueX = null;
$("presentacion").addEventListener("pointerdown", e => { toqueX = e.clientX; });
$("presentacion").addEventListener("pointerup", e => {
  if (toqueX === null) return;
  const dx = e.clientX - toqueX; toqueX = null;
  if (Math.abs(dx) > 60) mostrarDiapo(diapoActual + (dx < 0 ? 1 : -1));
});

/* ============================================================
   BIENVENIDA (nombre)
   ============================================================ */
function pintarSaludo(){
  const nombre = leer("llavero_nombre");
  const h = new Date().getHours();
  const momento = h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
  $("saludo").hidden = !nombre;
  if (nombre) $("saludo").textContent = `${momento}, ${nombre}`;
}
function mostrarBienvenida(){
  $("inpNombre").value = leer("llavero_nombre") || "";
  $("chkSinNombre").checked = false;
  $("inpNombre").disabled = false;
  $("bienvenida").hidden = false;
}
$("chkSinNombre").onchange = e => { $("inpNombre").disabled = e.target.checked; };
$("btnGuardarNombre").onclick = () => {
  const nombre = $("chkSinNombre").checked ? "" : $("inpNombre").value.trim();
  escribir("llavero_nombre", nombre);
  $("bienvenida").hidden = true;
  pintarSaludo();
  if (nombre) animo("feliz", 2000);
};
$("inpNombre").onkeydown = e => { if (e.key === "Enter") $("btnGuardarNombre").click(); };
$("btnOmitir").onclick = () => {
  if (leer("llavero_nombre") === null) escribir("llavero_nombre", "");
  $("bienvenida").hidden = true;
};

/* ============================================================
   EVENTOS DE LA INTERFAZ
   ============================================================ */
document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => cambiarTab(b.dataset.tab));

$("buscador").oninput = e => { filtro = e.target.value.trim(); pintarLista(); };

const crearSegunTab = () => crear(tab === "notas" ? "nota" : "tarea");
$("btnCrear").onclick = e => { chispasEn(e.currentTarget, 8); crearSegunTab(); };
$("btnCrearVacio").onclick = e => { chispasEn(e.currentTarget, 8); crearSegunTab(); };

$("btnCrearMas").onclick = e => abrirMenu(e.currentTarget, [
  { txt:"Nota en blanco",          fn: () => crear("nota") },
  { txt:"Desde una plantilla…",    fn: () => crear("nota", () => abrirMenuRico(vistaPlantillas())) },
  { txt:"Nota dictada (voz a texto)", fn: () => crear("nota", () => dictar($("tbDictar"))) },
  { txt:"Nota con foto",           fn: () => crear("nota", () => $("inpFoto").click()) },
  { txt:"Nota de audio",           fn: () => crear("nota", () => $("tbAudio").click()) },
  "-",
  { txt:"Lista de tareas",         fn: () => crear("tarea") },
]);

/* ---------- Tutorial (se descarga sólo cuando se usa) ---------- */
let cargaTutorial = null;
function iniciarTutorial(){
  (cargaTutorial || (cargaTutorial = import(`/tutorial.js?v=${VERSION}`)))
    .then(m => m.empezar())
    .catch(() => { cargaTutorial = null; avisar("No se pudo abrir el tutorial. Revisá la conexión.", "error"); });
}

$("btnMenu").onclick = e => abrirMenu(e.currentTarget, [
  { txt:"Ver el tutorial ✦",             fn: iniciarTutorial },
  { txt:"Sincronizar llavero",           fn: sincronizar },
  "-",
  { txt:"Exportar todo (copia .json)",   fn: exportarTodo },
  { txt:"Importar copia",                fn: () => $("inpImportar").click() },
  "-",
  { txt:"Cambiar mi nombre",             fn: mostrarBienvenida },
  "-",
  { txt:`Versión ${VERSION} · ${esMovil() ? "celular" : "PC"}`, fn: () => location.reload() },
]);

document.querySelectorAll(".seccion").forEach(sec => {
  const clave = "llavero_plegada_" + sec.dataset.sec;
  sec.classList.toggle("plegada", leer(clave) === "1");
  sec.querySelector(".plegar").onclick = () => {
    const p = sec.classList.toggle("plegada");
    escribir(clave, p ? "1" : "0");
  };
  sec.querySelector(".orden").onclick = e => {
    const op = (txt, valor) => ({ txt:(orden === valor ? "✓ " : "") + txt, fn: () => { orden = valor; escribir("llavero_orden", valor); pintarLista(); } });
    abrirMenu(e.currentTarget, [op("Más recientes", "recientes"), op("Más antiguas", "viejas"), op("Alfabético (A–Z)", "az")]);
  };
});

function alternarPanel(){
  const oculto = document.body.classList.toggle("panel-oculto");
  $("btnAbrirPanel").hidden = !oculto;
  escribir("llavero_panel", oculto ? "oculto" : "");
}
$("btnPanel").onclick = alternarPanel;
$("btnAbrirPanel").onclick = alternarPanel;

$("btnVolver").onclick = volver;

document.addEventListener("keydown", e => {
  const presentando = !$("presentacion").hidden;
  if (presentando){
    if (["ArrowRight", "PageDown", " "].includes(e.key)){ e.preventDefault(); mostrarDiapo(diapoActual + 1); return; }
    if (["ArrowLeft", "PageUp"].includes(e.key)){ e.preventDefault(); mostrarDiapo(diapoActual - 1); return; }
  }
  if (e.key === "Escape"){
    if (presentando) $("diapoCerrar").click();
    else if (!$("modal").hidden) cerrarModal();
    else if (!$("menuRico").hidden) cerrarMenuRico();
    else if (!$("buscaNota").hidden) cerrarBusqueda();
    else if (!$("menu").hidden) cerrarMenu();
    else if (document.querySelector(".visor")) document.querySelector(".visor").remove();
    else if (document.body.classList.contains("zen")) alternarZen();
  }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === "k"){
    e.preventDefault();
    if (abierto && esMovil()) volver();
    $("buscador").focus();
  }
  if (ctrl && e.key.toLowerCase() === "f" && abierto && !presentando){
    e.preventDefault();
    abrirBusqueda();
  }
});

// Si se pasa de PC a celular (o al revés) con una nota abierta, mantener el estado coherente
window.addEventListener("resize", () => { if (!abierto) document.body.classList.remove("editando"); });

/* ============================================================
   ARRANQUE
   ============================================================ */
cargar();
if (leer("llavero_panel") === "oculto" && !esMovil()){
  document.body.classList.add("panel-oculto");
  $("btnAbrirPanel").hidden = false;
}
aplicarHerramientas(leer("llavero_herramientas") === "ocultas");
pintarSaludo();
pintarLista();
// Primera vez: tutorial (que también pregunta el nombre).
// Si ya usabas la app, un aviso de una sola vez para contarte que existe.
const tutorial = leer("llavero_tutorial");
if (!tutorial && !docs.length) setTimeout(iniciarTutorial, 450);
else {
  if (!tutorial){
    escribir("llavero_tutorial", "avisado");
    setTimeout(() => avisar("✦ Nuevo: hay un tutorial en el menú ··· del panel", "", 5500), 1200);
  }
  setTimeout(() => { if (leer("llavero_nombre") === null) mostrarBienvenida(); }, 600);
}
