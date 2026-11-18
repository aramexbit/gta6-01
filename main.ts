// PIER HEAT — Sunset Bay v3.3: hand-in program for make.fun gta6-01.
// v3.3: realistic MPFB2 Mateo (replaces the Xbot mannequin + vertex-paint
// jacket — real clothing geometry, jacket visible from the back),
// pistol in Mateo's hand + authored aim/fire clips (viewmodel only
// while aiming), Kenney Car Kit GLB cars with spinning/steering wheels
// and body roll, Quaternius palm + rock, Poly Haven PBR textures +
// sunset HDRI environment + custom bloom/grade composer, 6 hero roof
// topologies, mission shot re-staged as a foot fire scene.
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
