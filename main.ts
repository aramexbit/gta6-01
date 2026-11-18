// PIER HEAT — Sunset Bay v3.3.2: hand-in program for make.fun gta6-01.
// v3.3.2 (18 Nov 2026): Mateo FIXED for real this time — the v3.3.1
// "fixes" were wrong in both directions, proven by an independent
// measurement round (round 3) plus this session's own component/section
// analysis of mateo.glb:
//   * GAMMA (the skirt's main cause): v3.3.1 wrote sRGB numbers
//     [0.137,0.137,0.227] raw into the LINEAR baseColorFactor, so the
//     jeans rendered as light grey-blue #686883 — a waist-to-ankle
//     light mass that reads as a skirt. v3.3's [0.017,0.017,0.042] was
//     the CORRECT linear value for sRGB #23233A. Restored.
//   * ENVELOPE TUBE (the skirt's geometry): the jeans mesh is three
//     coincident walls; two are separate leg tubes (gap 0.16 m at
//     y=0.5) and the third is one enclosing tube spanning both legs.
//     The body mesh has the same structure. The enclosing tubes are
//     deleted below y=0.85 (real index rebuild: jeans 6194 -> 4748
//     tris, body 36972 -> 35976; jeans triangles crossing x=0 below
//     y=0.85: 0). The "397 web triangles" of v3.3.1 were only the
//     crotch tip of that tube — degenerating them changed nothing.
//     A stray 5.4 cm cube at the model origin (12 tris) is deleted too.
//   * JACKET: shifted toward orange (sRGB #CC5A12) so it reads burnt
//     orange, not red, under the magenta sunset + ACES.
//   * COLLAR + SOLES (runtime, world.js): a flared burnt-orange collar
//     on the Neck bone covers the neck/trapezius strips above the
//     jacket (jacket ends y 1.58); dark sole slabs parented to the
//     Foot bones make the white sneakers read as sneakers, not feet.
//   * SPLAY deliberately NOT applied: measured leg gap at y=0.5 is
//     0.176 m (not <0.05 m), and the bone test shows no clean
//     single-axis splay for this rig (local Z+6deg also swings the foot
//     5 cm backward; Z-6deg crosses the legs 15 cm inward). Separation
//     is verified in the browser probe instead.
// Kept from v3.3.1: world-space retargeted locomotion (worst FK error
// 1.51 deg; same Xbot walk/run as v3.2), bright golden hour, soft
// sprite clouds (no box clouds), top-rank chase shot, pistol + aim.
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
