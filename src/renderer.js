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
let aviso = "";
let licencia = { mode: "development", reason: null, valid: true, signatureVerified: true };
let edicion = { isDemo: false, daysLeft: null };
let mesFiltro = null;

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

function barraFecha() {
  const barra = el("div", "fecha");
  barra.append(el("small", "", "Fecha"));
  const input = document.createElement("input");
  input.type = "date";
  input.className = "fecha-input";
  input.value = fecha;
  input.setAttribute("aria-label", "Fecha");
  input.addEventListener("change", async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.value)) return;
    fecha = input.value;
    aviso = "";
    await cargar();
  });
  barra.append(input);
  return barra;
}

function cabecera(cancha, estado) {
  const cabeza = el("div", "cabecera");
  cabeza.append(
    el("h2", "", cancha.nombre),
    el("p", "precio", `${cancha.deporte} · ${dinero(cancha.precio)} el turno`),
    el("span", `badge ${estado}`, textoEstado(estado))
  );
  return cabeza;
}

function horaOcupada(item) {
  return snapshot.canchas.some((cancha) =>
    cancha.celdas.some((celda) => celda.hora === item && celda.estado === "alquilada")
  );
}

function filaHoras() {
  const manana = snapshot.horas.filter((item) => item <= "18:00");
  const noche = snapshot.horas.filter((item) => item > "18:00");
  const grilla = el("div", "horas-grilla");
  for (const grupo of [manana, noche]) {
    if (!grupo.length) continue;
    const fila = el("div", "horas");
    for (const item of grupo) {
      const clases = ["hora"];
      if (item === hora) clases.push("activa");
      if (horaOcupada(item)) clases.push("ocupada");
      const nodo = boton(item, clases.join(" "), { hora: item });
      nodo.setAttribute("aria-pressed", item === hora ? "true" : "false");
      fila.append(nodo);
    }
    grilla.append(fila);
  }
  return grilla;
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

function licenciaBloqueada() {
  return licencia.mode === "blocked" || licencia.mode === "read_only";
}

function motivoLicencia(reason) {
  const motivos = {
    NO_LOCAL_LICENSE: "Ingresá tu clave para activar la licencia.",
    DEVICE_MISMATCH: "La licencia no corresponde a este equipo.",
    INVALID_TOKEN: "La clave no es válida.",
    INVALID_SIGNATURE: "La licencia no superó la verificación.",
    NO_VERIFY_KEY: "Esta copia no puede verificar la licencia.",
    TOKEN_EXPIRED_OUT_OF_GRACE: "La licencia venció.",
  };
  return motivos[reason] || reason || "";
}

function etiquetaLicencia() {
  const etiquetas = {
    full: "Activa",
    demo_trial: "Prueba demo",
    development: "Desarrollo",
    grace: "Período de gracia",
    read_only: "Solo lectura",
    blocked: "Sin activar",
  };
  return etiquetas[licencia.mode] || "Desconocido";
}

function detalleLicencia() {
  const mode = licencia.mode;
  if (mode === "full") {
    return licencia.signatureVerified === false
      ? "Licencia válida (token legacy HS256). Abrí online una vez para migrar a RS256."
      : "Licencia validada con firma RS256. Todas las funciones habilitadas.";
  }
  if (mode === "demo_trial") {
    const dias = Number(edicion.daysLeft);
    const resto = Number.isFinite(dias)
      ? ` Quedan ${dias === 1 ? "1 día" : `${Math.max(0, Math.floor(dias))} días`} de prueba.`
      : "";
    return `Todas las funciones habilitadas durante el periodo de prueba.${resto} Podés ingresar una licencia comercial en cualquier momento.`;
  }
  if (mode === "development") return "Esta copia de desarrollo no pide clave. El instalador final sí la pide.";
  if (mode === "grace") return "Sincronizá online para renovar la licencia.";
  if (mode === "read_only") return "Los alquileres, cobros y cambios de configuración están bloqueados hasta revalidar.";
  if (mode === "blocked") return motivoLicencia(licencia.reason) || "Ingresá tu clave para activar la licencia.";
  return "No se pudo determinar estado de licencia.";
}

function pintarAvisosLicencia() {
  const demo = document.getElementById("demo-banner");
  const candado = document.getElementById("license-lock-banner");
  if (demo) {
    if (edicion.isDemo && licencia.mode === "demo_trial") {
      const dias = Number(edicion.daysLeft);
      const seguros = Number.isFinite(dias) ? Math.max(0, Math.floor(dias)) : null;
      const texto = seguros === 1 ? "1 día" : `${seguros} días`;
      demo.innerHTML = `Versión DEMO activa — quedan <strong>${texto}</strong> para el vencimiento.`;
      demo.hidden = false;
      if (seguros !== null && seguros <= 2) demo.dataset.severity = "warn";
      else delete demo.dataset.severity;
    } else {
      demo.hidden = true;
      demo.textContent = "";
      delete demo.dataset.severity;
    }
  }
  if (candado) {
    if (licenciaBloqueada()) {
      candado.hidden = false;
      candado.textContent = licencia.mode === "blocked"
        ? "Sin licencia activa: los alquileres, los cobros y la configuración están bloqueados hasta activar en Configuración."
        : "Licencia en modo solo lectura: no se pueden registrar cambios.";
    } else {
      candado.hidden = true;
      candado.textContent = "";
    }
  }
}

function abrirModalLicencia() {
  const modal = document.getElementById("modal-licencia");
  const error = document.getElementById("modal-licencia-error");
  if (error) error.textContent = "";
  if (modal) modal.hidden = false;
  document.getElementById("modal-license-key")?.focus();
}

function cerrarModalLicencia() {
  const modal = document.getElementById("modal-licencia");
  if (modal) modal.hidden = true;
}

function aplicarEstadoLicencia(respuesta) {
  if (respuesta?.status !== "ok") return;
  licencia = {
    valid: !!respuesta.valid,
    mode: respuesta.mode || "unknown",
    reason: respuesta.reason || null,
    signatureVerified: !!respuesta.signatureVerified,
  };
}

async function sincronizarLicencia() {
  if (!window.canchas?.licencia) return;
  try {
    aplicarEstadoLicencia(await window.canchas.licencia.getStatus());
    try {
      await window.canchas.licencia.heartbeat();
    } catch (_) {}
    aplicarEstadoLicencia(await window.canchas.licencia.getStatus());
    const edition = await window.canchas.licencia.getEdition();
    if (edition?.status === "ok") edicion = edition;
  } catch (_) {}
  pintarAvisosLicencia();
}

async function activarLicenciaDesdeModal() {
  const input = document.getElementById("modal-license-key");
  const error = document.getElementById("modal-licencia-error");
  const botonActivar = document.getElementById("btn-activar-licencia");
  const clave = (input?.value || "").trim();
  if (!clave) {
    if (error) error.textContent = "Ingresá una clave de licencia";
    return;
  }
  if (botonActivar) botonActivar.disabled = true;
  try {
    const respuesta = await window.canchas.licencia.activate(clave, { device_name: "GestiónYa Canchas" });
    if (respuesta?.status !== "ok") throw new Error(respuesta?.message || "No se pudo activar la licencia");
    if (input) input.value = "";
    await sincronizarLicencia();
    cerrarModalLicencia();
    aviso = "Licencia activada correctamente.";
    pintar();
  } catch (err) {
    if (error) error.textContent = `No se pudo activar: ${err.message}`;
  } finally {
    if (botonActivar) botonActivar.disabled = false;
  }
}

async function revalidarLicenciaAhora() {
  try {
    const respuesta = await window.canchas.licencia.validateOnline();
    if (respuesta?.status !== "ok") throw new Error(respuesta?.message || "Falló la validación online");
    await sincronizarLicencia();
    aviso = "Licencia revalidada.";
    pintar();
  } catch (err) {
    aviso = `No se pudo revalidar: ${err.message}`;
    pintar();
  }
}

function frenarPorLicencia() {
  if (!licenciaBloqueada()) return false;
  aviso = licencia.mode === "blocked"
    ? "Sin licencia activa: activala en Configuración."
    : "Licencia en modo solo lectura.";
  if (licencia.mode === "blocked") abrirModalLicencia();
  pintar();
  return true;
}

async function cargar() {
  await sincronizarLicencia();
  snapshot = await window.canchas.estado(fecha || undefined);
  fecha = snapshot.fecha;
  if (!snapshot.horas.includes(hora)) hora = snapshot.horas.includes("18:00") ? "18:00" : snapshot.horas[0];
  if (licencia.mode === "blocked") abrirModalLicencia();
  pintar();
}

function aplicar(estado) {
  snapshot = estado;
  fecha = estado.fecha;
  pintar();
}

function asegurarSeleccion() {
  if (!snapshot) return;
  if (seleccionId && snapshot.canchas.some((item) => item.id === seleccionId)) return;
  const preferida = snapshot.canchas.find((item) => item.id === "futbol-5-a")
    || snapshot.canchas.find((item) => item.dentroDe)
    || snapshot.canchas[0];
  seleccionId = preferida ? preferida.id : null;
}

function pintar() {
  asegurarSeleccion();
  document.querySelectorAll(".nav-btn").forEach((item) => {
    item.classList.toggle("activo", item.dataset.vista === seccion);
  });
  app.dataset.vista = seccion;
  lienzo.replaceChildren();
  if (aviso) lienzo.append(el("p", "aviso", aviso));
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

function clasesEstado(estado, base) {
  const clases = [base];
  if (estado === "alquilada" || estado === "bloqueada") clases.push(estado);
  else clases.push("libre");
  return clases;
}

function tarjetaCancha(cancha) {
  const celda = celdaDe(cancha);
  const clases = clasesEstado(celda.estado, "cancha-card");
  if (cancha.id === seleccionId) clases.push("seleccionada");
  const tarjeta = boton("", clases.join(" "), { id: cancha.id });
  const pie = el("div", "cancha-pie");
  pie.append(el("strong", "", cancha.nombre), el("span", "", textoEstado(celda.estado)));
  tarjeta.append(pie);
  return tarjeta;
}

function pintarCanchas() {
  lienzo.append(barraFecha(), filaHoras(), leyenda());
  const mapa = el("div", "mapa");
  const chips = [];
  const predio = el("section", "predio");
  predio.append(el("h2", "", "Predio"));
  const canchas = snapshot.canchas;
  const usadas = new Set();
  const grandes = canchas.filter((cancha) => canchas.some((otra) => otra.dentroDe === cancha.id));
  for (const grande of grandes) {
    const celda = celdaDe(grande);
    const clases = clasesEstado(celda.estado, "marco");
    if (grande.id === seleccionId) clases.push("seleccionada");
    const marco = boton("", clases.join(" "), { id: grande.id });
    marco.append(el("span", "marco-nombre", grande.nombre));
    const hijas = el("div", "hijas");
    for (const chica of canchas.filter((item) => item.dentroDe === grande.id)) {
      hijas.append(tarjetaCancha(chica));
      usadas.add(chica.id);
    }
    marco.append(hijas);
    marco.addEventListener("pointerdown", (evento) => {
      if (evento.target.closest(".cancha-card")) return;
      seleccionId = grande.id;
      aviso = "";
      pintar();
    });
    predio.append(marco);
    chips.push(el("p", "chip", `${grande.nombre}: ${textoEstado(celda.estado)}`));
    usadas.add(grande.id);
  }
  const porEspacio = new Map();
  for (const cancha of canchas) {
    if (usadas.has(cancha.id) || !cancha.espacioId) continue;
    const companeras = canchas.filter((otra) => otra.espacioId === cancha.espacioId);
    if (companeras.length < 2) continue;
    if (!porEspacio.has(cancha.espacioId)) porEspacio.set(cancha.espacioId, []);
    porEspacio.get(cancha.espacioId).push(cancha);
    usadas.add(cancha.id);
  }
  for (const cancha of canchas) {
    if (!usadas.has(cancha.id)) predio.append(tarjetaCancha(cancha));
  }
  mapa.append(predio);
  for (const grupo of porEspacio.values()) {
    const misma = el("section", "misma");
    misma.append(el("h2", "", "Misma cancha"));
    for (const cancha of grupo) misma.append(tarjetaCancha(cancha));
    mapa.append(misma);
  }
  lienzo.append(mapa, ...chips);
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
  if (celda.estado === "bloqueada") formularioBloqueada();
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
    fila.append(check, el("span", "", `${accesorio.nombre} (${dinero(accesorio.precio)})`));
    lista.append(fila);
  }

  const cuenta = el("div", "subtotal");
  const extra = el("span", "", `Cancha ${dinero(cancha.precio)} + accesorios ${dinero(0)}`);
  extra.dataset.extra = "1";
  const nota = el("span", "comision", `Comisión directiva (${snapshot.comisionDirectiva}% solo de la cancha):`);
  const comision = el("strong", "", dinero(comisionDe(cancha.precio)));
  comision.dataset.comision = "1";
  cuenta.append(extra, nota, comision);
  const medio = el("label", "", "Medio de pago");
  const select = document.createElement("select");
  for (const item of metodos) select.append(opcion(item[0], item[1]));
  medio.append(select);
  const error = el("strong", "deuda", "");
  const registrar = boton("Registrar alquiler", "registrar");
  registrar.disabled = licenciaBloqueada();
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
  if (!cancha || !panel.querySelector("[data-comision]")) return;
  const extra = [...panel.querySelectorAll(".accesorio input:checked")]
    .reduce((suma, input) => suma + Number(input.dataset.precio), 0);
  panel.querySelector("[data-extra]").textContent = `Cancha ${dinero(cancha.precio)} + accesorios ${dinero(extra)}`;
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
  aviso = "Alquiler registrado.";
  aplicar(respuesta.estado);
}

function formularioAlquilada(turno) {
  const nombres = (turno.accesorios || []).map((item) => item.nombre);
  panel.append(
    el("p", "", `Cliente: ${turno.cliente}`),
    el("p", "", `Accesorios: ${nombres.length ? nombres.join(", ") : "Sin accesorios"}`),
    el("p", "", `Total: ${dinero(turno.monto)}`)
  );
  if (!turno.pagado) {
    const cobrar = boton("Cobrar", "primario", { cobrarTurno: turno.id });
    cobrar.disabled = licenciaBloqueada();
    panel.append(cobrar);
  }
  const anular = boton("Anular alquiler", "anular", { cancelarTurno: turno.id });
  anular.disabled = licenciaBloqueada();
  panel.append(anular);
}

function formularioBloqueada() {
  panel.append(el("p", "", "Hay un alquiler en una cancha que comparte el mismo espacio. No se puede superponer."));
}

function tablaDe(filas) {
  const tabla = el("div", "tabla");
  if (!filas.length) tabla.append(el("p", "fila", "Nada para mostrar en este día."));
  for (const fila of filas) tabla.append(fila);
  return tabla;
}

function extraDe(turno) {
  return (turno.accesorios || []).reduce((suma, item) => suma + (Number(item.precio) || 0), 0);
}

function mesVista() {
  if (mesFiltro) return mesFiltro;
  return (fecha || snapshot?.fecha || "").slice(0, 7);
}

function pintarAlquileres() {
  lienzo.append(el("h2", "", "Alquileres"));
  const mes = mesVista();
  const filtro = el("label", "mes");
  filtro.append(el("small", "", "Mes"));
  const input = document.createElement("input");
  input.type = "month";
  input.value = mes;
  input.setAttribute("aria-label", "Mes");
  input.addEventListener("change", () => {
    if (!/^\d{4}-\d{2}$/.test(input.value)) return;
    mesFiltro = input.value;
    pintar();
  });
  filtro.append(input);
  lienzo.append(filtro);

  const turnos = (snapshot.turnos || []).filter((turno) => String(turno.fecha).startsWith(mes));
  const cobrados = turnos.filter((turno) => turno.pagado);
  const alquilerCanchas = cobrados.reduce((suma, turno) => suma + turno.monto - extraDe(turno), 0);
  const accesorios = cobrados.reduce((suma, turno) => suma + extraDe(turno), 0);
  const total = cobrados.reduce((suma, turno) => suma + turno.monto, 0);
  const comision = cobrados.reduce((suma, turno) => suma + turno.comision, 0);
  const tarjetas = el("div", "tarjetas");
  for (const item of [
    ["Alquiler de canchas", alquilerCanchas],
    ["Accesorios", accesorios],
    ["Total cobrado", total],
    ["Comisión directiva", comision],
  ]) {
    const tarjeta = el("article");
    tarjeta.append(el("span", "", item[0]), el("strong", "", dinero(item[1])));
    tarjetas.append(tarjeta);
  }
  lienzo.append(
    tarjetas,
    el("p", "nota-comision", "La comisión se calcula solo sobre el precio de la cancha, sin los accesorios.")
  );

  const tabla = el("table", "tabla");
  const thead = document.createElement("thead");
  const encabezado = document.createElement("tr");
  for (const titulo of ["Fecha", "Turno", "Cancha", "Cliente", "Cancha", "Accesorios", "Comisión", "Total", "Medio", ""]) {
    encabezado.append(el("th", "", titulo));
  }
  thead.append(encabezado);
  const tbody = document.createElement("tbody");
  const ordenados = [...turnos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
  if (!ordenados.length) {
    const vacia = document.createElement("tr");
    const celda = el("td", "", "Nada para mostrar en este mes.");
    celda.colSpan = 10;
    vacia.append(celda);
    tbody.append(vacia);
  }
  for (const turno of ordenados) {
    const fila = document.createElement("tr");
    fila.className = "fila";
    for (const texto of [
      turno.fecha,
      turno.hora,
      turno.cancha,
      turno.cliente,
      dinero(turno.monto - extraDe(turno)),
      dinero(extraDe(turno)),
      dinero(turno.comision),
      dinero(turno.monto),
      etiquetaMetodo(turno.metodo),
    ]) fila.append(el("td", "", texto));
    const accion = document.createElement("td");
    accion.append(boton("Anular", "", { cancelarTurno: turno.id }));
    fila.append(accion);
    tbody.append(fila);
  }
  tabla.append(thead, tbody);
  lienzo.append(tabla);
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
  const panelLicencia = el("section", "licencia-panel");
  const estado = el("p", "");
  estado.append(document.createTextNode("Estado actual: "), el("strong", "", etiquetaLicencia()));
  const acciones = el("div", "modal-acciones");
  const activar = boton("Activar / cambiar clave", "primario");
  activar.addEventListener("click", abrirModalLicencia);
  const revalidar = boton("Revalidar online");
  revalidar.addEventListener("click", () => revalidarLicenciaAhora());
  acciones.append(activar, revalidar);
  panelLicencia.append(
    el("h2", "", "Licencia comercial"),
    estado,
    el("p", "ayuda", detalleLicencia()),
    el("p", "ayuda", "La activación y la revalidación usan el servicio de licencias de GestiónYa. La dirección técnica no se muestra acá por seguridad; si necesitás soporte, contactá al proveedor."),
    acciones
  );
  raiz.append(panelLicencia, el("h2", "", "Canchas"));
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
  const horaBtn = evento.target.closest(".hora");
  if (horaBtn) {
    hora = horaBtn.dataset.hora;
    aviso = "";
    pintar();
    return;
  }
  const tarjeta = evento.target.closest(".cancha-card");
  if (tarjeta) {
    seleccionId = tarjeta.dataset.id;
    aviso = "";
    pintar();
    return;
  }
  const marco = evento.target.closest(".marco");
  if (marco) {
    seleccionId = marco.dataset.id;
    aviso = "";
    pintar();
    return;
  }
  const cobrarTurno = evento.target.closest("[data-cobrar-turno]");
  if (cobrarTurno) {
    if (frenarPorLicencia()) return;
    const respuesta = await window.canchas.cobrarTurno(cobrarTurno.dataset.cobrarTurno);
    if (respuesta.ok) aplicar(respuesta.estado);
    return;
  }
  const cancelar = evento.target.closest("[data-cancelar-turno]");
  if (cancelar) {
    if (frenarPorLicencia()) return;
    aviso = "";
    const respuesta = await window.canchas.cancelar(cancelar.dataset.cancelarTurno);
    if (respuesta.ok) aplicar(respuesta.estado);
    return;
  }
  const cobrarCuota = evento.target.closest("[data-cobrar-cuota]");
  if (cobrarCuota) {
    if (frenarPorLicencia()) return;
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
  if (frenarPorLicencia()) return;
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

document.getElementById("btn-activar-licencia")?.addEventListener("click", activarLicenciaDesdeModal);
document.getElementById("btn-cerrar-licencia")?.addEventListener("click", cerrarModalLicencia);
document.getElementById("modal-licencia")?.addEventListener("click", (evento) => {
  if (evento.target.id === "modal-licencia") cerrarModalLicencia();
});

cargar();
