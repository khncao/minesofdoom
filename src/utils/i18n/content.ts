/**
 * Content-name i18n (todo: "Add localizations" — data-driven follow-up).
 *
 * UI chrome lives in en.ts/es.ts (key → string). The DATA-driven names —
 * cosmetics, goal tiers, goal/achievement/record labels, IAP product
 * labels, legal doc titles/section headings/bodies, depth-tier (biome)
 * names — live in their data modules (game.ts, goals.ts, cosmetics.ts,
 * achievements.ts, records.ts, iaps.ts, legal.ts), which are the
 * ENGLISH source of truth for those strings.
 *
 * This module adds the per-locale shape: a flat `ns:id → {title, detail?}`
 * table per locale, looked up at render time. English needs no table at
 * all — the caller passes the data-module value as the fallback, so the
 * English name can only live in one place. `translateContent` returns the
 * locale's entry when one exists and the data value otherwise, which means
 * a forgotten translation degrades to English instead of crashing.
 *
 * `title` is the display name/label; `detail` is the optional one-line
 * extra (blurb, unlock line); `body` is optional long text (legal doc
 * sections). The parity net (content.test.ts) walks the actual data
 * modules and pins that every locale covers exactly that key set, with
 * `detail` and `body` present exactly where the English item has one.
 */
import type { Locale } from "./i18n";
import { contentEs } from "./content-es";

/** Which data table a key belongs to. */
export type ContentNamespace =
  /** Biome names (DEPTH_TIERS in game.ts). id = tier id, stringified. */
  | "depthTier"
  /** Goal tier name + unlock line (GOAL_TIERS in goals.ts). */
  | "goalTier"
  /** Individual goal labels (the `goals` arrays in goals.ts). */
  | "goal"
  /** Achievement labels (ACHIEVEMENTS in achievements.ts). */
  | "achievement"
  /** Record row labels (getRecords in records.ts). */
  | "record"
  /** Outfit name + blurb (OUTFITS in cosmetics.ts). */
  | "outfit"
  /** Pickaxe name (PICKAXES in cosmetics.ts). */
  | "pickaxe"
  /** Cave theme name + blurb (CAVE_THEMES in cosmetics.ts). */
  | "caveTheme"
  /** IAP product label + blurb (IAP_PRODUCTS in iaps.ts). */
  | "iap"
  /** Legal document titles (LEGAL_DOCS in legal.ts). */
  | "legalDoc"
  /** Legal section headings + bodies. id = `<docId>:<English heading>`. */
  | "legalSection";

/** A content item's display strings. */
export type ContentStrings = {
  /** Display name / label. */
  title: string;
  /** Optional one-line extra (blurb, unlock line). */
  detail?: string;
  /** Optional long text (legal doc section bodies). */
  body?: string;
};

/** A locale's content table, keyed by `ns:id` (contentKey). */
export type ContentTable = Record<string, ContentStrings>;

/**
 * Per-locale content tables. The English table is deliberately EMPTY:
 * English strings are the data modules themselves (the `fallback` argument
 * at every call site), so they can't drift. A new locale ships by adding a
 * full table here + a parity entry in content.test.ts.
 */
const TABLES: Record<Locale, ContentTable> = {
  en: {},
  es: contentEs,
};

export function contentKey(ns: ContentNamespace, id: string): string {
  return `${ns}:${id}`;
}

/**
 * Translate one content item for `locale`. `fallback` is the data-module
 * value (always English) and is returned as-is for "en" and whenever the
 * locale table has no entry — a missing translation degrades to English,
 * mirroring `translate` in i18n.ts.
 */
export function translateContent(
  ns: ContentNamespace,
  id: string,
  locale: Locale,
  fallback: ContentStrings,
): ContentStrings {
  const entry = TABLES[locale][contentKey(ns, id)];
  if (entry == null) return fallback;
  return {
    title: entry.title,
    detail: entry.detail ?? fallback.detail,
    body: entry.body ?? fallback.body,
  };
}
