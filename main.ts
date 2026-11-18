// PIER HEAT — Sunset Bay: hand-in program for make.fun gta6-01.
// Copies game/ and screenshots/ from this repository to /output (or
// MAKEFUN_OUTPUT_DIR outside the grader) and writes /output/dossier.json
// with buildDossier from vendor/makefun-game.ts.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = dirname(fileURLToPath(new URL('./main.ts', import.meta.url)));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(repo, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(repo, 'screenshots'), join(out, 'screenshots'), { recursive: true });
writeFileSync(join(out, 'dossier.json'), buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));
console.log('dossier written to', join(out, 'dossier.json'));
