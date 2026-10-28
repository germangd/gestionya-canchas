async function enviar(ruta, cuerpo) {
  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo || {}),
  });
  return respuesta.json();
}

window.canchas = {
  estado: (fecha) => fetch(`/api/estado?fecha=${encodeURIComponent(fecha || "")}`).then((respuesta) => respuesta.json()),
  alquilar: (pedido) => enviar("/api/alquilar", pedido),
  cancelar: (turnoId) => enviar("/api/cancelar", { turnoId }),
  cobrarTurno: (turnoId) => enviar("/api/cobrar-turno", { turnoId }),
  cobrarCuota: (alumnoId, fecha) => enviar("/api/cobrar-cuota", { alumnoId, fecha }),
  agregarAlumno: (alumno, fecha) => enviar("/api/agregar-alumno", { alumno, fecha }),
};
