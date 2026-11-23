/* ============================================================
   KYNUS — tutorial para la primera vez
   Un recorrido guiado: oscurece todo, ilumina un botón por vez y
   la ventanita "tutorial.exe" (con los ojitos) explica qué hace.
   Se carga sólo cuando hace falta (la primera vez o desde el menú ···).
   Usa las funciones de app.js (abrir, cerrar, docs, avisar, chispas…).
   ============================================================ */

const espera = ms => new Promise(r => setTimeout(r, ms));
const cuadro = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

/* ---------- La nota de "primeros pasos" que se usa para mostrar el editor ---------- */
const CUERPO_DEMO = `
<p>¡Hola! Esta nota es tuya: escribí, tildá lo que vayas probando o borrala cuando quieras.</p>
<h2>Probá esto</h2>
<ul class="lista-check">
  <li>Tildar esta casilla (tocá el cuadradito)</li>
  <li>Grabar un evento con el botón rosa: “dentista el jueves a las 5”</li>
  <li>Crear una nota desde una plantilla</li>
  <li>Cambiarle el fondo a esta nota (menú ···)</li>
  <li>Pasar esta nota a otro celular con el código QR</li>
  <li>Mandar tus eventos de hoy al llavero</li>
</ul>
<h2>Atajos</h2>
<ul>
  <li><b>Ctrl + K</b>: buscar entre todas tus notas</li>
  <li><b>Ctrl + F</b>: buscar dentro de la nota abierta</li>
  <li>En una presentación, cada título como “Atajos” es una diapositiva nueva</li>
</ul>
<blockquote>Tu estrella guía para el día a día ✦</blockquote>`;

function notaDemo(){
  const id = leer("llavero_nota_tutorial");
  let d = id && docs.find(x => x.id === id);
  if (!d){
    d = nuevoDoc("nota", { titulo:"Primeros pasos con Kynus ✦", cuerpo:CUERPO_DEMO.trim(), fijada:true });
    docs.push(d);
    guardar();
    escribir("llavero_nota_tutorial", d.id);
  }
  return d;
}

/* ---------- Qué tiene que estar a la vista en cada paso ---------- */
async function prepararLugar(lugar){
  salirZen();
  if (lugar === "lista"){
    if (document.body.classList.contains("panel-oculto")) alternarPanel();
    if (abierto && !esMovil()) cerrar();
    if (abierto && esMovil()){ volver(); await espera(220); }
    if (tab !== "notas") cambiarTab("notas");
  }
  if (lugar === "nota"){
    const d = notaDemo();
    if (abierto !== d.id){ abrir(d.id); await espera(120); }
    if (document.body.classList.contains("sin-herramientas")) aplicarHerramientas(false);
    $("principal").scrollTop = 0;
  }
}

/* ---------- Los pasos ---------- */
const nombre = () => (leer("llavero_nombre") || "").trim();
const PASOS = [
  { id:"hola", grande:true, titulo:"¡Hola! Soy Kynus ✦",
    texto:"Te muestro en un minuto todo lo que podés hacer. Tus notas se guardan en este dispositivo, sin cuentas ni contraseñas.",
    pedirNombre:true },
  { lugar:"lista", el:".tabs", titulo:"Notas y tareas",
    texto:"Acá elegís qué ver: notas (con texto, fotos, audios y archivos) o listas de tareas con casillas." },
  { lugar:"lista", el:".buscar", titulo:"Buscar",
    texto:"Encontrá cualquier cosa: busca en títulos, texto, tareas, nombres de archivos y hasta en lo que dijiste en un audio." },
  { lugar:"lista", el:".crear", titulo:"Crear",
    texto:"«Crear nota» empieza una nota en blanco. La flechita ⌄ tiene más: desde una plantilla, dictada, con foto o de audio." },
  { lugar:"lista", el:'.seccion[data-sec="fijadas"]', titulo:"Fijadas",
    texto:"Lo que fijás queda siempre arriba. Con los ··· de cada sección cambiás el orden: recientes, antiguas o de la A a la Z." },
  { lugar:"lista", el:"#btnGrabar", titulo:"El botón rosa",
    texto:"Tocalo y decí algo como «dentista el jueves a las 5». Kynus lo entiende y lo agenda solo en tu Google Calendar." },
  { lugar:"lista", el:"#btnSync", titulo:"Tu llavero",
    texto:"Manda los eventos de hoy al llavero por Bluetooth y la pantallita te los muestra. Anda en Chrome, en Android o en la compu." },
  { lugar:"nota", el:".ed-meta", titulo:"Adentro de una nota",
    texto:"Te armé esta nota de ejemplo. Arriba ves el estado (tocalo: borrador → en curso → terminada) y cuántos caracteres llevás, hasta 35.000." },
  { lugar:"nota", el:"#toolbar", titulo:"Herramientas",
    texto:"Negrita, títulos, listas, casillas y citas. Y a la derecha: agregar una foto, grabar un audio o dictar (hablás y se escribe solo)." },
  { lugar:"nota", el:"#edCuerpo .lista-check", titulo:"Casillas",
    texto:"Las notas también pueden tener casillas: tocá el cuadradito para tildar. Sí, hay chispitas." },
  { lugar:"nota", el: () => $("bnDeshacer")?.parentElement, titulo:"Deshacer y rehacer",
    texto:"¿Borraste algo sin querer? Volvé para atrás (o para adelante) con estas flechas." },
  { lugar:"nota", el: () => $("bnQR")?.parentElement, titulo:"QR y buscar",
    texto:"Con el QR pasás la nota a otro celular: lo escaneás con la cámara y listo. La lupa busca palabras dentro de la nota." },
  { lugar:"nota", el:"#bnGrabar", titulo:"Grabar sin salir",
    texto:"El botón rosa también está acá abajo: agendás en el calendario sin cerrar la nota." },
  { lugar:"nota", el:"#menuRico", titulo:"Todo lo demás, en ···",
    texto:"Fotos, archivos (PDF, TXT, DOCX), presentación con diapositivas, exportar a PDF o Word, fondo, fuente, tablas, efectos de texto y 25 plantillas.",
    antes: () => abrirMenuRico(vistaPrincipal()), despues: () => cerrarMenuRico() },
  { lugar:"nota", el:"#bnHerramientas", titulo:"Más espacio",
    texto:"Esta flechita esconde las herramientas para escribir tranquilo. Tocala de nuevo y vuelven." },
  { lugar:"nota", el:".ed-acciones", titulo:"Fijar y modo lectura",
    texto:"El alfiler deja la nota arriba de todo. El ojo es el modo lectura: sólo el texto, sin distracciones." },
  { id:"fin", grande:true, titulo: () => nombre() ? `¡Listo, ${nombre()}!` : "¡Listo!",
    texto:"Te dejé fijada la nota «Primeros pasos» para que pruebes todo. Si querés volver a ver esto, está en el menú ··· del panel → «Ver el tutorial»." },
];

/* ---------- La interfaz del tutorial ---------- */
let capa, foco, ventana, paso = 0, activo = false, objetivo = null, rafUbicar = 0;

function crearInterfaz(){
  capa = document.createElement("div");
  capa.className = "tuto-capa";
  foco = document.createElement("div");
  foco.className = "tuto-foco centro";
  ventana = document.createElement("div");
  ventana.className = "tuto-ventana";
  ventana.setAttribute("role", "dialog");
  ventana.setAttribute("aria-modal", "true");
  ventana.setAttribute("aria-labelledby", "tutoTitulo");
  ventana.innerHTML = `
    <div class="tuto-barra"><span>tutorial.exe</span><span class="tuto-cuenta" id="tutoCuenta"></span></div>
    <div class="tuto-cuerpo">
      <div class="tuto-cabeza">
        <span class="ojitos tuto-ojos" aria-hidden="true"><i></i><i></i></span>
        <h3 id="tutoTitulo"></h3>
      </div>
      <p id="tutoTexto" aria-live="polite"></p>
      <label class="tuto-nombre" id="tutoNombre" hidden>
        <span>¿Cómo te llamás? (opcional)</span>
        <input type="text" id="tutoInpNombre" placeholder="Tu nombre" autocomplete="given-name" maxlength="30">
      </label>
      <div class="tuto-progreso" aria-hidden="true"><i id="tutoBarra"></i></div>
      <div class="tuto-botones">
        <button class="tuto-saltear" id="tutoSaltear" type="button">Saltear</button>
        <button class="btn-sec" id="tutoAtras" type="button">← Atrás</button>
        <button class="btn-sec ancho tuto-siguiente" id="tutoSiguiente" type="button">Siguiente →</button>
      </div>
    </div>`;
  document.body.append(capa, foco, ventana);
  $("tutoSiguiente").onclick = () => avanzar(1);
  $("tutoAtras").onclick = () => avanzar(-1);
  $("tutoSaltear").onclick = () => terminar(true);
  $("tutoInpNombre").onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); avanzar(1); } };
}

function guardarNombre(){
  const n = $("tutoInpNombre").value.trim();
  if (n) escribir("llavero_nombre", n);
  else if (leer("llavero_nombre") === null) escribir("llavero_nombre", "");
  pintarSaludo();
}

async function avanzar(delta){
  const p = PASOS[paso];
  if (p.pedirNombre && delta > 0) guardarNombre();
  if (paso + delta >= PASOS.length){ terminar(false); return; }
  if (paso + delta < 0) return;
  await mostrar(paso + delta);
}

async function mostrar(n){
  const anterior = PASOS[paso];
  if (anterior && anterior.despues && n !== paso) anterior.despues();
  paso = n;
  const p = PASOS[paso];
  ventana.classList.add("cambiando");
  await prepararLugar(p.lugar);
  if (p.antes){ p.antes(); await espera(80); }

  const el = typeof p.el === "function" ? p.el() : p.el ? document.querySelector(p.el) : null;
  objetivo = visible(el) ? el : null;
  if (objetivo) objetivo.scrollIntoView({ block:"nearest", inline:"nearest" });

  // Texto de la ventanita
  const titulo = typeof p.titulo === "function" ? p.titulo() : p.titulo;
  $("tutoTitulo").textContent = titulo;
  $("tutoTexto").textContent = p.texto;
  $("tutoCuenta").textContent = `${paso + 1} / ${PASOS.length}`;
  $("tutoBarra").style.width = `${((paso + 1) / PASOS.length) * 100}%`;
  $("tutoAtras").hidden = paso === 0;
  $("tutoSaltear").hidden = paso === PASOS.length - 1;
  $("tutoSiguiente").textContent = paso === 0 ? "¡Dale!" : paso === PASOS.length - 1 ? "¡Empezar!" : "Siguiente →";
  $("tutoNombre").hidden = !p.pedirNombre;
  if (p.pedirNombre) $("tutoInpNombre").value = nombre();
  ventana.classList.toggle("grande", !!p.grande);
  const ojos = ventana.querySelector(".tuto-ojos");
  ojos.classList.toggle("grande", !!p.grande);
  ojos.classList.toggle("feliz", p.id === "fin");

  await cuadro();
  ubicar();
  ventana.classList.remove("cambiando");
  if (p.id === "fin"){
    const r = ventana.getBoundingClientRect();
    chispas(r.left + r.width / 2, r.top + 30, 16);
  }
  (p.pedirNombre ? $("tutoInpNombre") : $("tutoSiguiente")).focus({ preventScroll:true });
}

// Pone el foco (el agujero iluminado) sobre el botón y la ventanita al lado, sin taparlo
function ubicar(){
  rafUbicar = 0;
  if (!activo) return;
  const W = innerWidth, H = innerHeight, m = 14;
  const w = ventana.offsetWidth, h = ventana.offsetHeight;
  let x, y;
  if (!objetivo || !visible(objetivo)){
    foco.classList.add("centro");
    foco.style.left = W / 2 + "px"; foco.style.top = H / 2 + "px"; foco.style.width = foco.style.height = "0px";
    x = (W - w) / 2; y = (H - h) / 2;
  } else {
    const r = objetivo.getBoundingClientRect();
    const pad = objetivo.id === "menuRico" ? 3 : 7;
    foco.classList.remove("centro");
    foco.style.left = r.left - pad + "px"; foco.style.top = r.top - pad + "px";
    foco.style.width = r.width + pad * 2 + "px"; foco.style.height = r.height + pad * 2 + "px";
    if (esMovil()){
      x = (W - w) / 2;
      const abajo = r.bottom + m + 6, arriba = r.top - h - m - 6;
      y = (r.top + r.height / 2 > H / 2) ? (arriba >= 10 ? arriba : 10) : (abajo + h <= H - 10 ? abajo : H - h - 10);
    } else {
      const opciones = [
        { x: r.left, y: r.bottom + m, eje:"y" },        // abajo
        { x: r.left, y: r.top - h - m, eje:"y" },       // arriba
        { x: r.right + m, y: r.top, eje:"x" },          // a la derecha
        { x: r.left - w - m, y: r.top, eje:"x" },       // a la izquierda
      ];
      const entra = o => o.eje === "y" ? (o.y >= 10 && o.y + h <= H - 10) : (o.x >= 10 && o.x + w <= W - 10);
      const elegida = opciones.find(entra) || { x:(W - w) / 2, y:(H - h) / 2 };
      x = elegida.x; y = elegida.y;
    }
  }
  x = Math.max(10, Math.min(x, W - w - 10));
  y = Math.max(10, Math.min(y, H - h - 10));
  ventana.style.left = x + "px";
  ventana.style.top = y + "px";
}
const pedirUbicar = () => { if (!rafUbicar) rafUbicar = requestAnimationFrame(ubicar); };

function teclas(e){
  if (!activo) return;
  if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); terminar(true); }
  else if (e.key === "ArrowRight" && e.target.tagName !== "INPUT"){ e.preventDefault(); e.stopPropagation(); avanzar(1); }
  else if (e.key === "ArrowLeft" && e.target.tagName !== "INPUT"){ e.preventDefault(); e.stopPropagation(); avanzar(-1); }
  else if ((e.ctrlKey || e.metaKey) && ["k", "f"].includes(e.key.toLowerCase())){ e.stopPropagation(); e.preventDefault(); }
}

function terminar(salteado){
  const p = PASOS[paso];
  if (p && p.despues) p.despues();
  if (p && p.pedirNombre) guardarNombre();
  activo = false;
  escribir("llavero_tutorial", "visto");
  removeEventListener("resize", pedirUbicar);
  removeEventListener("keydown", teclas, true);
  document.removeEventListener("scroll", pedirUbicar, true);
  [capa, foco, ventana].forEach(el => el && el.remove());
  capa = foco = ventana = null;
  document.body.classList.remove("tutorial");
  if (salteado) avisar("Cuando quieras, el tutorial está en el menú ··· del panel", "", 4000);
  else { animo("feliz", 2200); avisar("¡A organizar el día! ✦", "ok"); }
}

export async function empezar(){
  if (activo) return;
  activo = true;
  cerrarMenu();
  cerrarMenuRico();
  if (!$("bienvenida").hidden) $("bienvenida").hidden = true;
  document.body.classList.add("tutorial");
  crearInterfaz();
  addEventListener("resize", pedirUbicar);
  addEventListener("keydown", teclas, true);
  document.addEventListener("scroll", pedirUbicar, true);
  paso = 0;
  await mostrar(0);
}
