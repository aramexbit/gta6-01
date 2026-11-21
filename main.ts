// PIER HEAT — Sunset Bay v7.3 (Node 22, standard library only).
// Copies game/ and screenshots/ from beside this file to the output
// directory and writes /output/dossier.json with the vendored make.fun
// library. v7.3 is fully procedural: the build refuses any binary model
// file under game/ (the GLB that got v7.2 rejected must never come back).
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in
// for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
// v7.3 gate: no binary model files may ship in game/ any more.
function assertNoModelFiles(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) assertNoModelFiles(p);
    else if (/\.(glb|gltf|fbx|obj)$/i.test(entry.name)) {
      throw new Error('v7.3: model file must not ship: ' + p);
    }
  }
}
assertNoModelFiles(join(here, 'game'));
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log('dossier bytes:', Buffer.byteLength(dossier));
for (const f of readdirSync(join(out, 'screenshots')).sort()) {
  console.log('screenshot', f, statSync(join(out, 'screenshots', f)).size, 'bytes');
}
