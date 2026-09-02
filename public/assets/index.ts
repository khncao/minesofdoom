import type { AVPlaybackSource } from "expo-av";

export const stoneSound = require("./audio/stones_01.mp3");
export const pickaxeSound = require("./audio/pickaxe1.mp3");
// Per-pickaxe unique swing sounds (plan §5.2 "unique sounds"), keyed by
// pickaxe id — see soundFile in apps/mines_of_doom/cosmetics.ts. Synthesized
// by scripts/generate-pickaxe-sounds.mjs.
export const pickaxeSoundFiles: Record<string, AVPlaybackSource> = {
  steel: require("./audio/pickaxe-steel.wav"),
  gold: require("./audio/pickaxe-gold.wav"),
  frost: require("./audio/pickaxe-frost.wav"),
  shadow: require("./audio/pickaxe-shadow.wav"),
};
export const pickaxeImg = require("./pickaxe.png");
