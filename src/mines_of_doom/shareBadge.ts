/**
 * Share-badge rendering (todo "share images"): a shareable PNG badge for
 * completed achievements, rendered entirely in pure TS (pixel font +
 * pixel buffer + the pako-based PNG encoder in utils/png.ts) so it works
 * identically on web, Android, and iOS with no canvas dependency.
 *
 * The badge is deliberately small (320x180, chunky pixel type) — a
 * compact "earned" card, not a screenshot. Platform file-sharing lives
 * in shareImage.ts / shareImage.web.ts; this module is 100% pure and
 * unit-testable in Node.
 */
import { encodePng } from "src/utils/png";
import { formatNumber } from "src/utils/format";

/* ------------------------------------------------------------------ */
/* 5x7 pixel font                                                      */
/* ------------------------------------------------------------------ */

/**
 * Classic 5x7 dot font, one 7-bit row per line (MSB = leftmost pixel).
 * Only the characters the badge copy needs; anything else (accents,
 * lowercase, punctuation we didn't carve) degrades to a space — never a
 * garbage glyph.
 */
export const PIXEL_FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
  E: [0b11110, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11110],
  F: [0b11110, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11110],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b10001, 0b11011, 0b10101, 0b10011, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11110],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b01110, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "'": [0b00100, 0b00100, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '"': [0b01010, 0b01010, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  ".": [0, 0, 0, 0, 0, 0b00110, 0b00110],
  ",": [0, 0, 0, 0, 0, 0b00110, 0b01100],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  "?": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0, 0b00100],
  "-": [0, 0, 0, 0b01110, 0, 0, 0],
  "+": [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  "/": [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  "%": [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  "·": [0, 0, 0b00110, 0b00110, 0, 0, 0],
  "×": [0, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0],
};

/** Width/height of every glyph in font pixels. */
export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** 1px inter-glyph gap (scaled with the font scale). */
const GLYPH_GAP = 1;

/* ------------------------------------------------------------------ */
/* Pixel buffer primitives                                             */
/* ------------------------------------------------------------------ */

export interface PixelBuffer {
  width: number;
  height: number;
  /** RGBA, row-major. */
  data: Uint8Array;
}

export function createBuffer(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function fillRect(
  buf: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number, number],
): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(buf.width, x + w);
  const y1 = Math.min(buf.height, y + h);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * buf.width + px) * 4;
      buf.data[i] = color[0];
      buf.data[i + 1] = color[1];
      buf.data[i + 2] = color[2];
      buf.data[i + 3] = color[3];
    }
  }
}

/**
 * Wrap `text` (upper-cased, unknown glyphs blanked) into lines of at
 * most `maxChars` characters. Words break at spaces; a single word longer
 * than the limit is hard-cut; more than `maxLines` lines collapses the
 * tail into a single ellipsis line.
 */
export function wrapText(
  text: string,
  maxChars: number,
  maxLines: number,
): string[] {
  const up = text.toUpperCase();
  const words = up.split(/[\s]+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.length > 0) {
      lines.push(cur);
      cur = "";
    }
  };
  for (const word of words) {
    let piece = word;
    while (piece.length > maxChars) {
      push();
      lines.push(piece.slice(0, maxChars));
      piece = piece.slice(maxChars);
    }
    if (cur.length === 0) {
      cur = piece;
    } else if (cur.length + 1 + piece.length <= maxChars) {
      cur = cur + " " + piece;
    } else {
      push();
      cur = piece;
    }
  }
  push();
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines - 1);
    let last = lines.slice(maxLines - 1).join(" ");
    if (last.length > maxChars - 3) last = last.slice(0, maxChars - 3);
    kept.push(last + "..."); // the ellipsis line itself must fit the budget
    return kept;
  }
  return lines;
}

/** Draw one line of the 5x7 font at (x, y) at the given integer scale. */
export function drawText(
  buf: PixelBuffer,
  x: number,
  y: number,
  text: string,
  scale: number,
  color: [number, number, number, number],
): void {
  let cx = x;
  for (const rawCh of text.toUpperCase()) {
    const glyph = PIXEL_FONT[rawCh] ?? PIXEL_FONT[" "];
    for (let row = 0; row < GLYPH_H; row++) {
      const bits = glyph[row] ?? 0;
      for (let col = 0; col < GLYPH_W; col++) {
        if (bits & (1 << (GLYPH_W - 1 - col))) {
          fillRect(buf, cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += (GLYPH_W + GLYPH_GAP) * scale;
  }
}

/** Pixel width of a string at a scale (for centering). */
export function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * (GLYPH_W + GLYPH_GAP) * scale - scale;
}

/* ------------------------------------------------------------------ */
/* Badge layout                                                        */
/* ------------------------------------------------------------------ */

export interface ShareBadgeOptions {
  /** Small label line above the title (e.g. "BADGE EARNED"). */
  heading: string;
  /** The big line(s) — the achievement name. */
  title: string;
  /** Small dim line at the bottom (e.g. the depth). */
  detail: string;
}

export interface ShareBadge {
  width: number;
  height: number;
  /** Raw RGBA pixels (same layout the PNG encodes). */
  pixels: Uint8Array;
  /** The finished PNG file bytes. */
  bytes: Uint8Array;
}

// Palette (cave-night + torch-gold, matching the app's dark theme).
const C_BG: [number, number, number, number] = [14, 10, 7, 255];
const C_FRAME_OUTER: [number, number, number, number] = [87, 66, 44, 255];
const C_FRAME_INNER: [number, number, number, number] = [58, 47, 34, 255];
const C_GOLD: [number, number, number, number] = [255, 170, 68, 255];
const C_DIM: [number, number, number, number] = [154, 139, 116, 255];
const C_TITLE: [number, number, number, number] = [255, 214, 140, 255];

/** 8x8 pickaxe sprite (head arc + vertical handle). */
const PICKAXE: number[] = [
  0b01111110,
  0b10011001,
  0b00011000,
  0b00011000,
  0b00011000,
  0b00011000,
  0b00011000,
  0b00011000,
];

const BADGE_W = 320;
const BADGE_H = 180;
const MARGIN = 16;
const TITLE_LINE = "MINES OF IDLE DOOMATH";

/** The pure render: badge options in, RGBA pixels + PNG bytes out. */
export function renderShareBadge(opts: ShareBadgeOptions): ShareBadge {
  const buf = createBuffer(BADGE_W, BADGE_H);

  // Background + two-tone frame.
  fillRect(buf, 0, 0, BADGE_W, BADGE_H, C_BG);
  fillRect(buf, 4, 4, BADGE_W - 8, BADGE_H - 8, C_FRAME_OUTER);
  fillRect(buf, 8, 8, BADGE_W - 16, BADGE_H - 16, C_BG);
  fillRect(buf, 9, 9, BADGE_W - 18, BADGE_H - 18, C_FRAME_INNER);

  // Pickaxe, centered, 3x scale (24px).
  const pickScale = 3;
  const pickW = 8 * pickScale;
  const pickX = Math.floor((BADGE_W - pickW) / 2);
  for (let row = 0; row < 8; row++) {
    const bits = PICKAXE[row];
    for (let col = 0; col < 8; col++) {
      if (bits & (1 << (7 - col))) {
        fillRect(
          buf,
          pickX + col * pickScale,
          16 + row * pickScale,
          pickScale,
          pickScale,
          C_GOLD,
        );
      }
    }
  }

  // Game title, 2x scale, dim, centered.
  const titleScale = 2;
  const titleY = 48;
  drawText(
    buf,
    Math.floor((BADGE_W - textWidth(TITLE_LINE, titleScale)) / 2),
    titleY,
    TITLE_LINE,
    titleScale,
    C_DIM,
  );

  // Divider.
  fillRect(buf, MARGIN, 66, BADGE_W - MARGIN * 2, 1, C_FRAME_INNER);

  // Heading (label), 1x scale, dim, centered.
  const heading = opts.heading.toUpperCase();
  drawText(
    buf,
    Math.floor((BADGE_W - textWidth(heading, 1)) / 2),
    72,
    heading,
    1,
    C_DIM,
  );

  // Title — the achievement name, 3x scale, gold, up to 3 wrapped lines.
  const nameScale = 3;
  const maxChars = Math.floor((BADGE_W - MARGIN * 2) / ((GLYPH_W + GLYPH_GAP) * nameScale));
  const lines = wrapText(opts.title, maxChars, 3);
  let nameY = 84;
  for (const line of lines) {
    drawText(
      buf,
      Math.floor((BADGE_W - textWidth(line, nameScale)) / 2),
      nameY,
      line,
      nameScale,
      C_TITLE,
    );
    nameY += (GLYPH_H + 1) * nameScale;
  }

  // Detail line, 1x scale, dim, centered, pinned to the bottom area.
  const detail = opts.detail.toUpperCase();
  drawText(
    buf,
    Math.floor((BADGE_W - textWidth(detail, 1)) / 2),
    162,
    detail,
    1,
    C_DIM,
  );

  const pixels = buf.data;
  return {
    width: BADGE_W,
    height: BADGE_H,
    pixels,
    bytes: encodePng(BADGE_W, BADGE_H, pixels),
  };
}

/**
 * Build the achievement badge: the achievement name as the title and the
 * player's deepest depth as the detail line (personal, truthful — it's a
 * lifetime max). `maxDepthMeters` is a bigint by convention in game.ts.
 */
export function renderAchievementBadge(
  achievementName: string,
  maxDepthMeters: bigint,
  heading = "BADGE EARNED",
): ShareBadge {
  return renderShareBadge({
    heading,
    title: achievementName,
    detail: `DEPTH ${formatNumber(maxDepthMeters)}M`,
  });
}
