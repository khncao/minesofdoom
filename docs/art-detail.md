# Detail pass drafts — more detailed generated pixel art

Draft of the "more detailed pixel art" item (todo: "draft improved generated
graphics"). The current in-game art (`pixelArt.ts` / `caveTiles.ts`) is flat:
every region is one hand-placed color with no shading, so a 16×16 sprite
reads like a flat icon. This draft answers "what if the SAME base grids had
detail?" with one pure `PixelGrid -> PixelGrid` transform instead of
re-authoring every grid by hand.

Each sheet below is the SAME set of base sprites — 4 characters (classic
human, long-hair human, fox critter, marmot critter), all 4 pickaxes, the
gem and mineral-chunk icons, and one full cave row — an identical sample set
to `generate-art-style-samples.mjs` — run through the detail pass, so the
sheets compare detail levels, not content.

The pass lives in `src/utils/graphics/detailPass.ts` (a pure top-left light
bevel over the existing grids — no new assets, no new dependencies) and is
tested in `src/utils/graphics/detailPass.test.ts`. It is **not wired into
the app** — this is the draft the decision picks from.

## The pass

Top-left light source, one tone per edge direction:

- a filled pixel whose **left or top** neighbor is empty faces the light →
  its color is mixed toward white (highlight);
- a filled pixel whose **right or bottom** neighbor is empty faces away →
  mixed toward black (shadow);
- a pixel facing **both** (a 1px-wide arm, a 1px-tall bar, a 1px corner) is a
  *thin part* — beveling it just smears it, so it keeps its base color;
- interior pixels keep their base color; empty pixels are never written.

Identity is never lost: every output color is either a base color from the
input or a lighten/darken of one, so a cosmetic's gold stays gold and a
skin tone stays that tone. The pass is deterministic, never mutates its
input, and preserves the silhouette exactly.

## Sheets

Contact sheets (340×184 for the three levels; `zoom.png` is the classic
miner at 8×, flat / detailed / soft side by side; dark slate ground so light
and dark styles judge the same; re-render with
`node scripts/generate-detailed-art-samples.mjs`):

| sheet | one-liner |
| --- | --- |
| ![flat](samples/flat.png) | `flat` — the current in-game look (baseline) |
| ![detailed](samples/detailed.png) | `detailed` — strong top-left bevel (highlight 0.45 / shadow 0.30): sprites gain mass and sit in the cave instead of floating as flat icons |
| ![detailed-soft](samples/detailed-soft.png) | `detailed-soft` (highlight 0.28 / shadow 0.18): a whisper of roundness, stays close to the flat baseline |
| ![zoom](samples/zoom.png) | `zoom` — the classic miner at 8×: flat vs. `detailed` vs. `detailed-soft`, for judging the bevel without pixel squinting |

## Look notes

**`detailed` — strong bevel.** Pros: the clearest "this is detailed pixel
art" read — the 16×16 sprites gain real volume (the miner's helmet and
boots, the pickaxe heads, the gem), and the cave row stops reading as flat
paper. Cons: at the strong amount, adjacent regions of similar base color
can band where a highlight touches a shadow edge; the cave row at 1× gains
a lot of new tone (606 re-toned pixels across 336×24), which is the biggest
visual jump of the two and the one to judge in-situ on the canvas (the app
stretches it 2×).

**`detailed-soft` — subtle bevel.** Pros: keeps the flat baseline's calm
flatness while removing the "flat icon" feel; safest for the F2P-aesthetic
that the flat art has so far; the cave row is nearly unchanged at a glance.
Cons: on a small phone screen the difference from `flat` may be close to
imperceptible at 16px — this is a "the whole screen feels 10% more
finished" look, not a "the art changed" look.

**Both** leave the 1px-thin parts (arm pixels, pickaxe handle segments) at
their base color by design — that's what keeps the sprites from muddying.
The amounts (`DETAIL_STRONG` / `DETAIL_SOFT` in `detailPass.ts`) are the
whole tuning surface; a third amount or an angle variant is a two-line
change.

## If a look is picked — adoption notes

- **Single hook point — same one as the style passes.** Applied after the
  grid is built and before `gridToPngDataUri`, in the `pixelArt.ts` cache
  layer (`minerSpriteUri` / `pickaxeSpriteUri` / `debrisSpriteUri`) and the
  `caveTiles.ts` row cache (`caveRowUri`). Grid builders, cosmetics data, and
  the app all stay untouched.
- **Composes with `stylePasses.ts`.** The intended order is **detail first,
  then style** (bevel the base, then e.g. snap to retro16 or dither to
  mono) — detail supplies the edge tones that make the mono/retro16 passes
  read as shaded instead of flat. Both passes are pure grid transforms, so
  composing is `stylePass(detailPass(grid))` with no coupling.
- **Cost.** O(pixels) over ≤ 336×24 grids, runs once per cache key,
  deterministic (see the tests) — no runtime cost difference vs. the
  baseline.
- **Unaffected.** The emoji-art fallback setting, the cave descent
  animation, juice/haptics — none of it touches the grid layer.
- **Re-rendering samples.** `node scripts/generate-detailed-art-samples.mjs`
  rewrites the four contact sheets after any amount tuning.

Open question for the decision: whether the detail level is global or a
setting (and, if the style passes are also adopted, whether "detail level"
and "art style" are one combined picker or two). A setting is cheap with
this design (pick which pass to compose at the hook point), but adds
cache-key fan-out — worth deciding at greenlight, not here.
