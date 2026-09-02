/**
 * Content-name i18n regression nets (todo: "Add localizations" —
 * data-driven follow-up).
 *
 * The ENGLISH source of truth for content names is the data modules
 * themselves (game.ts, goals.ts, cosmetics.ts, achievements.ts, records.ts,
 * iaps.ts, legal.ts), so this suite walks those modules and pins every
 * locale table against the key set they actually contain:
 *  - a data item with no translation degrades to English at render time,
 *    but a FORGOTTEN one is caught here, not by a player;
 *  - a stray key in a locale table (typo'd or orphaned) fails too;
 *  - `detail` must be present exactly where the English item has one.
 */
import { DEPTH_TIERS, createEmptySaveData } from "src/mines_of_doom/game";
import { GOAL_TIERS } from "src/mines_of_doom/goals";
import { ACHIEVEMENTS } from "src/mines_of_doom/achievements";
import { getRecords } from "src/mines_of_doom/records";
import { IAP_PRODUCTS } from "src/mines_of_doom/iaps";
import { LEGAL_DOCS } from "src/mines_of_doom/legal";
import {
  OUTFITS,
  PICKAXES,
  CAVE_THEMES,
} from "src/mines_of_doom/cosmetics";
import {
  translateContent,
  contentKey,
  type ContentStrings,
} from "./content";
import { contentEs } from "./content-es";

/**
 * Every translatable content item, keyed by `ns:id`, with its English
 * strings — derived from the data modules, so it can't drift from them.
 */
function expectedItems(): Map<string, ContentStrings> {
  const m = new Map<string, ContentStrings>();
  for (const tier of DEPTH_TIERS) {
    m.set(contentKey("depthTier", String(tier.id)), { title: tier.name });
  }
  for (const tier of GOAL_TIERS) {
    m.set(contentKey("goalTier", tier.id), {
      title: tier.name,
      detail: tier.unlock,
    });
    for (const goal of tier.goals) {
      m.set(contentKey("goal", goal.id), { title: goal.label });
    }
  }
  for (const a of ACHIEVEMENTS) {
    m.set(contentKey("achievement", a.id), { title: a.label });
  }
  for (const r of getRecords(createEmptySaveData())) {
    m.set(contentKey("record", r.id), { title: r.label });
  }
  for (const p of Object.values(IAP_PRODUCTS)) {
    m.set(contentKey("iap", p.id), { title: p.label, detail: p.blurb });
  }
  for (const o of OUTFITS) {
    m.set(contentKey("outfit", o.id), { title: o.name, detail: o.blurb });
  }
  for (const p of PICKAXES) {
    m.set(contentKey("pickaxe", p.id), { title: p.name });
  }
  for (const t of CAVE_THEMES) {
    m.set(contentKey("caveTheme", t.id), { title: t.name, detail: t.blurb });
  }
  for (const doc of LEGAL_DOCS) {
    m.set(contentKey("legalDoc", doc.id), { title: doc.title });
    for (const section of doc.sections) {
      m.set(
        contentKey("legalSection", `${doc.id}:${section.heading}`),
        { title: section.heading },
      );
    }
  }
  return m;
}

describe("locale content tables", () => {
  const expected = expectedItems();

  it("the data modules actually contain the expected items (non-trivial walk)", () => {
    expect(expected.size).toBeGreaterThan(100);
  });

  it("every table covers exactly the data modules' key set", () => {
    const expectedKeys = [...expected.keys()].sort();
    for (const table of Object.values({ es: contentEs })) {
      expect(Object.keys(table).sort()).toEqual(expectedKeys);
    }
  });

  it("no empty strings in a table", () => {
    for (const table of Object.values({ es: contentEs })) {
      for (const entry of Object.values(table)) {
        expect(entry.title.trim().length).toBeGreaterThan(0);
        if (entry.detail != null) expect(entry.detail).not.toBe("");
      }
    }
  });

  it("`detail` is present exactly where the English item has one", () => {
    for (const [locale, table] of Object.entries({ es: contentEs })) {
      for (const [key, entry] of Object.entries(table)) {
        const hasEn = expected.get(key)?.detail != null;
        expect({ locale, key, hasEn, hasLocale: entry.detail != null }).toEqual(
          { locale, key, hasEn, hasLocale: hasEn },
        );
      }
    }
  });
});

describe("translateContent", () => {
  const fallback: ContentStrings = { title: "Steel", detail: "en extra" };

  it("returns the fallback as-is for English (no EN table by design)", () => {
    expect(translateContent("pickaxe", "steel", "en", fallback)).toEqual(
      fallback,
    );
  });

  it("returns the locale strings when present, over the fallback", () => {
    expect(translateContent("pickaxe", "steel", "es", fallback)).toEqual({
      title: "Acero",
      detail: "en extra",
    });
  });

  it("degrades to the fallback (English) for a missing key", () => {
    expect(
      translateContent("pickaxe", "no-such-pickaxe", "es", fallback),
    ).toEqual(fallback);
  });
});
