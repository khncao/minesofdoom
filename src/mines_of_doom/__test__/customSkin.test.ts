import {
  CUSTOM_SKIN_UNLOCK_COST_GEMS,
  CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH,
  CUSTOM_SKIN_GRID_SIZE,
  hasCustomSkinPixels,
  isValidCustomSkinColor,
  normalizeCustomSkinAudio,
  normalizeCustomSkinGrid,
  customSkinGridToUri,
} from "../customSkin";

const row = (color: string | null): (string | null)[] =>
  Array.from({ length: CUSTOM_SKIN_GRID_SIZE }, () => color);

const goodGrid = () =>
  Array.from({ length: CUSTOM_SKIN_GRID_SIZE }, () => row("#aabbcc"));

describe("normalizeCustomSkinGrid", () => {
  it("accepts a valid 16×16 grid (string colors and null)", () => {
    const grid = goodGrid();
    (grid[3] as (string | null)[])[4] = null;
    expect(normalizeCustomSkinGrid(grid)).toEqual(grid);
  });

  it("accepts hash-less 6/8-digit hex", () => {
    expect(isValidCustomSkinColor("abc")).toBe(true);
    expect(isValidCustomSkinColor("#ff8800ff")).toBe(true);
  });

  it.each([
    ["not an array", 42],
    ["wrong size (15 rows)", goodGrid().slice(0, 15)],
    ["wrong row width", goodGrid().map((r) => r.slice(0, 15))],
    ["non-string cell", goodGrid().map((r, i) => (i === 0 ? ["zz"] as unknown as (string | null)[] : r))],
    ["non-hex cell", goodGrid().map((r, i) => (i === 0 ? ["not-a-color"] as unknown as (string | null)[] : r))],
  ])("rejects %s", (_name, grid) => {
    expect(normalizeCustomSkinGrid(grid)).toBeNull();
  });

  it("rejects undefined and null input", () => {
    expect(normalizeCustomSkinGrid(undefined)).toBeNull();
    expect(normalizeCustomSkinGrid(null)).toBeNull();
  });

  it("supports a custom size (the slot is 16 today)", () => {
    expect(normalizeCustomSkinGrid([[ "#fff", null ], [ null, "#000" ]], 2)).toHaveLength(2);
    expect(normalizeCustomSkinGrid([[ "#fff", null ], [ null, "#000" ]], 16)).toBeNull();
  });
});

describe("hasCustomSkinPixels", () => {
  it("is false for null and an all-null grid, true for one opaque cell", () => {
    expect(hasCustomSkinPixels(null)).toBe(false);
    expect(
      hasCustomSkinPixels(
        Array.from({ length: CUSTOM_SKIN_GRID_SIZE }, () => row(null)),
      ),
    ).toBe(false);
    const grid = goodGrid();
    (grid[0] as (string | null)[]).fill(null);
    expect(hasCustomSkinPixels(grid)).toBe(true);
  });
});

describe("normalizeCustomSkinAudio", () => {
  it("accepts a small data:audio URI and rejects the rest", () => {
    const good = `data:audio/wav;base64,${"A".repeat(100)}`;
    expect(normalizeCustomSkinAudio(good)).toBe(good);
    expect(normalizeCustomSkinAudio("file:///sdcard/a.mp3")).toBeNull();
    expect(normalizeCustomSkinAudio("https://x/y.mp3")).toBeNull();
    expect(normalizeCustomSkinAudio("data:image/png;base64,AA==")).toBeNull();
    expect(normalizeCustomSkinAudio("data:audio/wav;base64," + "A".repeat(CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH + 1))).toBeNull();
    expect(normalizeCustomSkinAudio(42)).toBeNull();
  });
});

describe("customSkinGridToUri", () => {
  it("caches: the same grid produces one encoded call", () => {
    const grid = goodGrid();
    const toDataUri = jest.fn(() => "data:image/png;base64,xyz");
    expect(customSkinGridToUri(grid, toDataUri)).toBe(
      "data:image/png;base64,xyz",
    );
    expect(customSkinGridToUri(grid, toDataUri)).toBe(
      "data:image/png;base64,xyz",
    );
    expect(toDataUri).toHaveBeenCalledTimes(1);
  });

  it("a different grid re-encodes", () => {
    const toDataUri = jest.fn((g) => `data:image/png;base64,${JSON.stringify(g).length}`);
    const c = "#deadbe";
    const g1 = Array.from({ length: CUSTOM_SKIN_GRID_SIZE }, () =>
      Array.from({ length: CUSTOM_SKIN_GRID_SIZE }, () => c),
    );
    const g2 = Array.from({ length: CUSTOM_SKIN_GRID_SIZE }, (_, i) =>
      Array.from({ length: CUSTOM_SKIN_GRID_SIZE }, (_, j) => (i === 0 && j === 0 ? null : c)),
    );
    const a = customSkinGridToUri(g1, toDataUri);
    const b = customSkinGridToUri(g2, toDataUri);
    expect(a).not.toBe(b);
    expect(toDataUri).toHaveBeenCalledTimes(2);
  });
});

describe("cost", () => {
  it("unlock price is a positive integer of gems (feature tier)", () => {
    expect(CUSTOM_SKIN_UNLOCK_COST_GEMS).toBeGreaterThan(0);
    expect(Number.isInteger(CUSTOM_SKIN_UNLOCK_COST_GEMS)).toBe(true);
  });
});
