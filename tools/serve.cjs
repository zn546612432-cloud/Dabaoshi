const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mime = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".ogg": "audio/ogg", ".wav": "audio/wav"};
http.createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + (name === "/" ? "/index.html" : name));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  response.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).on("error", () => { response.statusCode = 404; response.end(); }).pipe(response);
}).listen(4173, "127.0.0.1", () => console.log("Dabaoshi at http://127.0.0.1:4173"));
