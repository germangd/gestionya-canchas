const lienzo = document.querySelector(".lienzo");
const panel = document.querySelector(".panel");
const app = document.querySelector(".app");

let snapshot = null;
let fecha = null;
let hora = "18:00";
let seccion = "canchas";
let seleccionId = null;
let canchaEditId = null;
let accesorioEditId = null;

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const metodos = [
  ["efectivo", "Efectivo"],
  ["transferencia", "Transferencia"],
  ["tarjeta", "Tarjeta"],
];

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

function fechaCorta(iso) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

function el(tag, clase, texto) {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto != null) nodo.textContent = texto;
  return nodo;
}

function boton(texto, clase, atributos = {}) {
  const nodo = el("button", clase, texto);
  nodo.type = "button";
  for (const [clave, valor] of Object.entries(atributos)) nodo.dataset[clave] = valor;
  return nodo;
}

function opcion(valor, texto, seleccionado) {
  const nodo = document.createElement("option");
  nodo.value = valor;
  nodo.textContent = texto;
  nodo.selected = Boolean(seleccionado);
  return nodo;
}

function canchaSeleccionada() {
  return snapshot.canchas.find((item) => item.id === seleccionId) || null;
}

function celdaDe(cancha) {
  return cancha.celdas.find((item) => item.hora === hora) || { estado: "libre", hora };
}

function esGrande(cancha) {
  return snapshot.canchas.some((otra) => otra.dentroDe === cancha.id);
}

function textoEstado(estado) {
  if (estado === "alquilada") return "Alquilada";
  if (estado === "bloqueada") return "Bloqueada";
  return "Libre";
}

function etiquetaMetodo(metodo) {
  return { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" }[metodo] || metodo;
}

function comisionDe(precio) {
  return Math.round(precio * (Number(snapshot.comisionDirectiva) || 0) / 100);
}

function grupos(canchas) {
  const usadas = new Set();
  const lista = [];
  const grandes = canchas.filter((cancha) => canchas.some((otra) => otra.dentroDe === cancha.id));
  for (const grande of grandes) {
    const chicas = canchas.filter((cancha) => cancha.dentroDe === grande.id);
    lista.push({ titulo: "Cancha grande", canchas: [grande, ...chicas] });
    usadas.add(grande.id);
    for (const chica of chicas) usadas.add(chica.id);
  }
  const porEspacio = new Map();
  for (const cancha of canchas) {
    if (usadas.has(cancha.id) || !cancha.espacioId) continue;
    if (!porEspacio.has(cancha.espacioId)) porEspacio.set(cancha.espacioId, []);
    porEspacio.get(cancha.espacioId).push(cancha);
  }
  for (const grupo of porEspacio.values()) {
    if (grupo.length < 2) continue;
    lista.push({ titulo: "Misma cancha", canchas: grupo });
    for (const cancha of grupo) usadas.add(cancha.id);
  }
  const sueltas = canchas.filter((cancha) => !usadas.has(cancha.id));
  if (sueltas.length) lista.push({ titulo: "Canchas", canchas: sueltas });
  return lista;
}

function barraFecha() {
  const barra = el("div", "fecha");
  const linea = el("span");
  const anterior = boton("←", "", { fecha: "-1" });
  const siguiente = boton("→", "", { fecha: "1" });
  anterior.setAttribute("aria-label", "Día anterior");
  siguiente.setAttribute("aria-label", "Día siguiente");
  linea.append(anterior, document.createTextNode(` ${fechaCorta(fecha)} `), siguiente, boton("Hoy", "", { fecha: "hoy" }));
  barra.append(el("small", "", "Fecha"), linea);
  return barra;
}

function cabecera(cancha, estado) {
  const cabeza = el("header");
  const texto = el("div");
  texto.append(el("h2", "", cancha.nombre), el("p", "", `${cancha.deporte} · ${dinero(cancha.precio)} · ${hora}`));
  cabeza.append(texto, el("span", estado === "libre" ? "badge" : `badge ${estado}`, textoEstado(estado)));
  return cabeza;
}

function filaHoras() {
  const fila = el("div", "horas");
  for (const item of snapshot.horas) {
    const nodo = boton(item, item === hora ? "hora activa" : "hora", { hora: item });
    nodo.setAttribute("aria-pressed", item === hora ? "true" : "false");
    fila.append(nodo);
  }
  return fila;
}

function leyenda() {
  const nodo = el("div", "leyenda");
  for (const item of [
    ["libre", "Libre"],
    ["alquilada", "Alquilada"],
    ["bloqueada", "Bloqueada por superposición"],
  ]) {
    const texto = el("span");
    const punto = el("i", `punto ${item[0]}`);
    punto.setAttribute("aria-hidden", "true");
    texto.append(punto, document.createTextNode(` ${item[1]}`));
    nodo.append(texto);
  }
  return nodo;
}

async function cargar() {
  snapshot = await window.canchas.estado(fecha || undefined);
  fecha = snapshot.fecha;
  if (!snapshot.horas.includes(hora)) hora = snapshot.horas.includes("18:00") ? "18:00" : snapshot.horas[0];
  pintar();
}

function aplicar(estado) {
  snapshot = estado;
  fecha = estado.fecha;
  pintar();
}

function pintar() {
  document.querySelectorAll(".nav-btn").forEach((item) => {
    item.classList.toggle("activo", item.dataset.vista === seccion);
  });
  app.dataset.vista = seccion;
  lienzo.replaceChildren();
  if (seccion === "canchas") {
    if (!panel.isConnected) app.append(panel);
    pintarCanchas();
    pintarPanel();
    return;
  }
  panel.remove();
  if (seccion === "alquileres") pintarAlquileres();
  if (seccion === "clientes") pintarClientes();
  if (seccion === "escuelita") pintarEscuelita();
  if (seccion === "resumen") pintarResumen();
  if (seccion === "config") pintarConfig();
}

function pintarCanchas() {
  lienzo.append(barraFecha(), filaHoras(), leyenda());
  const mapa = el("div", "mapa");
  for (const grupo of grupos(snapshot.canchas)) {
    const caja = el("section", "grupo");
    caja.append(el("h2", "", grupo.titulo));
    for (const cancha of grupo.canchas) {
      const celda = celdaDe(cancha);
      const clases = ["cancha-card"];
      if (esGrande(cancha)) clases.push("grande");
      if (celda.estado === "alquilada") clases.push("alquilada");
      if (celda.estado === "bloqueada") clases.push("bloqueada");
      if (cancha.id === seleccionId) clases.push("seleccionada");
      const tarjeta = boton("", clases.join(" "), { id: cancha.id });
      tarjeta.append(el("strong", "", cancha.nombre), el("span", "", textoEstado(celda.estado)));
      caja.append(tarjeta);
    }
    mapa.append(caja);
  }
  lienzo.append(mapa);
}

function pintarPanel() {
  panel.replaceChildren();
  const cancha = canchaSeleccionada();
  if (!cancha) {
    panel.append(el("h2", "", "Alquiler"), el("p", "", "Elegí una cancha del mapa."));
    return;
  }
  const celda = celdaDe(cancha);
  panel.append(cabecera(cancha, celda.estado));
  if (celda.estado === "libre") formularioLibre(cancha);
  if (celda.estado === "alquilada") formularioAlquilada(celda.turno);
  if (celda.estado === "bloqueada") formularioBloqueada(celda);
}

function formularioLibre(cancha) {
  const busqueda = el("label", "", "Cliente");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Buscar por nombre o teléfono";
  input.autocomplete = "off";
  busqueda.append(input);
  const sugerencias = el("div");
  input.addEventListener("input", () => {
    delete input.dataset.clienteId;
    pintarSugerencias(sugerencias, input);
  });
  input.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    panel.querySelector(".registrar")?.click();
  });

  const lista = el("div");
  lista.append(el("h3", "", "Accesorios"));
  for (const accesorio of snapshot.accesorios) {
    const fila = el("label", "accesorio");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.value = accesorio.id;
    check.dataset.precio = String(accesorio.precio);
    fila.append(check, el("span", "", accesorio.nombre), el("b", "", dinero(accesorio.precio)));
    lista.append(fila);
  }

  const cuenta = el("div", "subtotal");
  const extra = el("span", "", `Cancha ${dinero(cancha.precio)} + accesorios ${dinero(0)}`);
  extra.dataset.extra = "1";
  const total = el("strong", "", dinero(cancha.precio));
  total.dataset.total = "1";
  const nota = el("span", "comision", `Comisión directiva (${snapshot.comisionDirectiva}% solo de la cancha)`);
  const comision = el("strong", "", dinero(comisionDe(cancha.precio)));
  comision.dataset.comision = "1";
  cuenta.append(extra, total, nota, comision);
  const medio = el("label", "", "Medio de pago");
  const select = document.createElement("select");
  for (const item of metodos) select.append(opcion(item[0], item[1]));
  medio.append(select);
  const error = el("strong", "deuda", "");
  const registrar = boton("Registrar alquiler", "registrar");
  registrar.addEventListener("click", () => registrarAlquiler(cancha, input, select, error, registrar));
  panel.append(busqueda, sugerencias, lista, cuenta, medio, error, registrar);
}

function pintarSugerencias(contenedor, input) {
  contenedor.replaceChildren();
  const q = input.value.trim().toLowerCase();
  if (!q) return;
  const coincidencias = snapshot.clientes.filter((item) =>
    item.nombre.toLowerCase().includes(q) || (item.telefono || "").toLowerCase().includes(q)
  ).slice(0, 8);
  for (const cliente of coincidencias) {
    const item = boton(`${cliente.nombre}${cliente.telefono ? ` · ${cliente.telefono}` : ""}`);
    item.addEventListener("click", () => {
      input.value = cliente.nombre;
      input.dataset.clienteId = cliente.id;
      contenedor.replaceChildren();
    });
    contenedor.append(item);
  }
}

function accesoriosMarcados() {
  return [...panel.querySelectorAll(".accesorio input:checked")].map((input) => input.value);
}

function actualizarCuenta() {
  const cancha = canchaSeleccionada();
  if (!cancha || !panel.querySelector("[data-total]")) return;
  const extra = [...panel.querySelectorAll(".accesorio input:checked")]
    .reduce((suma, input) => suma + Number(input.dataset.precio), 0);
  panel.querySelector("[data-extra]").textContent = `Cancha ${dinero(cancha.precio)} + accesorios ${dinero(extra)}`;
  panel.querySelector("[data-total]").textContent = dinero(cancha.precio + extra);
  panel.querySelector("[data-comision]").textContent = dinero(comisionDe(cancha.precio));
}

async function registrarAlquiler(cancha, input, select, error, registrar) {
  const escrito = input.value.trim();
  const elegido = snapshot.clientes.find((item) => item.id === input.dataset.clienteId);
  registrar.disabled = true;
  const respuesta = await window.canchas.alquilar({
    canchaId: cancha.id,
    fecha,
    hora,
    cliente: escrito,
    clienteId: elegido && elegido.nombre === escrito ? elegido.id : undefined,
    accesorios: accesoriosMarcados(),
    metodo: select.value,
  });
  registrar.disabled = false;
  if (!respuesta.ok) {
    error.textContent = respuesta.error;
    return;
  }
  aplicar(respuesta.estado);
}

function textoAccesorios(turno) {
  const lista = turno.accesorios || [];
  if (!lista.length) return "Sin accesorios";
  return lista.map((item) => `${item.nombre} (${dinero(item.precio)})`).join(", ");
}

function formularioAlquilada(turno) {
  panel.append(
    el("p", "", turno.cliente),
    el("p", "", turno.telefono || "Sin teléfono"),
    el("p", "", textoAccesorios(turno)),
    el("p", "", dinero(turno.monto)),
    el("p", "", `${etiquetaMetodo(turno.metodo)} · ${turno.pagado ? "Cobrado" : "Pendiente de cobro"}`)
  );
  if (!turno.pagado) panel.append(boton("Cobrar", "primario", { cobrarTurno: turno.id }));
  panel.append(boton("Cancelar turno", "peligro", { cancelarTurno: turno.id }));
}

function formularioBloqueada(celda) {
  const motivo = celda.bloqueadaPor;
  const detalle = motivo.cliente
    ? `${motivo.cancha} está alquilada a ${motivo.cliente}.`
    : `Está bloqueada por ${motivo.cancha}.`;
  panel.append(el("strong", "deuda", `No se puede registrar. ${detalle}`));
}

function tablaDe(filas) {
  const tabla = el("div", "tabla");
  if (!filas.length) tabla.append(el("p", "fila", "Nada para mostrar en este día."));
  for (const fila of filas) tabla.append(fila);
  return tabla;
}

function pintarAlquileres() {
  lienzo.append(barraFecha(), el("h2", "", "Alquileres del día"));
  const filas = snapshot.resumen.turnos.map((turno) => {
    const fila = el("div", "fila");
    fila.append(
      el("strong", "", `${turno.hora} · ${turno.cliente}`),
      el("span", "", turno.cancha),
      el("span", "", turno.telefono || "Sin teléfono"),
      el("span", "", textoAccesorios(turno)),
      el("span", "", `${dinero(turno.monto)} · ${turno.pagado ? "Cobrado" : "Pendiente de cobro"}`),
      el("span", "", `Comisión directiva ${dinero(turno.comision)}`)
    );
    return fila;
  });
  lienzo.append(tablaDe(filas));
}

function pintarClientes() {
  lienzo.append(el("h2", "", "Clientes"));
  const filas = snapshot.clientes.map((cliente) => {
    const fila = el("div", "fila");
    fila.append(el("strong", "", cliente.nombre), el("span", "", cliente.telefono || "Sin teléfono"));
    return fila;
  });
  if (!filas.length) {
    lienzo.append(el("p", "", "Todavía no hay clientes."));
    return;
  }
  lienzo.append(tablaDe(filas));
}

function pintarEscuelita() {
  lienzo.append(barraFecha(), el("h2", "", "Cuotas de la escuelita"));
  const filas = snapshot.alumnos.map((alumno) => {
    const fila = el("article", "fila");
    fila.append(
      el("strong", "", alumno.nombre),
      el("span", "", dinero(alumno.cuota)),
      el("span", "", alumno.situacion),
      el("span", "", `${alumno.profesor} · ${alumno.comision}%`)
    );
    if (alumno.mesesDeuda.length) fila.append(el("span", "", `Debe ${dinero(alumno.deuda)}`));
    const cobrar = boton("Cobrar cuota", "primario", { cobrarCuota: alumno.id });
    if (alumno.situacion === "Al día" && alumno.mesesDeuda.length === 0) cobrar.disabled = true;
    fila.append(cobrar);
    return fila;
  });
  lienzo.append(tablaDe(filas));

  const alta = document.createElement("form");
  alta.id = "form-alumno";
  alta.append(
    campo("nombre", "Nuevo alumno"),
    campo("cuota", "Cuota", "number"),
    campo("vence", "Vence", "number"),
    campo("profesor", "Profesor"),
    campo("comision", "Comisión %", "number"),
    submit("Agregar"),
    el("p", "error deuda", "")
  );
  alta.className = "tabla";
  alta.querySelector("[name=comision]").value = "20";
  alta.querySelector("[name=vence]").value = "10";
  lienzo.append(alta);
}

function pintarResumen() {
  const resumen = snapshot.resumen;
  lienzo.append(barraFecha(), el("h2", "", "Resumen del día"));
  const totales = el("div", "tabla");
  for (const item of [
    ["Alquileres", resumen.alquileres],
    ["Cuotas", resumen.cuotas],
    ["Deudas", resumen.deudas],
    ["Comisiones", resumen.comisiones],
  ]) {
    const fila = el("div", "fila");
    fila.append(el("span", "", item[0]), el("strong", "", dinero(item[1])));
    totales.append(fila);
  }
  lienzo.append(totales, el("h2", "", "Movimientos del día"));
  const filas = [];
  for (const turno of resumen.turnos) {
    const fila = el("div", "fila");
    fila.append(
      el("strong", "", `${turno.hora} · ${turno.cliente}`),
      el("span", "", turno.cancha),
      el("span", "", `${dinero(turno.monto)} · ${turno.pagado ? "cobrado" : "a cuenta"}`)
    );
    filas.push(fila);
  }
  for (const cuota of resumen.cuotasDetalle) {
    const fila = el("div", "fila");
    fila.append(
      el("strong", "", cuota.alumno),
      el("span", "", `Cuota ${cuota.mes}`),
      el("span", "", `${dinero(cuota.monto)} · comisión ${dinero(cuota.comision)}`)
    );
    filas.push(fila);
  }
  lienzo.append(tablaDe(filas));
  if (resumen.deudasCuotas.length || resumen.deudasTurnos.length) {
    lienzo.append(el("h2", "", "Lo que todavía se debe"));
    const deudas = el("div", "tabla");
    for (const turno of resumen.deudasTurnos) {
      deudas.append(el("p", "fila", `${turno.fecha} ${turno.hora} · ${turno.cliente} · ${dinero(turno.monto)}`));
    }
    for (const cuota of resumen.deudasCuotas) {
      deudas.append(el("p", "fila", `${cuota.alumno} · cuota ${cuota.mes} · ${dinero(cuota.monto)}`));
    }
    lienzo.append(deudas);
  }
}

function pintarConfig() {
  const raiz = el("section", "config");
  raiz.append(el("h2", "", "Canchas"));
  const formCancha = document.createElement("form");
  formCancha.id = "form-cancha";
  if (canchaEditId) formCancha.dataset.id = canchaEditId;
  const editada = snapshot.canchas.find((item) => item.id === canchaEditId) || null;
  formCancha.append(
    campo("nombre", "Nombre"),
    campo("deporte", "Deporte"),
    campo("precio", "Precio", "number"),
    selectCanchas("dentroDe", "Dentro de qué cancha grande", editada, "dentro"),
    selectCanchas("compartirCon", "Espacio compartido con", editada, "espacio"),
    submit(editada ? "Guardar cancha" : "Agregar cancha"),
    boton("Nueva cancha", "", { limpiarCancha: "1" }),
    el("p", "error deuda", "")
  );
  if (editada) {
    formCancha.nombre.value = editada.nombre;
    formCancha.deporte.value = editada.deporte;
    formCancha.precio.value = String(editada.precio);
  }
  raiz.append(formCancha);

  const lista = el("div", "tabla");
  for (const cancha of snapshot.canchas) {
    const fila = el("div", "fila");
    fila.append(
      el("strong", "", cancha.nombre),
      el("span", "", `${cancha.deporte} · ${dinero(cancha.precio)}`),
      el("span", "", relacionDe(cancha)),
      boton("Editar", "", { editarCancha: cancha.id })
    );
    lista.append(fila);
  }
  raiz.append(lista, el("h2", "", "Accesorios"));

  const formAccesorio = document.createElement("form");
  formAccesorio.id = "form-accesorio";
  if (accesorioEditId) formAccesorio.dataset.id = accesorioEditId;
  const accesorio = snapshot.accesorios.find((item) => item.id === accesorioEditId) || null;
  formAccesorio.append(
    campo("nombre", "Nombre"),
    campo("precio", "Precio", "number"),
    submit(accesorio ? "Guardar accesorio" : "Agregar accesorio"),
    boton("Nuevo accesorio", "", { limpiarAccesorio: "1" }),
    el("p", "error deuda", "")
  );
  if (accesorio) {
    formAccesorio.nombre.value = accesorio.nombre;
    formAccesorio.precio.value = String(accesorio.precio);
  }
  raiz.append(formAccesorio);
  const accesorios = el("div", "tabla");
  for (const item of snapshot.accesorios) {
    const fila = el("div", "fila");
    fila.append(
      el("strong", "", item.nombre),
      el("span", "", dinero(item.precio)),
      boton("Editar", "", { editarAccesorio: item.id })
    );
    accesorios.append(fila);
  }
  raiz.append(accesorios, el("h2", "", "Comisión directiva"));

  const formComision = document.createElement("form");
  formComision.id = "form-comision";
  const porcentaje = campo("porcentaje", "Porcentaje", "number");
  porcentaje.querySelector("input").min = "0";
  porcentaje.querySelector("input").max = "100";
  porcentaje.querySelector("input").step = "any";
  porcentaje.querySelector("input").value = String(snapshot.comisionDirectiva);
  formComision.append(porcentaje, submit("Guardar comisión"), el("p", "error deuda", ""));
  raiz.append(
    formComision,
    el("p", "", "Se calcula solo sobre el precio de la cancha. Los accesorios no entran.")
  );
  lienzo.append(raiz);
}

function relacionDe(cancha) {
  const partes = [];
  const grande = snapshot.canchas.find((item) => item.id === cancha.dentroDe);
  if (grande) partes.push(`Dentro de ${grande.nombre}`);
  const companeras = snapshot.canchas.filter((item) => item.id !== cancha.id && cancha.espacioId && item.espacioId === cancha.espacioId);
  if (companeras.length) partes.push(`Comparte con ${companeras.map((item) => item.nombre).join(", ")}`);
  return partes.join(" · ") || "Sin superposición";
}

function selectCanchas(nombre, etiqueta, editada, modo) {
  const label = el("label", "", etiqueta);
  const select = document.createElement("select");
  select.name = nombre;
  const contiene = editada ? snapshot.canchas.some((item) => item.dentroDe === editada.id) : false;
  select.append(opcion("", modo === "dentro" ? "Ninguna" : "No comparte"));
  if (!(modo === "dentro" && contiene)) {
    for (const cancha of snapshot.canchas) {
      if (editada && cancha.id === editada.id) continue;
      if (modo === "dentro" && cancha.dentroDe) continue;
      select.append(opcion(cancha.id, cancha.nombre));
    }
  }
  if (editada && modo === "dentro") select.value = editada.dentroDe || "";
  if (editada && modo === "espacio") {
    const companera = snapshot.canchas.find((item) => item.id !== editada.id && editada.espacioId && item.espacioId === editada.espacioId);
    select.value = companera?.id || "";
  }
  label.append(select);
  return label;
}

function campo(nombre, placeholder, tipo = "text") {
  const label = el("label", "", placeholder);
  const input = document.createElement("input");
  input.name = nombre;
  input.placeholder = placeholder;
  input.type = tipo;
  input.required = true;
  if (tipo === "number") input.min = "1";
  label.append(input);
  return label;
}

function submit(texto) {
  const nodo = el("button", "", texto);
  nodo.type = "submit";
  return nodo;
}

function mostrarError(form, texto) {
  const error = form.querySelector(".error");
  if (error) error.textContent = texto;
}

app.addEventListener("click", async (evento) => {
  const nav = evento.target.closest(".nav-btn");
  if (nav) {
    seccion = nav.dataset.vista;
    pintar();
    return;
  }
  const fechaBtn = evento.target.closest("[data-fecha]");
  if (fechaBtn) {
    fecha = fechaBtn.dataset.fecha === "hoy" ? snapshot.hoy : moverFecha(Number(fechaBtn.dataset.fecha));
    await cargar();
    return;
  }
  const horaBtn = evento.target.closest(".hora");
  if (horaBtn) {
    hora = horaBtn.dataset.hora;
    pintar();
    return;
  }
  const tarjeta = evento.target.closest(".cancha-card");
  if (tarjeta) {
    seleccionId = tarjeta.dataset.id;
    pintar();
    return;
  }
  const cobrarTurno = evento.target.closest("[data-cobrar-turno]");
  if (cobrarTurno) {
    const respuesta = await window.canchas.cobrarTurno(cobrarTurno.dataset.cobrarTurno);
    if (respuesta.ok) aplicar(respuesta.estado);
    return;
  }
  const cancelar = evento.target.closest("[data-cancelar-turno]");
  if (cancelar) {
    const respuesta = await window.canchas.cancelar(cancelar.dataset.cancelarTurno);
    if (respuesta.ok) aplicar(respuesta.estado);
    return;
  }
  const cobrarCuota = evento.target.closest("[data-cobrar-cuota]");
  if (cobrarCuota) {
    const respuesta = await window.canchas.cobrarCuota(cobrarCuota.dataset.cobrarCuota, fecha);
    if (!respuesta.ok) {
      cobrarCuota.textContent = respuesta.error;
      return;
    }
    aplicar(respuesta.estado);
    return;
  }
  const editarCancha = evento.target.closest("[data-editar-cancha]");
  if (editarCancha) {
    canchaEditId = editarCancha.dataset.editarCancha;
    seccion = "config";
    pintar();
    return;
  }
  const editarAccesorio = evento.target.closest("[data-editar-accesorio]");
  if (editarAccesorio) {
    accesorioEditId = editarAccesorio.dataset.editarAccesorio;
    seccion = "config";
    pintar();
    return;
  }
  if (evento.target.closest("[data-limpiar-cancha]")) {
    canchaEditId = null;
    pintar();
    return;
  }
  if (evento.target.closest("[data-limpiar-accesorio]")) {
    accesorioEditId = null;
    pintar();
  }
});

app.addEventListener("change", (evento) => {
  if (evento.target.closest(".accesorio")) actualizarCuenta();
});

app.addEventListener("submit", async (evento) => {
  const form = evento.target;
  if (!(form instanceof HTMLFormElement)) return;
  evento.preventDefault();
  const datos = new FormData(form);
  if (form.id === "form-cancha") {
    const respuesta = await window.canchas.guardarCancha({
      id: form.dataset.id || undefined,
      nombre: datos.get("nombre"),
      deporte: datos.get("deporte"),
      precio: Number(datos.get("precio")),
      dentroDe: datos.get("dentroDe") || "",
      compartirCon: datos.get("compartirCon") || "",
      fecha,
    });
    if (!respuesta.ok) return mostrarError(form, respuesta.error);
    canchaEditId = null;
    aplicar(respuesta.estado);
    return;
  }
  if (form.id === "form-accesorio") {
    const respuesta = await window.canchas.guardarAccesorio({
      id: form.dataset.id || undefined,
      nombre: datos.get("nombre"),
      precio: Number(datos.get("precio")),
      fecha,
    });
    if (!respuesta.ok) return mostrarError(form, respuesta.error);
    accesorioEditId = null;
    aplicar(respuesta.estado);
    return;
  }
  if (form.id === "form-comision") {
    const respuesta = await window.canchas.guardarComision({
      porcentaje: Number(datos.get("porcentaje")),
      fecha,
    });
    if (!respuesta.ok) return mostrarError(form, respuesta.error);
    aplicar(respuesta.estado);
    return;
  }
  if (form.id === "form-alumno") {
    const respuesta = await window.canchas.agregarAlumno({
      nombre: datos.get("nombre"),
      cuota: Number(datos.get("cuota")),
      vence: Number(datos.get("vence")),
      profesor: datos.get("profesor"),
      comision: Number(datos.get("comision")),
    }, fecha);
    if (!respuesta.ok) return mostrarError(form, respuesta.error);
    aplicar(respuesta.estado);
  }
});

cargar();
