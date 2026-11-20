// PIER HEAT — Sunset Bay (v6.6)
// main.ts — the entry program: copies game/ and screenshots/ into the
// output directory and writes dossier.json with the kit's buildDossier.
// The caps below are the bounty's gate caps (see the kit's RULES.txt):
// 160 KiB of source text, at most 4 screenshots of 256 KiB each, at most
// 993 game entries totalling 48 MiB, paths at most 1000 bytes.
// Run from the repository root:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = (process.env.MAKEFUN_OUTPUT_DIR || 'out').replace(/\/+$/, '');
const repo = process.cwd();

// Fresh output every run, so two runs write identical bytes.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(`${repo}/game`, `${outDir}/game`, { recursive: true });
cpSync(`${repo}/screenshots`, `${outDir}/screenshots`, { recursive: true });

let dossier;
try {
  dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
} catch (e) {
  console.error(`PIER HEAT dossier failed: ${e.message}`);
  process.exit(1);
}
writeFileSync(`${outDir}/dossier.json`, dossier);
console.log(`PIER HEAT v6.6 dossier written to ${outDir}/dossier.json (${dossier.length} bytes)`);
