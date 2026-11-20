// PIER HEAT — Sunset Bay, v6.8 entry for the make.fun gta6-01 bounty.
// This file is the program's entry point: it hands the game in by copying
// the static game folder and the four screenshots beside this file into
// the output directory, then writes the dossier summary with the vendored
// make.fun library. Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outDir, { recursive: true });

  // The whole playable game, exactly as it sits in the repository.
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

  // The four staged screenshots of the game itself.
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(join(repoRoot, 'screenshots'))) {
    cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  }

  // The dossier the judge reads: source outline + contact sheet. The caps
  // below are the scorer's own (see the kit's reference/gate.json): at most
  // four screenshots of 256 KiB, a game folder under 48 MiB / 993 files.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  // Say what was handed in, so a local run shows the same numbers the
  // kit check will judge: dossier size and every screenshot's bytes.
  const shots = ['1-chase.jpg', '2-onfoot.jpg', '3-mission.jpg', '4-combat.jpg'];
  for (const name of shots) {
    const p = join(outDir, 'screenshots', name);
    if (existsSync(p)) console.log(`shot ${name}: ${statSync(p).size} bytes`);
  }
  console.log(`dossier.json: ${statSync(join(outDir, 'dossier.json')).size} bytes`);
}

handIn();
