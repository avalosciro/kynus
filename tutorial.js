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

/* ---------- Movimiento: curvas de resorte ----------
   Se calcula un resorte amortiguado y se pasa a una curva CSS linear(…),
   así todo frena con un rebotecito chico en vez de pararse en seco.
   Sólo se animan transform/opacity (y el tamaño de la ventanita, que es chica),
   para que ande liviano en el celular. */
function resorte(amortiguacion){
  const w = 6.4 / amortiguacion, wd = w * Math.sqrt(1 - amortiguacion ** 2), k = amortiguacion * w / wd;
  const puntos = [];
  for (let i = 0; i <= 50; i++){
    const t = i / 50;
    puntos.push((1 - Math.exp(-amortiguacion * w * t) * (Math.cos(wd * t) + k * Math.sin(wd * t))).toFixed(3));
  }
  puntos[50] = "1";
  return `linear(${puntos.join(", ")})`;
}
const soportaLinear = typeof CSS !== "undefined" && CSS.supports("animation-timing-function", "linear(0, 1)");
const SUAVE  = soportaLinear ? resorte(0.74) : "cubic-bezier(.2,.9,.25,1.05)";   // para moverse
const REBOTE = soportaLinear ? resorte(0.52) : "cubic-bezier(.34,1.56,.64,1)";   // para aparecer
const SALIR  = "cubic-bezier(.4,0,1,1)";
const quieto = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ms = n => quieto() ? 0 : n;
const termino = a => a ? a.finished.catch(() => {}) : Promise.resolve();
const cortar = (el, id) => el.getAnimations().forEach(a => { if (!id || a.id === id) a.cancel(); });

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
let turno = 0, tam = null, pos = { x:0, y:0 };   // turno: si tocás rápido, sólo vale el último paso

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
  ventana.style.opacity = "0";   // aparece con un saltito cuando ya está en su lugar
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
  await mostrar(paso + delta, delta);
}

// Las partes del contenido que cambian de un paso al otro (entran y salen deslizándose)
const piezas = () => [ventana.querySelector(".tuto-cabeza"), $("tutoTexto"), $("tutoNombre")].filter(visible);

async function mostrar(n, dir = 1){
  const yo = ++turno;
  const anterior = PASOS[paso];
  if (anterior && anterior.despues && n !== paso) anterior.despues();
  paso = n;
  const p = PASOS[paso];
  const primera = !ventana.dataset.lista;

  // 1. Lo de antes se va para el costado (hacia atrás si avanzás, hacia adelante si volvés)
  const salida = primera ? [] : piezas().map(el => {
    cortar(el);
    return el.animate([{ opacity:1, transform:"none" }, { opacity:0, transform:`translateX(${-dir * 16}px)` }],
      { duration:ms(140), easing:SALIR, fill:"forwards" });
  });
  await Promise.all([prepararLugar(p.lugar), ...salida.map(termino)]);
  if (yo !== turno || !activo) return;
  if (p.antes){ p.antes(); await espera(80); if (yo !== turno || !activo) return; }

  const el = typeof p.el === "function" ? p.el() : p.el ? document.querySelector(p.el) : null;
  objetivo = visible(el) ? el : null;
  if (objetivo) objetivo.scrollIntoView({ block:"nearest", inline:"nearest" });
  await cuadro();
  if (yo !== turno || !activo) return;

  // 2. Tamaño de antes (tal cual se ve, aunque esté a mitad de una animación)
  const antes = ventana.getBoundingClientRect();
  cortar(ventana, "tam");
  const cuerpo = ventana.querySelector(".tuto-cuerpo");
  cuerpo.style.width = "";

  // 3. Texto nuevo
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

  // 4. La ventanita cambia de tamaño suave (el contenido ya queda con el ancho final, así no "baila")
  tam = { w: ventana.offsetWidth, h: ventana.offsetHeight };
  salida.forEach(a => a.cancel());
  if (!primera && (Math.abs(antes.width - tam.w) > 1 || Math.abs(antes.height - tam.h) > 1)){
    cuerpo.style.width = tam.w - 6 + "px";
    const a = ventana.animate([{ width:antes.width + "px", height:antes.height + "px" }, { width:tam.w + "px", height:tam.h + "px" }],
      { duration:ms(560), easing:SUAVE });
    a.id = "tam";
    a.finished.then(() => { cuerpo.style.width = ""; }, () => {});
  }

  // 5. Todo a su lugar: el foco viaja al botón y la ventanita lo sigue
  ubicar(!primera);

  // 6. Lo nuevo entra desde el otro costado, uno atrás del otro
  piezas().forEach((el, i) => el.animate(
    [{ opacity:0, transform:`translateX(${dir * 22}px)` }, { opacity:1, transform:"none" }],
    { duration:ms(520), delay:ms(70 + i * 45), easing:SUAVE, fill:"backwards" }));
  if (!primera) $("tutoCuenta").animate([{ opacity:0, transform:`translateY(${dir * -8}px)` }, { opacity:1, transform:"none" }],
    { duration:ms(380), easing:REBOTE });

  // 7. Los ojitos parpadean y miran el botón del que se habla
  ojos.querySelectorAll("i").forEach(i => i.animate([{ scale:"1 1" }, { scale:"1 .1", offset:.45 }, { scale:"1 1" }],
    { duration:ms(260), easing:"ease-in-out" }));
  mirar();

  if (primera){
    ventana.dataset.lista = "1";
    ventana.style.opacity = "";
    ventana.animate([{ opacity:0, scale:.86 }, { opacity:1, scale:1 }], { duration:ms(620), easing:REBOTE });
  }
  if (p.id === "fin") setTimeout(() => {
    if (!activo || !ventana) return;
    const r = ventana.getBoundingClientRect();
    chispas(r.left + r.width / 2, r.top + 30, 18);
  }, ms(260));
  (p.pedirNombre ? $("tutoInpNombre") : $("tutoSiguiente")).focus({ preventScroll:true });
}

// Los ojitos de la ventanita miran hacia el botón iluminado
function mirar(){
  const ojos = ventana.querySelector(".tuto-ojos");
  const max = ojos.classList.contains("grande") ? 10 : 3;
  let ox = 0, oy = 0;
  if (objetivo){
    const r = objetivo.getBoundingClientRect();
    const cx = pos.x + 3 + ojos.offsetLeft + ojos.offsetWidth / 2, cy = pos.y + 3 + ojos.offsetTop + ojos.offsetHeight / 2;
    const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy, d = Math.hypot(dx, dy) || 1;
    ox = dx / d * max; oy = dy / d * max * 0.7;
  }
  ojos.style.setProperty("--ox", ox.toFixed(1) + "px");
  ojos.style.setProperty("--oy", oy.toFixed(1) + "px");
}

// Pone el foco (el agujero iluminado) sobre el botón y la ventanita al lado, sin taparlo
function ubicar(animado = false){
  rafUbicar = 0;
  if (!activo) return;
  const W = innerWidth, H = innerHeight, m = 14;
  // Si la ventanita está cambiando de tamaño, se ubica según el tamaño final
  if (!animado && !ventana.getAnimations().some(a => a.id === "tam")) tam = { w: ventana.offsetWidth, h: ventana.offsetHeight };
  const w = tam ? tam.w : ventana.offsetWidth, h = tam ? tam.h : ventana.offsetHeight;
  const focoAntes = animado ? foco.getBoundingClientRect() : null;
  const radioAntes = animado ? getComputedStyle(foco).borderTopLeftRadius : null;
  let x, y, f;
  if (!objetivo || !visible(objetivo)){
    foco.classList.add("centro");
    f = { x: W / 2, y: H / 2, w: 0, h: 0, radio: "12px", forma: "round" };
    x = (W - w) / 2; y = (H - h) / 2;
  } else {
    const r = objetivo.getBoundingClientRect();
    const pad = objetivo.id === "menuRico" ? 3 : 7;
    foco.classList.remove("centro");
    // El foco copia las esquinas del botón (más el margen), así quedan concéntricas
    const radio = parseFloat(getComputedStyle(objetivo).borderTopLeftRadius) || 0;
    const pildora = radio >= r.height / 2 - 1;
    f = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2,
          radio: pildora ? "999px" : (radio ? radio + pad : pad + 4) + "px",
          forma: pildora || !radio ? "round" : "squircle" };
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
  x = Math.round(Math.max(10, Math.min(x, W - w - 10)));
  y = Math.round(Math.max(10, Math.min(y, H - h - 10)));

  // Foco: viaja con resorte desde donde está ahora (aunque esté a mitad de camino)
  cortar(foco, "mover");
  Object.assign(foco.style, { left: f.x + "px", top: f.y + "px", width: f.w + "px", height: f.h + "px", borderRadius: f.radio });
  foco.style.setProperty("corner-shape", f.forma);
  if (focoAntes){
    const a = foco.animate([
      { left: focoAntes.left + "px", top: focoAntes.top + "px", width: focoAntes.width + "px", height: focoAntes.height + "px", borderRadius: radioAntes },
      { left: f.x + "px", top: f.y + "px", width: f.w + "px", height: f.h + "px", borderRadius: f.radio },
    ], { duration: ms(640), easing: SUAVE });
    a.id = "mover";
  }

  // Ventanita: se mueve con transform (lo más liviano que hay)
  const desde = animado ? ventana.getBoundingClientRect() : null;
  cortar(ventana, "mover");
  pos = { x, y };
  ventana.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  if (desde && (Math.abs(desde.left - x) > 1 || Math.abs(desde.top - y) > 1)){
    const a = ventana.animate([
      { transform: `translate3d(${desde.left}px, ${desde.top}px, 0)` },
      { transform: `translate3d(${x}px, ${y}px, 0)` },
    ], { duration: ms(680), easing: SUAVE });
    a.id = "mover";
  }
}
// Al desplazar o cambiar el tamaño: si el foco iba en camino, cambia de rumbo suave en vez de saltar
const pedirUbicar = () => {
  if (rafUbicar || !foco) return;
  rafUbicar = requestAnimationFrame(() => ubicar(!!foco && foco.getAnimations().some(a => a.id === "mover")));
};

function teclas(e){
  if (!activo) return;
  if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); terminar(true); }
  else if (e.key === "ArrowRight" && e.target.tagName !== "INPUT"){ e.preventDefault(); e.stopPropagation(); avanzar(1); }
  else if (e.key === "ArrowLeft" && e.target.tagName !== "INPUT"){ e.preventDefault(); e.stopPropagation(); avanzar(-1); }
  else if ((e.ctrlKey || e.metaKey) && ["k", "f"].includes(e.key.toLowerCase())){ e.stopPropagation(); e.preventDefault(); }
}

function terminar(salteado){
  if (!activo) return;
  const p = PASOS[paso];
  if (p && p.despues) p.despues();
  if (p && p.pedirNombre) guardarNombre();
  activo = false;
  turno++;
  escribir("llavero_tutorial", "visto");
  removeEventListener("resize", pedirUbicar);
  removeEventListener("keydown", teclas, true);
  document.removeEventListener("scroll", pedirUbicar, true);
  // La ventanita se achica y el oscuro se va; recién después se borran
  const [c, f, v] = [capa, foco, ventana];
  capa = foco = ventana = null;
  c.remove();
  cortar(f, "mover"); cortar(v, "mover"); cortar(v, "tam");
  const fin = [
    v.animate([{ opacity:1, scale:1 }, { opacity:0, scale:.9 }], { duration:ms(190), easing:SALIR, fill:"forwards" }),
    f.animate([{ opacity:1 }, { opacity:0 }], { duration:ms(280), easing:"ease-out", fill:"forwards" }),
  ];
  Promise.all(fin.map(termino)).then(() => { f.remove(); v.remove(); });
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
  tam = null;
  foco.animate([{ opacity:0 }, { opacity:1 }], { duration:ms(320), easing:"ease-out" });
  await mostrar(0);
}
