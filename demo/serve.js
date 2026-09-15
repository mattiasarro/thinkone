/* Väike staatiline server demo eelvaateks (brauseriautomaatika/ekraanipildid).
   Käivita: node serve.js  →  http://localhost:8471/
   Topeltklõps demo/index.html töötab endiselt ilma serverita. */
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "demo");
const PORT = 8471;
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png",
  ".pdf": "application/pdf", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store", // alati värske — v=NN riitus on file:// jaoks
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`ThinkOne demo: http://localhost:${PORT}/`));
