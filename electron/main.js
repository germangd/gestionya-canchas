const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { crearStore } = require("./store");
const licenseService = require("./licenseService");
const demoLicense = require("./demoLicense");

function leerPackage() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  } catch (_) {
    return {};
  }
}

function getEditionInfo() {
  const pkg = leerPackage();
  const envEdition = String(process.env.APP_EDITION || "").trim().toLowerCase();
  const pkgEdition = String(pkg.edition || "").trim().toLowerCase();
  const isDemo = envEdition === "demo" || pkgEdition === "demo" || pkg.demoEdition === true;
  const days = Number(pkg.demoDays);
  return {
    isDemo,
    demoDays: Number.isFinite(days) && days > 0 ? Math.floor(days) : demoLicense.DEMO_DAYS_FALLBACK,
  };
}

if (getEditionInfo().isDemo) {
  app.setPath("userData", path.join(app.getPath("appData"), "GestionYa Canchas Demo"));
}

let demoSessionStatus = null;

function rutaDemo() {
  return path.join(app.getPath("userData"), demoLicense.DEMO_LICENSE_FILE);
}

function validateDemoGuard() {
  const edition = getEditionInfo();
  if (!edition.isDemo) return { ok: true, isDemo: false };
  const machineHash = demoLicense.getMachineFingerprint();
  const result = demoLicense.evaluate({
    stored: demoLicense.readState(rutaDemo()),
    now: Date.now(),
    machineHash,
    demoDays: edition.demoDays,
  });
  if (result.write) demoLicense.writeState(rutaDemo(), result.write.payload, machineHash);
  return result.status;
}

function estadoLicencia() {
  const edition = getEditionInfo();
  if (!app.isPackaged && !edition.isDemo) {
    return { valid: true, mode: "development", reason: null, signatureVerified: true };
  }
  if (edition.isDemo) {
    const commercial = licenseService.evaluateLocalLicense();
    if (commercial.mode === "full" || commercial.mode === "grace" || commercial.mode === "read_only") {
      return commercial;
    }
    if (!demoSessionStatus) demoSessionStatus = validateDemoGuard();
    if (demoSessionStatus.ok && demoSessionStatus.isDemo) {
      return { valid: true, mode: "demo_trial", reason: null, signatureVerified: true };
    }
    return commercial;
  }
  return licenseService.evaluateLocalLicense();
}

function exigirEscritura() {
  const estado = estadoLicencia();
  if (estado.mode === "full" || estado.mode === "grace" || estado.mode === "demo_trial" || estado.mode === "development") {
    return null;
  }
  if (estado.mode === "read_only") {
    return { ok: false, error: "Licencia en modo solo lectura. Revalidá online en Configuración." };
  }
  return { ok: false, error: "Sin licencia activa. Activala en Configuración." };
}

function conEscritura(handler) {
  return (evento, pedido) => {
    const bloqueo = exigirEscritura();
    if (bloqueo) return bloqueo;
    return handler(evento, pedido);
  };
}

function crearVentana() {
  const edition = getEditionInfo();
  const ventana = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#f4f6f1",
    icon: path.join(__dirname, "..", "assets", "icono-canchas.png"),
    title: edition.isDemo ? "GestiónYa Canchas Demo" : "GestiónYa Canchas",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  ventana.loadFile(path.join(__dirname, "..", "src", "index.html"));
}

app.whenReady().then(() => {
  demoSessionStatus = validateDemoGuard();
  if (!demoSessionStatus.ok && demoSessionStatus.isDemo) {
    dialog.showMessageBoxSync({
      type: "error",
      title: "Demo expirada o inválida",
      message: "No se puede iniciar esta versión Demo.",
      detail: `${demoSessionStatus.reason}\n\nSolicitá la versión completa para seguir usando el sistema.`,
    });
    app.quit();
    return;
  }

  const store = crearStore(path.join(app.getPath("userData"), "datos.json"), {
    vacio: app.isPackaged,
  });
  ipcMain.handle("estado", (_evento, fecha) => store.snapshot(fecha || undefined));
  ipcMain.handle("alquilar", conEscritura((_evento, pedido) => store.alquilar(pedido)));
  ipcMain.handle("cancelar", conEscritura((_evento, turnoId) => store.cancelar(turnoId)));
  ipcMain.handle("cobrar-turno", conEscritura((_evento, turnoId) => store.cobrarTurno(turnoId)));
  ipcMain.handle("cobrar-cuota", conEscritura((_evento, pedido) => store.cobrarCuota(pedido.alumnoId, pedido.fecha)));
  ipcMain.handle("agregar-alumno", conEscritura((_evento, pedido) => store.agregarAlumno(pedido.alumno, pedido.fecha)));
  ipcMain.handle("guardar-cancha", conEscritura((_evento, pedido) => store.guardarCancha(pedido)));
  ipcMain.handle("guardar-accesorio", conEscritura((_evento, pedido) => store.guardarAccesorio(pedido)));
  ipcMain.handle("guardar-comision", conEscritura((_evento, pedido) => store.guardarComision(pedido)));
  ipcMain.handle("guardar-cliente", conEscritura((_evento, pedido) => store.guardarCliente(pedido)));
  ipcMain.handle("eliminar-cliente", conEscritura((_evento, clienteId) => store.eliminarCliente(clienteId)));

  ipcMain.handle("app:getEditionStatus", async () => {
    try {
      if (!demoSessionStatus) demoSessionStatus = validateDemoGuard();
      if (!demoSessionStatus.ok) {
        return { status: "error", message: demoSessionStatus.reason || "Demo inválida" };
      }
      return {
        status: "ok",
        isDemo: !!demoSessionStatus.isDemo,
        daysLeft: Number.isFinite(demoSessionStatus.daysLeft) ? demoSessionStatus.daysLeft : null,
      };
    } catch (err) {
      return { status: "error", message: err.message };
    }
  });

  ipcMain.handle("license:getStatus", async () => {
    try {
      return { status: "ok", ...estadoLicencia() };
    } catch (err) {
      return { status: "error", message: err.message };
    }
  });

  ipcMain.handle("license:activate", async (_evento, licenseKey, meta = {}) => {
    try {
      const key = String(licenseKey || "").trim();
      if (!key) return { status: "error", message: "La clave de licencia es obligatoria." };
      const data = await licenseService.activateLicense(key, meta);
      return { status: "ok", data };
    } catch (err) {
      return { status: "error", message: err.message, code: err.code || null };
    }
  });

  ipcMain.handle("license:validateOnline", async () => {
    try {
      const data = await licenseService.validateOnline();
      return { status: "ok", data };
    } catch (err) {
      return { status: "error", message: err.message, code: err.code || null };
    }
  });

  ipcMain.handle("license:heartbeat", async () => {
    try {
      const data = await licenseService.heartbeat();
      return { status: "ok", data };
    } catch (err) {
      return { status: "error", message: err.message, code: err.code || null };
    }
  });

  crearVentana();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
