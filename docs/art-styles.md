# Art style drafts — characters & cosmetics

Draft of a few different GENERATED art styles (todo: "draft a few different
generated art styles for characters and cosmetics"). Each style below is the
SAME set of base sprites — 4 characters (classic human, long-hair human, fox
critter, marmot critter), all 4 pickaxes, the gem and mineral-chunk icons,
and one full cave row — run through one pure grid transform, so the sheets
compare styles, not content.

All styles live in `src/utils/graphics/stylePasses.ts` (pure
`PixelGrid -> PixelGrid` passes over the existing `pixelArt.ts` /
`caveTiles.ts` grids — no new assets, no new dependencies) and are tested in
`src/utils/graphics/stylePasses.test.ts`. They are **not wired into the app**
— this is the draft the decision picks from.

Contact sheets (340×184, dark slate ground so light and dark styles judge
the same; re-render with `node scripts/generate-art-style-samples.mjs`):

| id | sheet | one-liner |
| --- | --- | --- |
| `flat` | ![flat](samples/flat.png) | the current in-game look — hand-placed pixels, no post-processing (baseline) |
| `mono` | ![mono](samples/mono.png) | 1-bit woodcut — Bayer 4×4 dither to ink + paper |
| `retro16` | ![retro16](samples/retro16.png) | console 8-bit — every color snaps to a curated 16-color palette |
| `outline` | ![outline](samples/outline.png) | cartoon cel — base colors + 1px near-black edge around every sprite |

## Style notes

**`flat` (baseline).** What ships today. Pros: the reference point; zero
cost; already tuned. Cons: individual sprites read fine, but a 16×16 sprite
has so few pixels that per-sprite palettes don't cohere across the screen.

**`mono` — 1-bit dither.** `BAYER_4[y%4][x%4]` ordered dither on luminance,
2 colors only (ink `#1a1a1a`, paper `#f4efe6`). Pros: the strongest
character — poster/woodcut look, every sprite unmistakably "the game";
trivial to implement; inks beautifully on dark cave themes. Cons: kills all
color (outfit/pickaxe identity now rides silhouette + dither alone — a gold
pickaxe and a steel pickaxe look nearly the same); the cave row dithers to a
busy texture at 1× (it reads better at the 2× canvas stretch the app applies,
which should be checked in-situ before adopting).

**`retro16` — 16-color console.** Nearest-neighbor snap of every pixel to a
curated 16 (curated from the palettes already in circulation — skins, furs,
cloths, stone, gems, glows — so real looks land on their intended hue).
Pros: the whole screen — cave included — suddenly reads as one cohesive
limited-palette console; colors stay distinct enough to keep cosmetic
identity; cheap (one nearest-of-16 per pixel). Cons: nearest-RGB snapping
ignores perceptual distance, so a few hues shift a little (acceptable at
16px); the palette is a taste decision — swapping the 16 hexes is the whole
tuning surface.

**`outline` — cartoon cel.** Base colors kept; every empty cell touching a
filled one (8-way) becomes ink `#14141a`. Pros: sprites stand off the cave
immediately and read as "hand-inked" without losing any color or
silhouette; composes with a future background rework. Cons: on the dense cave
row the same rule outlines every rock tile and gem, which can look noisy
(the pass is uniform — a per-layer ink variant is a follow-up if adopted);
the edge eats one pixel of the 16×16 margin on tight sprites.

## If a style is picked — adoption notes

- **Single hook point.** Each pass is applied after the grid is built and
  before `gridToPngDataUri`, in the `pixelArt.ts` cache layer
  (`minerSpriteUri` / `pickaxeSpriteUri` / `debrisSpriteUri`) and the
  `caveTiles.ts` row cache (`caveRowUri`). The grid builders, cosmetics
  data, and the app all stay untouched — a style is a one-line composition
  change, not a re-asset.
- **Cost.** Every pass is O(pixels) over ≤ 288×24 grids, runs once per cache
  key, and is already deterministic (see the tests) — no runtime cost
  difference vs. the baseline.
- **Unaffected.** The emoji-art fallback setting, the cave descent
  animation, juice/haptics — none of it touches the grid layer.
- **Re-rendering samples.** `node scripts/generate-art-style-samples.mjs`
  rewrites the four contact sheets after any pass tuning.

Open question for the decision: whether the style is global or a setting
("art style" picker). A setting is cheap with this design (pick which pass
to compose at the hook point), but adds cache-key fan-out — worth deciding
at greenlight, not here.
