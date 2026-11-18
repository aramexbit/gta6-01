// PIER HEAT — Sunset Bay v3.3.1: hand-in program for make.fun gta6-01.
// v3.3.1 (18 Nov 2026): Mateo FIXED — the v3.3 build pasted Xbot walk/run
// clips onto the MPFB armature by bone name; the rigs share names but not
// rest orientations, so the FK error reached 179° (hands behind the back,
// legs splayed sideways, jeans crotch web stretched into a skirt, neck
// sheared into a long blonde "second person"). Fixed by a world-space
// delta retarget of idle/walk/run (worst FK error 1.51°); the same Xbot
// locomotion as v3.2 (walk 4.2 / run 8 / sprint 11.5 m/s, 0.3 s crossfade),
// only the model/skin is new. Bright GOLDEN HOUR restored (v3.3 read as
// night), box clouds DELETED and replaced with soft sprite clouds, sun
// moved ahead (+Z) so the chase drives into the sunset, chase shot
// re-staged to the top-rank pattern (7.5 m camera, ~150 KM/H held speed,
// 3 police in a flanking formation with bird/fish callsigns, heli,
// traffic ahead, Kira portrait dialog). Everything else from v3.3 kept:
// pistol in Mateo's hand + authored aim/fire clips, Kenney Car Kit GLB
// cars, Quaternius palm + rock, Poly Haven PBR + sunset HDRI, bloom/grade
// composer, 6 hero roof topologies, foot-fire mission shot.
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
