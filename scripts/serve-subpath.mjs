// Sirve dist/ bajo un prefijo de ruta, imitando GitHub Pages en https://usuario.github.io/<repo>/
// Uso: node scripts/serve-subpath.mjs [puerto=4180] [prefijo=/photoguard-family/]
// Cabeceras parecidas a Pages: cache-control public, max-age=600.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 4180);
const prefix = process.argv[3] ?? '/photoguard-family/';
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json'
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(prefix)) {
    // GitHub Pages devuelve 404 fuera del prefijo del repo.
    res.writeHead(404).end('404');
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  try {
    const info = await stat(file);
    const path = info.isDirectory() ? join(file, 'index.html') : file;
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=600'
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('404');
  }
}).listen(port, () => console.log(`http://localhost:${port}${prefix}`));
