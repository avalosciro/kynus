/* ============================================================
   KYNUS — app.js
   Notas + tareas (localStorage), fotos y audios (IndexedDB),
   dictado, modo lectura, fijar, exportar y grabar → Google Calendar.
   ============================================================ */

const BACKEND = window.location.origin;
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHAR_UUID    = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const VERSION = 9;
const esMovil = () => document.documentElement.classList.contains("movil");

const $ = id => document.getElementById(id);
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Estado ---------- */
let docs = [];          // { id, tipo:"nota"|"tarea", titulo, cuerpo, items, fijada, creada, editada, adjuntos }
let tab = "notas";      // notas | tareas
let abierto = null;     // id del doc en el editor
let filtro = "";
let orden = leer("llavero_orden") || "recientes";

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
  return { id:nuevoId(), tipo, titulo:"", cuerpo:"", items:[], fijada:false, creada:ahora, editada:ahora, adjuntos:[], ...extra };
}

const docAbierto = () => docs.find(d => d.id === abierto);

/* ---------- Fotos y audios en IndexedDB ---------- */
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
const textoPlano = html => { const t = document.createElement("div"); t.innerHTML = html || ""; return (t.innerText || t.textContent || "").trim(); };

function fechaCorta(ts){
  const d = new Date(ts), hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });
  return d.toLocaleDateString("es-AR", { day:"numeric", month:"short" });
}
function fechaLarga(ts){
  return new Date(ts).toLocaleString("es-AR", { day:"numeric", month:"long", hour:"2-digit", minute:"2-digit" });
}

let timerAviso;
function avisar(texto, tipo = "", ms = 2800){
  const el = $("aviso");
  el.textContent = texto;
  el.className = "aviso mostrar " + tipo;
  clearTimeout(timerAviso);
  if (ms) timerAviso = setTimeout(() => el.className = "aviso " + tipo, ms);
}

function descargar(nombre, contenido, tipo){
  const url = URL.createObjectURL(new Blob([contenido], { type:tipo }));
  const a = Object.assign(document.createElement("a"), { href:url, download:nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const nombreArchivo = t => (t || "sin-titulo").replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 60) || "sin-titulo";

/* ============================================================
   MENÚ FLOTANTE
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
  if (!$("menu").hidden && !$("menu").contains(e.target)) cerrarMenu();
}, true);

/* ============================================================
   LISTA DEL PANEL
   ============================================================ */
function visibles(){
  const tipo = tab === "notas" ? "nota" : "tarea";
  const f = filtro.toLowerCase();
  const lista = docs.filter(d => d.tipo === tipo && (!f ||
    (d.titulo + " " + textoPlano(d.cuerpo) + " " + d.items.map(i => i.texto).join(" ") +
     " " + d.adjuntos.map(a => a.transcripcion || "").join(" ")).toLowerCase().includes(f)));
  if (orden === "az")      lista.sort((a, b) => (a.titulo || "￿").localeCompare(b.titulo || "￿", "es"));
  else if (orden === "viejas") lista.sort((a, b) => a.creada - b.creada);
  else                     lista.sort((a, b) => b.editada - a.editada);
  return lista;
}

function fila(d){
  const li = document.createElement("li");
  li.className = "fila" + (d.id === abierto ? " activa" : "");
  const titulo = document.createElement("span");
  titulo.className = "fila-titulo";
  titulo.textContent = d.titulo || (d.tipo === "nota" ? "Sin título" : "Lista sin título");
  const meta = document.createElement("span");
  meta.className = "fila-meta";
  const cuando = document.createElement("span");
  cuando.textContent = fechaCorta(d.editada);
  const resumen = document.createElement("span");
  if (d.tipo === "nota"){
    const fotos = d.adjuntos.filter(a => a.tipo === "foto").length;
    const audios = d.adjuntos.filter(a => a.tipo === "audio").length;
    const extra = [fotos && `${fotos} foto${fotos > 1 ? "s" : ""}`, audios && `${audios} audio${audios > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
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

  const esNota = d.tipo === "nota";
  $("edTitulo").value = d.titulo;
  $("edTitulo").placeholder = esNota ? "Sin título" : "Nombre de la lista";
  $("edCuerpo").hidden = !esNota;
  $("edTareas").hidden = esNota;
  // En las listas sólo quedan foto, audio y dictado: sin formato ni separadores
  document.querySelectorAll("#toolbar [data-cmd], #toolbar [data-block], #toolbar .sep")
    .forEach(b => b.hidden = !esNota);
  if (esNota) $("edCuerpo").innerHTML = d.cuerpo;
  else pintarItems();
  pintarCabecera();
  pintarAdjuntos();

  $("vistaVacia").hidden = true;
  $("vistaEditor").hidden = false;
  $("principal").scrollTop = 0;
  document.body.classList.add("editando");
  if (esMovil() && !(history.state && history.state.editor)) history.pushState({ editor:true }, "");
  pintarLista();
}

function cerrar(sinPintar){
  limpiarVacio(docAbierto());
  abierto = null;
  salirZen();
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
window.addEventListener("popstate", () => { if (abierto) cerrar(); });

// Borra notas que quedaron completamente vacías
function limpiarVacio(d){
  if (!d) return;
  const vacio = !d.titulo.trim() && !textoPlano(d.cuerpo) && !d.items.length && !d.adjuntos.length;
  if (vacio){ docs = docs.filter(x => x.id !== d.id); guardar(); }
}

function tocar(d){ d.editada = Date.now(); guardar(); pintarCabecera(); pintarLista(); }

function pintarCabecera(){
  const d = docAbierto();
  if (!d) return;
  $("edFecha").textContent = "Editado " + fechaLarga(d.editada);
  $("btnFijar").classList.toggle("activo", d.fijada);
  $("btnFijar").title = d.fijada ? "Desfijar" : "Fijar";
}

$("edTitulo").oninput = () => { const d = docAbierto(); if (d){ d.titulo = $("edTitulo").value; tocar(d); } };
$("edTitulo").onkeydown = e => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const d = docAbierto();
  if (d && d.tipo === "nota") $("edCuerpo").focus(); else $("nuevoItem").focus();
};
$("edCuerpo").oninput = () => { const d = docAbierto(); if (d){ d.cuerpo = $("edCuerpo").innerHTML; tocar(d); } };

/* ---------- Barra de formato ---------- */
document.querySelectorAll("#toolbar button").forEach(b => b.addEventListener("mousedown", e => e.preventDefault()));
document.querySelectorAll("#toolbar [data-cmd]").forEach(b => b.onclick = () => {
  document.execCommand(b.dataset.cmd, false, null);
  $("edCuerpo").dispatchEvent(new Event("input"));
});
document.querySelectorAll("#toolbar [data-block]").forEach(b => b.onclick = () => {
  const actual = (document.queryCommandValue("formatBlock") || "").toUpperCase();
  document.execCommand("formatBlock", false, actual === b.dataset.block ? "P" : b.dataset.block);
  $("edCuerpo").dispatchEvent(new Event("input"));
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
    li.querySelector(".check").onclick = () => { it.hecho = !it.hecho; tocar(d); pintarItems(); };
    li.querySelector(".item-borrar").onclick = () => { d.items.splice(i, 1); tocar(d); pintarItems(); };
    inp.oninput = () => { it.texto = inp.value; tocar(d); };
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
}
const partirEnTareas = texto => texto.split(/[,;\n]| y luego | después | y /i);

$("formItem").onsubmit = e => {
  e.preventDefault();
  agregarItems([$("nuevoItem").value]);
  $("nuevoItem").value = "";
};

/* ---------- Fijar / zen / menú de la nota ---------- */
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

$("btnNotaMenu").onclick = e => {
  const d = docAbierto();
  if (!d) return;
  abrirMenu(e.currentTarget, [
    { txt: d.fijada ? "Desfijar" : "Fijar arriba", fn: () => alternarFijada(d) },
    { txt: "Modo lectura", fn: alternarZen },
    { txt: "Duplicar", fn: () => duplicar(d) },
    "-",
    { txt: "Exportar como Markdown (.md)", fn: () => exportarDoc(d, "md") },
    { txt: "Exportar como texto (.txt)",   fn: () => exportarDoc(d, "txt") },
    "-",
    { txt: "Eliminar", peligro:true, fn: () => eliminar(d) },
  ]);
};

function duplicar(d){
  const copia = nuevoDoc(d.tipo, {
    titulo: (d.titulo || "Sin título") + " (copia)", cuerpo:d.cuerpo, fijada:false,
    items: d.items.map(i => ({ ...i, id:nuevoId() })),
  });
  docs.push(copia); guardar(); abrir(copia.id);
  avisar("Duplicada (sin fotos ni audios)");
}

async function eliminar(d){
  if (!confirm(`¿Eliminar "${d.titulo || "Sin título"}"?`)) return;
  docs = docs.filter(x => x.id !== d.id);
  guardar();
  d.adjuntos.forEach(a => media.del(a.id).catch(() => {}));
  volver();
  avisar("Eliminada");
}

/* ---------- Exportar ---------- */
function htmlAMarkdown(html){
  const raiz = document.createElement("div");
  raiz.innerHTML = html || "";
  const rec = (n, lista) => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1) return "";
    const hijos = () => [...n.childNodes].map(c => rec(c, lista)).join("");
    switch (n.tagName){
      case "B": case "STRONG": return `**${hijos()}**`;
      case "I": case "EM":     return `_${hijos()}_`;
      case "S": case "STRIKE": case "DEL": return `~~${hijos()}~~`;
      case "U":  return hijos();
      case "BR": return "\n";
      case "H1": case "H2": case "H3": return `\n## ${hijos()}\n`;
      case "BLOCKQUOTE": return "\n" + hijos().split("\n").map(l => "> " + l).join("\n") + "\n";
      case "UL": return "\n" + [...n.children].map(li => "- " + rec(li, "ul").trim()).join("\n") + "\n";
      case "OL": return "\n" + [...n.children].map((li, i) => `${i + 1}. ` + rec(li, "ol").trim()).join("\n") + "\n";
      case "A":  return `[${hijos()}](${n.getAttribute("href")})`;
      case "DIV": case "P": return "\n" + hijos();
      default:   return hijos();
    }
  };
  return rec(raiz).replace(/\n{3,}/g, "\n\n").trim();
}

function exportarDoc(d, formato){
  const titulo = d.titulo || "Sin título";
  let cuerpo;
  if (d.tipo === "nota") cuerpo = formato === "md" ? htmlAMarkdown(d.cuerpo) : textoPlano(d.cuerpo);
  else cuerpo = d.items.map(i => formato === "md" ? `- [${i.hecho ? "x" : " "}] ${i.texto}` : `${i.hecho ? "[x]" : "[ ]"} ${i.texto}`).join("\n");
  const transcripciones = d.adjuntos.filter(a => a.transcripcion).map(a => a.transcripcion);
  if (transcripciones.length) cuerpo += (formato === "md" ? "\n\n## Audios\n\n" : "\n\nAudios:\n") + transcripciones.map(t => "- " + t).join("\n");
  const texto = (formato === "md" ? `# ${titulo}\n\n` : `${titulo}\n\n`) + cuerpo + "\n";
  descargar(`${nombreArchivo(titulo)}.${formato}`, texto, formato === "md" ? "text/markdown" : "text/plain");
}

function exportarTodo(){
  const datos = { app:"llavero", version:1, exportado:new Date().toISOString(), docs };
  descargar(`kynus-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(datos, null, 2), "application/json");
  avisar("Copia descargada (las fotos y audios quedan en este dispositivo)", "", 4000);
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
      const limpio = nuevoDoc(d.tipo, { ...d, adjuntos:[] });
      const i = docs.findIndex(x => x.id === d.id);
      if (i >= 0){ if (limpio.editada > docs[i].editada) docs[i] = { ...limpio, adjuntos:docs[i].adjuntos }; }
      else { docs.push(limpio); nuevos++; }
    });
    guardar(); pintarLista();
    avisar(`Importado: ${nuevos} nuevas, ${entrantes.length - nuevos} actualizadas`, "ok");
  }catch{ avisar("Ese archivo no es una copia válida", "error"); }
};

/* ============================================================
   ADJUNTOS: FOTOS Y AUDIOS
   ============================================================ */
let urlsVivas = [];

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
        const url = URL.createObjectURL(blob);
        urlsVivas.push(url);
        const img = caja.querySelector("img");
        img.src = url;
        img.onclick = () => verFoto(url);
      }).catch(() => {});
    }
    cont.appendChild(grilla);
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
      const url = URL.createObjectURL(blob);
      urlsVivas.push(url);
      caja.querySelector("audio").src = url;
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
  if (!d || !confirm(a.tipo === "foto" ? "¿Quitar esta foto?" : "¿Quitar este audio?")) return;
  d.adjuntos = d.adjuntos.filter(x => x.id !== a.id);
  tocar(d);
  media.del(a.id).catch(() => {});
  pintarAdjuntos();
}

async function agregarAdjunto(tipo, blob, extra = {}){
  const d = docAbierto();
  if (!d) return;
  const id = nuevoId();
  try{ await media.put(id, blob); }
  catch{ avisar("No hay espacio para guardar el archivo", "error"); return; }
  d.adjuntos.push({ id, tipo, creada:Date.now(), ...extra });
  tocar(d);
  pintarAdjuntos();
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
  await agregarAdjunto("foto", await comprimir(archivo));
  avisar("Foto agregada", "ok");
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
  d.cuerpo = $("edCuerpo").innerHTML;
  tocar(d);
}

/* ---------- Audio adjunto ---------- */
$("tbAudio").onclick = () => grabar($("tbAudio"), async blob => {
  await agregarAdjunto("audio", blob);
  avisar("Audio guardado", "ok");
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
  }catch(e){
    avisar(e && e.message ? e.message : "No se pudo agendar. Probá de nuevo.", "error", 4000);
  }finally{
    btn.classList.remove("ocupado");
  }
});

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
      filters:[{ namePrefix:"Llavero" }],
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
$("btnCrear").onclick = crearSegunTab;
$("btnCrearVacio").onclick = crearSegunTab;

$("btnCrearMas").onclick = e => abrirMenu(e.currentTarget, [
  { txt:"Nota en blanco",          fn: () => crear("nota") },
  { txt:"Nota dictada (voz a texto)", fn: () => crear("nota", () => dictar($("tbDictar"))) },
  { txt:"Nota con foto",           fn: () => crear("nota", () => $("inpFoto").click()) },
  { txt:"Nota de audio",           fn: () => crear("nota", () => $("tbAudio").click()) },
  "-",
  { txt:"Lista de tareas",         fn: () => crear("tarea") },
]);

$("btnMenu").onclick = e => abrirMenu(e.currentTarget, [
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
  if (e.key === "Escape"){
    if (!$("menu").hidden) cerrarMenu();
    else if (document.querySelector(".visor")) document.querySelector(".visor").remove();
    else if (document.body.classList.contains("zen")) alternarZen();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){
    e.preventDefault();
    if (abierto && esMovil()) volver();
    $("buscador").focus();
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
pintarSaludo();
pintarLista();
setTimeout(() => { if (leer("llavero_nombre") === null) mostrarBienvenida(); }, 600);
