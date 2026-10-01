/**
 * THE ART-PACK SEAM — the single place that decides what the game's sprites
 * look like.
 *
 * Everything that draws a miner, a pickaxe, a gem, an ore chunk or a debris
 * shard goes through this module (`minerSpriteUri`, `pickaxeSpriteUri`,
 * …), never through `pixelArt` directly. An art pack supplies those five
 * builders; swapping the whole game's art is then one line:
 *
 *   setActiveArtPack("pixel");     // back to the classic 16×16 look
 *   setActiveArtPack("papercut");  // the shipped direction (the default)
 *
 * Two packs are registered:
 *
 *   pixel     the classic procedural 16×16 art — the grids in pixelArt.ts,
 *             unchanged, still the baseline every other draft compares to.
 *   papercut  the 32×32 paper-cut direction (docs/art-directions.md): the
 *             same in-game `MinerLook`s re-drawn as cut-paper characters,
 *             with the shape hints the look carries (hair / outfit / beard /
 *             cute face / critter form).
 *
 * Packs are pure: builders take data in and return a cached PNG data URI,
 * so nothing above this layer knows (or cares) how a sprite was made. The
 * cave (`caveTiles.ts`) is deliberately NOT part of the seam — it is a
 * separate strip pipeline with its own rock work.
 */
import {
  debrisSpriteUri as pixelDebrisSpriteUri,
  gemSpriteUri as pixelGemSpriteUri,
  gridToPngDataUri,
  mineralChunkSpriteUri as pixelMineralChunkSpriteUri,
  minerSpriteUri as pixelMinerSpriteUri,
  pickaxeSpriteUri as pixelPickaxeSpriteUri,
} from "./pixelArt";
import {
  buildDirectionGrid,
  buildPalette,
  minerLabels,
  renderDirection,
} from "./characterArt";
import { buildPremiumCharGrid, premiumCharById } from "./premiumChars";
import type { SkinShape } from "./characterArt";
import type { MinerLook, PickaxeThemeDef, PixelGrid } from "./pixelArt";

export const ART_PACK_IDS = ["pixel", "papercut"] as const;
export type ArtPackId = (typeof ART_PACK_IDS)[number];

/** Per-sprite request options a caller can pass down to the pack. */
export interface SpriteOpts {
  /** Render this premium-crew character instead of the look (see premiumChars). */
  premiumId?: string;
}

/** What a pack has to supply. Same names as this module's entry points. */
export interface ArtPack {
  id: ArtPackId;
  /** Human label (settings UI / docs). */
  label: string;
  /** Grid size the pack builds its sprites at (16 classic / 32 papercut). */
  gridSize: number;
  /**
   * `opts.premiumId` asks for a PREMIUM CREW character (the legendary
   * miners) by id — see premiumChars.ts. A pack that has no premium line
   * ignores the id and draws the plain miner, which is exactly what the
   * classic pixel pack does.
   */
  minerSprite(look: MinerLook, opts?: SpriteOpts): string;
  pickaxeSprite(theme: PickaxeThemeDef): string;
  debrisSprite(variant: number): string;
  mineralChunkSprite(): string;
  gemSprite(): string;
}

// ---------------------------------------------------------------------------
// The papercut pack
// ---------------------------------------------------------------------------

/**
 * Map an in-game look onto the papercut shape axes.
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

/** Papercut grid for one in-game look (the pack's body sprite). */
export function buildPapercutMinerGrid(look: MinerLook): PixelGrid {
 return renderDirection(
  "papercut",
  minerLabels(shapeForLook(look)),
  buildPalette("papercut", "miner", { miner: look }),
 );
}

/**
 * Debris: the papercut direction has no shard subject, and a 32×32 rock
 * crushed into the 12 px particle box is mush. The classic shards stay until
 * a paper-cut shard exists — at 12 px the mix is invisible.
 */
const papercutPack: ArtPack = {
 id: "papercut",
 label: "Paper cut",
 gridSize: 32,
 minerSprite: (look, opts) => {
  const char =
   opts?.premiumId == null ? undefined : premiumCharById(opts.premiumId);
  return gridToPngDataUri(
   char == null
    ? buildPapercutMinerGrid(look)
    : buildPremiumCharGrid(char),
  );
 },
 pickaxeSprite: (theme) =>
  gridToPngDataUri(buildDirectionGrid("papercut", "pickaxe", { pickaxe: theme })),
 debrisSprite: (variant) => pixelDebrisSpriteUri(variant),
 mineralChunkSprite: () =>
  gridToPngDataUri(buildDirectionGrid("papercut", "chunk")),
 gemSprite: () => gridToPngDataUri(buildDirectionGrid("papercut", "gem")),
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const pixelPack: ArtPack = {
 id: "pixel",
 label: "Classic pixels",
 gridSize: 16,
 // No premium line: a legendary row falls back to the classic miner.
 minerSprite: (look) => pixelMinerSpriteUri(look),
 pickaxeSprite: pixelPickaxeSpriteUri,
 debrisSprite: pixelDebrisSpriteUri,
 mineralChunkSprite: pixelMineralChunkSpriteUri,
 gemSprite: pixelGemSpriteUri,
};

export const ART_PACKS: Record<ArtPackId, ArtPack> = {
 pixel: pixelPack,
 papercut: papercutPack,
};

/**
 * The shipped direction (docs/art-directions.md: "Decision — papercut").
 * Flip this one line to go back to the classic 16×16 art.
 */
export const DEFAULT_ART_PACK_ID: ArtPackId = "papercut";

let activeId: ArtPackId = DEFAULT_ART_PACK_ID;

/** The pack every sprite goes through right now. */
export function activeArtPack(): ArtPack {
 return ART_PACKS[activeId];
}

export function activeArtPackId(): ArtPackId {
 return activeId;
}

/**
 * Swap the game's art at runtime. Screens memoise their sprite URIs, so a
 * live swap takes effect on the next remount / cache-key change — enough for
 * a settings picker or a test, not a mid-swipe instant switch.
 */
export function setActiveArtPack(id: ArtPackId): void {
 activeId = id;
}

export function getArtPack(id: ArtPackId): ArtPack {
 return ART_PACKS[id];
}

// ---------------------------------------------------------------------------
// The pack-aware entry points (the only sprite API above this layer)
// ---------------------------------------------------------------------------

// Data URIs are the <Image> source identity; caching keeps every miner of a
// variant sharing one string (and one decoded image). Keyed by pack + subject
// so a swapped pack can never read the other pack's sprites out of the cache.
const uriCache = new Map<string, string>();

function cached(subject: string, key: string, build: () => string): string {
 const cacheKey = `${activeId}:${subject}:${key}`;
 let uri = uriCache.get(cacheKey);
  if (uri == null) {
   uri = build();
   uriCache.set(cacheKey, uri);
  }
  return uri;
}

/**
 * Miner body for a look, as a PNG data URI. `opts.premiumId` renders a
 * premium-crew character instead of the look (legendary miners); it is part
 * of the cache key, so one player's crew can hold several of them and each
 * stays a single shared image.
 */
export function minerSpriteUri(
 look: MinerLook,
 opts?: SpriteOpts,
): string {
 const key = JSON.stringify([
  look.skin,
  look.shirt,
  look.pants,
  look.boots,
  look.hat,
  look.hatStyle,
  look.species ?? "human",
  look.hair ?? "",
  look.outfit ?? "",
  look.beard === true ? 1 : 0,
  look.cute === true ? 1 : 0,
  opts?.premiumId ?? "",
 ]);
 return cached("miner", key, () =>
  activeArtPack().minerSprite(look, opts),
 );
}

/** Pickaxe for a theme, as a PNG data URI. */
export function pickaxeSpriteUri(theme: PickaxeThemeDef): string {
 const key = JSON.stringify([theme.head, theme.glow, theme.handle]);
 return cached("pickaxe", key, () => activeArtPack().pickaxeSprite(theme));
}

/** Debris shard for a variant index (wraps, like the classic pack). */
export function debrisSpriteUri(variant: number): string {
 const key = String(variant);
 return cached("debris", key, () => activeArtPack().debrisSprite(variant));
}

/** The cave-display ore chunk. */
export function mineralChunkSpriteUri(): string {
 return cached("chunk", "chunk", () =>
  activeArtPack().mineralChunkSprite(),
 );
}

/** The gem icon. */
export function gemSpriteUri(): string {
 return cached("gem", "gem", () => activeArtPack().gemSprite());
}

export type { MinerLook, PickaxeThemeDef, SkinShape };