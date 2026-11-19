// PIER HEAT — Sunset Bay: entrypoint for make.fun gta6-01.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Node 22 standard library only.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const src = join(repoRoot, name);
  const dst = join(outDir, name);
  if (existsSync(src)) cpSync(src, dst, { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
if (dossier.length === 0) throw new Error('buildDossier wrote an empty dossier');
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`PIER HEAT dossier written: ${dossier.length} bytes -> ${join(outDir, 'dossier.json')}`);
