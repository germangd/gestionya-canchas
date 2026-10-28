const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("canchas", {
  estado: (fecha) => ipcRenderer.invoke("estado", fecha),
  alquilar: (pedido) => ipcRenderer.invoke("alquilar", pedido),
  cancelar: (turnoId) => ipcRenderer.invoke("cancelar", turnoId),
  cobrarTurno: (turnoId) => ipcRenderer.invoke("cobrar-turno", turnoId),
  cobrarCuota: (alumnoId, fecha) => ipcRenderer.invoke("cobrar-cuota", { alumnoId, fecha }),
  agregarAlumno: (alumno, fecha) => ipcRenderer.invoke("agregar-alumno", { alumno, fecha }),
  guardarCancha: (pedido) => ipcRenderer.invoke("guardar-cancha", pedido),
  guardarAccesorio: (pedido) => ipcRenderer.invoke("guardar-accesorio", pedido),
  guardarComision: (pedido) => ipcRenderer.invoke("guardar-comision", pedido),
  licencia: {
    getStatus: () => ipcRenderer.invoke("license:getStatus"),
    getEdition: () => ipcRenderer.invoke("app:getEditionStatus"),
    activate: (licenseKey, meta) => ipcRenderer.invoke("license:activate", licenseKey, meta || {}),
    validateOnline: () => ipcRenderer.invoke("license:validateOnline"),
    heartbeat: () => ipcRenderer.invoke("license:heartbeat"),
  },
});
