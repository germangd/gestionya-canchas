"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const demo = require("../electron/demoLicense");

const hash = "equipo-de-prueba";
const ahora = Date.parse("2026-10-28T12:00:00.000Z");
const dia = 24 * 60 * 60 * 1000;

test("la demo nueva arranca con los días completos y deja constancia firmada", () => {
  const resultado = demo.evaluate({ stored: null, now: ahora, machineHash: hash, demoDays: 7 });
  assert.equal(resultado.status.ok, true);
  assert.equal(resultado.status.daysLeft, 7);
  const firma = demo.buildLicenseSignature(resultado.write.payload, hash);
  const otra = demo.evaluate({
    stored: { payload: resultado.write.payload, signature: firma },
    now: ahora + dia,
    machineHash: hash,
    demoDays: 7,
  });
  assert.equal(otra.status.ok, true);
  assert.equal(otra.status.daysLeft, 6);
});

test("una demo vencida o alterada no sigue", () => {
  const payload = { firstRunAt: ahora - 8 * dia, lastSeenAt: ahora - dia, machineHash: hash, demoDays: 7 };
  const vencida = demo.evaluate({
    stored: { payload, signature: demo.buildLicenseSignature(payload, hash) },
    now: ahora,
    machineHash: hash,
    demoDays: 7,
  });
  assert.equal(vencida.status.ok, false);
  assert.match(vencida.status.reason, /venció/);

  const alterada = demo.evaluate({
    stored: { payload, signature: "firma-falsa" },
    now: ahora,
    machineHash: hash,
    demoDays: 7,
  });
  assert.match(alterada.status.reason, /modificación/);
});
