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

test("el fútbol 5 alquilado bloquea el fútbol 8 de la misma cancha", () => {
  const { store, archivo } = nuevo();
  const hoy = hoyISO();
  const estado = store.snapshot(hoy);
  const futbol8 = estado.canchas.find((cancha) => cancha.id === "f8-norte");
  const dieciocho = futbol8.celdas.find((celda) => celda.hora === "18:00");
  assert.equal(dieciocho.estado, "bloqueada");
  assert.match(dieciocho.bloqueadaPor.cancha, /Fútbol 5/);
  const intento = store.alquilar({
    canchaId: "f8-norte",
    fecha: hoy,
    hora: "18:00",
    cliente: "Club rival",
    metodo: "efectivo",
    monto: 28000,
  });
  assert.equal(intento.ok, false);
  fs.unlinkSync(archivo);
});

test("cancelar el turno libera la cancha superpuesta", () => {
  const { store, archivo } = nuevo();
  const hoy = hoyISO();
  const cancelado = store.cancelar("t1");
  assert.equal(cancelado.ok, true);
  const futbol8 = cancelado.estado.canchas.find((cancha) => cancha.id === "f8-norte");
  assert.equal(futbol8.celdas.find((celda) => celda.hora === "18:00").estado, "libre");
  fs.unlinkSync(archivo);
});

test("un turno fiado entra en las deudas y se puede cobrar", () => {
  const { store, archivo } = nuevo();
  const hoy = hoyISO();
  const antes = store.snapshot(hoy).resumen;
  assert.ok(antes.deudasTurnos.some((turno) => turno.cliente === "Diego Sosa"));
  const cobrado = store.cobrarTurno("t3");
  assert.equal(cobrado.ok, true);
  assert.equal(cobrado.estado.resumen.deudasTurnos.some((turno) => turno.id === "t3"), false);
  fs.unlinkSync(archivo);
});

test("cobrar la cuota del mes suma el monto y la comisión del profesor", () => {
  const { store, archivo } = nuevo();
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
  fs.unlinkSync(archivo);
});

test("vóley alquilado bloquea hándbol en la misma cancha", () => {
  const { store, archivo } = nuevo();
  const hoy = hoyISO();
  const hand = store.snapshot(hoy).canchas.find((cancha) => cancha.id === "hand-sur");
  assert.equal(hand.celdas.find((celda) => celda.hora === "19:00").estado, "bloqueada");
  fs.unlinkSync(archivo);
});
