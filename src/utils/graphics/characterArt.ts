/**
 * Draft ART DIRECTIONS — the "completely different art styles" set (todo:
 * "add more generated art styles ... to potential art assets"; see
 * docs/art-directions.md).
 *
 * Where the earlier drafts sit:
 *   - stylePasses.ts  recolors / re-treats the EXISTING 16×16 grids (flat,
 *                     mono, retro16, outline) — same pixels, new palette.
 *   - detailPass.ts   bevels those same grids (more shading, same pixels).
 *   - animeArt.ts     ONE hand-built 32×32 chibi character.
 * This module is the next step: a small set of subjects (the miner, a
 * pickaxe, a gem, a mineral chunk) drawn ONCE into a 32×32 *label map*
 * ("hat" / "skin" / "blade" / … instead of colors), then RENDERED by five
 * completely different art directions:
 *
 *   cartoon   bold-ink cel — flat fills, one hard shadow band, 2px contour
 *   anime     clean cel — soft top-lit gradient, 1px contour, specular shine
 *   storybook picture-book gouache — warm paper, ragged painted edges,
 *             stippled tooth, one soft umber line inside the silhouette
 *   crayon    kid's crayon drawing — shaky hand-drawn outline, crayon-box
 *             colors, paper showing through the gaps
 *   papercut  layered paper diorama — 3 value planes per material, a cast
 *             shadow layer, a lighter cut edge, no lines at all
 *
 * Because the GEOMETRY is shared and only the palette + mark-making change,
 * the contact sheets compare art direction, not content — the same trick the
 * earlier drafts use, so the two sets can be read side by side.
 *
 * Papercut is the picked direction (docs/art-directions.md), so the miner
 * subject also grew a `SkinShape` — headwear / hair / outfit / beard /
 * critter form / cute face — which is what the skin line in
 * `papercutSkins.ts` is built from. A skin is a `MinerLook` + a `SkinShape`,
 * so a new character is data, never drawing code.
 *
 * Pure, framework-free, deterministic (no Math.random / Date — the crayon
 * wobble and the storybook stipple come from a hashed `noise()`), no new
 * assets and no new dependencies.
 *
 * NOT wired into the app — this is the draft the art decision picks from.
 * Contact sheets: docs/art-directions.md, rendered by
 * scripts/generate-art-direction-samples.mjs.
 */
import { createGrid, hashSeed, hexToRgb, mulberry32 } from "./pixelArt";
import { darkenHex, lightenHex, mixHex } from "./detailPass";
import type {
  HatStyle,
  MinerHair,
  MinerLook,
  PickaxeThemeDef,
  PixelGrid,
} from "./pixelArt";

/** Every sprite in a direction is this size (2× the classic 16×16). */
export const DIRECTION_GRID_SIZE = 32;

// ---------------------------------------------------------------------------
// Label map — the geometry layer (material per pixel, no colors)
// ---------------------------------------------------------------------------

/**
 * The material alphabet every subject is drawn with. Keeping it small is
 * deliberate: a direction derives every tone from these few colors, so a new
 * look only has to supply a handful of hexes (see `buildPalette`).
 */
export type MaterialId =
 | "skin"
 | "eye"
 | "eyeShine"
 | "mouth"
 | "hat"
 | "brim"
 | "lamp"
 | "shirt"
 | "belt"
 | "pants"
 | "boots"
 | "handle"
 | "blade"
 | "bladeShine"
 | "gem"
 | "gemLight"
 | "gemDark"
 | "rock"
 | "rockLight"
 | "rockShade"
 | "ore"
 | "aura";

/** grid[y][x] — a material id, or null for "no paint here". */
export type LabelGrid = (MaterialId | null)[][];

function newLabels(): LabelGrid {
 return createGrid(DIRECTION_GRID_SIZE, DIRECTION_GRID_SIZE) as LabelGrid;
}

/** Grid edge used by the drawing primitives (one grid, 32×32). */
const M = DIRECTION_GRID_SIZE;

function put(g: LabelGrid, x: number, y: number, m: MaterialId): void {
 if (y < 0 || y >= M || x < 0 || x >= M) return;
 g[y][x] = m;
}

function fillRect(
 g: LabelGrid,
 x0: number,
 y0: number,
 x1: number,
 y1: number,
 m: MaterialId,
): void {
 for (let y = Math.round(y0); y <= Math.round(y1); y++) {
  for (let x = Math.round(x0); x <= Math.round(x1); x++) put(g, x, y, m);
 }
}

/** Axis-aligned rounded rectangle (corner radius `r`, clamped to the box). */
function fillRoundRect(
 g: LabelGrid,
 x0: number,
 y0: number,
 x1: number,
 y1: number,
 r: number,
 m: MaterialId,
): void {
 const rad = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
 fillRect(g, x0, y0, x1, y1, m);
 const cs: [number, number][] = [
  [x0 + rad, y0 + rad],
  [x1 - rad, y0 + rad],
  [x0 + rad, y1 - rad],
  [x1 - rad, y1 - rad],
 ];
 for (const [cx, cy] of cs) {
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
   for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) put(g, x, y, m);
   }
  }
 }
}

function fillEllipse(
 g: LabelGrid,
 cx: number,
 cy: number,
 rx: number,
 ry: number,
 m: MaterialId,
): void {
 for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
   const dx = (x - cx) / rx;
   const dy = (y - cy) / ry;
   if (dx * dx + dy * dy <= 1) put(g, x, y, m);
  }
 }
}

/** Thick line segment (capsule of radius `r`) — limbs, handles, straps. */
function fillCapsule(
 g: LabelGrid,
 x0: number,
 y0: number,
 x1: number,
 y1: number,
 r: number,
 m: MaterialId,
): void {
 const vx = x1 - x0;
 const vy = y1 - y0;
 const len2 = vx * vx + vy * vy || 1;
 for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++) {
  for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
   const px = x - x0;
   const py = y - y0;
   const t = Math.max(0, Math.min(1, (px * vx + py * vy) / len2));
   const dx = px - vx * t;
   const dy = py - vy * t;
   if (dx * dx + dy * dy <= r * r) put(g, x, y, m);
  }
 }
}

type Pt = readonly [number, number];

/**
 * Scanline polygon fill (non-zero winding is not needed — every polygon
 * here is a simple convex-ish region). Edges are sampled at 2× so the
 * diagonals don't staircase.
 */
function fillPolygon(g: LabelGrid, pts: readonly Pt[], m: MaterialId): void {
 const ys = pts.map((p) => p[1]);
 const xs = pts.map((p) => p[0]);
 const y0 = Math.max(0, Math.floor(Math.min(...ys)));
 const y1 = Math.min(M - 1, Math.ceil(Math.max(...ys)));
 const x0 = Math.max(0, Math.floor(Math.min(...xs)));
 const x1 = Math.min(M - 1, Math.ceil(Math.max(...xs)));
 const SUB = 3; // sub-scanlines per pixel row
 for (let y = y0; y <= y1; y++) {
  for (let s = 0; s < SUB; s++) {
   const sy = y + (s + 0.5) / SUB;
   const crossings: number[] = [];
   for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if (ay === by) continue;
    if (sy < Math.min(ay, by) || sy >= Math.max(ay, by)) continue;
    crossings.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
   }
   crossings.sort((a, b) => a - b);
   for (let i = 0; i + 1 < crossings.length; i += 2) {
    const sx = Math.round(crossings[i]);
    const ex = Math.round(crossings[i + 1]);
    for (let x = Math.max(x0, sx); x <= Math.min(x1, ex); x++) {
     put(g, x, y, m);
    }
   }
  }
 }
}

/** Annulus segment — a pickaxe crescent. Angles in degrees, 90° = up. */
function fillArc(
 g: LabelGrid,
 cx: number,
 cy: number,
 rOuter: number,
 rInner: number,
 a0deg: number,
 a1deg: number,
 m: MaterialId,
): void {
 const toRad = (d: number): number => (d * Math.PI) / 180;
 const a0 = toRad(a0deg);
 const a1 = toRad(a1deg);
 for (let y = Math.floor(cy - rOuter); y <= Math.ceil(cy + rOuter); y++) {
  for (let x = Math.floor(cx - rOuter); x <= Math.ceil(cx + rOuter); x++) {
   const dx = x - cx;
   const dy = cy - y; // screen y is down, so flip for "up = positive"
   const r = Math.hypot(dx, dy);
   if (r < rInner || r > rOuter) continue;
   let ang = Math.atan2(dy, dx);
   // Normalize into the [a0, a1] sweep (a0 < a1, both in the upper half).
   while (ang < a0 - Math.PI) ang += 2 * Math.PI;
   while (ang > a0 + Math.PI) ang -= 2 * Math.PI;
   if (ang >= a0 && ang <= a1) put(g, x, y, m);
  }
 }
}

// ---------------------------------------------------------------------------
// Subjects — the shared geometry, drawn once per subject
// ---------------------------------------------------------------------------

/**
 * Shape switches for one character — the axes a SKIN moves along. The
 * colors come from the `MinerLook` (see `buildPalette`); this is the
 * silhouette. All fields are optional; the defaults reproduce the plain
 * hard-hat miner the direction sheets render.
 */
export interface SkinShape {
 /** A human miner, or one of the round little critters. */
 form?: "human" | "critter";
 /** Headgear. "longhair" and "hair" both mean "no hat, hair instead". */
 hatStyle?: HatStyle;
 /** Hair style — only used with a bare head (`hatStyle: "longhair"`). */
 hair?: HairStyle;
 /** Beard / moustache (drawn in the `hat` color, like the in-game longhair). */
 beard?: boolean;
 /** Trousers and boots, or a flared dress. */
 outfit?: "trousers" | "dress";
 /** Cute face: bigger eyes with lash ticks, plus blush. */
 cute?: boolean;
 /**
  * Draw the raised pickaxe as part of the body. TRUE for portraits (the
  * contact sheets); FALSE in-game, where `Miner` draws the tool as its own
  * rotating sprite — a baked-in pickaxe would double up under the swing.
  */
 tool?: boolean;
 /** Headwear mark worn OVER the hat — the premium characters' signature. */
 crown?: CrownStyle;
 /** Aura motes floating in the empty space around the body. */
 motes?: MoteStyle;
}

/**
 * The mark worn over the headwear. Each crew character gets a different one,
 * so their silhouette reads at a glance even in a 24px crew row — a shared
 * body in a different palette is not a different character. The first block
 * is the legendary line's (grand marks: a circlet, a halo, a hood…), the
 * second the fast line's (working marks: goggles, a tied kerchief, a crest,
 * a pair of wings), so the two gem tiers never share a silhouette.
 */
export type CrownStyle =
  | "none"
  | "crown"
  | "halo"
  | "hood"
  | "antlers"
  | "crystal"
  | "plume"
  | "goggles"
  | "kerchief"
  | "crest"
  | "wings";

/**
 * Aura mote patterns. The positions are FIXED offsets in the empty space
 * around the body (never over it — a mote on the character is just a
 * misplaced pixel), and each pattern has its own shape language (rising
 * sparks, drifting flakes, hard glints) so the aura matches the name instead
 * of being one dot pattern in six colors.
 */
export type MoteStyle =
  | "none"
  // legendary line — static, precious mark-making
  | "embers"
  | "frost"
  | "void"
  | "gold"
  | "bone"
  | "crystal"
  // fast line — motion mark-making: kicked dust, trailing streaks, sparks
  // off the boots, a swirl around the shaft
  | "dust"
  | "streaks"
  | "sparks"
  | "swirl";

/** Re-exported so a skin line never has to import two modules. */
export type HairStyle = MinerHair;

const DEFAULT_SHAPE: Required<SkinShape> = {
 form: "human",
 hatStyle: "helmet",
 hair: "long",
 beard: false,
 outfit: "trousers",
 cute: false,
 tool: true,
 crown: "none",
 motes: "none",
};

/**
 * The miner: hard hat with a lamp on the brim, chibi proportions (the head
 * is half the sprite), suspenders, boots, and a raised pickaxe behind the
 * right shoulder.
 *
 * The classic 16×16 miner is centered on x 7.5 with a brim out to x 3; the
 * 32-wide subject keeps the body at the same relative place but nudges it
 * left (center x 13.5) so the pickaxe on the right has room for a crescent
 * that clears the helmet instead of hiding behind it.
 */
/**
 * Map an in-game `MinerLook` onto the papercut shape axes — the one place
 * the game's look data becomes drawing instructions.
 *
 * The look already carries `hatStyle` and `species` (both map 1:1), plus the
 * shape hints `rollMinerLook` appends (hair / outfit / beard / cute). A look
 * built by hand — a test, a preview — simply gets the defaults, so nothing
 * above the art layer has to know the papercut axes exist.
 *
 * `tool: false` is deliberate: in-game the pickaxe is its own rotating sprite
 * (the swing animation), so the body must not carry one.
 */
export function shapeForLook(look: MinerLook): SkinShape {
 return {
  form: look.species === "animal" ? "critter" : "human",
  hatStyle: look.hatStyle,
  hair: look.hair,
  beard: look.beard ?? false,
  outfit: look.outfit ?? "trousers",
  cute: look.cute ?? false,
  tool: false,
 };
}

export function minerLabels(shape: SkinShape = {}): LabelGrid {
 const g = newLabels();
 const s: Required<SkinShape> = { ...DEFAULT_SHAPE, ...shape };

 // --- pickaxe (behind the body; its near tip tucks behind the helmet) ----
 if (s.tool) {
  fillArc(g, 25.5, 11.5, 5.2, 3.2, 20, 160, "blade");
  fillEllipse(g, 22.4, 8.2, 1, 1, "bladeShine");
  fillCapsule(g, 25.5, 12.5, 26.5, 27, 1.3, "handle");
 }

 if (s.form === "critter") {
  critterHead(g);
  headgear(g, s.hatStyle);
  critterFace(g, s.cute);
  critterBody(g);
 } else {
  // --- head, headgear, crown, face ---------------------------------------
  fillEllipse(g, 13.5, 10.5, 7.5, 7.5, "skin");
  headgear(g, s.hatStyle);
  if (s.hatStyle === "longhair") hairMass(g, s.hair);
  drawCrown(g, s.crown);
  // The beard goes on BEFORE the face, so the eyes and mouth stay readable
  // on top of it.
  if (s.beard) fillEllipse(g, 13.5, 16.6, 4.4, 2.2, "hat");
  humanFace(g, s.cute);
  // --- body --------------------------------------------------------------
  humanBody(g, s.outfit);
 }

 // --- hair that falls OVER the shoulders (must come last) -----------------
 if (s.form === "human" && s.hatStyle === "longhair") {
  hairFall(g, s.hair);
 }
 // Aura motes sit in the empty space AROUND the body, so they go last and
 // can never be overpainted.
 drawMotes(g, s.motes);
 return g;
}

/** Headgear over the head. The `hat` slot colors it (a hat, a band, a cap). */
function headgear(g: LabelGrid, style: HatStyle): void {
 switch (style) {
  case "helmet":
   fillEllipse(g, 13.5, 6.5, 7.8, 5, "hat");
   fillRoundRect(g, 3.5, 10.5, 23.5, 12, 1, "brim");
   fillEllipse(g, 13.5, 11.2, 1.5, 1.5, "brim"); // lamp socket, on the brim
   fillEllipse(g, 13.5, 11.2, 1, 1, "lamp"); // helmet lamp
   break;
  case "beanie":
   fillEllipse(g, 13.5, 5.9, 8, 5.6, "hat"); // top stays off the grid edge
   fillRoundRect(g, 5, 9.4, 22, 11, 1, "brim"); // turned-up cuff
   break;
  case "cap":
   fillEllipse(g, 13.5, 6, 7.6, 4.9, "hat");
   fillRoundRect(g, 6, 9.6, 23.5, 11, 1, "brim"); // visor (forward)
   fillEllipse(g, 13.5, 3, 0.8, 0.8, "brim"); // button
   break;
  case "bandana":
   fillRoundRect(g, 5.2, 8.6, 21.8, 10.6, 1, "hat");
   fillRect(g, 21, 10, 22, 11, "hat"); // knot
   fillRect(g, 22, 11, 23, 12, "hat"); // tail
   break;
  case "longhair": // bare head — `hairMass` draws the hair instead
   break;
 }
}

/**
 * The mark over the headwear, in the `aura` accent (the palette maps it to
 * the character's own aura color). Drawn after the headgear — a hood covers
 * a hat, a circlet sits on a helmet — but before the face, so the eyes and
 * mouth always read.
 */
function drawCrown(g: LabelGrid, style: CrownStyle): void {
 switch (style) {
  case "crown":
   // A circlet across the forehead with three points rising off it.
   fillRect(g, 8, 8, 19, 9, "aura");
   fillRect(g, 9, 6, 10, 7, "aura");
   fillRect(g, 13, 5, 14, 7, "aura");
   fillRect(g, 17, 6, 18, 7, "aura");
   break;
  case "halo":
   // A ring floating over the head: an ellipse outline, upper half only.
   for (let y = 0; y < 7; y++) {
    const rx = 9 - Math.round(y * 0.6);
    if (rx < 2) break;
    // Rounded: a fractional index would set a "4.5" PROPERTY on the row
    // instead of a pixel, and the halo would be invisible.
    put(g, Math.round(13.5 - rx), y + 1, "aura");
    put(g, Math.round(13.5 + rx), y + 1, "aura");
   }
   break;
  case "hood":
   // A pointed hood that swallows the headgear, face left clear. Drawn in
   // the DARKER `brim` tone on purpose: in the `hat` tone it covered the
   // headwear with the same color and the hood vanished (the render was
   // within 10 pixels of no hood at all).
   fillEllipse(g, 13.5, 8.6, 9.6, 7.9, "brim");
   fillPolygon(
    g,
    [
     [9, 6],
     [13.5, 1.4],
     [18, 6],
    ],
    "brim",
   );
   break;
  case "antlers":
   // Two thin branching horns, mirrored about x=13.5. Drawn as 1px
   // branches on purpose: the earlier 2px columns read as EARS on a round
   // head, which is exactly the wrong silhouette.
   for (const [x, y] of [
    [10, 7],
    [9, 6],
    [8, 5],
    [7, 4],
    [6, 3],
    [5, 2],
    [8, 3],
    [7, 2],
   ] as const) {
    put(g, x, y, "aura");
    put(g, 27 - x, y, "aura");
   }
   break;
  case "plume":
   // A tall feather plume off the headgear, curling at the top.
   fillRect(g, 13, 1, 14, 8, "aura");
   fillRect(g, 12, 3, 12, 5, "aura");
   fillRect(g, 15, 1, 16, 2, "aura");
   break;
  case "crystal":
   // Angular crystal spikes, the tallest at the center.
   fillPolygon(
    g,
    [
     [8, 6],
     [10, 1],
     [12, 6],
    ],
    "aura",
   );
   fillPolygon(
    g,
    [
     [13, 6],
     [14.5, 0.6],
     [16, 6],
    ],
    "aura",
   );
   fillPolygon(
    g,
    [
     [17, 6],
     [19, 1.5],
     [21, 6],
    ],
    "aura",
   );
   break;
  // --- fast line: working marks (gems buy speed; the mark is field gear) --
  case "goggles":
   // Round goggles pushed up onto the brow, so the eyes stay readable (the
   // face is drawn after the crown). The strap and bridge are in the DARKER
   // `brim` tone on purpose: in the aura tone the strap and the two lenses
   // merged into one bright bar and the goggles read as a headband.
   fillRect(g, 7, 8, 20, 9, "brim");
   fillEllipse(g, 10.5, 9.5, 2.6, 2.1, "aura");
   fillEllipse(g, 16.5, 9.5, 2.6, 2.1, "aura");
   put(g, 13, 9, "brim");
   put(g, 14, 9, "brim");
   break;
  case "kerchief":
   // A tied kerchief: band across the forehead, knot at the right, two
   // tails trailing down past the jaw.
   fillRect(g, 7, 8, 20, 9, "aura");
   fillRect(g, 20, 9, 22, 10, "aura");
   put(g, 23, 11, "aura");
   put(g, 24, 12, "aura");
   put(g, 22, 11, "aura");
   put(g, 23, 13, "aura");
   break;
  case "crest":
   // A three-toothed comb off the headgear, tallest tooth in the middle.
   fillRect(g, 10, 7, 17, 8, "aura");
   fillPolygon(
    g,
    [
     [9, 8],
     [11, 2],
     [13, 8],
    ],
    "aura",
   );
   fillPolygon(
    g,
    [
     [12, 8],
     [14, 0.8],
     [16, 8],
    ],
    "aura",
   );
   fillPolygon(
    g,
    [
     [15, 8],
     [16.5, 3],
     [18, 8],
    ],
    "aura",
   );
   break;
  case "wings":
   // A pair of wings off the temples — three long swept feathers a side,
   // mirrored about x=13.5 (27 - x). Drawn long on purpose: a short feather
   // pair merged into the headwear at 24px and read as ears.
   for (const feather of [
    [
     [8, 11],
     [1, 2],
     [5, 4],
    ],
    [
     [8, 11],
     [0, 6],
     [4, 7],
    ],
    [
     [8, 11],
     [1, 10],
     [4, 10],
    ],
    [
     [19, 11],
     [26, 2],
     [22, 4],
    ],
    [
     [19, 11],
     [27, 6],
     [23, 7],
    ],
    [
     [19, 11],
     [26, 10],
     [23, 10],
    ],
   ] as const) {
    fillPolygon(g, feather, "aura");
   }
   break;
  case "none":
   break;
 }
}

/**
 * Fixed aura-mote positions per style. All sit in the empty space AROUND the
 * body; the pattern is part of the character's identity, so it is data.
 */
const MOTES: Record<
 Exclude<MoteStyle, "none">,
 readonly (readonly [number, number])[]
> = {
 // Rising sparks down both flanks, denser low (heat coming off the rock).
 embers: [
  [3, 24],
  [2, 19],
  [4, 14],
  [28, 22],
  [30, 16],
  [27, 27],
 ],
 // Drifting flakes: a loose diamond around the head.
 frost: [
  [2, 6],
  [27, 4],
  [4, 27],
  [29, 28],
  [1, 16],
  [31, 11],
 ],
 // Void: a few hard glints well clear of the body, so they read as a cold
 // absence rather than as sparkles.
 void: [
  [2, 3],
  [30, 2],
  [1, 28],
  [30, 29],
 ],
 // Gold: hard sparkle glints, top-down.
 gold: [
  [3, 5],
  [8, 1],
  [21, 1],
  [28, 6],
  [1, 12],
  [31, 24],
  [6, 29],
 ],
 // Bone: pale chips, mostly low.
 bone: [
  [2, 20],
  [3, 29],
  [29, 18],
  [30, 27],
  [1, 9],
 ],
 // Crystal: faceted points paired across the body.
 crystal: [
  [2, 8],
  [30, 9],
  [3, 25],
  [29, 25],
 ],
 // Dust: kicked up off the boots, clustered low on both flanks.
 dust: [
  [2, 26],
  [4, 23],
  [3, 29],
  [29, 27],
  [27, 24],
  [30, 22],
 ],
 // Streaks: horizontal runs trailing the body, three of them.
 streaks: [
  [1, 16],
  [3, 16],
  [5, 16],
  [26, 15],
  [28, 15],
  [30, 15],
  [2, 22],
  [4, 22],
  [28, 21],
  [30, 21],
 ],
 // Sparks: hard single pixels, low and close (a sprinter's static).
 sparks: [
  [4, 29],
  [28, 29],
  [2, 24],
  [30, 25],
  [1, 18],
  [31, 17],
 ],
 // Swirl: one loose S-curve around the shaft, offset side to side.
 swirl: [
  [1, 13],
  [3, 10],
  [5, 8],
  [31, 19],
  [29, 22],
  [27, 24],
 ],
};

function drawMotes(g: LabelGrid, style: MoteStyle): void {
 if (style === "none") return;
 for (const [x, y] of MOTES[style]) put(g, x, y, "aura");
}

/**
 * The hair ON the skull: a cap over the crown plus the style's volume. A
 * helmet leaves it behind the crown, so it only peeks out at the sides.
 */
function hairMass(g: LabelGrid, style: HairStyle): void {
 if (style === "ponytail") {
  fillEllipse(g, 22.4, 8.2, 2.4, 2.4, "hat"); // gathered at the back
  fillEllipse(g, 24.2, 11.4, 2, 2, "hat");
  fillEllipse(g, 23.8, 14.4, 1.7, 1.7, "hat");
 }
 if (style === "twin") {
  fillEllipse(g, 4.8, 12, 2, 3.4, "hat"); // two tied bunches
  fillEllipse(g, 22.2, 12, 2, 3.4, "hat");
 }
 if (style === "bun") {
  // A bun is a bump BEHIND the crown: at the top it would be swallowed by
  // the hair cap (same material), so it sits back-right, clear of it.
  fillEllipse(g, 22.4, 5, 3.2, 2.9, "hat");
 }
 fillEllipse(g, 13.5, 5.8, 7.9, 5.6, "hat"); // hair cap
 fillRect(g, 7.5, 9, 19.5, 11, "hat"); // fringe over the forehead
 fillRect(g, 8, 12, 9, 12, "hat"); // fringe tips
 fillRect(g, 12, 12, 13, 12, "hat");
 fillRect(g, 17, 12, 18, 12, "hat");
}

/** The hair that hangs past the jaw — drawn AFTER the body. */
function hairFall(g: LabelGrid, style: HairStyle): void {
 switch (style) {
  case "bob":
   fillRoundRect(g, 5, 9, 7.5, 15, 1.5, "hat");
   fillRoundRect(g, 19.5, 9, 22, 15, 1.5, "hat");
   break;
  case "long":
   fillRoundRect(g, 5, 9, 7.5, 24, 1.5, "hat");
   fillRoundRect(g, 19.5, 9, 22, 24, 1.5, "hat");
   break;
  case "twin":
   fillRoundRect(g, 3.4, 10, 5.6, 17, 1.4, "hat"); // tapered tails
   fillRoundRect(g, 21.4, 10, 23.6, 17, 1.4, "hat");
   break;
 case "bun":
   fillRoundRect(g, 20.5, 9, 22.5, 15, 1.4, "hat"); // loose strand
   break;
  default:
   break; // ponytail and bun are drawn behind/above the head
 }
}

function humanFace(g: LabelGrid, cute: boolean): void {
 if (cute) {
  fillRect(g, 10, 13, 12, 15, "eye"); // bigger, rounder eyes
  fillRect(g, 15, 13, 17, 15, "eye");
  fillRect(g, 9, 13, 9, 14, "eye"); // lash ticks, outer corners
  fillRect(g, 18, 13, 18, 14, "eye");
  fillRect(g, 10, 13, 10, 13, "eyeShine"); // 1px catch-light (a 2×2 glint
  fillRect(g, 15, 13, 15, 13, "eyeShine"); // swallows the eye at 32px)
  fillRect(g, 8, 16, 9, 16, "mouth"); // blush, 2×1 so it stays a hint
  fillRect(g, 18, 16, 19, 16, "mouth");
  fillRect(g, 13, 17, 15, 17, "mouth"); // small smile
  return;
 }
 // Classic face: two 2×2 eyes with a catch-light, a smile with dropped corners.
 fillRect(g, 10, 13, 11, 14, "eye");
 fillRect(g, 16, 13, 17, 14, "eye");
 fillRect(g, 10, 13, 10, 13, "eyeShine");
 fillRect(g, 17, 13, 17, 13, "eyeShine");
 fillRect(g, 12, 16, 15, 16, "mouth");
 fillRect(g, 11, 17, 11, 17, "mouth");
 fillRect(g, 16, 17, 16, 17, "mouth");
}

function humanBody(g: LabelGrid, outfit: "trousers" | "dress"): void {
 fillRoundRect(g, 6.5, 18, 20.5, 24, 2, "shirt");
 if (outfit === "dress") {
  fillPolygon(
   g,
   [
    [7.5, 22],
    [19.5, 22],
    [23.5, 29],
    [3.5, 29],
   ],
   "shirt",
  ); // flared skirt
  fillRect(g, 8, 22, 19, 22, "belt"); // waist band
 } else {
  fillRect(g, 9, 18, 10, 24, "belt"); // suspender straps
  fillRect(g, 17, 18, 18, 24, "belt");
  fillRect(g, 6.5, 23, 20.5, 24, "belt"); // waist belt
  fillRect(g, 8, 25, 10, 28, "pants");
  fillRect(g, 16, 25, 18, 28, "pants");
 }
 fillCapsule(g, 7.5, 20, 6, 24, 1.5, "skin"); // left arm
 fillCapsule(g, 19.5, 20, 24, 25, 1.5, "skin"); // right arm → the handle
 fillRoundRect(g, 7, 29, 11, 30, 1, "boots"); // feet (under a dress too)
 fillRoundRect(g, 16, 29, 20, 30, 1, "boots");
}

/** Critter: pointy ears, a round fur head, a muzzle and a catch-light nose. */
function critterHead(g: LabelGrid): void {
 fillPolygon(
  g,
  [
   [6.2, 6.5],
   [8.6, 1.4],
   [11.4, 7],
  ],
  "skin",
 ); // ears (fur)
 fillPolygon(
  g,
  [
   [20.8, 6.5],
   [18.4, 1.4],
   [15.6, 7],
  ],
  "skin",
 );
 fillEllipse(g, 13.5, 11, 8, 7.6, "skin");
}

function critterFace(g: LabelGrid, cute: boolean): void {
 fillEllipse(g, 13.5, 15.4, 3, 1.9, "eyeShine"); // muzzle
 if (cute) {
  fillRect(g, 9, 12, 11, 14, "eye");
  fillRect(g, 16, 12, 18, 14, "eye");
  fillRect(g, 9, 12, 9, 12, "eyeShine");
  fillRect(g, 17, 12, 17, 12, "eyeShine");
  fillRect(g, 7, 15, 8, 15, "mouth"); // blush
  fillRect(g, 19, 15, 20, 15, "mouth");
 } else {
  fillRect(g, 9, 12, 10, 13, "eye");
  fillRect(g, 17, 12, 18, 13, "eye");
  fillRect(g, 9, 12, 9, 12, "eyeShine");
  fillRect(g, 18, 12, 18, 12, "eyeShine");
 }
 fillRect(g, 13, 15, 14, 15, "eye"); // nose
}

/** Critter body: a vest over a fluffy lower half, feet, and a curled tail. */
function critterBody(g: LabelGrid): void {
 fillRoundRect(g, 6, 18, 21, 24, 2, "shirt"); // vest
 fillEllipse(g, 24, 20.5, 1.9, 1.9, "skin"); // tail
 fillEllipse(g, 13.5, 26, 7.4, 3.4, "pants"); // fluffy lower half
 fillRoundRect(g, 6.5, 28.5, 11, 30, 1, "boots");
 fillRoundRect(g, 16, 28.5, 20.5, 30, 1, "boots");
}

/** A pickaxe on its own: crescent head over a straight handle. */
export function pickaxeLabels(): LabelGrid {
 const g = newLabels();
 fillCapsule(g, 16, 6, 16, 28, 1.8, "handle");
 fillArc(g, 16, 13, 9.5, 6.5, 15, 165, "blade");
 fillEllipse(g, 12, 6, 1.3, 1.3, "bladeShine");
 return g;
}

/** A cut gem: table, crown facets, girdle, pavilion with a light keel. */
export function gemLabels(): LabelGrid {
 const g = newLabels();
 fillRect(g, 11, 8, 20, 11, "gemLight"); // table
 fillPolygon(
  g,
  [
   [11, 12],
   [9, 15],
   [14, 15],
  ],
  "gemLight",
 ); // left crown facet
 fillPolygon(
  g,
  [
   [20, 12],
   [22, 15],
   [17, 15],
  ],
  "gemLight",
 ); // right crown facet
 fillPolygon(
  g,
  [
   [9, 12],
   [22, 12],
   [24, 15],
   [7, 15],
  ],
  "gem",
 ); // crown
 fillRect(g, 7, 15, 24, 16, "gemDark"); // girdle
 fillPolygon(
  g,
  [
   [7, 16],
   [24, 16],
   [15.5, 27],
  ],
  "gemDark",
 ); // pavilion
 fillPolygon(
  g,
  [
   [12, 16],
   [19, 16],
   [15.5, 26],
  ],
  "gem",
 ); // keel facet
 fillRect(g, 14, 9, 14, 9, "eyeShine");
 fillRect(g, 18, 18, 18, 18, "eyeShine");
 return g;
}

/** An ore chunk: an irregular rock blob with a lit top-left, a shaded
 * bottom-right, gold flecks and one crack. */
export function chunkLabels(): LabelGrid {
 const g = newLabels();
 fillPolygon(
  g,
  [
   [13, 5],
   [21, 8],
   [26, 14],
   [23, 23],
   [15, 26],
   [7, 22],
   [5, 13],
   [8, 8],
  ],
  "rock",
 );
 fillPolygon(
  g,
  [
   [13, 6],
   [20, 9],
   [16, 13],
   [8, 12],
   [7, 11],
  ],
  "rockLight",
 );
 fillPolygon(
  g,
  [
   [17, 14],
   [25, 14],
   [22, 22],
   [15, 25],
   [13, 20],
  ],
  "rockShade",
 );
 for (const [ox, oy] of [
  [10, 16],
  [18, 11],
  [20, 19],
  [13, 21],
 ] as const) {
  fillEllipse(g, ox, oy, 1.2, 1.2, "ore");
 }
 fillRect(g, 15, 16, 15, 18, "rockShade"); // crack
 return g;
}

export type SubjectId = "miner" | "pickaxe" | "gem" | "chunk";

/** The label geometry for one subject (always a fresh grid). */
export const SUBJECT_LABELS: Record<SubjectId, () => LabelGrid> = {
 miner: minerLabels,
 pickaxe: pickaxeLabels,
 gem: gemLabels,
 chunk: chunkLabels,
};

export const SUBJECT_IDS: readonly SubjectId[] = [
 "miner",
 "pickaxe",
 "gem",
 "chunk",
];

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function clamp255(v: number): number {
 return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbToHex(r: number, g: number, b: number): string {
 const h = (v: number): string => clamp255(v).toString(16).padStart(2, "0");
 return `#${h(r)}${h(g)}${h(b)}`;
}

/** Push channels away from their mean (t > 0 = more saturated). */
export function saturate(hex: string, t: number): string {
 const [r, g, b] = hexToRgb(hex);
 const m = (r + g + b) / 3;
 return rgbToHex(
  m + (r - m) * (1 + t),
  m + (g - m) * (1 + t),
  m + (b - m) * (1 + t),
 );
}

/**
 * Deterministic per-pixel noise in [0, 1). Used by the crayon fill and the
 * storybook stipple, so a sprite looks identical on every run and on every
 * device (no Math.random anywhere in the art layer).
 */
export function noise(x: number, y: number, seed: number): number {
 return mulberry32(hashSeed(seed, (x * 73856093) ^ (y * 19349663)) >>> 0)();
}

// ---------------------------------------------------------------------------
// Palettes — one grading per direction (the "hue" half of a direction)
// ---------------------------------------------------------------------------

/** Near-black cartoon contour. */
export const CARTOON_INK = "#1b1a22";
/** Soft violet anime contour (never pure black — it warms the face). */
export const ANIME_INK = "#3a2a3a";
/** Warm paper the storybook and crayon directions are graded toward. */
export const STORYBOOK_PAPER = "#f3e6cf";
export const CRAYON_PAPER = "#f7f1e2";
/** Papercut: cream stock + the cast shadow of the layer above it. */
export const PAPERCUT_PAPER = "#efe3cc";
export const PAPERCUT_SHADOW = "#c2ab92";
/**
 * The crayon box: gold/yellow, blue and purple are in every box, and so are
 * gray and brown — without them steel reads as green and rock as purple.
 * White is LAST: it is the fallback for a nearly-white source color only.
 */
export const CRAYON_HUES: readonly string[] = [
 "#e8443a", // red
 "#f2913a", // orange
 "#f5d442", // yellow
 "#57a94f", // green
 "#3f8fd0", // blue
 "#7d55b0", // purple
 "#8d93a8", // gray
 "#7a5230", // brown
 "#4a4a55", // charcoal
 "#f6efe0", // white
];

/** A full material → hex map (every MaterialId resolves, no holes). */
export type Palette = Record<MaterialId, string>;

/**
 * Materials a plain (non-miner) subject uses — the rest get paper neutrals.
 */
const SUBJECT_MATERIALS: Record<SubjectId, readonly MaterialId[]> = {
 miner: [
  "skin",
  "eye",
  "eyeShine",
  "mouth",
  "hat",
  "brim",
  "lamp",
  "shirt",
  "belt",
  "pants",
  "boots",
  "handle",
  "blade",
  "bladeShine",
  "aura",
 ],
 pickaxe: ["handle", "blade", "bladeShine", "eyeShine"],
 gem: ["gem", "gemLight", "gemDark", "eyeShine"],
 chunk: ["rock", "rockLight", "rockShade", "ore"],
};

/**
 * The "accent" materials — eyes, mouth, lamp, gleams, ore. A paper wash on
 * these reads as mud, so the soft directions (storybook, papercut) leave
 * them at full strength and only the crayon box recolors them.
 */
const ACCENTS: readonly MaterialId[] = [
 "eye",
 "eyeShine",
 "mouth",
 "lamp",
 "bladeShine",
 "ore",
 "aura",
];

/** Neutral defaults, so a palette is always complete even for a bare subject. */
const BASE_COLORS: Record<MaterialId, string> = {
 skin: "#f2c9a0",
 eye: "#2b2430",
 eyeShine: "#ffffff",
 mouth: "#b3574f",
 hat: "#e8c33d",
 brim: "#c9a52f",
 lamp: "#fff3b0",
 shirt: "#4a90d9",
 belt: "#3a2f2a",
 pants: "#3b4a6b",
 boots: "#4a3524",
 handle: "#8a5a2b",
 blade: "#9aa5b1",
 bladeShine: "#e6eef5",
 gem: "#59c9f2",
 gemLight: "#bdeeff",
 gemDark: "#2b8fc0",
 rock: "#7a7a82",
 rockLight: "#9a9aa4",
 rockShade: "#56565e",
 ore: "#e8c33d",
 aura: "#ffffff",
};

function gradeCartoon(hex: string): string {
 return saturate(hex, 0.12);
}

function gradeAnime(hex: string): string {
 return saturate(mixHex(hex, "#fff3ea", 0.14), 0.3);
}

function gradeStorybook(hex: string): string {
 return mixHex(saturate(hex, 0.12), STORYBOOK_PAPER, 0.1);
}

function gradeCrayon(hex: string): string {
 const [r, g, b] = hexToRgb(hex);
 // Prefer a CHROMATIC crayon: the white one is only allowed for a color
 // that is nearly white to begin with, so skin and gold don't come out of
 // the box as white chalk.
 const [wr, wg, wb] = hexToRgb(CRAYON_HUES[CRAYON_HUES.length - 1]);
 const nearWhite =
  Math.abs(r - wr) + Math.abs(g - wg) + Math.abs(b - wb) < 96;
 const pool = nearWhite ? CRAYON_HUES : CRAYON_HUES.slice(0, -1);
 let best = pool[0];
 let bestD = Infinity;
 for (const hue of pool) {
  const [hr, hg, hb] = hexToRgb(hue);
  // Weight green: a gold/yellow crayon must not win on red alone.
  const d = 2 * (r - hr) ** 2 + 3 * (g - hg) ** 2 + (b - hb) ** 2;
  if (d < bestD) {
   bestD = d;
   best = hue;
  }
 }
 return mixHex(best, CRAYON_PAPER, 0.12);
}

/**
 * Papercut: colored paper stock — hue kept (paper is dyed, not printed),
 * saturation pulled back so the flat planes read, and a little of the cream
 * sheet mixed in. The value planes live in the renderer, not here.
 */
function gradePapercut(hex: string): string {
 return mixHex(saturate(hex, -0.1), PAPERCUT_PAPER, 0.12);
}

/** One grading function per direction (index-aligned with DIRECTION_IDS). */
const GRADERS: Record<DirectionId, (hex: string) => string> = {
 cartoon: gradeCartoon,
 anime: gradeAnime,
 storybook: gradeStorybook,
 crayon: gradeCrayon,
 papercut: gradePapercut,
};

/**
 * Build the full palette for one subject in one direction.
 *
 * The `look` supplies the base hues (same `MinerLook` / `PickaxeThemeDef`
 * the live 16×16 pipeline takes, so a sheet column can be swapped for the
 * in-game sprite without touching the data), and the direction grades them —
 * every direction has its own ink, neutrals and accent so a look never leaks
 * the cartoon palette into the crayon sheet.
 */
export function buildPalette(
 id: DirectionId,
 subject: SubjectId,
 look?: { miner?: MinerLook; pickaxe?: PickaxeThemeDef },
): Palette {
 const grade = GRADERS[id];
 const base = { ...BASE_COLORS } as Palette;
 const m = look?.miner;
 if (m) {
  base.skin = m.skin;
  base.shirt = m.shirt;
  base.pants = m.pants;
  base.boots = m.boots;
  base.hat = m.hat;
  base.brim = darkenHex(m.hat, 0.18);
 }
 const p = look?.pickaxe;
 if (p) {
  base.blade = p.head;
  base.bladeShine = p.glow;
  base.handle = p.handle;
 }
 const inks: Record<DirectionId, { eye: string; mouth: string; lamp: string }> =
  {
   cartoon: { eye: "#221c26", mouth: "#8e3b39", lamp: "#fff6c4" },
   anime: { eye: "#33283a", mouth: "#d07b86", lamp: "#fffbe6" },
   storybook: { eye: "#4a3a34", mouth: "#a3574a", lamp: "#f6dfa6" },
   crayon: { eye: "#3a3a45", mouth: "#c0564e", lamp: "#f7d94c" },
   papercut: { eye: "#3d3a4a", mouth: "#b0705f", lamp: "#e8c98a" },
  };
 base.eye = inks[id].eye;
 base.mouth = inks[id].mouth;
 base.lamp = inks[id].lamp;

 const out = {} as Palette;
 for (const key of Object.keys(base) as MaterialId[]) {
  // Grade only the subject's own materials; the neutrals it never uses keep
  // their defaults, and accents keep their strength under a wash (a paper
  // grade on an eye or a lamp glow just makes mud).
  if (
   !SUBJECT_MATERIALS[subject].includes(key) ||
   (ACCENTS.includes(key) && id !== "crayon")
  ) {
   out[key] = base[key];
  } else {
   out[key] = grade(base[key]);
  }
 }
 return out;
}

// ---------------------------------------------------------------------------
// Geometry analysis shared by the renderers
// ---------------------------------------------------------------------------

interface Box {
 x0: number;
 y0: number;
 x1: number;
 y1: number;
 h: number;
}

function boxesOf(labels: LabelGrid): Map<MaterialId, Box> {
 const boxes = new Map<MaterialId, Box>();
 for (let y = 0; y < labels.length; y++) {
  for (let x = 0; x < labels[y].length; x++) {
   const m = labels[y][x];
   if (m == null) continue;
   const b = boxes.get(m);
   if (b == null) {
    boxes.set(m, { x0: x, y0: y, x1: x, y1: y, h: 1 });
   } else {
    b.x0 = Math.min(b.x0, x);
    b.y0 = Math.min(b.y0, y);
    b.x1 = Math.max(b.x1, x);
    b.y1 = Math.max(b.y1, y);
    b.h = b.y1 - b.y0 + 1;
   }
  }
 }
 return boxes;
}

/** Paint the base fills (label → palette color, null stays null). */
function fillBase(labels: LabelGrid, palette: Palette): PixelGrid {
 const out = createGrid(labels[0].length, labels.length);
 for (let y = 0; y < labels.length; y++) {
  for (let x = 0; x < labels[y].length; x++) {
   const m = labels[y][x];
   if (m != null) out[y][x] = palette[m];
  }
 }
 return out;
}

function filled(labels: LabelGrid, x: number, y: number): boolean {
 return labels[y]?.[x] != null;
}

/**
 * Ink a `width`-px contour OUTSIDE the silhouette: every empty cell that
 * touches a filled one becomes `ink`, repeated `width` times so the edge
 * grows inward toward the sprite.
 */
function inkSilhouette(
 out: PixelGrid,
 labels: LabelGrid,
 ink: string,
 width: number,
): void {
 const h = labels.length;
 const w = labels[0].length;
 for (let pass = 0; pass < width; pass++) {
  const adds: [number, number][] = [];
  for (let y = 0; y < h; y++) {
   for (let x = 0; x < w; x++) {
    if (out[y][x] != null) continue;
    for (let dy = -1; dy <= 1; dy++) {
     for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (filled(labels, x + dx, y + dy)) {
       adds.push([x, y]);
       dx = 2;
       break;
      }
     }
    }
   }
  }
  for (const [x, y] of adds) out[y][x] = ink;
 }
}

// ---------------------------------------------------------------------------
// The five direction renderers
// ---------------------------------------------------------------------------

/** Cartoon: flat cel fills + one hard shadow band + a 2px ink contour. */
function renderCartoon(labels: LabelGrid, palette: Palette): PixelGrid {
 const out = createGrid(M, M);
 for (let y = 0; y < labels.length; y++) {
  for (let x = 0; x < labels[y].length; x++) {
   const m = labels[y][x];
   if (m == null) continue;
   const base = palette[m];
   const lit = labels[y - 1]?.[x] !== m || labels[y][x - 1] !== m;
   const shade = labels[y + 1]?.[x] !== m || labels[y][x + 1] !== m;
   if (shade && !lit) out[y][x] = darkenHex(base, 0.3);
   else if (lit && !shade) out[y][x] = lightenHex(base, 0.24);
   else out[y][x] = base; // interior, or a 1px part facing both ways
  }
 }
 inkSilhouette(out, labels, CARTOON_INK, 2);
 return out;
}

/**
 * Anime: cel fills with a soft top-lit gradient, a thin contour, and a
 * specular shine band on the tall materials (the hat and the head).
 */
function renderAnime(labels: LabelGrid, palette: Palette): PixelGrid {
 const boxes = boxesOf(labels);
 const out = fillBase(labels, palette);
 for (let y = 0; y < labels.length; y++) {
  for (let x = 0; x < labels[y].length; x++) {
   const m = labels[y][x];
   if (m == null) continue;
   const box = boxes.get(m)!;
   // 0 at the top of the material, 1 at its bottom.
   const t = Math.min(1, Math.max(0, (y - box.y0) / Math.max(1, box.h - 1)));
   const base = palette[m];
   if (t < 0.6) {
    out[y][x] = mixHex(base, "#ffffff", 0.46 * (1 - t / 0.6));
   } else {
    out[y][x] = mixHex(base, "#463355", 0.3 * ((t - 0.6) / 0.4));
   }
   // Shine band: the top-left corner of any material ≥ 8px tall gets a
   // hard white specular step (the anime "hair gloss" read).
   if (box.h >= 8 && x - box.x0 <= 1 && y - box.y0 <= 1) {
    out[y][x] = mixHex(base, "#ffffff", 0.55);
   }
  }
 }
 inkSilhouette(out, labels, ANIME_INK, 1);
 return out;
}

/**
 * Storybook: picture-book gouache. Nothing is inked around the sprite — a
 * warm paper grade, a soft 4-step vertical wash per material, a stipple for
 * tooth, a ragged edge where the paint thins out, and a single soft umber
 * line drawn just INSIDE the silhouette (the picture-book brush line).
 */
function renderStorybook(labels: LabelGrid, palette: Palette): PixelGrid {
 const boxes = boxesOf(labels);
 const out = createGrid(M, M);
 for (let y = 0; y < labels.length; y++) {
  for (let x = 0; x < labels[y].length; x++) {
   const m = labels[y][x];
   if (m == null) continue;
   const box = boxes.get(m)!;
   const t = Math.min(1, Math.max(0, (y - box.y0) / Math.max(1, box.h - 1)));
   // 4 wash steps — the posterization is what makes it read as paint, not
   // as a gradient.
   const step = Math.round(t * 3) / 3;
   let c = mixHex(palette[m], "#fffaf0", 0.38 * (1 - step));
   if (step > 0) c = mixHex(c, "#5e3b28", 0.18 * step);
   const edge =
    !filled(labels, x - 1, y) ||
    !filled(labels, x + 1, y) ||
    !filled(labels, x, y - 1) ||
    !filled(labels, x, y + 1);
   // A picture book still has a drawn line — a warm umber brush line just
   // INSIDE the silhouette (never outside it: the paper stays clean).
   // Internal material boundaries are left alone, or a 15px-wide shirt
   // disappears under its own outline.
   if (edge) c = mixHex(c, "#5a3520", 0.34);
   // Paper tooth: a sparse stipple of lighter / darker grains.
   const n = noise(x, y, 4211);
   if (n > 0.94) c = mixHex(c, "#ffffff", 0.35);
   else if (n < 0.06) c = mixHex(c, "#6b4a38", 0.26);
   // Ragged paint edge: thin the silhouette with holes so the paper shows.
   if (edge && noise(x, y, 9137) < 0.16) continue;
   out[y][x] = c;
  }
 }
 return out;
}

/**
 * Crayon: a kid's drawing. The FILL is a crayon box (see `gradeCrayon`),
 * and the mark-making is the giveaway: the outline is shaky — patchy where
 * the paper shows through the gaps, bulging outward where the hand
 * overshot — with a faint grain inside and a darker pressure ridge where
 * two strokes overlap.
 */
function renderCrayon(
 labels: LabelGrid,
 palette: Palette,
 seed: number,
): PixelGrid {
 const phase = ((seed % 7) + 7) % 7;
 // A kid's drawing is SOLID inside and shaky at the line: the outline is
 // patchy (paper shows through the gaps) and bulges outward where the hand
 // overshot, while the fills stay dense. Resampling the geometry with a
 // domain warp instead would collapse thin diagonals (a pickaxe handle is
 // 3px wide), so the wobble is applied to the BOUNDARY only.
 const keep = (x: number, y: number, edge: boolean): boolean => {
  if (!edge) return noise(x, y, 3301 + seed) > 0.05;
  const stroke = Math.sin((x * 0.9 + y * 0.55) * 1.7 + phase);
  if (stroke < -0.5) return false;
  return noise(x, y, 3301 + seed) > 0.16;
 };
 const out = createGrid(M, M);
 const h = labels.length;
 const w = labels[0].length;
 for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
   const m = labels[y][x];
   if (m != null) {
    const edge =
     labels[y - 1]?.[x] !== m ||
     labels[y + 1]?.[x] !== m ||
     labels[y][x - 1] !== m ||
     labels[y][x + 1] !== m;
    if (!keep(x, y, edge)) continue;
    const base = palette[m];
    // Pressure: a stroke darkens where it overlaps the next one.
    const ridge =
    labels[y - 1]?.[x] === m &&
    !keep(x, y - 1, true) &&
    keep(x - 1, y, true) &&
    keep(x + 1, y, true);
    out[y][x] = ridge ? darkenHex(base, 0.22) : base;
    continue;
   }
   // Overshoot: an empty cell next to the drawing sometimes gets colored,
   // which is what makes the line look drawn rather than traced.
   let source: MaterialId | null = null;
   for (let dy = -1; dy <= 1 && source == null; dy++) {
    for (let dx = -1; dx <= 1 && source == null; dx++) {
     if (dx === 0 && dy === 0) continue;
     source = labels[y + dy]?.[x + dx] ?? null;
    }
   }
   if (source != null && keep(x, y, true) && noise(x, y, 7703 + seed) < 0.3) {
    out[y][x] = palette[source];
   }
  }
 }
 return out;
}

/**
 * Papercut: a layered paper diorama. The silhouette is cast onto the sheet
 * one layer down (an offset shadow), each material is cut into three value
 * planes, and the top-left cut edge shows the lighter paper core. No lines.
 */
function renderPapercut(labels: LabelGrid, palette: Palette): PixelGrid {
 const boxes = boxesOf(labels);
 const out = createGrid(M, M);
 // Layer 0: the shadow the cut-out sheet casts on the background.
 for (let y = 0; y < labels.length; y++) {
  for (let x = 0; x < labels[y].length; x++) {
   if (!filled(labels, x, y)) continue;
   const sx = x + 2;
   const sy = y + 2;
   if (sx < M && sy < M && out[sy][sx] == null) out[sy][sx] = PAPERCUT_SHADOW;
  }
 }
 for (let y = 0; y < labels.length; y++) {
  for (let x = 0; x < labels[y].length; x++) {
   const m = labels[y][x];
   if (m == null) continue;
   const box = boxes.get(m)!;
   const t = Math.min(1, Math.max(0, (y - box.y0) / Math.max(1, box.h - 1)));
   const base = palette[m];
   const c =
    t < 0.3
     ? lightenHex(base, 0.28)
     : t < 0.66
      ? base
      : darkenHex(base, 0.28);
   // The lit cut edge: the first row of a material against empty space —
   // but never double-lighten the top plane, or the whole shape goes white.
   const coreEdge =
    t >= 0.3 &&
    (!filled(labels, x - 1, y) || !filled(labels, x, y - 1));
   out[y][x] = coreEdge ? lightenHex(c, 0.18) : c;
  }
 }
 return out;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * The five draft directions, in contact-sheet order. `flat` (the live 16×16
 * pixel art) is not here on purpose: it is the baseline COLUMN of the sheet,
 * drawn by the generator from `buildMinerGrid` / `buildPickaxeGrid`, because
 * a direction that only exists as a 32×32 draft cannot be compared at 16.
 */
export type DirectionId =
 | "cartoon"
 | "anime"
 | "storybook"
 | "crayon"
 | "papercut";

export const DIRECTION_IDS: readonly DirectionId[] = [
 "cartoon",
 "anime",
 "storybook",
 "crayon",
 "papercut",
];

/** One-line description per direction (the doc's table row). */
export const DIRECTION_LABELS: Record<DirectionId, string> = {
 cartoon: "bold-ink cel: flat fills, one hard shadow band, 2px contour",
 anime: "clean cel: soft top-lit gradient, 1px contour, specular shine",
 storybook:
  "picture-book gouache: warm paper, ragged edges, soft inner brush line",
 crayon:
  "kid's crayon: shaky hand-drawn outline, crayon-box colors, paper gaps",
 papercut:
  "layered paper diorama: three value planes, cast shadow, cut-edge core",
};

export type DirectionRenderer = (
 labels: LabelGrid,
 palette: Palette,
 seed: number,
) => PixelGrid;

const RENDERERS: Record<DirectionId, DirectionRenderer> = {
 cartoon: (labels, palette) => renderCartoon(labels, palette),
 anime: (labels, palette) => renderAnime(labels, palette),
 storybook: (labels, palette) => renderStorybook(labels, palette),
 crayon: (labels, palette, seed) => renderCrayon(labels, palette, seed),
 papercut: (labels, palette) => renderPapercut(labels, palette),
};

/**
 * Render one subject in one direction. Deterministic: the same
 * (labels, palette, seed) always produces the same grid, and the label grid
 * is never mutated.
 */
export function renderDirection(
 id: DirectionId,
 labels: LabelGrid,
 palette: Palette,
 seed = 1,
): PixelGrid {
 return RENDERERS[id](labels, palette, seed);
}

/** Subject geometry + graded palette + the direction's mark-making. */
export function buildDirectionGrid(
 id: DirectionId,
 subject: SubjectId,
 look?: { miner?: MinerLook; pickaxe?: PickaxeThemeDef },
 seed = 1,
): PixelGrid {
 return renderDirection(
  id,
  SUBJECT_LABELS[subject](),
  buildPalette(id, subject, look),
  seed,
 );
}

export type { HatStyle, MinerHair, MinerLook, PickaxeThemeDef, PixelGrid };