import {
  SAVE_CODE_PREFIX,
  base64Decode,
  base64Encode,
  decodeSaveCode,
  encodeSaveCode,
} from "../saveCode";
import {
  PRESTIGE_LEVELS,
  SaveData,
  createEmptySaveData,
  saveVersion,
} from "../game";
import { DEFAULT_OWNED, DEFAULT_OUTFIT } from "../cosmetics";

const NOW = Date.parse("2026-06-10T12:00:00Z");

describe("base64 (pure, engine-agnostic)", () => {
  it("round-trips ASCII", () => {
    const input = '{"minerals":12345,"ownedCosmetics":["outfit_default"]}';
    expect(base64Decode(base64Encode(input))).toBe(input);
  });

  it("matches the standard base64 alphabet for known vectors", () => {
    // Vectors from RFC 4648.
    expect(base64Encode("")).toBe("");
    expect(base64Encode("f")).toBe("Zg==");
    expect(base64Encode("fo")).toBe("Zm8=");
    expect(base64Encode("foo")).toBe("Zm9v");
    expect(base64Encode("foob")).toBe("Zm9vYg==");
    expect(base64Encode("foobaz")).toBe("Zm9vYmF6");
  });

  it("round-trips non-ASCII (UTF-8) strings", () => {
    const input = "minerals 💎 and émojis 鉱";
    expect(base64Decode(base64Encode(input))).toBe(input);
  });

  it("tolerates line breaks and spaces in pasted codes", () => {
    const encoded = base64Encode("hello world");
    const pasted = `${encoded.slice(0, 6)}\n${encoded.slice(6, 14)} ${encoded.slice(14)}`;
    expect(base64Decode(pasted)).toBe("hello world");
  });

  it("rejects invalid base64", () => {
    expect(base64Decode("not valid base64!!")).toBeNull();
    expect(base64Decode("A")).toBeNull(); // length % 4 === 1 can't decode
    // "gA==" is a single byte (0x80), a stray UTF-8 continuation byte:
    expect(base64Decode("gA==")).toBeNull();
  });
});

describe("encodeSaveCode / decodeSaveCode", () => {
  it("round-trips a full save", () => {
    const save: SaveData = {
      ...createEmptySaveData(),
      minerals: 123_456_789n,
      gems: 42,
      miners: 3,
      minerPower: 7,
      fastMiners: 2,
      legendaryMiners: 1,
      prestigeLevel: 3,
      clickBoostLevels: 2,
      comboResistLevels: 1,
      lifetimeMinerals: 999_999_999n,
      lifetimeCorrect: 555,
      maxCombo: 40,
      maxDepth: 120n,
      minersOwnedEver: 5,
      totalGemsMinted: 10,
      totalGemsSpent: 6,
      totalPrestiges: 2,
      startTime: NOW - 86400000,
      saveTime: NOW - 3600000,
      completedTiers: ["tier-1", "tier-2"],
      completedAchievements: ["badge"],
      playerSeed: 987654321,
      ownedCosmetics: [...DEFAULT_OWNED, "gold"],
      selectedPickaxe: "gold",
    };
    const code = encodeSaveCode(save);
    expect(code.startsWith(`${SAVE_CODE_PREFIX}.`)).toBe(true);
    const decoded = decodeSaveCode(code, NOW);
    expect(decoded).not.toBeNull();
    expect(decoded).toEqual(save);
  });

  it("tolerates surrounding whitespace in pasted codes", () => {
    const save = createEmptySaveData();
    const code = encodeSaveCode(save);
    const decoded = decodeSaveCode(`  ${code}\n`, NOW);
    expect(decoded).not.toBeNull();
    expect(decoded!.saveVersion).toBe(saveVersion);
  });

  it("accepts raw base64 without the MOD1 prefix", () => {
    const save = createEmptySaveData();
    const raw = encodeSaveCode(save).slice(SAVE_CODE_PREFIX.length + 1);
    const decoded = decodeSaveCode(raw, NOW);
    expect(decoded).not.toBeNull();
    expect(decoded!.saveVersion).toBe(saveVersion);
  });

  it("migrates an old (v1-era) partial save and fills defaults", () => {
    const old = {
      minerals: 555,
      gems: 1,
      clickPower: 2,
      miners: 1,
      minerPower: 1,
      saveVersion: 1,
    };
    const code = `${SAVE_CODE_PREFIX}.${base64Encode(JSON.stringify(old))}`;
    const decoded = decodeSaveCode(code, NOW);
    expect(decoded).not.toBeNull();
    expect(decoded!.saveVersion).toBe(saveVersion);
    expect(decoded!.minerals).toBe(555n);
    expect(decoded!.clickPower).toBe(2);
    // Pre-v2 stats folded in the same way the loader does.
    expect(decoded!.lifetimeMinerals).toBe(555n);
    expect(decoded!.minersOwnedEver).toBe(1);
    // Missing newer fields default.
    expect(decoded!.fastMiners).toBe(0);
    expect(decoded!.prestigeLevel).toBe(0);
    // Missing timestamps fall back to now.
    expect(decoded!.startTime).toBe(NOW);
    expect(decoded!.saveTime).toBe(NOW);
  });

  it("clamps garbage numbers like the storage loader does", () => {
    const bad = {
      minerals: "lots", // not a number -> 0
      miners: -3, // passthrough, exactly like the storage loader
      fastMiners: -3,
      prestigeLevel: 99,
      gemChanceLevels: -1,
      saveVersion,
    };
    const code = `${SAVE_CODE_PREFIX}.${base64Encode(JSON.stringify(bad))}`;
    const decoded = decodeSaveCode(code, NOW);
    expect(decoded).not.toBeNull();
    expect(decoded!.minerals).toBe(0n);
    expect(decoded!.miners).toBe(-3);
    expect(decoded!.fastMiners).toBe(0);
    expect(decoded!.gemChanceLevels).toBe(0);
    expect(decoded!.prestigeLevel).toBe(PRESTIGE_LEVELS.length - 1);
  });

  it("rejects unparseable input", () => {
    expect(decodeSaveCode("", NOW)).toBeNull();
    expect(decodeSaveCode("not a save code", NOW)).toBeNull();
    // Valid base64 of non-JSON:
    expect(decodeSaveCode(`${SAVE_CODE_PREFIX}.${base64Encode("hello")}`, NOW)).toBeNull();
    // Valid JSON but not a plain object:
    expect(
      decodeSaveCode(`${SAVE_CODE_PREFIX}.${base64Encode("[1,2,3]")}`, NOW),
    ).toBeNull();
    expect(
      decodeSaveCode(`${SAVE_CODE_PREFIX}.${base64Encode('"a string"')}`, NOW),
    ).toBeNull();
    expect(
      decodeSaveCode(`${SAVE_CODE_PREFIX}.${base64Encode("null")}`, NOW),
    ).toBeNull();
  });

  it("drops unknown cosmetic ids but keeps the free defaults", () => {
    const save: SaveData = {
      ...createEmptySaveData(),
      ownedCosmetics: ["definitely_not_a_cosmetic"],
      selectedOutfit: "not_an_outfit",
    };
    const decoded = decodeSaveCode(encodeSaveCode(save), NOW);
    expect(decoded).not.toBeNull();
    expect(decoded!.ownedCosmetics).toEqual([...DEFAULT_OWNED]);
    expect(decoded!.selectedOutfit).toBe(DEFAULT_OUTFIT);
  });
});
