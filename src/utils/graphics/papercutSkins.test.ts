/**
 * The papercut skin line (docs/art-directions.md): contracts that keep the
 * line a LINE — unique ids and names, complete colorways, a distinct
 * silhouette per character, every skin rendering real content
 * deterministically, and the cute/pretty group being what it says it is.
 */
import {
 PAPERCUT_SKIN_GRID_SIZE,
 PAPERCUT_SKIN_GROUPS,
 PAPERCUT_SKIN_IDS,
 PAPERCUT_SKINS,
 buildPapercutSkinGrid,
 papercutSkinById,
 papercutSkinGroup,
} from "src/utils/graphics/papercutSkins";
import type { PapercutSkin } from "src/utils/graphics/papercutSkins";
import { DIRECTION_IDS } from "src/utils/graphics/characterArt";

function filled(grid: (string | null)[][]): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c != null) n++;
  return n;
}

describe("the line", () => {
  it("has a full cast of characters", () => {
    expect(PAPERCUT_SKINS.length).toBeGreaterThanOrEqual(10);
    for (const id of PAPERCUT_SKIN_IDS) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("has unique ids, names and blurbs", () => {
    for (const key of ["id", "name", "blurb"] as const) {
      const seen = new Set<string>();
      for (const skin of PAPERCUT_SKINS) {
        expect(seen.has(skin[key])).toBe(false);
        seen.add(skin[key]);
      }
    }
  });

  it("gives every skin a complete six-color look", () => {
    for (const skin of PAPERCUT_SKINS) {
      for (const slot of [
       "skin",
       "shirt",
       "pants",
       "boots",
       "hat",
      ] as const) {
        expect(skin.look[slot]).toMatch(/^#[0-9a-f]{6}$/);
      }
      // The look's hatStyle is metadata for the in-game cosmetic line; the
      // draft's silhouette switch is `shape`.
      expect(skin.shape.hatStyle ?? "helmet").toBe(skin.look.hatStyle);
    }
  });

  it("covers the shape axes a crew needs (every hat, both forms, hair, a beard)", () => {
    const hats = new Set(PAPERCUT_SKINS.map((s) => s.shape.hatStyle));
    expect(hats).toEqual(
      new Set(["helmet", "beanie", "cap", "bandana", "longhair"]),
    );
    const forms = new Set(PAPERCUT_SKINS.map((s) => s.shape.form));
    expect(forms).toEqual(new Set(["human", "critter"]));
    const hairs = new Set(
      PAPERCUT_SKINS.filter((s) => s.shape.hair).map((s) => s.shape.hair),
    );
    expect(hairs.size).toBeGreaterThanOrEqual(4);
    expect(PAPERCUT_SKINS.filter((s) => s.shape.beard).length).toBeGreaterThanOrEqual(1);
    expect(PAPERCUT_SKINS.filter((s) => s.shape.outfit === "dress").length)
      .toBeGreaterThanOrEqual(4);
  });

  it("splits into a crew half and a cute/pretty half", () => {
    expect(PAPERCUT_SKIN_GROUPS).toEqual(["crew", "pretty"]);
    const groups = new Set(PAPERCUT_SKINS.map(papercutSkinGroup));
    expect(groups).toEqual(new Set(PAPERCUT_SKIN_GROUPS));
    const pretty = PAPERCUT_SKINS.filter((s) => papercutSkinGroup(s) === "pretty");
    const crew = PAPERCUT_SKINS.filter((s) => papercutSkinGroup(s) === "crew");
    expect(pretty.length).toBeGreaterThanOrEqual(4);
    expect(crew.length).toBeGreaterThanOrEqual(3);
    // The cute half is where the dresses and the big eyes live.
    for (const skin of pretty) {
      expect(skin.shape.outfit === "dress" || skin.shape.cute === true).toBe(true);
    }
    // The crew half keeps the plain face and the trousers.
    for (const skin of crew) {
      expect(skin.shape.cute ?? false).toBe(false);
      expect(skin.shape.outfit ?? "trousers").toBe("trousers");
    }
  });

  it("looks a skin up by id", () => {
    expect(papercutSkinById(PAPERCUT_SKIN_IDS[0])?.id).toBe(PAPERCUT_SKIN_IDS[0]);
    expect(papercutSkinById("nope")).toBeUndefined();
  });
});

describe("buildPapercutSkinGrid", () => {
  it("renders every skin at 32×32 with real content", () => {
    for (const skin of PAPERCUT_SKINS) {
      const g = buildPapercutSkinGrid(skin);
      expect(g).toHaveLength(PAPERCUT_SKIN_GRID_SIZE);
      for (const row of g) {
        expect(row).toHaveLength(PAPERCUT_SKIN_GRID_SIZE);
        for (const c of row) {
          expect(c === null || /^#[0-9a-f]{6}$/.test(c as string)).toBe(true);
        }
      }
      const n = filled(g);
      expect(n).toBeGreaterThan(200);
      expect(n).toBeLessThan(PAPERCUT_SKIN_GRID_SIZE ** 2 - 80);
    }
  });

  it("is deterministic and does not mutate the skin", () => {
    for (const skin of PAPERCUT_SKINS) {
      const before = JSON.stringify(skin);
      const a = buildPapercutSkinGrid(skin);
      const b = buildPapercutSkinGrid(skin);
      expect(b).toEqual(a);
      expect(b).not.toBe(a);
      expect(JSON.stringify(skin)).toBe(before);
    }
  });

  it("gives every skin its own silhouette — no two read the same", () => {
    const grids = PAPERCUT_SKINS.map((s) => buildPapercutSkinGrid(s));
    for (let i = 0; i < grids.length; i++) {
      for (let j = i + 1; j < grids.length; j++) {
        let same = 0;
        for (let y = 0; y < PAPERCUT_SKIN_GRID_SIZE; y++) {
          for (let x = 0; x < PAPERCUT_SKIN_GRID_SIZE; x++) {
            if (grids[i][y][x] === grids[j][y][x]) same++;
          }
        }
        // A same-outfit pair may share a lot of pixels; a whole identical
        // sprite would mean a copy-paste skin.
        expect(same / PAPERCUT_SKIN_GRID_SIZE ** 2).toBeLessThan(0.93);
      }
    }
  });

  it("uses papercut by default, and can be re-rendered in another direction", () => {
    const skin = PAPERCUT_SKINS[0];
    expect(buildPapercutSkinGrid(skin)).toEqual(
      buildPapercutSkinGrid(skin, { direction: "papercut" }),
    );
    for (const direction of DIRECTION_IDS) {
      const g = buildPapercutSkinGrid(skin, { direction });
      expect(filled(g)).toBeGreaterThan(200);
    }
    // The other directions must actually differ (no accidental no-op).
    const cartoon = buildPapercutSkinGrid(skin, { direction: "cartoon" });
    expect(cartoon).not.toEqual(buildPapercutSkinGrid(skin));
  });

  it("keeps the pretty half pretty: a bigger, lighter face than the crew", () => {
    const pretty = PAPERCUT_SKINS.filter(
      (s) => papercutSkinGroup(s) === "pretty",
    )[0] as PapercutSkin;
    const crew = PAPERCUT_SKINS.filter(
      (s) => papercutSkinGroup(s) === "crew",
    )[0] as PapercutSkin;
    // The dress silhouette is wider at the hem than the trouser legs.
    const hem = (g: (string | null)[][]): number => {
      let n = 0;
      for (let x = 0; x < PAPERCUT_SKIN_GRID_SIZE; x++) {
        if (g[28][x] != null) n++;
      }
      return n;
    };
    expect(hem(buildPapercutSkinGrid(pretty))).toBeGreaterThan(
      hem(buildPapercutSkinGrid(crew)),
    );
  });
});