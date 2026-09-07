/**
 * Share-badge tests (shareBadge.ts): the 5x7 font table's invariants,
 * the text-wrap policy, and the full render (deterministic pixels,
 * layout spot-checks, and a PNG that decodes back to the same pixels).
 */
import { decodePngForTest } from "src/utils/png";
import {
  GLYPH_H,
  GLYPH_W,
  PIXEL_FONT,
  createBuffer,
  drawText,
  fillRect,
  renderAchievementBadge,
  renderShareBadge,
  textWidth,
  wrapText,
} from "../shareBadge";

describe("PIXEL_FONT", () => {
  it("covers A-Z and 0-9 plus the punctuation the badge copy uses", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .?!-,+%\"'·×/") {
      expect(PIXEL_FONT[ch]).toBeDefined();
    }
  });

  it("every glyph is exactly 7 rows of 5-bit rows", () => {
    for (const [ch, rows] of Object.entries(PIXEL_FONT)) {
      expect(rows).toHaveLength(GLYPH_H);
      for (const bits of rows) {
        expect(bits).toBeGreaterThanOrEqual(0);
        expect(bits).toBeLessThan(1 << GLYPH_W);
      }
      void ch;
    }
  });

  it("unknown glyphs degrade to the space glyph, never garbage", () => {
    // drawText maps missing chars to the space glyph — verify the space
    // glyph is truly blank so the degradation is invisible.
    expect(PIXEL_FONT[" "].reduce((a, b) => a | b, 0)).toBe(0);
  });
});

describe("wrapText", () => {
  it("wraps at spaces within the width budget", () => {
    expect(wrapText("GEM HOARDER", 7, 3)).toEqual(["GEM", "HOARDER"]);
  });

  it("hard-cuts a single word longer than the budget", () => {
    expect(wrapText("FOREMANSHIP", 5, 5)).toEqual(["FOREM", "ANSHI", "P"]);
  });

  it("collapses overflow into one ellipsis line that itself fits the budget", () => {
    expect(wrapText("ONE TWO THREE FOUR FIVE", 5, 2)).toEqual([
      "ONE",
      "TW...",
    ]);
  });

  it("uppercases and ignores odd whitespace", () => {
    expect(wrapText("  on   a   roll ", 8, 3)).toEqual(["ON A", "ROLL"]);
  });
});

describe("text primitives", () => {
  it("textWidth accounts for the inter-glyph gap (and the trailing one)", () => {
    expect(textWidth("ABC", 1)).toBe(3 * (GLYPH_W + 1) - 1);
    expect(textWidth("", 2)).toBe(0);
  });

  it("drawText paints exactly the glyph pixels (A, scale 1)", () => {
    const buf = createBuffer(5, 7);
    drawText(buf, 0, 0, "A", 1, [255, 0, 0, 255]);
    const at = (x: number, y: number) => buf.data[(y * 5 + x) * 4];
    // top row of A: 01110
    expect([at(0, 0), at(1, 0), at(2, 0), at(3, 0), at(4, 0)]).toEqual([
      0, 255, 255, 255, 0,
    ]);
    // middle row 3 is the 11110 bar
    expect([at(0, 3), at(1, 3), at(2, 3), at(3, 3), at(4, 3)]).toEqual([
      255, 255, 255, 255, 0,
    ]);
  });

  it("fillRect clamps to the buffer", () => {
    const buf = createBuffer(4, 4);
    fillRect(buf, -2, -2, 8, 8, [1, 2, 3, 255]);
    expect(buf.data[0]).toBe(1);
    expect(buf.data[buf.data.length - 4]).toBe(1);
  });
});

describe("renderShareBadge", () => {
  const opts = {
    heading: "BADGE EARNED",
    title: "Gem Hoarder",
    detail: "DEPTH 520M",
  };

  it("renders a 320x180 badge whose PNG decodes back to the same pixels", () => {
    const badge = renderShareBadge(opts);
    expect(badge.width).toBe(320);
    expect(badge.height).toBe(180);
    expect(badge.pixels).toHaveLength(320 * 180 * 4);
    const decoded = decodePngForTest(badge.bytes);
    expect(decoded.width).toBe(320);
    expect(decoded.height).toBe(180);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(badge.pixels));
  });

  it("is deterministic (same options, byte-identical PNG)", () => {
    const a = renderShareBadge(opts);
    const b = renderShareBadge(opts);
    expect(Array.from(a.bytes)).toEqual(Array.from(b.bytes));
  });

  it("lays out frame, pickaxe, and text where the design says", () => {
    const badge = renderShareBadge(opts);
    const px = (x: number, y: number) => {
      const i = (y * 320 + x) * 4;
      return [badge.pixels[i], badge.pixels[i + 1], badge.pixels[i + 2]];
    };
    // Corners are background; the outer frame ring is visible at (5,5).
    expect(px(0, 0)).toEqual([14, 10, 7]);
    expect(px(5, 5)).toEqual([87, 66, 44]);
    // Pickaxe center column (gold) at its 3x slot: x=160..161? 8*3=24,
    // x=(320-24)/2=148; handle cols 3..4 of the sprite → 148+9..148+11.
    expect(px(157, 30)).toEqual([255, 170, 68]);
  });

  it("draws the achievement title in gold and long names wrap, not clip", () => {
    const badge = renderShareBadge({
      heading: "BADGE EARNED",
      title: "Master Of The Crystal Kingdom And Beyond",
      detail: "DEPTH 1M",
    });
    let goldPx = 0;
    for (let i = 0; i < badge.pixels.length; i += 4) {
      if (
        badge.pixels[i] === 255 &&
        badge.pixels[i + 1] === 214 &&
        badge.pixels[i + 2] === 140
      ) {
        goldPx++;
      }
    }
    expect(goldPx).toBeGreaterThan(500); // a 3x-scaled name is big
  });

  it("the badge bytes are a PNG of a plausible size for sharing", () => {
    const badge = renderShareBadge(opts);
    // 320x180x4 raw = 230KB; a real PNG of flat-color pixel art is far
    // below that — pin a ceiling so nobody quietly ships a 230KB blob.
    expect(badge.bytes.length).toBeLessThan(30_000);
    expect(badge.bytes[0]).toBe(0x89);
  });
});

describe("renderAchievementBadge", () => {
  it("formats the depth detail from a bigint", () => {
    const badge = renderAchievementBadge("First Hire", 1_234_567n, "BADGE EARNED");
    // Must render without throwing and still decode — the formatting
    // (formatBigNumber) is what varies with the value.
    expect(badge.bytes[0]).toBe(0x89);
    const decoded = decodePngForTest(badge.bytes);
    expect(decoded.width).toBe(320);
  });
});
