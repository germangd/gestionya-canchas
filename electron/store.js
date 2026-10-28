const fs = require("fs");
const path = require("path");

const HORAS = [
  "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
];

const METODOS = ["efectivo", "transferencia", "tarjeta"];

function hoyISO(fecha = new Date()) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function mesDe(iso) {
  return iso.slice(0, 7);
}

function id() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function sumarMes(ym, cantidad) {
  const [anio, mes] = ym.split("-").map(Number);
  const fecha = new Date(anio, mes - 1 + cantidad, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function compararMes(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cuotasPagadas(alumnoId, desde, hasta, cuota, comision) {
  const lista = [];
  for (let mes = desde; compararMes(mes, hasta) <= 0; mes = sumarMes(mes, 1)) {
    lista.push({
      id: id(),
      alumnoId,
      mes,
      fecha: `${mes}-05`,
      monto: cuota,
      comision: Math.round(cuota * comision / 100),
    });
  }
  return lista;
}

function semilla(hoy) {
  const anio = hoy.slice(0, 4);
  const mes = hoy.slice(0, 7);
  const mesAnterior = sumarMes(mes, -1);
  const ciclo = `${anio}-03`;
  return {
    canchas: [
      { id: "futbol-8", nombre: "Fútbol 8", deporte: "Fútbol", precio: 28000 },
      { id: "futbol-5-a", nombre: "Fútbol 5 A", deporte: "Fútbol", precio: 14000, dentroDe: "futbol-8" },
      { id: "futbol-5-b", nombre: "Fútbol 5 B", deporte: "Fútbol", precio: 14000, dentroDe: "futbol-8" },
      { id: "futbol-5-c", nombre: "Fútbol 5 C", deporte: "Fútbol", precio: 14000, dentroDe: "futbol-8" },
      { id: "voleibol", nombre: "Vóleibol", deporte: "Vóleibol", precio: 15000, espacioId: "espacio-voley" },
      { id: "handbol", nombre: "Hándbol", deporte: "Hándbol", precio: 15000, espacioId: "espacio-voley" },
    ],
    accesorios: [
      { id: "pelota-futbol", nombre: "Pelota de fútbol", precio: 1500 },
      { id: "pelota-voley", nombre: "Pelota de vóley", precio: 1000 },
      { id: "pelota-handbol", nombre: "Pelota de hándbol", precio: 1000 },
    ],
    comisionDirectiva: 10,
    clientes: [
      { id: "c1", nombre: "Pablo Herrera", telefono: "221 555-0142" },
      { id: "c2", nombre: "Ana López", telefono: "221 555-0190" },
      { id: "c3", nombre: "Diego Sosa", telefono: "221 555-0118" },
    ],
    turnos: [],
    alumnos: [
      {
        id: "a1", nombre: "Luca Gómez", cuota: 25000, vence: 5,
        desde: ciclo, profesor: "Carlos", comision: 20,
      },
      {
        id: "a2", nombre: "Mora Díaz", cuota: 25000, vence: 28,
        desde: ciclo, profesor: "Carlos", comision: 20,
      },
      {
        id: "a3", nombre: "Thiago Ruiz", cuota: 18000, vence: 10,
        desde: mesAnterior, profesor: "Laura", comision: 15,
      },
    ],
    cuotas: [
      ...cuotasPagadas("a1", ciclo, mesAnterior, 25000, 20),
      ...cuotasPagadas("a2", ciclo, mesAnterior, 25000, 20),
      { id: "q-mora-hoy", alumnoId: "a2", mes, fecha: hoy, monto: 25000, comision: 5000 },
    ],
  };
}

function normalizar(base) {
  base.canchas = Array.isArray(base.canchas) ? base.canchas : [];
  base.clientes = Array.isArray(base.clientes) ? base.clientes : [];
  base.turnos = Array.isArray(base.turnos) ? base.turnos : [];
  base.alumnos = Array.isArray(base.alumnos) ? base.alumnos : [];
  base.cuotas = Array.isArray(base.cuotas) ? base.cuotas : [];
  if (!Array.isArray(base.accesorios)) {
    base.accesorios = [
      { id: "pelota-futbol", nombre: "Pelota de fútbol", precio: 1500 },
      { id: "pelota-voley", nombre: "Pelota de vóley", precio: 1000 },
      { id: "pelota-handbol", nombre: "Pelota de hándbol", precio: 1000 },
    ];
  }
  if (!Number.isFinite(Number(base.comisionDirectiva))) base.comisionDirectiva = 10;
  for (const cancha of base.canchas) {
    if (cancha.grupo && !cancha.espacioId) cancha.espacioId = `grupo-${cancha.grupo}`;
    delete cancha.grupo;
  }
  for (const turno of base.turnos) {
    if (!Array.isArray(turno.accesorios)) turno.accesorios = [];
    if (!Number.isFinite(Number(turno.comision))) {
      const lugar = base.canchas.find((item) => item.id === turno.canchaId);
      turno.comision = Math.round((lugar?.precio || 0) * Number(base.comisionDirectiva) / 100);
    }
  }
  return base;
}

function crearStore(archivo) {
  let datos = null;

  function leer() {
    if (datos) return datos;
    if (fs.existsSync(archivo)) {
      datos = normalizar(JSON.parse(fs.readFileSync(archivo, "utf8")));
      if (datos.canchas.some((cancha) => cancha.id === "f5-norte" || cancha.id === "f8-norte")) {
        const nueva = semilla(hoyISO());
        datos.canchas = nueva.canchas;
        datos.accesorios = nueva.accesorios;
        datos.turnos = [];
        guardar();
      }
      return datos;
    }
    datos = semilla(hoyISO());
    guardar();
    return datos;
  }

  function guardar() {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    const temporal = `${archivo}.tmp`;
    fs.writeFileSync(temporal, JSON.stringify(datos, null, 2));
    fs.renameSync(temporal, archivo);
  }

  function cancha(canchaId) {
    return leer().canchas.find((item) => item.id === canchaId) || null;
  }

  function cliente(clienteId) {
    return leer().clientes.find((item) => item.id === clienteId) || null;
  }

  function turnoEn(canchaId, fecha, hora) {
    return leer().turnos.find((item) => item.canchaId === canchaId && item.fecha === fecha && item.hora === hora) || null;
  }

  function mismasFisicas(canchaId) {
    const actual = cancha(canchaId);
    if (!actual) return new Set();
    const grupo = new Set([actual.id]);
    if (!actual.espacioId) return grupo;
    for (const item of leer().canchas) {
      if (item.espacioId && item.espacioId === actual.espacioId) grupo.add(item.id);
    }
    return grupo;
  }

  function sumarMismoEspacio(destino, canchaId) {
    const actual = cancha(canchaId);
    if (!actual?.espacioId) return;
    for (const item of leer().canchas) {
      if (item.espacioId === actual.espacioId) destino.add(item.id);
    }
  }

  function canchasBloqueadasPor(origenId) {
    const bloqueadas = new Set();
    for (const idEspacio of mismasFisicas(origenId)) {
      if (idEspacio !== origenId) bloqueadas.add(idEspacio);
      const item = cancha(idEspacio);
      if (item.dentroDe) {
        bloqueadas.add(item.dentroDe);
        sumarMismoEspacio(bloqueadas, item.dentroDe);
      }
      for (const otra of leer().canchas) {
        if (otra.dentroDe !== idEspacio) continue;
        bloqueadas.add(otra.id);
        sumarMismoEspacio(bloqueadas, otra.id);
        if (!otra.espacioId) continue;
        for (const gemela of leer().canchas) {
          if (gemela.espacioId === otra.espacioId && gemela.dentroDe) bloqueadas.add(gemela.dentroDe);
        }
      }
    }
    bloqueadas.delete(origenId);
    return bloqueadas;
  }

  function turnosQueBloquean(canchaId, fecha, hora) {
    return leer().turnos.filter((item) => {
      if (item.fecha !== fecha || item.hora !== hora || item.canchaId === canchaId) return false;
      return canchasBloqueadasPor(item.canchaId).has(canchaId);
    });
  }

  function celda(canchaId, fecha, hora) {
    const propio = turnoEn(canchaId, fecha, hora);
    if (propio) return { estado: "alquilada", turno: enriquecerTurno(propio) };
    const bloqueos = turnosQueBloquean(canchaId, fecha, hora);
    if (bloqueos.length) {
      const nombres = [...new Set(bloqueos.map((item) => cancha(item.canchaId)?.nombre).filter(Boolean))];
      const persona = bloqueos.length === 1 ? cliente(bloqueos[0].clienteId) : null;
      return {
        estado: "bloqueada",
        bloqueadaPor: {
          cancha: nombres.join(" y "),
          cliente: persona?.nombre || "",
          hora,
        },
      };
    }
    return { estado: "libre" };
  }

  function enriquecerTurno(turno) {
    const persona = cliente(turno.clienteId);
    const lugar = cancha(turno.canchaId);
    return {
      ...turno,
      cliente: persona?.nombre || "",
      telefono: persona?.telefono || "",
      cancha: lugar?.nombre || "",
      deporte: lugar?.deporte || "",
    };
  }

  function mesesAdeudados(alumno, hasta) {
    const pagos = new Set(
      leer().cuotas.filter((item) => item.alumnoId === alumno.id && item.fecha <= hasta).map((item) => item.mes)
    );
    const limite = mesDe(hasta);
    const lista = [];
    if (compararMes(alumno.desde, limite) > 0) return lista;
    for (let mes = alumno.desde; compararMes(mes, limite) <= 0; mes = sumarMes(mes, 1)) {
      if (pagos.has(mes)) continue;
      const vence = `${mes}-${String(alumno.vence).padStart(2, "0")}`;
      if (vence <= hasta) lista.push(mes);
    }
    return lista;
  }

  function estadoAlumno(alumno, fecha) {
    const mes = mesDe(fecha);
    const pago = leer().cuotas.find((item) => item.alumnoId === alumno.id && item.mes === mes);
    const deuda = mesesAdeudados(alumno, fecha);
    let situacion = "Al día";
    if (compararMes(mes, alumno.desde) < 0) situacion = "Sin ciclo";
    else if (!pago) {
      const vence = `${mes}-${String(alumno.vence).padStart(2, "0")}`;
      if (fecha < vence) situacion = `Vence el ${alumno.vence}`;
      else if (fecha === vence) situacion = "Vence hoy";
      else situacion = "Deuda";
    }
    return {
      ...alumno,
      situacion,
      mesesDeuda: deuda,
      deuda: deuda.length * alumno.cuota,
    };
  }

  function pareceTelefono(texto) {
    return /^[\d\s()+-]{6,}$/.test(texto);
  }

  function resolverCliente(pedido) {
    if (pedido.clienteId) {
      const elegido = cliente(pedido.clienteId);
      if (elegido) return elegido;
    }
    const texto = (pedido.cliente || "").trim();
    if (!texto) return null;
    const tel = (pedido.telefono || "").trim();
    const compacto = texto.replace(/\s/g, "");
    const exacto = leer().clientes.find((item) => {
      if (item.nombre.toLowerCase() === texto.toLowerCase()) return true;
      const telItem = (item.telefono || "").replace(/\s/g, "");
      if (tel && telItem === tel.replace(/\s/g, "")) return true;
      return telItem && telItem === compacto;
    });
    if (exacto) return exacto;
    const nuevo = pareceTelefono(texto)
      ? { id: id(), nombre: texto, telefono: texto }
      : { id: id(), nombre: texto, telefono: tel };
    leer().clientes.push(nuevo);
    return nuevo;
  }

  function fechaPedido(pedido) {
    return pedido?.fecha && /^\d{4}-\d{2}-\d{2}$/.test(pedido.fecha) ? pedido.fecha : hoyISO();
  }

  function snapshot(fecha = hoyISO()) {
    const base = leer();
    const dia = fecha || hoyISO();
    return {
      hoy: hoyISO(),
      fecha: dia,
      horas: HORAS,
      canchas: base.canchas.map((item) => ({
        ...item,
        celdas: HORAS.map((hora) => ({ hora, ...celda(item.id, dia, hora) })),
      })),
      accesorios: base.accesorios,
      comisionDirectiva: Number(base.comisionDirectiva) || 0,
      clientes: [...base.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      alumnos: base.alumnos.map((item) => estadoAlumno(item, dia)),
      turnos: base.turnos.map((item) => enriquecerTurno(item)),
      resumen: resumen(dia),
    };
  }

  function resumen(fecha) {
    const base = leer();
    const turnosDia = base.turnos.filter((item) => item.fecha === fecha).map(enriquecerTurno);
    const cuotasDia = base.cuotas
      .filter((item) => item.fecha === fecha)
      .map((item) => ({
        ...item,
        alumno: base.alumnos.find((alumno) => alumno.id === item.alumnoId)?.nombre || "",
      }));
    const deudasTurnos = base.turnos
      .filter((item) => item.fecha <= fecha && !item.pagado)
      .map(enriquecerTurno);
    const deudasCuotas = base.alumnos.flatMap((alumno) =>
      mesesAdeudados(alumno, fecha).map((mes) => ({
        alumno: alumno.nombre,
        mes,
        monto: alumno.cuota,
      }))
    );
    const total = (lista, campo = "monto") => lista.reduce((acum, item) => acum + item[campo], 0);
    return {
      alquileres: total(turnosDia.filter((item) => item.pagado)),
      cuotas: total(cuotasDia),
      deudas: total(deudasTurnos) + total(deudasCuotas),
      comisiones: total(cuotasDia, "comision"),
      turnos: turnosDia,
      cuotasDetalle: cuotasDia,
      deudasTurnos,
      deudasCuotas,
    };
  }

  function alquilar(pedido) {
    const lugar = cancha(pedido.canchaId);
    if (!lugar) return { ok: false, error: "Esa cancha no existe." };
    if (!HORAS.includes(pedido.hora)) return { ok: false, error: "Esa hora no está en la grilla." };
    if (!pedido.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(pedido.fecha)) {
      return { ok: false, error: "La fecha no es válida." };
    }
    const ocupada = celda(pedido.canchaId, pedido.fecha, pedido.hora);
    if (ocupada.estado === "alquilada") return { ok: false, error: "Ese turno ya está alquilado." };
    if (ocupada.estado === "bloqueada") {
      return { ok: false, error: `Esa hora está bloqueada por ${ocupada.bloqueadaPor.cancha}.` };
    }
    if (!METODOS.includes(pedido.metodo)) return { ok: false, error: "Elegí efectivo, transferencia o tarjeta." };
    const persona = resolverCliente(pedido);
    if (!persona) return { ok: false, error: "Falta el nombre del cliente." };
    const pedidosIds = [...new Set(Array.isArray(pedido.accesorios) ? pedido.accesorios : [])];
    const detalle = [];
    for (const accesorioId of pedidosIds) {
      const item = leer().accesorios.find((accesorio) => accesorio.id === accesorioId);
      if (!item) return { ok: false, error: "Ese accesorio no existe." };
      detalle.push({ id: item.id, nombre: item.nombre, precio: item.precio });
    }
    const extra = detalle.reduce((suma, item) => suma + item.precio, 0);
    const comision = Math.round(lugar.precio * (Number(leer().comisionDirectiva) || 0) / 100);
    const monto = lugar.precio + extra;
    if (monto <= 0) return { ok: false, error: "El monto tiene que ser mayor a cero." };
    leer().turnos.push({
      id: id(),
      canchaId: lugar.id,
      fecha: pedido.fecha,
      hora: pedido.hora,
      clienteId: persona.id,
      accesorios: detalle,
      metodo: pedido.metodo,
      monto,
      comision,
      pagado: !pedido.fiado && pedido.pagado !== false,
    });
    guardar();
    return { ok: true, estado: snapshot(pedido.fecha) };
  }

  function cancelar(turnoId) {
    const base = leer();
    const turno = base.turnos.find((item) => item.id === turnoId);
    if (!turno) return { ok: false, error: "Ese turno no está." };
    base.turnos = base.turnos.filter((item) => item.id !== turnoId);
    guardar();
    return { ok: true, estado: snapshot(turno.fecha) };
  }

  function cobrarTurno(turnoId) {
    const turno = leer().turnos.find((item) => item.id === turnoId);
    if (!turno) return { ok: false, error: "Ese turno no está." };
    turno.pagado = true;
    guardar();
    return { ok: true, estado: snapshot(turno.fecha) };
  }

  function proximaCuota(alumno, fecha) {
    const deuda = mesesAdeudados(alumno, fecha)[0];
    if (deuda) return deuda;
    const mes = mesDe(fecha);
    const pagado = leer().cuotas.some((item) => item.alumnoId === alumno.id && item.mes === mes);
    if (!pagado && compararMes(mes, alumno.desde) >= 0) return mes;
    return null;
  }

  function cobrarCuota(alumnoId, fecha = hoyISO()) {
    const alumno = leer().alumnos.find((item) => item.id === alumnoId);
    if (!alumno) return { ok: false, error: "Ese alumno no está." };
    const pendiente = proximaCuota(alumno, fecha);
    if (!pendiente) return { ok: false, error: "Esa cuota ya está cobrada." };
    if (compararMes(pendiente, alumno.desde) < 0) {
      return { ok: false, error: "Ese mes es anterior al ciclo." };
    }
    const comision = Math.round(alumno.cuota * (Number(alumno.comision) || 0) / 100);
    leer().cuotas.push({
      id: id(),
      alumnoId: alumno.id,
      mes: pendiente,
      fecha,
      monto: alumno.cuota,
      comision,
    });
    guardar();
    return { ok: true, estado: snapshot(fecha) };
  }

  function agregarAlumno(pedido, fecha = hoyISO()) {
    const nombre = (pedido.nombre || "").trim();
    if (!nombre) return { ok: false, error: "Falta el nombre del alumno." };
    const cuota = Number(pedido.cuota);
    const vence = Number(pedido.vence);
    const comision = Number(pedido.comision);
    if (!Number.isFinite(cuota) || cuota <= 0) return { ok: false, error: "La cuota tiene que ser mayor a cero." };
    if (!Number.isInteger(vence) || vence < 1 || vence > 28) {
      return { ok: false, error: "El vencimiento tiene que ser un día del 1 al 28." };
    }
    if (!Number.isFinite(comision) || comision < 0 || comision > 100) {
      return { ok: false, error: "La comisión tiene que estar entre 0 y 100." };
    }
    leer().alumnos.push({
      id: id(),
      nombre,
      cuota,
      vence,
      desde: mesDe(fecha),
      profesor: (pedido.profesor || "").trim() || "Sin profesor",
      comision,
    });
    guardar();
    return { ok: true, estado: snapshot(fecha) };
  }

  function resolverRelaciones(propioId, dentroDe, compartirCon) {
    let espacioId = null;
    let espacioNuevoEn = null;
    if (dentroDe) {
      if (dentroDe === propioId) return { ok: false, error: "Una cancha no puede estar dentro de sí misma." };
      const grande = cancha(dentroDe);
      if (!grande) return { ok: false, error: "La cancha grande no existe." };
      if (grande.dentroDe) return { ok: false, error: "Elegí una cancha que no esté dentro de otra." };
      if (propioId && leer().canchas.some((item) => item.dentroDe === propioId)) {
        return { ok: false, error: "Esta cancha contiene otras, no puede ir adentro." };
      }
    }
    if (compartirCon) {
      if (compartirCon === propioId) return { ok: false, error: "Elegí otra cancha para compartir el espacio." };
      const otra = cancha(compartirCon);
      if (!otra) return { ok: false, error: "La cancha para compartir no existe." };
      if (otra.espacioId) espacioId = otra.espacioId;
      else {
        espacioId = id();
        espacioNuevoEn = otra.id;
      }
    }
    return { ok: true, dentroDe: dentroDe || null, espacioId, espacioNuevoEn };
  }

  function guardarCancha(pedido) {
    const nombre = (pedido.nombre || "").trim();
    const deporte = (pedido.deporte || "").trim();
    const precio = Number(pedido.precio);
    if (!nombre) return { ok: false, error: "Falta el nombre de la cancha." };
    if (!deporte) return { ok: false, error: "Falta el deporte." };
    if (!Number.isFinite(precio) || precio <= 0) return { ok: false, error: "El precio tiene que ser mayor a cero." };
    const base = leer();
    const existente = pedido.id ? base.canchas.find((item) => item.id === pedido.id) : null;
    if (pedido.id && !existente) return { ok: false, error: "Esa cancha no existe." };
    const relaciones = resolverRelaciones(existente?.id || null, pedido.dentroDe || "", pedido.compartirCon || "");
    if (!relaciones.ok) return relaciones;
    const actual = existente || { id: id() };
    actual.nombre = nombre;
    actual.deporte = deporte;
    actual.precio = precio;
    if (relaciones.dentroDe) actual.dentroDe = relaciones.dentroDe;
    else delete actual.dentroDe;
    if (relaciones.espacioId) actual.espacioId = relaciones.espacioId;
    else delete actual.espacioId;
    if (relaciones.espacioNuevoEn) {
      const otra = cancha(relaciones.espacioNuevoEn);
      if (otra) otra.espacioId = relaciones.espacioId;
    }
    if (!existente) base.canchas.push(actual);
    guardar();
    return { ok: true, estado: snapshot(fechaPedido(pedido)) };
  }

  function guardarAccesorio(pedido) {
    const nombre = (pedido.nombre || "").trim();
    const precio = Number(pedido.precio);
    if (!nombre) return { ok: false, error: "Falta el nombre del accesorio." };
    if (!Number.isFinite(precio) || precio <= 0) return { ok: false, error: "El precio tiene que ser mayor a cero." };
    const base = leer();
    if (pedido.id) {
      const actual = base.accesorios.find((item) => item.id === pedido.id);
      if (!actual) return { ok: false, error: "Ese accesorio no existe." };
      actual.nombre = nombre;
      actual.precio = precio;
    } else {
      base.accesorios.push({ id: id(), nombre, precio });
    }
    guardar();
    return { ok: true, estado: snapshot(fechaPedido(pedido)) };
  }

  function guardarComision(pedido) {
    const valor = Number(pedido?.porcentaje ?? pedido);
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      return { ok: false, error: "La comisión tiene que estar entre 0 y 100." };
    }
    leer().comisionDirectiva = valor;
    guardar();
    return { ok: true, estado: snapshot(fechaPedido(pedido)) };
  }

  return {
    snapshot,
    alquilar,
    cancelar,
    cobrarTurno,
    cobrarCuota,
    agregarAlumno,
    guardarCancha,
    guardarAccesorio,
    guardarComision,
    archivo,
  };
}

module.exports = { crearStore, hoyISO, HORAS };
