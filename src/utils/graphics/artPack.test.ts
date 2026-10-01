/**
 * The art-pack seam (src/utils/graphics/artPack.ts): the contract that makes
 * the game's art swappable — every pack supplies the same five builders, the
 * shipped pack is papercut, swapping really changes every sprite, and the
 * papercut pack reads the shape hints off a look without anything above it
 * knowing they exist.
 */
import {
  ART_PACK_IDS,
  ART_PACKS,
  DEFAULT_ART_PACK_ID,
  activeArtPack,
  activeArtPackId,
  debrisSpriteUri,
  gemSpriteUri,
  getArtPack,
  mineralChunkSpriteUri,
  minerSpriteUri,
  pickaxeSpriteUri,
  setActiveArtPack,
  shapeForLook,
} from "src/utils/graphics/artPack";
import {
  DEBRIS_VARIANTS,
  gridToPngDataUri,
  minerSpriteUri as pixelMinerSpriteUri,
  pickaxeSpriteUri as pixelPickaxeSpriteUri,
} from "src/utils/graphics/pixelArt";
import { buildMinerGrid, buildPickaxeGrid } from "src/utils/graphics/pixelArt";
import { minerLabels } from "src/utils/graphics/characterArt";
import type { MinerLook } from "src/utils/graphics/pixelArt";

const PREFIX = "data:image/png;base64,";

const LOOK: MinerLook = {
  skin: "#ffdbb4",
  shirt: "#e8a33d",
  pants: "#3b4a6b",
  boots: "#4a3524",
  hat: "#e8c33d",
  hatStyle: "helmet",
};

const THEME = { head: "#9aa5b1", glow: "#d9e2ec", handle: "#8a5a2b" };

/** Width/height out of the PNG IHDR (no decoder needed). */
function pngSize(uri: string): [number, number] {
  expect(uri.startsWith(PREFIX)).toBe(true);
  const bin = Buffer.from(uri.slice(PREFIX.length), "base64");
  expect([...bin.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  return [bin.readUInt32BE(16), bin.readUInt32BE(20)];
}

afterEach(() => {
  setActiveArtPack(DEFAULT_ART_PACK_ID);
});

describe("the registry", () => {
  it("ships papercut and keeps the classic pack swappable", () => {
    expect(ART_PACK_IDS).toEqual(["pixel", "papercut"]);
    expect(DEFAULT_ART_PACK_ID).toBe("papercut");
    expect(activeArtPackId()).toBe("papercut");
    expect(activeArtPack()).toBe(ART_PACKS.papercut);
    expect(getArtPack("pixel")).toBe(ART_PACKS.pixel);
  });

  it("gives each pack its grid size and the same five builders", () => {
    for (const id of ART_PACK_IDS) {
      const pack = ART_PACKS[id];
      expect(pack.id).toBe(id);
      expect(pack.label.length).toBeGreaterThan(0);
      expect(pack.gridSize).toBeGreaterThanOrEqual(16);
      for (const fn of [
        pack.minerSprite,
        pack.pickaxeSprite,
        pack.debrisSprite,
        pack.mineralChunkSprite,
        pack.gemSprite,
      ]) {
        expect(typeof fn).toBe("function");
      }
    }
    expect(ART_PACKS.pixel.gridSize).toBe(16);
    expect(ART_PACKS.papercut.gridSize).toBe(32);
  });
});

describe("the entry points", () => {
  it("every pack returns a valid PNG data URI for every sprite", () => {
    for (const id of ART_PACK_IDS) {
      setActiveArtPack(id);
      const grid = ART_PACKS[id].gridSize;
      // The miner and the pickaxe are the pack-sized ones. The debris shard
      // is deliberately small (a 12px particle), and the classic chunk/gem
      // icons are 12×12 rather than the pack's 16.
      for (const uri of [minerSpriteUri(LOOK), pickaxeSpriteUri(THEME)]) {
        expect(uri.startsWith(PREFIX)).toBe(true);
        expect(pngSize(uri)).toEqual([grid, grid]);
      }
      for (const uri of [
        debrisSpriteUri(0),
        mineralChunkSpriteUri(),
        gemSpriteUri(),
      ]) {
        expect(uri.startsWith(PREFIX)).toBe(true);
        const [w, h] = pngSize(uri);
        expect(w).toBe(h);
        expect(w).toBeGreaterThan(4);
        expect(w).toBeLessThanOrEqual(grid);
      }
    }
  });

  it("debris still wraps out-of-range variants", () => {
    expect(debrisSpriteUri(-1)).toBe(debrisSpriteUri(DEBRIS_VARIANTS - 1));
    expect(debrisSpriteUri(0)).not.toBe(debrisSpriteUri(1));
  });

  it("caches: same input → the same string, different input → different", () => {
    for (const id of ART_PACK_IDS) {
      setActiveArtPack(id);
      expect(minerSpriteUri(LOOK)).toBe(minerSpriteUri({ ...LOOK }));
      expect(minerSpriteUri(LOOK)).not.toBe(
        minerSpriteUri({ ...LOOK, shirt: "#e8443a" }),
      );
      expect(pickaxeSpriteUri(THEME)).toBe(pickaxeSpriteUri({ ...THEME }));
      expect(pickaxeSpriteUri(THEME)).not.toBe(
        pickaxeSpriteUri({ ...THEME, head: "#e8c33d" }),
      );
    }
  });

  it("swapping the pack changes every sprite (and back again)", () => {
    const papercutMiner = minerSpriteUri(LOOK);
    const papercutPick = pickaxeSpriteUri(THEME);
    setActiveArtPack("pixel");
    const pixelMiner = minerSpriteUri(LOOK);
    const pixelPick = pickaxeSpriteUri(THEME);
    expect(pixelMiner).not.toBe(papercutMiner);
    expect(pixelPick).not.toBe(papercutPick);
    // The classic pack IS the old art, byte for byte.
    expect(pixelMiner).toBe(pixelMinerSpriteUri(LOOK));
    expect(pixelPick).toBe(pixelPickaxeSpriteUri(THEME));
    expect(pixelMiner).toBe(gridToPngDataUri(buildMinerGrid(LOOK)));
    expect(pixelPick).toBe(gridToPngDataUri(buildPickaxeGrid(THEME)));
    setActiveArtPack("papercut");
    expect(minerSpriteUri(LOOK)).toBe(papercutMiner);
  });

  it("keeps the two packs out of each other's cache", () => {
    const papercutGem = (setActiveArtPack("papercut"), gemSpriteUri());
    setActiveArtPack("pixel");
    expect(gemSpriteUri()).not.toBe(papercutGem);
    setActiveArtPack("papercut");
    expect(gemSpriteUri()).toBe(papercutGem);
  });
});

describe("the papercut pack", () => {
  it("ignores the shape hints the classic art cannot draw", () => {
    setActiveArtPack("pixel");
    const plain = minerSpriteUri(LOOK);
    const dressed = minerSpriteUri({ ...LOOK, outfit: "dress", cute: true });
    expect(dressed).toBe(plain);
  });

  it("honors the shape hints the look carries", () => {
    setActiveArtPack("papercut");
    const plain = minerSpriteUri(LOOK);
    const dressed = minerSpriteUri({ ...LOOK, outfit: "dress" });
    const cute = minerSpriteUri({ ...LOOK, cute: true });
    const critter = minerSpriteUri({ ...LOOK, species: "animal" });
    expect(dressed).not.toBe(plain);
    expect(cute).not.toBe(plain);
    expect(critter).not.toBe(plain);
    expect(dressed).not.toBe(cute);
  });

  it("draws the critter form for an animal look, the human form otherwise", () => {
    expect(shapeForLook({ ...LOOK, species: "animal" }).form).toBe("critter");
    expect(shapeForLook(LOOK).form).toBe("human");
    expect(shapeForLook({ ...LOOK, species: "human" }).form).toBe("human");
  });

  it("passes the look's headwear and hair straight through", () => {
    for (const hatStyle of [
      "helmet",
      "beanie",
      "cap",
      "bandana",
      "longhair",
    ] as const) {
      expect(shapeForLook({ ...LOOK, hatStyle }).hatStyle).toBe(hatStyle);
    }
    expect(shapeForLook({ ...LOOK, hair: "twin" }).hair).toBe("twin");
  });

  it("defaults the optional shape hints (a hand-built look still renders)", () => {
    const shape = shapeForLook(LOOK);
    expect(shape.beard).toBe(false);
    expect(shape.cute).toBe(false);
    expect(shape.outfit).toBe("trousers");
    expect(shape.hair).toBeUndefined();
  });

  it("renders a crew character by id, and caches it separately", () => {
    setActiveArtPack("papercut");
    const plain = minerSpriteUri(LOOK);
    const ember = minerSpriteUri(LOOK, { crewId: "ember" });
    expect(ember).not.toBe(plain);
    // Same id → same string (one shared image per character in the crew).
    expect(minerSpriteUri(LOOK, { crewId: "ember" })).toBe(ember);
    // A different character is a different sprite even from the same look.
    expect(minerSpriteUri(LOOK, { crewId: "vesper" })).not.toBe(ember);
    // Every line has one, and all three differ from the plain miner.
    for (const id of ["cog", "flint", "ember"]) {
      expect(minerSpriteUri(LOOK, { crewId: id })).not.toBe(plain);
    }
    // …and a different look does not leak into a character sprite.
    expect(minerSpriteUri({ ...LOOK, shirt: "#e8443a" }, {
      crewId: "ember",
    })).toBe(ember);
    // An unknown id falls back to the plain miner (never a blank sprite).
    expect(minerSpriteUri(LOOK, { crewId: "nope" })).toBe(plain);
  });

  it("the wardrobe flag is part of the sprite identity", () => {
    // An undressed crew slot wears the character's own palette; dressing it
    // swaps in the outfit's colours, so the two must never share a cache
    // entry (this is the ordinary crew's own sprite).
    setActiveArtPack("papercut");
    const bare = minerSpriteUri(LOOK, { crewId: "cog" });
    const dressed = minerSpriteUri(LOOK, {
      crewId: "cog",
      crewWearsOutfit: true,
    });
    expect(dressed).not.toBe(bare);
    expect(bare).toBe(minerSpriteUri(LOOK, { crewId: "cog" }));
    expect(dressed).toBe(
      minerSpriteUri(LOOK, { crewId: "cog", crewWearsOutfit: true }),
    );
    // false and absent are the same thing (nobody assigns outfits to the
    // gem tiers, so their rows never set it).
    expect(minerSpriteUri(LOOK, { crewId: "cog", crewWearsOutfit: false })).toBe(
      bare,
    );
  });

  it("the classic pack has no cast and ignores the id", () => {
    setActiveArtPack("pixel");
    for (const id of ["cog", "flint", "ember"]) {
      expect(minerSpriteUri(LOOK, { crewId: id })).toBe(
        pixelMinerSpriteUri(LOOK),
      );
      expect(
        minerSpriteUri(LOOK, { crewId: id, crewWearsOutfit: true }),
      ).toBe(pixelMinerSpriteUri(LOOK));
    }
  });

  it("leaves the tool out of the body (Miner draws the swinging pickaxe)", () => {
    expect(shapeForLook(LOOK).tool).toBe(false);
    // The grid really is tool-less: dropping the tool removes the blade,
    // the shine and the handle.
    const withTool = minerLabels({ ...shapeForLook(LOOK), tool: true });
    const without = minerLabels(shapeForLook(LOOK));
    let toolPixels = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (withTool[y][x] !== without[y][x]) toolPixels++;
      }
    }
    expect(toolPixels).toBeGreaterThan(20);
  });
});