# Mateo Vega — the model (v7.2)

## The character
Mateo Vega, 28, getaway driver. Burnt-orange bomber jacket, white tee, dark
jeans. Low-poly face: two small dark eyes and a simple mouth line, built as
tiny meshes so the face reads in screenshots from any angle.

## The file
`game/vendor/mateo.glb` is an animated human model (CC0). It is loaded by a
minimal GLB reader written for this game in `game/core.js`
(`PH.loadGLB`) — no external loader library is used. The reader parses the
binary glTF container (JSON chunk + BIN chunk), builds geometry from the
accessors (position / normal / UV / index, plus skin joints and weights),
materials from base-color factors, the node hierarchy (translation /
rotation / scale or a full matrix), skins with a skeleton and inverse bind
matrices, and rebuilds animation clips from the channels.

## Materials (as named in the file)
MateoSkin, MateoHair, MateoEyes, MateoJacket, MateoTee, MateoJeans,
MateoSneaker, MateoSole.

## Animations (as named in the file)
`idle`, `run`, `walk`, `aim`, `fire`.

## Armature scale — read this before touching the loader
The armature root carries a large uniform scale (about 69x). The loader
KEEPS it (rev 3). The height is measured from the skeleton itself
(`HeadTop_End` down to the toe ends) and the root is scaled so the person
is 1.8 m tall standing on the ground (feet at local Y = 0).

> Rev 4 lesson — the bind matrix: `bind()` was first called with the
> mesh's world matrix (69.18x from the armature scale), which inflated
> every vertex 69x — the model rendered ~126 units tall with giant white
> sneakers, while its bones stood at the correct 1.8 m. The file's inverse
> bind matrices already map mesh-local vertices into joint space, so the
> bind matrix must be identity. With bindMode 'attached'
> (`bindMatrixInverse` = current world inverse), the shader then reduces
> to the glTF formula `jointWorld x IBM x vertex`. Verified by probe: the
> head vertex lands at world y≈3.0 instead of y≈117.

## Facing
The model's face points along local +X in mesh space (the `MateoEyes`
geometry sits at +X). The wrapper therefore exposes `forwardOffset`
(-PI/2): a movement heading h (0 = south, +Z) is applied as
`rotation.y = h + forwardOffset`.

## Retinting
`PH.retint` recolours named materials after load. Mateo's jacket is
recoloured to burnt orange `0xff7a1a` — note: `0xFF9900` was tried and still
rendered yellow under this engine's sun, so `0xff7a1a` is the colour that
actually reads orange. Kira is the same model recoloured: teal jacket
`0x0e7a7a`, dark tee `0x222831`, dark hair `0x2a1a12`.

## Face
The face (two dark eyes + mouth) is attached to the bone named `Head`, so it
follows the animation. Its size is computed from the raw height of the
model, so it stays proportional after normalisation.

## Fallback
If the GLB cannot be loaded, the game falls back to a procedural
stand-in person (same jacket colour) and records the failure in
`window.__errors`, so the scene still renders instead of going black.
