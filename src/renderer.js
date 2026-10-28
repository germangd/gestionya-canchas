const vista = document.querySelector("#vista");
const titulo = document.querySelector("#titulo-fecha");
const panel = document.querySelector("#panel");
const formulario = document.querySelector("#formulario");

let snapshot = null;
let fecha = null;
let seccion = "mapa";

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function dinero(valor) {
  return pesos.format(valor || 0);
}

function moverFecha(dias) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const siguiente = new Date(anio, mes - 1, dia + dias);
  const m = String(siguiente.getMonth() + 1).padStart(2, "0");
  const d = String(siguiente.getDate()).padStart(2, "0");
  return `${siguiente.getFullYear()}-${m}-${d}`;
}

function tituloFecha(iso) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function el(tag, clase, texto) {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto != null) nodo.textContent = texto;
  return nodo;
}

async function cargar() {
  snapshot = await window.canchas.estado(fecha || undefined);
  fecha = fecha || snapshot.hoy;
  snapshot = await window.canchas.estado(fecha);
  pintar();
}

function pintar() {
  titulo.textContent = tituloFecha(fecha);
  vista.replaceChildren();
  if (seccion === "mapa") pintarMapa();
  if (seccion === "escuelita") pintarEscuelita();
  if (seccion === "resumen") pintarResumen();
}

function pintarMapa() {
  const wrap = el("div", "grilla-wrap");
  const tabla = document.createElement("table");
  const cabeza = document.createElement("tr");
  cabeza.append(el("th", "cancha", "Cancha"));
  for (const hora of snapshot.horas) cabeza.append(el("th", "", hora));
  tabla.append(cabeza);

  for (const cancha of snapshot.canchas) {
    const fila = document.createElement("tr");
    const nombre = el("th", "cancha");
    nombre.append(el("b", "", `${cancha.nombre}`), el("span", "", cancha.deporte));
    fila.append(nombre);
    for (const celda of cancha.celdas) {
      const td = el("td", "hora");
      const boton = el("button", `celda ${celda.estado}`);
      boton.type = "button";
      if (celda.estado === "libre") boton.append(el("span", "", "Libre"));
      if (celda.estado === "alquilada") {
        boton.append(el("span", "", celda.turno.cliente), el("small", "", celda.turno.pagado ? "Cobrado" : "Debe"));
      }
      if (celda.estado === "bloqueada") boton.append(el("span", "", "Bloqueada"), el("small", "", celda.bloqueadaPor.cancha));
      boton.addEventListener("click", () => abrirCelda(cancha, celda));
      td.append(boton);
      fila.append(td);
    }
    tabla.append(fila);
  }
  wrap.append(tabla);
  vista.append(wrap);
}

function abrirCelda(cancha, celda) {
  formulario.replaceChildren();
  if (celda.estado === "libre") formularioTurno(cancha, celda.hora);
  if (celda.estado === "alquilada") formularioAlquilada(celda.turno);
  if (celda.estado === "bloqueada") {
    formulario.append(
      el("h2", "", "Hora bloqueada"),
      el("p", "", `${cancha.nombre} ${cancha.deporte} no se puede alquilar a las ${celda.hora}. ${celda.bloqueadaPor.cancha} está alquilada a ${celda.bloqueadaPor.cliente}.`),
      acciones([boton("Cerrar", "secundario", () => panel.close())])
    );
  }
  panel.showModal();
}

function formularioTurno(cancha, hora) {
  const pelotaPrecio = 2000;
  formulario.append(
    el("h2", "", `${cancha.nombre} ${cancha.deporte}`),
    el("p", "", `${tituloFecha(fecha)} · ${hora}`)
  );
  const cliente = campo("Cliente", "text", "Nombre y apellido");
  const telefono = campo("Teléfono", "tel", "221 …");
  const pelota = document.createElement("label");
  pelota.className = "check";
  const check = document.createElement("input");
  check.type = "checkbox";
  pelota.append(check, document.createTextNode("Incluye pelota"));
  const metodo = document.createElement("select");
  for (const opcion of [
    ["efectivo", "Efectivo"],
    ["transferencia", "Transferencia"],
    ["tarjeta", "Tarjeta"],
  ]) {
    const item = document.createElement("option");
    item.value = opcion[0];
    item.textContent = opcion[1];
    metodo.append(item);
  }
  const monto = campo("Monto", "number", "");
  monto.querySelector("input").value = String(cancha.precio);
  check.addEventListener("change", () => {
    const input = monto.querySelector("input");
    input.value = String(cancha.precio + (check.checked ? pelotaPrecio : 0));
  });
  const fiado = document.createElement("label");
  fiado.className = "check";
  const fiadoCheck = document.createElement("input");
  fiadoCheck.type = "checkbox";
  fiado.append(fiadoCheck, document.createTextNode("Lo deja a cuenta"));
  const error = el("p", "error", "");
  const guardar = boton("Alquilar", "primario", async () => {
    guardar.disabled = true;
    const respuesta = await window.canchas.alquilar({
      canchaId: cancha.id,
      fecha,
      hora,
      cliente: cliente.querySelector("input").value,
      telefono: telefono.querySelector("input").value,
      pelota: check.checked,
      metodo: metodo.value,
      monto: Number(monto.querySelector("input").value),
      fiado: fiadoCheck.checked,
    });
    guardar.disabled = false;
    if (!respuesta.ok) {
      error.textContent = respuesta.error;
      return;
    }
    aplicar(respuesta.estado);
  });
  formulario.append(cliente, telefono, pelota, etiqueta("Cobro", metodo), monto, fiado, error, acciones([
    boton("Cancelar", "secundario", () => panel.close()),
    guardar,
  ]));
}

function formularioAlquilada(turno) {
  formulario.append(
    el("h2", "", turno.cliente),
    el("p", "", `${turno.cancha} · ${turno.hora}`),
    el("p", "", `${turno.telefono || "Sin teléfono"} · ${etiquetaMetodo(turno.metodo)} · ${dinero(turno.monto)}`),
    el("p", "", turno.pelota ? "Con pelota" : "Sin pelota"),
    el("p", turno.pagado ? "ok" : "deuda", turno.pagado ? "Cobrado" : "Pendiente de cobro")
  );
  const botones = [boton("Cerrar", "secundario", () => panel.close())];
  if (!turno.pagado) {
    botones.push(boton("Cobrar", "primario", async () => {
      const respuesta = await window.canchas.cobrarTurno(turno.id);
      if (respuesta.ok) aplicar(respuesta.estado);
    }));
  }
  botones.push(boton("Cancelar turno", "peligro", async () => {
    const respuesta = await window.canchas.cancelar(turno.id);
    if (respuesta.ok) aplicar(respuesta.estado);
  }));
  formulario.append(acciones(botones));
}

function pintarEscuelita() {
  vista.append(el("h2", "seccion-titulo", "Cuotas de la escuelita"));
  const lista = el("div", "lista");
  for (const alumno of snapshot.alumnos) {
    const fila = el("article", "alumno");
    fila.append(
      el("strong", "", alumno.nombre),
      el("span", "", dinero(alumno.cuota)),
      el("span", alumno.situacion === "Al día" ? "ok" : "deuda", alumno.situacion),
      el("span", "", `${alumno.profesor} · ${alumno.comision}%`)
    );
    const cobrar = boton("Cobrar cuota", "primario", async () => {
      const respuesta = await window.canchas.cobrarCuota(alumno.id, fecha);
      if (!respuesta.ok) {
        cobrar.textContent = respuesta.error;
        return;
      }
      aplicar(respuesta.estado);
    });
    if (alumno.situacion === "Al día" && alumno.mesesDeuda.length === 0) cobrar.disabled = true;
    fila.append(cobrar);
    lista.append(fila);
  }
  vista.append(lista);

  const alta = el("form", "alta");
  alta.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const datos = new FormData(alta);
    const respuesta = await window.canchas.agregarAlumno({
      nombre: datos.get("nombre"),
      cuota: Number(datos.get("cuota")),
      vence: Number(datos.get("vence")),
      profesor: datos.get("profesor"),
      comision: Number(datos.get("comision")),
    }, fecha);
    if (!respuesta.ok) return;
    aplicar(respuesta.estado);
  });
  alta.append(
    inputSuelto("nombre", "Nuevo alumno"),
    inputSuelto("cuota", "Cuota", "number"),
    inputSuelto("vence", "Vence", "number"),
    inputSuelto("profesor", "Profesor"),
    inputSuelto("comision", "%", "number"),
    boton("Agregar", "primario")
  );
  alta.querySelector("[name=comision]").value = "20";
  alta.querySelector("[name=vence]").value = "10";
  vista.append(alta);
}

function pintarResumen() {
  const resumen = snapshot.resumen;
  const cards = el("div", "cards");
  for (const item of [
    ["Alquileres", resumen.alquileres],
    ["Cuotas", resumen.cuotas],
    ["Deudas", resumen.deudas],
    ["Comisiones", resumen.comisiones],
  ]) {
    const card = el("article", "card");
    card.append(el("span", "", item[0]), el("strong", "", dinero(item[1])));
    cards.append(card);
  }
  vista.append(cards);
  vista.append(el("h2", "seccion-titulo", "Movimientos del día"));
  const lista = el("div", "lista");
  if (resumen.turnos.length === 0 && resumen.cuotasDetalle.length === 0) {
    lista.append(el("p", "vacio", "Este día todavía no tiene alquileres ni cuotas cobradas."));
  }
  for (const turno of resumen.turnos) {
    const fila = el("article", "fila");
    fila.append(
      el("strong", "", `${turno.hora} · ${turno.cliente}`),
      el("span", "", turno.cancha),
      el("span", turno.pagado ? "ok" : "deuda", `${dinero(turno.monto)} · ${turno.pagado ? "cobrado" : "a cuenta"}`)
    );
    lista.append(fila);
  }
  for (const cuota of resumen.cuotasDetalle) {
    const fila = el("article", "fila");
    fila.append(
      el("strong", "", cuota.alumno),
      el("span", "", `Cuota ${cuota.mes}`),
      el("span", "ok", `${dinero(cuota.monto)} · comisión ${dinero(cuota.comision)}`)
    );
    lista.append(fila);
  }
  vista.append(lista);
  if (resumen.deudasCuotas.length || resumen.deudasTurnos.length) {
    vista.append(el("h2", "seccion-titulo", "Lo que todavía se debe"));
    const deudas = el("div", "lista");
    for (const turno of resumen.deudasTurnos) {
      deudas.append(el("p", "fila", `${turno.fecha} ${turno.hora} · ${turno.cliente} · ${dinero(turno.monto)}`));
    }
    for (const cuota of resumen.deudasCuotas) {
      deudas.append(el("p", "fila", `${cuota.alumno} · cuota ${cuota.mes} · ${dinero(cuota.monto)}`));
    }
    vista.append(deudas);
  }
}

function aplicar(estado) {
  snapshot = estado;
  fecha = estado.fecha;
  panel.close();
  pintar();
}

function campo(texto, tipo, placeholder) {
  const label = el("label", "", texto);
  const input = document.createElement("input");
  input.type = tipo;
  input.placeholder = placeholder;
  if (tipo === "number") input.min = "1";
  label.append(input);
  return label;
}

function etiqueta(texto, control) {
  const label = el("label", "", texto);
  label.append(control);
  return label;
}

function inputSuelto(nombre, placeholder, tipo = "text") {
  const input = document.createElement("input");
  input.name = nombre;
  input.placeholder = placeholder;
  input.type = tipo;
  input.required = true;
  if (tipo === "number") input.min = "1";
  return input;
}

function boton(texto, clase, accion) {
  const nodo = el("button", clase, texto);
  nodo.type = accion ? "button" : "submit";
  if (accion) nodo.addEventListener("click", accion);
  return nodo;
}

function acciones(botones) {
  const fila = el("div", "fila-form");
  fila.append(...botones);
  return fila;
}

function etiquetaMetodo(metodo) {
  return { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" }[metodo] || metodo;
}

document.querySelectorAll("nav button").forEach((botonNav) => {
  botonNav.addEventListener("click", () => {
    seccion = botonNav.dataset.vista;
    document.querySelectorAll("nav button").forEach((item) => item.classList.toggle("activo", item === botonNav));
    pintar();
  });
});

document.querySelector("#anterior").addEventListener("click", async () => {
  fecha = moverFecha(-1);
  await cargar();
});
document.querySelector("#siguiente").addEventListener("click", async () => {
  fecha = moverFecha(1);
  await cargar();
});
document.querySelector("#hoy").addEventListener("click", async () => {
  fecha = snapshot.hoy;
  await cargar();
});

cargar();
