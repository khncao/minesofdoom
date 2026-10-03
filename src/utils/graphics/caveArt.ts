/**
 * THE PAPER-CUT CAVE — the rock side of the art direction
 * (docs/art-directions.md, todo "cave art in the new style").
 *
 * The cave has always been its own strip pipeline (`caveTiles.ts`: 336×24
 * row strips plus addressable foreground wall bands, one shared rock/gap
 * silhouette sampled at global pixels). What this module adds is the
 * direction the rock is MARKED in — the same split the characters use
 * (characterArt.ts): the geometry stays where it is, and a direction is a
 * *grade* plus a *renderer* over it.
 *
 * **What "papercut" means for a cave.** The characters get three value
 * planes per material, cut at hard horizontal edges, with a lit cut edge
 * showing the paper core and a warm cast shadow offset down-right. A cave
 * is not a silhouette of one object though — it is a WALL of rock, so the
 * same language is applied to the strata instead of to one shape: the rock
 * mass is a handful of big cut sheets of dyed paper, each one FLAT, each
 * one cut along an organic boundary (the plane field in `caveTiles.ts`, low
 * frequency and domain-warped so no boundary pins to a lattice), and each
 * sheet reads as a sheet because of two edges:
 *
 *  - **the lit cut edge** — the first row of rock against open air, and the
 *    first row of a sheet that tucks under a LIGHTER one, show the lighter
 *    paper core. Same rule the character renderer uses (`renderPapercut`),
 *    with light coming from the same top-left;
 *  - **the cast shadow** — a cut sheet throws a shadow onto whatever is
 *    behind it, so the silhouette is offset two pixels down-right onto the
 *    gap. Exactly the character renderer's 2px offset, applied to the one
 *    shape the cave has that the characters don't: the rock/gap contour.
 *
 * The read comes from the plane steps and those two edges. No dithered
 * shading ramp and no outline — which is also why this cannot reintroduce
 * the patterns the classic ramp fought: a flat plane is not a pattern, a
 * lattice is (see the tests in caveArt.test.ts).
 *
 * Deliberately NOT done:
 *  - the SILHOUETTE is untouched. The rock/gap layout field is
 *    load-bearing for "no visible patterns" and this is a direction change,
 *    not a layout change;
 *  - the classic treatment stays available and byte-identical
 *    (`CAVE_ROCK_STYLES.classic` in caveTiles.ts);
 *  - gems, rubble and the easter eggs stay the flat classic objects they
 *    already were — they are already flat, and they read on paper.
 */

import { darkenHex, lightenHex } from "./detailPass";

/** The rock directions, in sheet order (classic first, papercut shipped). */
export const CAVE_ART_IDS = ["classic", "papercut"] as const;
export type CaveArtId = (typeof CAVE_ART_IDS)[number];

/** Number of flat value planes in one rock sheet stack (light → dark). */
export const PAPER_PLANES = 3;

/**
 * How far a cut sheet's cast shadow is offset, in px. Two, the same offset
 * `characterArt.renderPapercut` uses for the character sheets — the whole
 * direction is one set of numbers so the cave and the crew are cut from
 * the same stock with the same light.
 */
export const PAPER_SHADOW_OFFSET = 2;

/**
 * The paper stock for one cave tint: three flat value planes, the lit
 * paper core, and the shadow a sheet throws. Built from the tier tint
 * exactly like the characters' palette is built from a `MinerLook`
 * (`characterArt.buildPalette`), with the SAME mixes the character
 * renderer uses for its three planes — so a cave and its miners are cut
 * from one sheet.
 */
export interface PaperInk {
  /** Flat value planes, index 0 = lightest (the top sheet) → 2 = darkest. */
  planes: readonly [string, string, string];
  /** The lit paper core along a cut edge. */
  core: string;
  /** The shadow a cut sheet throws onto the sheet behind it. */
  shadow: string;
}

/** The paper stock for one cave tint (`PaperInk`). */
export function paperRockInk(tint: string): PaperInk {
  const top = lightenHex(tint, 0.28);
  return {
    planes: [top, tint, darkenHex(tint, 0.3)],
    // The core is the TOP plane lightened once more: the top sheet is where
    // the light already lands, so its cut edge can only go so far before
    // the rock washes out at the silhouette.
    core: lightenHex(top, 0.18),
    // Deeper than the darkest plane, and deeper than the wash the game puts
    // behind the rows (which is the tint at 0.55 black): a shadow that is
    // lighter than what it falls on is not a shadow. The rows are drawn at
    // 35% opacity, so this is deliberately restrained — it is a lip of
    // shadow along the contour, not a halo.
    shadow: darkenHex(tint, 0.62),
  };
}

/**
 * What the renderer needs to know about one pixel. Deliberately values and
 * booleans, never pixels: the geometry (the plane field, the silhouette)
 * stays in `caveTiles.ts`, which samples it at GLOBAL pixels so a row
 * strip, a tile and a wall band all continue one rock body.
 */
export interface PaperPixel {
  /** This pixel's plane index, 0 (lightest) → 2 (darkest). */
  plane: number;
  /**
   * The plane index one pixel ABOVE. Never a strip boundary: rows are
   * addressed absolutely, so the pixel above the top row of a strip is a
   * real pixel of the world and the caller reads it from there.
   */
  above: number;
  /** Is this pixel painted rock (silhouette minus the dug shaft)? */
  rock: boolean;
  /**
   * Painted rock at a global pixel. The cut edges and the cast shadow are
   * both reads of the silhouette one or two pixels away — the cave's
   * version of looking at your neighbours.
   */
  rockAt: (x: number, y: number) => boolean;
}

/**
 * Paint one pixel of the paper-cut cave, or `null` to leave the grid alone
 * (an open gap that the shadow does not reach).
 *
 * Three rules, in the order they apply:
 *  1. a gap keeps its shape unless a sheet casts onto it (rule 3);
 *  2. a rock pixel on a cut edge shows the paper core;
 *  3. a gap pixel inside the silhouette's two-pixel down-right offset is
 *     shadow — the one mark the cave gets that a character never needs.
 */
export function paintPaperRock(
  ink: PaperInk,
  x: number,
  y: number,
  px: PaperPixel,
): string | null {
  if (!px.rock) {
    for (let dy = 1; dy <= PAPER_SHADOW_OFFSET; dy++) {
      for (let dx = 1; dx <= PAPER_SHADOW_OFFSET; dx++) {
        if (px.rockAt(x - dx, y - dy)) return ink.shadow;
      }
    }
    return null;
  }
  // The lit cut edge: the first row of the sheet against open air, on the
  // two sides the light comes from.
  if (!px.rockAt(x, y - 1) || !px.rockAt(x - 1, y)) return ink.core;
  // A sheet's own lip: the first row of a sheet tucked under a LIGHTER one
  // is exposed to the light that clears the overhang. (The reverse — a
  // darker sheet on top — is the overhang's own underside and stays in the
  // plane's value, which is what makes the stack read as a stack.)
  if (px.plane > px.above) return ink.core;
  return ink.planes[px.plane];
}

/**
 * One-line description per direction (the doc's table row, same shape as
 * `characterArt.DIRECTION_LABELS`).
 */
export const CAVE_ART_LABELS = {
  classic: "classic rock: dithered shade ramp, no cut edges",
  papercut: "paper-cut rock: flat layered planes, lit cut edges, cast shadow",
} as const;
