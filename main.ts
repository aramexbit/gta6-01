// PIER HEAT — Sunset Bay v3.4: hand-in program for make.fun gta6-01.
// v3.4 (18 Nov 2026): MATEO REPLACED. The v3.3 MPFB2 model's mesh was
// defective (upper arms fused to the torso, cube-segment pale hands,
// googly eyes) and three rounds of pose fixes could not repair it, so
// the model was replaced, not patched: Quaternius "Animated Human"
// (Poly Pizza, CC0 1.0) with 8 procedural materials split in Blender
// (amber jacket, white tee V, dark jeans, white sneakers + baked dark
// soles), its own Idle/Walk/Run clips (in-place, facing-fixed so all
// clips face +X), and aim/fire retargeted at the glTF level from the
// Universal Animation Library (CC0). All MPFB runtime code
// (mateoFixHands, collar, sole slabs, sleeves) deleted from world.js.
// Everything else is v3.3.2/v3.3.3 unchanged: two separate jeans legs,
// burnt-orange jacket, bright golden hour, soft sprite clouds,
// top-rank chase shot, pistol + aim. See game/MATEO-MODEL.md.
// v3.3.3 (18 Nov 2026): HANDS ONLY — no rebuild. Round-4 diagnosis
// (independent, measured in the browser) found the idle/walk hands
// holding palms-up like trays at waist height: the MPFB hand's bind
// pose has the palm facing sideways, 90 deg off the Mixamo/Xbot
// convention, and the retargeted clips barely rotate the wrist
// (idle: Hand 9-14 deg, ForeArm 8-13 deg). Fix, probe-verified
// (mateo-hands-B-foreY90.jpg): a fixed mirrored pronation of the
// ForeArm bones (Left +90 deg / Right -90 deg about local Y) applied
// after every mixer update for idle/walk/run only, plus finger-curl
// damping halfway toward the bind pose, plus orange sleeve cylinders
// on the ForeArm bones so the forearm is no longer bare skin from
// elbow to wrist. Aim/fire keep the authored grip (trigger finger
// extended, right fist). Everything else is v3.3.2 unchanged: two
// separate jeans legs (skirt gone), burnt-orange jacket, bright
// golden hour, soft sprite clouds, top-rank chase shot.
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
