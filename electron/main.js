const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { crearStore } = require("./store");

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#f4f6f1",
    title: "GestiónYa Canchas",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  ventana.loadFile(path.join(__dirname, "..", "src", "index.html"));
}

app.whenReady().then(() => {
  const store = crearStore(path.join(app.getPath("userData"), "datos.json"));
  ipcMain.handle("estado", (_evento, fecha) => store.snapshot(fecha || undefined));
  ipcMain.handle("alquilar", (_evento, pedido) => store.alquilar(pedido));
  ipcMain.handle("cancelar", (_evento, turnoId) => store.cancelar(turnoId));
  ipcMain.handle("cobrar-turno", (_evento, turnoId) => store.cobrarTurno(turnoId));
  ipcMain.handle("cobrar-cuota", (_evento, pedido) => store.cobrarCuota(pedido.alumnoId, pedido.fecha));
  ipcMain.handle("agregar-alumno", (_evento, pedido) => store.agregarAlumno(pedido.alumno, pedido.fecha));
  ipcMain.handle("guardar-cancha", (_evento, pedido) => store.guardarCancha(pedido));
  ipcMain.handle("guardar-accesorio", (_evento, pedido) => store.guardarAccesorio(pedido));
  ipcMain.handle("guardar-comision", (_evento, pedido) => store.guardarComision(pedido));
  crearVentana();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
