"use strict";

const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const DEMO_LICENSE_FILE = "demo-license.v1.json";
const DEMO_DAYS_FALLBACK = 7;
const DEMO_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const DEMO_SIGNATURE_NAMESPACE = "gestionya-canchas-demo-v1";
const DEMO_SECRET = ["GestionYaCanchas", "Demo", "Proteccion", "Local"].join("::");

function getMachineFingerprint() {
  const base = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.userInfo?.()?.username || "",
    os.cpus()?.[0]?.model || "",
    os.totalmem(),
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex");
}

function buildLicenseSignature(payload, machineHash) {
  const h = crypto.createHmac("sha256", DEMO_SECRET);
  h.update(DEMO_SIGNATURE_NAMESPACE);
  h.update("|");
  h.update(machineHash);
  h.update("|");
  h.update(JSON.stringify(payload));
  return h.digest("hex");
}

function readState(licensePath) {
  try {
    if (!fs.existsSync(licensePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(licensePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.payload || !parsed.signature) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeState(licensePath, payload, machineHash) {
  const folder = require("path").dirname(licensePath);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    licensePath,
    JSON.stringify({ payload, signature: buildLicenseSignature(payload, machineHash) }, null, 2),
    "utf8"
  );
}

function evaluate({ stored, now, machineHash, demoDays }) {
  const days = Number(demoDays) > 0 ? Math.floor(Number(demoDays)) : DEMO_DAYS_FALLBACK;
  if (!stored) {
    return {
      status: { ok: true, isDemo: true, daysLeft: days },
      write: {
        payload: {
          firstRunAt: now,
          lastSeenAt: now,
          machineHash,
          demoDays: days,
        },
      },
    };
  }

  const expected = buildLicenseSignature(stored.payload, machineHash);
  if (expected !== stored.signature) {
    return {
      status: {
        ok: false,
        isDemo: true,
        reason: "Se detectó modificación de archivos de licencia demo.",
      },
    };
  }

  const payload = stored.payload || {};
  if (payload.machineHash !== machineHash) {
    return {
      status: {
        ok: false,
        isDemo: true,
        reason: "La licencia demo no corresponde a este equipo.",
      },
    };
  }

  const firstRunAt = Number(payload.firstRunAt);
  const lastSeenAt = Number(payload.lastSeenAt);
  const storedDays = Number(payload.demoDays) || days;
  if (!Number.isFinite(firstRunAt) || !Number.isFinite(lastSeenAt) || firstRunAt <= 0 || lastSeenAt <= 0) {
    return {
      status: {
        ok: false,
        isDemo: true,
        reason: "Estado demo inválido. Reinstalá la app de demo.",
      },
    };
  }

  if (now + DEMO_CLOCK_TOLERANCE_MS < lastSeenAt) {
    return {
      status: {
        ok: false,
        isDemo: true,
        reason: "Se detectó retroceso del reloj del sistema.",
      },
    };
  }

  const expiresAt = firstRunAt + storedDays * 24 * 60 * 60 * 1000;
  if (now > expiresAt) {
    return {
      status: {
        ok: false,
        isDemo: true,
        reason: `La versión Demo de ${storedDays} días venció.`,
      },
    };
  }

  const msLeft = Math.max(0, expiresAt - now);
  return {
    status: { ok: true, isDemo: true, daysLeft: Math.ceil(msLeft / (24 * 60 * 60 * 1000)) },
    write: {
      payload: {
        ...payload,
        demoDays: storedDays,
        lastSeenAt: now,
      },
    },
  };
}

module.exports = {
  DEMO_LICENSE_FILE,
  DEMO_DAYS_FALLBACK,
  getMachineFingerprint,
  buildLicenseSignature,
  readState,
  writeState,
  evaluate,
};
