const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { crearStore, hoyISO } = require("../electron/store");

function nuevo() {
  const archivo = path.join(os.tmpdir(), `canchas-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  return { store: crearStore(archivo), archivo };
}

function celda(estado, canchaId, hora) {
  const cancha = estado.canchas.find((item) => item.id === canchaId);
  return cancha.celdas.find((item) => item.hora === hora);
}

test("alquilar el fútbol 5 A bloquea solo al 8, no a 5 B ni a 5 C", () => {
  const { store, archivo } = nuevo();
  try {
    const hoy = hoyISO();
    const estado = store.snapshot(hoy);
    assert.equal(estado.horas[0], "10:00");
    assert.equal(estado.horas.at(-1), "22:00");
    assert.equal(estado.horas.includes("08:00"), false);
    assert.equal(estado.horas.includes("23:00"), false);
    assert.equal(estado.canchas.filter((cancha) => cancha.dentroDe === "futbol-8").length, 3);
    assert.equal(estado.canchas.find((cancha) => cancha.id === "futbol-8").precio, 28000);
    assert.equal(estado.resumen.turnos.length, 0);
    const voley = estado.canchas.find((cancha) => cancha.id === "voleibol");
    const handbol = estado.canchas.find((cancha) => cancha.id === "handbol");
    assert.equal(voley.precio, 15000);
    assert.equal(handbol.precio, 15000);
    assert.equal(voley.espacioId, handbol.espacioId);
    assert.equal(voley.dentroDe, undefined);
    assert.equal(handbol.dentroDe, undefined);
    assert.equal(estado.accesorios.find((item) => item.id === "pelota-futbol").precio, 1500);
    assert.equal(estado.accesorios.find((item) => item.id === "pelota-voley").precio, 1000);
    assert.equal(estado.accesorios.find((item) => item.id === "pelota-handbol").precio, 1000);
    for (const id of ["futbol-8", "futbol-5-a", "futbol-5-b", "futbol-5-c", "voleibol", "handbol"]) {
      assert.equal(celda(estado, id, "18:00").estado, "libre");
      if (id.startsWith("futbol-5")) assert.equal(estado.canchas.find((cancha) => cancha.id === id).espacioId, undefined);
    }
    const alquiler = store.alquilar({
      canchaId: "futbol-5-a",
      fecha: hoy,
      hora: "18:00",
      cliente: "Martín Gómez",
      metodo: "efectivo",
    });
    assert.equal(alquiler.ok, true);
    assert.equal(celda(alquiler.estado, "futbol-5-a", "18:00").estado, "alquilada");
    assert.equal(celda(alquiler.estado, "futbol-8", "18:00").estado, "bloqueada");
    assert.match(celda(alquiler.estado, "futbol-8", "18:00").bloqueadaPor.cancha, /Fútbol 5 A/);
    assert.equal(celda(alquiler.estado, "futbol-5-b", "18:00").estado, "libre");
    assert.equal(celda(alquiler.estado, "futbol-5-c", "18:00").estado, "libre");
    assert.equal(celda(alquiler.estado, "voleibol", "18:00").estado, "libre");
    const intento = store.alquilar({
      canchaId: "futbol-8",
      fecha: hoy,
      hora: "18:00",
      cliente: "Club rival",
      metodo: "efectivo",
    });
    assert.equal(intento.ok, false);
  } finally {
    fs.rmSync(archivo, { force: true });
  }
});

test("la cancha grande bloquea a todas las de adentro", () => {
  const { store, archivo } = nuevo();
  try {
    const hoy = hoyISO();
    const alquiler = store.alquilar({
      canchaId: "futbol-8",
      fecha: hoy,
      hora: "15:00",
      cliente: "Torneo interno",
      metodo: "transferencia",
    });
    assert.equal(alquiler.ok, true);
    for (const id of ["futbol-5-a", "futbol-5-b", "futbol-5-c"]) {
      assert.equal(celda(alquiler.estado, id, "15:00").estado, "bloqueada");
    }
    assert.equal(celda(alquiler.estado, "voleibol", "15:00").estado, "libre");
    const intento = store.alquilar({
      canchaId: "futbol-5-b",
      fecha: hoy,
      hora: "15:00",
      cliente: "Otro equipo",
      metodo: "efectivo",
    });
    assert.equal(intento.ok, false);
  } finally {
    fs.rmSync(archivo, { force: true });
  }
});

test("el vóley alquilado bloquea el hándbol del mismo espacio", () => {
  const { store, archivo } = nuevo();
  try {
    const hoy = hoyISO();
    const alquiler = store.alquilar({
      canchaId: "voleibol",
      fecha: hoy,
      hora: "19:00",
      cliente: "Escuela voley",
      metodo: "efectivo",
    });
    assert.equal(alquiler.ok, true);
    assert.equal(celda(alquiler.estado, "handbol", "19:00").estado, "bloqueada");
    assert.equal(celda(alquiler.estado, "futbol-5-b", "19:00").estado, "libre");
    const inverso = store.alquilar({
      canchaId: "handbol",
      fecha: hoy,
      hora: "20:00",
      cliente: "Escuela handbol",
      metodo: "tarjeta",
    });
    assert.equal(inverso.ok, true);
    assert.equal(celda(inverso.estado, "voleibol", "20:00").estado, "bloqueada");
  } finally {
    fs.rmSync(archivo, { force: true });
  }
});

test("la comisión directiva no suma los accesorios", () => {
  const { store, archivo } = nuevo();
  try {
    const hoy = hoyISO();
    const estado = store.snapshot(hoy);
    const pelotaFutbol = estado.accesorios.find((item) => item.nombre === "Pelota de fútbol");
    const pelotaVoley = estado.accesorios.find((item) => item.nombre === "Pelota de vóley");
    const alquiler = store.alquilar({
      canchaId: "futbol-5-b",
      fecha: hoy,
      hora: "16:00",
      cliente: "Laura Méndez",
      metodo: "tarjeta",
      accesorios: [pelotaFutbol.id, pelotaVoley.id],
    });
    assert.equal(alquiler.ok, true);
    const turno = alquiler.estado.resumen.turnos.find((item) => item.cliente === "Laura Méndez");
    assert.equal(turno.monto, 14000 + 1500 + 1000);
    assert.equal(turno.comision, 1400);
    assert.notEqual(turno.comision, Math.round(turno.monto * 10 / 100));
  } finally {
    fs.rmSync(archivo, { force: true });
  }
});

test("una cancha chica nueva dentro de la grande también bloquea", () => {
  const { store, archivo } = nuevo();
  try {
    const hoy = hoyISO();
    assert.equal(store.snapshot(hoy).canchas.filter((cancha) => cancha.dentroDe === "futbol-8").length, 3);
    const alta = store.guardarCancha({
      nombre: "Fútbol 5 D",
      deporte: "Fútbol",
      precio: 14000,
      dentroDe: "futbol-8",
      fecha: hoy,
    });
    assert.equal(alta.ok, true);
    const nueva = alta.estado.canchas.find((cancha) => cancha.nombre === "Fútbol 5 D");
    assert.equal(nueva.dentroDe, "futbol-8");
    const alquiler = store.alquilar({
      canchaId: nueva.id,
      fecha: hoy,
      hora: "12:00",
      cliente: "Equipo nuevo",
      metodo: "efectivo",
    });
    assert.equal(alquiler.ok, true);
    assert.equal(celda(alquiler.estado, "futbol-8", "12:00").estado, "bloqueada");
    assert.equal(celda(alquiler.estado, "futbol-5-a", "12:00").estado, "libre");
    assert.equal(celda(alquiler.estado, "futbol-5-b", "12:00").estado, "libre");
    const grande = store.alquilar({
      canchaId: "futbol-8",
      fecha: hoy,
      hora: "13:00",
      cliente: "Liga",
      metodo: "efectivo",
    });
    assert.equal(grande.ok, true);
    const chica = grande.estado.canchas.find((cancha) => cancha.nombre === "Fútbol 5 D");
    assert.equal(chica.celdas.find((item) => item.hora === "13:00").estado, "bloqueada");
    assert.equal(celda(grande.estado, "futbol-5-a", "13:00").estado, "bloqueada");
    assert.equal(celda(grande.estado, "futbol-5-b", "13:00").estado, "bloqueada");
    assert.equal(celda(grande.estado, "futbol-5-c", "13:00").estado, "bloqueada");
  } finally {
    fs.rmSync(archivo, { force: true });
  }
});

test("alquilar un deporte bloquea al otro y también a la cancha que lo contiene", () => {
  const { store, archivo } = nuevo();
  try {
    const hoy = hoyISO();
    const editada = store.guardarCancha({
      id: "voleibol",
      nombre: "Vóleibol",
      deporte: "Vóleibol",
      precio: 15000,
      dentroDe: "futbol-8",
      compartirCon: "handbol",
      fecha: hoy,
    });
    assert.equal(editada.ok, true);
    const alquiler = store.alquilar({
      canchaId: "handbol",
      fecha: hoy,
      hora: "14:00",
      cliente: "Handbol local",
      metodo: "efectivo",
    });
    assert.equal(alquiler.ok, true);
    assert.equal(celda(alquiler.estado, "voleibol", "14:00").estado, "bloqueada");
    assert.equal(celda(alquiler.estado, "futbol-8", "14:00").estado, "bloqueada");
    assert.equal(celda(alquiler.estado, "futbol-5-a", "14:00").estado, "libre");
    const grande = store.alquilar({
      canchaId: "futbol-8",
      fecha: hoy,
      hora: "16:00",
      cliente: "Fútbol completo",
      metodo: "transferencia",
    });
    assert.equal(grande.ok, true);
    assert.equal(celda(grande.estado, "voleibol", "16:00").estado, "bloqueada");
    assert.equal(celda(grande.estado, "handbol", "16:00").estado, "bloqueada");
    assert.equal(celda(grande.estado, "futbol-5-b", "16:00").estado, "bloqueada");
    assert.equal(celda(grande.estado, "futbol-5-c", "16:00").estado, "bloqueada");
  } finally {
    fs.rmSync(archivo, { force: true });
  }
});

test("cancelar el turno de la chica libera a la grande", () => {
  const { store, archivo } = nuevo();
  try {
    const hoy = hoyISO();
    const alquiler = store.alquilar({
      canchaId: "futbol-5-a",
      fecha: hoy,
      hora: "18:00",
      cliente: "Martín Gómez",
      metodo: "efectivo",
    });
    assert.equal(alquiler.ok, true);
    const turno = alquiler.estado.resumen.turnos.find((item) => item.cliente === "Martín Gómez");
    const cancelado = store.cancelar(turno.id);
    assert.equal(cancelado.ok, true);
    assert.equal(celda(cancelado.estado, "futbol-8", "18:00").estado, "libre");
    assert.equal(celda(cancelado.estado, "futbol-5-a", "18:00").estado, "libre");
    assert.equal(celda(cancelado.estado, "futbol-5-b", "18:00").estado, "libre");
    assert.equal(celda(cancelado.estado, "futbol-5-c", "18:00").estado, "libre");
  } finally {
    fs.rmSync(archivo, { force: true });
  }
});

test("cobrar la cuota del mes suma el monto y la comisión del profesor", () => {
  const { store, archivo } = nuevo();
  try {
    const hoy = hoyISO();
    const antes = store.snapshot(hoy);
    const luca = antes.alumnos.find((alumno) => alumno.nombre === "Luca Gómez");
    assert.notEqual(luca.situacion, "Al día");
    const cobro = store.cobrarCuota(luca.id, hoy);
    assert.equal(cobro.ok, true);
    const cuota = cobro.estado.resumen.cuotasDetalle.find((item) => item.alumno === "Luca Gómez");
    assert.equal(cuota.monto, 25000);
    assert.equal(cuota.comision, 5000);
    assert.equal(cobro.estado.alumnos.find((alumno) => alumno.id === luca.id).situacion, "Al día");
  } finally {
    fs.rmSync(archivo, { force: true });
  }
});
