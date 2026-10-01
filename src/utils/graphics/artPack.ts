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
 *             cute face / critter form) — and the crew cast (crewChars.ts),
 *             so every purchasable miner is a character with a face, a mark
 *             and an aura instead of a recolour of the player.
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
  shapeForLook,
} from "./characterArt";
import type { ToolId } from "./characterArt";
import {
  buildCrewCharGrid,
  crewCharById,
  crewLookFor,
} from "./crewChars";
import type { SkinShape } from "./characterArt";
import type { MinerLook, PickaxeThemeDef, PixelGrid } from "./pixelArt";
import type { SkinCosmetic as SkinDef } from "../../mines_of_doom/cosmetics";

export const ART_PACK_IDS = ["pixel", "papercut"] as const;
export type ArtPackId = (typeof ART_PACK_IDS)[number];

/** Per-sprite request options a caller can pass down to the pack. */
export interface SpriteOpts {
  /**
   * Render this CREW CHARACTER instead of the plain look (see crewChars).
   * Every purchasable miner type has one: the ordinary hires (names + faces),
   * the fast crew (marks + motion motes) and the legendary line (grand marks
   * + full aura). Roster rows only; the player never wears one.
   */
  crewId?: string;
  /**
   * The wardrobe rule: this crew slot has an OUTFIT ASSIGNED to it, so the
   * character's clothes come from that outfit (they keep their face). False
   * for an undressed slot, and never set for the gem tiers — nobody assigns
   * outfits to them.
   */
  crewWearsOutfit?: boolean;
}

/** What a pack has to supply. Same names as this module's entry points. */
export interface ArtPack {
  id: ArtPackId;
  /** Human label (settings UI / docs). */
  label: string;
  /** Grid size the pack builds its sprites at (16 classic / 32 papercut). */
  gridSize: number;
  /**
   * `opts.crewId` asks for a CREW CHARACTER by id (every purchasable miner
   * type has one — see crewChars.ts). A pack that has no cast ignores the id
   * and draws the plain miner, which is exactly what the classic pixel pack
   * does.
   */
  minerSprite(look: MinerLook, opts?: SpriteOpts): string;
  /** `tool` is the pickaxe line's silhouette axis (see characterArt TOOLS);
   *  a pack without tool axes draws its one tool in every theme. */
  pickaxeSprite(theme: PickaxeThemeDef, tool: ToolId): string;
  /** One skin character for the player's slot (see cosmetics.SKINS). */
  skinSprite(skin: SkinDef): string;
  debrisSprite(variant: number): string;
  mineralChunkSprite(): string;
  gemSprite(): string;
}

// ---------------------------------------------------------------------------
// The papercut pack
// ---------------------------------------------------------------------------

/** Re-exported: the look → shape mapping belongs to characterArt, but tests
 *  and previews have always imported it from here. */
export { shapeForLook };

/** Papercut grid for one in-game look (the pack's body sprite). */
export function buildPapercutMinerGrid(look: MinerLook): PixelGrid {
 return renderDirection(
  "papercut",
  minerLabels(shapeForLook(look)),
  buildPalette("papercut", "miner", { miner: look }),
 );
}

/**
 * Papercut grid for one skin character (the pack's skin sprite).
 *
 * A skin carries its own `shape`, so — unlike the crew lines, which fold a
 * character into a rolled look — the silhouette is drawn exactly as authored.
 */
export function buildPapercutSkinGrid(skin: SkinDef): PixelGrid {
  return renderDirection(
    "papercut",
    minerLabels({ ...skin.shape, tool: false }),
    buildPalette("papercut", "miner", { miner: skin.look }),
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
   opts?.crewId == null ? undefined : crewCharById(opts.crewId);
  if (char == null) return gridToPngDataUri(buildPapercutMinerGrid(look));
  // The wardrobe rule: an assigned outfit dresses the character, so the
  // sprite is built from the merged look rather than the character's own.
  const worn = opts?.crewWearsOutfit === true ? crewLookFor(char, look, false) : char.look;
  return gridToPngDataUri(buildCrewCharGrid(char, worn));
 },
 pickaxeSprite: (theme, tool) =>
  gridToPngDataUri(
   buildDirectionGrid("papercut", "pickaxe", { pickaxe: theme, tool }),
  ),
 skinSprite: (skin) => gridToPngDataUri(buildPapercutSkinGrid(skin)),
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
 // No cast: a crew row falls back to the classic miner.
 minerSprite: (look) => pixelMinerSpriteUri(look),
 // No tool axes in the classic art: every tool is the crescent colorway.
 pickaxeSprite: (theme) => pixelPickaxeSpriteUri(theme),
 // No silhouette axes in the classic art: a skin is its colorway there.
 skinSprite: (skin) => pixelMinerSpriteUri(skin.look),
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
 * Miner body for a look, as a PNG data URI. `opts.crewId` renders a crew
 * character instead of the plain look, and `opts.crewWearsOutfit` says their
 * clothes come from an assigned outfit; both are part of the cache key, so
 * one player's crew can hold several characters and each stays a single
 * shared image.
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
  opts?.crewId ?? "",
  opts?.crewWearsOutfit === true ? "w" : "",
 ]);
 return cached("miner", key, () =>
  activeArtPack().minerSprite(look, opts),
 );
}

/**
 * An equipped skin's body sprite, as a PNG data URI (the player's slot).
 * Both the id and the look fields are in the cache key, so switching skins
 * or swapping art packs can never serve a stale image.
 */
export function skinSpriteUri(skin: SkinDef): string {
  const key = JSON.stringify([
    skin.id,
    skin.look.skin,
    skin.look.shirt,
    skin.look.pants,
    skin.look.boots,
    skin.look.hat,
    skin.look.hatStyle,
    skin.shape.form,
    skin.shape.hair ?? "",
    skin.shape.outfit ?? "",
    skin.shape.beard === true ? 1 : 0,
    skin.shape.cute === true ? 1 : 0,
  ]);
  return cached("skin", key, () => activeArtPack().skinSprite(skin));
}

/**
 * A pickaxe as a PNG data URI: the theme's three colors AND the tool's
 * silhouette are both part of the cache key, so eight tools never share an
 * image (nor do two themes of the same tool).
 */
export function pickaxeSpriteUri(
 theme: PickaxeThemeDef,
 tool: ToolId,
): string {
 const key = JSON.stringify([theme.head, theme.glow, theme.handle, tool]);
 return cached(
  "pickaxe",
  key,
  () => activeArtPack().pickaxeSprite(theme, tool),
 );
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