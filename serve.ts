// PIER HEAT — Sunset Bay v7.5. Tiny static server for local testing.
// Serves the game/ folder at the root: http://localhost:8080/ opens the
// game. Only files under game/ are served; anything else is a 404, no
// directory listing, no cache. Model files are gone in v7.3, so a
// request for one is answered 410 (gone) instead of a silent 404.
// v7.4 also serves /shots.json (the screenshot manifest) from the repo
// root and answers HEAD, so capture scripts can check the game is up
// before screenshotting.
//
//   node serve.ts --port 8095
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');
const args = process.argv.slice(2);
let port = 8080;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) port = Number(args[i + 1]);
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    // v7.4: model files were removed from the game — say so explicitly.
    if (/\.(glb|gltf|fbx|obj)$/i.test(p)) {
      res.writeHead(410); res.end('gone in v7.4: characters are procedural'); return;
    }
    // v7.4: the screenshot manifest lives at the repo root, not game/.
    if (p === '/shots.json') {
      const data = await readFile(join(here, 'shots.json'));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(data); return;
    }
    const file = normalize(join(root, p));
    if (!file.startsWith(root + '/') && file !== root) {
      res.writeHead(404); res.end('not found'); return;
    }
    const data = await readFile(file);
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'content-type': MIME[extname(file)] || 'application/octet-stream',
        'content-length': data.length, 'cache-control': 'no-store',
      });
      res.end(); return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch {
    console.error('404', req.url);
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log('pier heat v7.5 — serving game/ at http://localhost:' + port + '/ (shots.json at /shots.json)'));
