/* ============================================================
   KYNUS — plantillas de notas
   Se cargan sólo cuando abrís "Plantillas" (no pesan al arrancar la app).
   Cada una arma el HTML de la nota; "hoy" sirve para poner la fecha.
   ============================================================ */

const h2 = t => `<h2>${t}</h2>`;
const p = t => `<p>${t}</p>`;
const lista = items => `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
const numerada = items => `<ol>${items.map(i => `<li>${i}</li>`).join("")}</ol>`;
const checks = items => `<ul class="lista-check">${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
const cita = t => `<blockquote>${t}</blockquote>`;
const tabla = (cabeza, filas) =>
  `<table class="tabla"><tbody><tr>${cabeza.map(c => `<td>${c}</td>`).join("")}</tr>` +
  filas.map(f => `<tr>${f.map(c => `<td>${c || "<br>"}</td>`).join("")}</tr>`).join("") + `</tbody></table><p><br></p>`;
const vacios = n => Array.from({ length: n }, () => "<br>");

const dia = hoy => hoy.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
const semana = hoy => {
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  return "semana del " + lunes.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
};
const mes = hoy => hoy.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

export const PLANTILLAS = [
  { id: "dia", titulo: "Plan del día", sub: "Prioridades, horarios y tareas",
    nombre: hoy => "Plan del " + dia(hoy),
    html: () => h2("✦ Lo más importante") + numerada(vacios(3)) +
      h2("Horarios") + tabla(["Hora", "Qué"], [["08:00", ""], ["10:00", ""], ["13:00", ""], ["16:00", ""], ["19:00", ""]]) +
      h2("Tareas") + checks(vacios(3)) + h2("Notas") + p("<br>") },

  { id: "semana", titulo: "Plan semanal", sub: "Objetivos y prioridades de la semana",
    nombre: hoy => "Plan de la " + semana(hoy),
    html: () => h2("✦ Objetivos de la semana") + checks(vacios(3)) +
      h2("Día por día") + tabla(["Día", "Foco", "Pendientes"], ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Fin de semana"].map(d => [d, "", ""])) +
      h2("No me olvido de") + lista(vacios(2)) },

  { id: "reunion", titulo: "Notas de reunión", sub: "Temario, decisiones y responsables",
    nombre: hoy => "Reunión · " + hoy.toLocaleDateString("es-AR"),
    html: () => p("<b>Participantes:</b> ") + p("<b>Objetivo:</b> ") +
      h2("Temario") + numerada(vacios(3)) + h2("Decisiones") + lista(vacios(2)) +
      h2("Próximos pasos") + tabla(["Tarea", "Quién", "Para cuándo"], [["", "", ""], ["", "", ""], ["", "", ""]]) },

  { id: "uno", titulo: "Charla uno a uno", sub: "Una conversación enfocada, con seguimiento",
    nombre: hoy => "Uno a uno · " + hoy.toLocaleDateString("es-AR"),
    html: () => h2("Cómo venimos") + p("<br>") + h2("Temas para hablar") + lista(vacios(3)) +
      h2("Lo que salió de la charla") + p("<br>") + h2("Seguimiento") + checks(vacios(2)) },

  { id: "brief", titulo: "Resumen de proyecto", sub: "Alcance, resultado y plan de trabajo",
    nombre: () => "Proyecto: ",
    html: () => h2("¿Qué problema resuelve?") + p("<br>") + h2("Resultado esperado") + p("<br>") +
      h2("Qué incluye y qué no") + tabla(["Incluye", "No incluye"], [["", ""], ["", ""]]) +
      h2("Plan") + numerada(["Investigar", "Diseñar", "Armar", "Probar", "Presentar"]) +
      h2("Riesgos") + lista(vacios(2)) },

  { id: "estado", titulo: "Estado del proyecto", sub: "Avance, bloqueos y próximos pasos",
    nombre: hoy => "Estado · " + hoy.toLocaleDateString("es-AR"),
    html: () => p("<b>Cómo va:</b> 🟢 bien · 🟡 con dudas · 🔴 trabado") +
      h2("Avances") + checks(vacios(3)) + h2("Bloqueos") + lista(vacios(2)) + h2("Próximos pasos") + checks(vacios(3)) },

  { id: "decisiones", titulo: "Registro de decisiones", sub: "El contexto y la decisión final",
    nombre: () => "Decisión: ",
    html: () => p("<b>Fecha:</b> " + new Date().toLocaleDateString("es-AR")) + h2("Contexto") + p("<br>") +
      h2("Opciones") + tabla(["Opción", "A favor", "En contra"], [["A", "", ""], ["B", "", ""], ["C", "", ""]]) +
      h2("Decisión") + cita("<br>") + h2("Por qué") + p("<br>") },

  { id: "ideas", titulo: "Lluvia de ideas", sub: "Generar y darle forma a buenas ideas",
    nombre: () => "Lluvia de ideas",
    html: () => p("<b>Pregunta:</b> ¿Cómo podríamos…?") + h2("✦ Todas las ideas (sin filtro)") + lista(vacios(6)) +
      h2("Las mejores 3") + numerada(vacios(3)) + h2("Próximo paso") + checks(vacios(1)) },

  { id: "investigacion", titulo: "Notas de investigación", sub: "Fuentes, hallazgos y preguntas abiertas",
    nombre: () => "Investigación: ",
    html: () => h2("Pregunta") + p("<br>") + h2("Fuentes") + numerada(vacios(3)) +
      h2("Hallazgos") + lista(vacios(3)) + h2("Preguntas abiertas") + lista(vacios(2)) },

  { id: "estudio", titulo: "Notas de estudio", sub: "Entender, recordar y repasar",
    nombre: () => "Estudio: ",
    html: () => h2("Tema") + p("<br>") + h2("Conceptos clave") + tabla(["Concepto", "En mis palabras"], [["", ""], ["", ""], ["", ""]]) +
      h2("Preguntas para repasar") + numerada(vacios(3)) + h2("Resumen en 3 líneas") + p("<br>") +
      h2("Repasos") + checks(["Hoy", "En 3 días", "En una semana"]) },

  { id: "clase", titulo: "Apuntes de clase", sub: "La clase ordenada, lista para repasar",
    nombre: hoy => "Clase · " + hoy.toLocaleDateString("es-AR"),
    html: () => p("<b>Materia:</b> ") + p("<b>Profe:</b> ") + h2("Lo que vimos") + lista(vacios(4)) +
      h2("Dudas para preguntar") + lista(vacios(2)) + h2("Tarea") + checks(vacios(2)) },

  { id: "lectura", titulo: "Notas de lectura", sub: "Ideas clave, citas y conclusiones",
    nombre: () => "Lectura: ",
    html: () => p("<b>Libro / texto:</b> ") + p("<b>Autor:</b> ") + h2("Ideas clave") + lista(vacios(3)) +
      h2("Citas que me gustaron") + cita("<br>") + h2("Qué me llevo") + p("<br>") },

  { id: "articulo", titulo: "Esquema de artículo", sub: "Una estructura clara, del gancho al final",
    nombre: () => "Artículo: ",
    html: () => h2("Gancho") + p("<br>") + h2("La idea principal") + p("<br>") +
      h2("Desarrollo") + numerada(vacios(3)) + h2("Ejemplos") + lista(vacios(2)) + h2("Cierre") + p("<br>") },

  { id: "contenido", titulo: "Calendario de contenido", sub: "Ideas para publicar y su producción",
    nombre: hoy => "Contenido · " + mes(hoy),
    html: () => tabla(["Fecha", "Idea", "Formato", "Estado"], [["", "", "Post", "Idea"], ["", "", "Video", "Grabando"], ["", "", "Historia", "Listo"], ["", "", "", ""]]) +
      h2("Ideas sueltas") + lista(vacios(3)) },

  { id: "habitos", titulo: "Seguimiento de hábitos", sub: "Un control simple de constancia diaria",
    nombre: hoy => "Hábitos · " + semana(hoy),
    html: () => p("Marcá con ✓ cada día que lo cumplas.") +
      tabla(["Hábito", "L", "M", "M", "J", "V", "S", "D"], [["Tomar agua", ...Array(7).fill("")], ["Leer 20 min", ...Array(7).fill("")], ["Moverme", ...Array(7).fill("")], ["Dormir 8 h", ...Array(7).fill("")]]) +
      h2("Cómo me fue") + p("<br>") },

  { id: "repaso-semana", titulo: "Repaso semanal", sub: "Logros, aprendizajes y foco de la próxima",
    nombre: hoy => "Repaso · " + semana(hoy),
    html: () => h2("✦ Logros") + lista(vacios(3)) + h2("Lo que aprendí") + lista(vacios(2)) +
      h2("Qué no salió") + lista(vacios(2)) + h2("Foco de la próxima semana") + checks(vacios(3)) },

  { id: "repaso-mes", titulo: "Repaso mensual", sub: "Mirar el avance y reordenar prioridades",
    nombre: hoy => "Repaso de " + mes(hoy),
    html: () => h2("El mes en una frase") + p("<br>") + h2("Avances") + lista(vacios(3)) +
      h2("Números") + tabla(["Qué", "Cuánto"], [["", ""], ["", ""]]) + h2("Prioridades del mes que viene") + numerada(vacios(3)) },

  { id: "diario", titulo: "Diario", sub: "Un lugar tranquilo para pensar",
    nombre: hoy => dia(hoy).replace(/^./, c => c.toUpperCase()),
    html: () => p("<b>Cómo me siento:</b> ☀️ 🌤️ ☁️ 🌧️") + h2("Hoy") + p("<br>") + h2("Algo que quiero recordar") + cita("<br>") },

  { id: "gratitud", titulo: "Diario de gratitud", sub: "Notar los momentos que importan",
    nombre: hoy => "Gracias · " + hoy.toLocaleDateString("es-AR"),
    html: () => h2("✦ Hoy agradezco") + numerada(vacios(3)) + h2("Un momento lindo del día") + p("<br>") + h2("Alguien que me ayudó") + p("<br>") },

  { id: "objetivo", titulo: "Plan de objetivo", sub: "Convertir una meta en pasos concretos",
    nombre: () => "Objetivo: ",
    html: () => h2("Meta") + cita("<br>") + h2("Por qué me importa") + p("<br>") +
      h2("Pasos") + checks(vacios(4)) + h2("Fecha límite") + p("<br>") + h2("Cómo sé que lo logré") + p("<br>") },

  { id: "viaje", titulo: "Plan de viaje", sub: "Itinerario y cosas para llevar",
    nombre: () => "Viaje a ",
    html: () => p("<b>Fechas:</b> ") + p("<b>Cómo llego:</b> ") + h2("Itinerario") + tabla(["Día", "Plan"], [["1", ""], ["2", ""], ["3", ""]]) +
      h2("Para llevar") + checks(["Documento", "Cargador", "Ropa", "Plata / tarjeta", "El llavero ✦"]) + h2("Lugares para ver") + lista(vacios(3)) },

  { id: "evento", titulo: "Plan de evento", sub: "Personas, logística y checklist",
    nombre: () => "Evento: ",
    html: () => p("<b>Fecha y hora:</b> ") + p("<b>Lugar:</b> ") + h2("Invitados") + lista(vacios(3)) +
      h2("Logística") + tabla(["Qué", "Quién", "Listo"], [["Comida", "", ""], ["Música", "", ""], ["Decoración", "", ""]]) +
      h2("Checklist") + checks(vacios(4)) },

  { id: "compras", titulo: "Lista de compras", sub: "Una lista ordenada por secciones",
    nombre: () => "Compras",
    html: () => h2("Verdulería") + checks(vacios(2)) + h2("Almacén") + checks(vacios(3)) + h2("Lácteos") + checks(vacios(2)) + h2("Limpieza") + checks(vacios(2)) },

  { id: "receta", titulo: "Receta", sub: "Ingredientes, pasos y notas",
    nombre: () => "Receta: ",
    html: () => p("<b>Porciones:</b> · <b>Tiempo:</b> ") + h2("Ingredientes") + checks(vacios(4)) +
      h2("Pasos") + numerada(vacios(4)) + h2("Notas") + p("<br>") },

  { id: "problema", titulo: "Resolver un problema", sub: "Definir, analizar y elegir una respuesta",
    nombre: () => "Problema: ",
    html: () => h2("1. ¿Cuál es el problema?") + p("<br>") + h2("2. ¿Por qué pasa?") + lista(vacios(3)) +
      h2("3. Posibles soluciones") + tabla(["Solución", "Ventajas", "Desventajas"], [["", "", ""], ["", "", ""]]) +
      h2("4. Elijo…") + cita("<br>") + h2("5. Primeros pasos") + checks(vacios(3)) },
];
