// expo-audio (which replaced expo-av in SDK 53+) accepts a raw asset
// reference as its source: number on native, string URL on web.
type SoundAsset = number | string;

export const stoneSound: SoundAsset = require("./audio/stones_01.mp3");
export const pickaxeSound: SoundAsset = require("./audio/pickaxe1.mp3");
// Per-pickaxe unique swing sounds (plan §5.2 "unique sounds"), keyed by
// pickaxe id — see soundFile in apps/mines_of_doom/cosmetics.ts. Synthesized
// by scripts/generate-pickaxe-sounds.mjs.
export const pickaxeSoundFiles: Record<string, SoundAsset> = {
  steel: require("./audio/pickaxe-steel.wav"),
  gold: require("./audio/pickaxe-gold.wav"),
  frost: require("./audio/pickaxe-frost.wav"),
  shadow: require("./audio/pickaxe-shadow.wav"),
};
export const pickaxeImg = require("./pickaxe.png");
