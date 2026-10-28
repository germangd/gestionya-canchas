const http = require("http");
const fs = require("fs");
const path = require("path");
const { crearStore } = require("./electron/store");

const raiz = __dirname;
const store = crearStore(path.join(raiz, "data", "preview.json"));
const puerto = 4173;

const tipos = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    req.on("data", (parte) => partes.push(parte));
    req.on("end", () => {
      if (!partes.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(partes).toString("utf8"))); }
      catch (error) { reject(error); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${puerto}`);
  try {
    if (url.pathname === "/api/estado") {
      return json(res, store.snapshot(url.searchParams.get("fecha") || undefined));
    }
    if (req.method === "POST") {
      const cuerpo = await leerCuerpo(req);
      if (url.pathname === "/api/alquilar") return json(res, store.alquilar(cuerpo));
      if (url.pathname === "/api/cancelar") return json(res, store.cancelar(cuerpo.turnoId));
      if (url.pathname === "/api/cobrar-turno") return json(res, store.cobrarTurno(cuerpo.turnoId));
      if (url.pathname === "/api/cobrar-cuota") return json(res, store.cobrarCuota(cuerpo.alumnoId, cuerpo.fecha));
      if (url.pathname === "/api/agregar-alumno") return json(res, store.agregarAlumno(cuerpo.alumno, cuerpo.fecha));
      if (url.pathname === "/api/guardar-cancha") return json(res, store.guardarCancha(cuerpo));
      if (url.pathname === "/api/guardar-accesorio") return json(res, store.guardarAccesorio(cuerpo));
      if (url.pathname === "/api/guardar-comision") return json(res, store.guardarComision(cuerpo));
    }
    let archivo = url.pathname === "/" ? "/src/index.html" : url.pathname;
    if (archivo === "/preview-bridge.js") archivo = "/preview-bridge.js";
    else if (!archivo.startsWith("/src/")) archivo = `/src${archivo}`;
    const disco = path.join(raiz, archivo.replace(/\//g, path.sep));
    if (!disco.startsWith(raiz) || !fs.existsSync(disco)) {
      res.writeHead(404);
      res.end("No está");
      return;
    }
    let cuerpo = fs.readFileSync(disco);
    if (archivo.endsWith("index.html")) {
      cuerpo = Buffer.from(cuerpo.toString("utf8").replace(
        '<script src="renderer.js"></script>',
        '<script src="/preview-bridge.js"></script><script src="renderer.js"></script>'
      ));
    }
    res.writeHead(200, { "Content-Type": tipos[path.extname(disco)] || "text/plain" });
    res.end(cuerpo);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
});

function json(res, cuerpo) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(cuerpo));
}

server.listen(puerto, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${puerto}`);
});
