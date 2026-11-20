// PIER HEAT — Sunset Bay (v6.5)
// serve.ts — a tiny static server for local play-testing.
// Serves game/ at the root, so http://localhost:8080/ opens the game.
// Usage: node serve.ts [--port 8080]
// It serves only files under game/: anything else is a 404, never a
// directory listing, so the game cannot accidentally leak other files.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx >= 0 ? Number(args[portIdx + 1]) || 8080 : 8080;
const root = join(process.cwd(), 'game');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') path = '/index.html';
    const file = join(root, path);
    if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
    const data = await readFile(file);
    // No caching while play-testing: a reload always shows the latest build.
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch (e) {
    console.log(`404 ${req.url}`);
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`PIER HEAT serving game/ at http://localhost:${port}/`);
});
