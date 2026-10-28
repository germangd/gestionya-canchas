const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("canchas", {
  estado: (fecha) => ipcRenderer.invoke("estado", fecha),
  alquilar: (pedido) => ipcRenderer.invoke("alquilar", pedido),
  cancelar: (turnoId) => ipcRenderer.invoke("cancelar", turnoId),
  cobrarTurno: (turnoId) => ipcRenderer.invoke("cobrar-turno", turnoId),
  cobrarCuota: (alumnoId, fecha) => ipcRenderer.invoke("cobrar-cuota", { alumnoId, fecha }),
  agregarAlumno: (alumno, fecha) => ipcRenderer.invoke("agregar-alumno", { alumno, fecha }),
});
