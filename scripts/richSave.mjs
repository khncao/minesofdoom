/**
 * The RICH save fixture used by the screenshot scripts: a mid-game player
 * (crew + gems + owned cosmetics) so every panel has something to render.
 *
 * Extracted from scripts/screenshot.mjs so the landscape harness seeds the
 * exact same state and the two screenshots are comparable.
 */
export const richSave = {
  minerals: "150000",
  gems: 300,
  clickPower: 20,
  miners: 5,
  minerPower: 4,
  fastMiners: 2,
  legendaryMiners: 1,
  gemChanceLevels: 2,
  prestigeLevel: 0,
  clickBoostLevels: 0,
  comboResistLevels: 0,
  startTime: Date.now(),
  saveTime: Date.now(),
  saveVersion: 13,
  lifetimeMinerals: "150000",
  lifetimeCorrect: 40,
  maxCombo: 12,
  maxDepth: "300",
  minersOwnedEver: 8,
  totalGemsMinted: 25,
  gemsBoughtWithMinerals: 0,
  totalGemsSpent: 0,
  totalPrestiges: 0,
  playSeconds: 900,
  lastActiveDay: "",
  completedTiers: [
    "miner-power",
    "fast-miner",
    "cave-theme",
    "legendary-miner",
  ],
  completedAchievements: [],
  playerSeed: 123456789,
  ownedCosmetics: [
    "classic",
    "steel",
    "night",
    "goldrush",
    "crystal",
    "magma",
    "marmot",
    "gold",
    "frost",
  ],
  selectedOutfit: "classic",
  selectedPickaxe: "gold",
  ownedCaveThemes: ["natural"],
  selectedCaveTheme: "natural",
  minerOutfits: {
    0: "night",
    1: "goldrush",
    2: "crystal",
    3: "magma",
    4: "marmot",
  },
};
export const RICH_SAVE = richSave;
