const fs = require("fs");
const path = require("path");

const HORAS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00", "23:00",
];

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
      { id: "f5-norte", nombre: "Norte", deporte: "Fútbol 5", grupo: "norte", precio: 18000 },
      { id: "f8-norte", nombre: "Norte", deporte: "Fútbol 8", grupo: "norte", precio: 28000 },
      { id: "voley-sur", nombre: "Sur", deporte: "Vóley", grupo: "sur", precio: 15000 },
      { id: "hand-sur", nombre: "Sur", deporte: "Hándbol", grupo: "sur", precio: 15000 },
      { id: "f5-este", nombre: "Este", deporte: "Fútbol 5", grupo: "este", precio: 18000 },
    ],
    clientes: [
      { id: "c1", nombre: "Pablo Herrera", telefono: "221 555-0142" },
      { id: "c2", nombre: "Ana López", telefono: "221 555-0190" },
      { id: "c3", nombre: "Diego Sosa", telefono: "221 555-0118" },
    ],
    turnos: [
      {
        id: "t1", canchaId: "f5-norte", fecha: hoy, hora: "18:00",
        clienteId: "c1", pelota: true, metodo: "efectivo", monto: 20000, pagado: true,
      },
      {
        id: "t2", canchaId: "voley-sur", fecha: hoy, hora: "19:00",
        clienteId: "c2", pelota: false, metodo: "transferencia", monto: 15000, pagado: true,
      },
      {
        id: "t3", canchaId: "f5-este", fecha: hoy, hora: "21:00",
        clienteId: "c3", pelota: true, metodo: "tarjeta", monto: 20000, pagado: false,
      },
    ],
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

function crearStore(archivo) {
  let datos = null;

  function leer() {
    if (datos) return datos;
    if (fs.existsSync(archivo)) {
      datos = JSON.parse(fs.readFileSync(archivo, "utf8"));
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

  function turnoQueBloquea(canchaId, fecha, hora) {
    const actual = cancha(canchaId);
    if (!actual) return null;
    return leer().turnos.find((item) => {
      if (item.fecha !== fecha || item.hora !== hora || item.canchaId === canchaId) return false;
      const otra = cancha(item.canchaId);
      return otra && otra.grupo === actual.grupo;
    }) || null;
  }

  function celda(canchaId, fecha, hora) {
    const propio = turnoEn(canchaId, fecha, hora);
    if (propio) {
      return { estado: "alquilada", turno: enriquecerTurno(propio) };
    }
    const bloqueo = turnoQueBloquea(canchaId, fecha, hora);
    if (bloqueo) {
      const otra = cancha(bloqueo.canchaId);
      return {
        estado: "bloqueada",
        bloqueadaPor: {
          cancha: `${otra.nombre} ${otra.deporte}`,
          cliente: cliente(bloqueo.clienteId)?.nombre || "un turno",
          hora: bloqueo.hora,
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
      cancha: lugar ? `${lugar.nombre} ${lugar.deporte}` : "",
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

  function asegurarCliente(nombre, telefono) {
    const limpio = nombre.trim();
    const tel = (telefono || "").trim();
    const existente = leer().clientes.find(
      (item) => item.nombre.toLowerCase() === limpio.toLowerCase() && item.telefono === tel
    );
    if (existente) return existente;
    const nuevo = { id: id(), nombre: limpio, telefono: tel };
    leer().clientes.push(nuevo);
    return nuevo;
  }

  function snapshot(fecha = hoyISO()) {
    const base = leer();
    return {
      hoy: hoyISO(),
      fecha,
      horas: HORAS,
      canchas: base.canchas.map((item) => ({
        ...item,
        celdas: HORAS.map((hora) => ({ hora, ...celda(item.id, fecha, hora) })),
      })),
      alumnos: base.alumnos.map((item) => estadoAlumno(item, fecha)),
      resumen: resumen(fecha),
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
    const nombre = (pedido.cliente || "").trim();
    if (!nombre) return { ok: false, error: "Falta el nombre del cliente." };
    const ocupada = celda(pedido.canchaId, pedido.fecha, pedido.hora);
    if (ocupada.estado === "alquilada") return { ok: false, error: "Ese turno ya está alquilado." };
    if (ocupada.estado === "bloqueada") {
      return {
        ok: false,
        error: `Esa hora está bloqueada por ${ocupada.bloqueadaPor.cancha}.`,
      };
    }
    const metodos = ["efectivo", "transferencia", "tarjeta"];
    if (!metodos.includes(pedido.metodo)) return { ok: false, error: "Elegí efectivo, transferencia o tarjeta." };
    const monto = Number(pedido.monto);
    if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: "El monto tiene que ser mayor a cero." };
    const persona = asegurarCliente(nombre, pedido.telefono);
    leer().turnos.push({
      id: id(),
      canchaId: lugar.id,
      fecha: pedido.fecha,
      hora: pedido.hora,
      clienteId: persona.id,
      pelota: Boolean(pedido.pelota),
      metodo: pedido.metodo,
      monto,
      pagado: !pedido.fiado,
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

  return { snapshot, alquilar, cancelar, cobrarTurno, cobrarCuota, agregarAlumno, archivo };
}

module.exports = { crearStore, hoyISO, HORAS };
