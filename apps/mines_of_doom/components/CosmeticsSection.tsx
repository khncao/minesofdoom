import { memo, useMemo, type ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Button from "apps/components/Button";
import {
  CAVE_THEMES,
  CaveTheme,
  getPickaxe,
  OUTFITS,
  PICKAXES,
  rollMinerLook,
} from "../cosmetics";
import {
  minerSpriteUri,
  pickaxeSpriteUri,
} from "apps/utils/graphics/pixelArt";
import { emojis } from "apps/utils/graphics/emojis";
import { styles } from "../styles";

/**
 * Cosmetic picker (plan §5.2 cosmetic line, programmatic variant): player
 * outfit palettes + pickaxe themes, buyable in gems, plus the seeded
 * "reroll look" randomizer. Everything shown here is the actual in-game
 * sprite, generated at runtime. Below the pickaxes: the tier-4 cave theme
 * line (background recolor palettes, locked until Crystal Kingdom).
 */

/** Fixed seed for per-outfit thumbnails (a representative look, not random). */
const SAMPLE_SEED = 42;

function CosmeticsSection({
  gems,
  playerSeed,
  ownedCosmetics,
  selectedOutfit,
  selectedPickaxe,
  onBuy,
  onSelect,
  onReroll,
  caveThemesUnlocked,
  ownedCaveThemes,
  selectedCaveTheme,
  onBuyCaveTheme,
  onSelectCaveTheme,
}: {
  gems: number;
  playerSeed: number;
  ownedCosmetics: string[];
  selectedOutfit: string;
  selectedPickaxe: string;
  onBuy: (id: string) => void;
  onSelect: (id: string) => void;
  onReroll: () => void;
  /** Tier-4 goal unlock (goals.ts): cave themes stay locked until then. */
  caveThemesUnlocked: boolean;
  ownedCaveThemes: string[];
  selectedCaveTheme: string;
  onBuyCaveTheme: (id: string) => void;
  onSelectCaveTheme: (id: string) => void;
}) {
  const playerUri = useMemo(
    () => minerSpriteUri(rollMinerLook(playerSeed, selectedOutfit)),
    [playerSeed, selectedOutfit],
  );
  const playerPickaxeUri = useMemo(
    () => pickaxeSpriteUri(getPickaxe(selectedPickaxe).theme),
    [selectedPickaxe],
  );

  const renderItem = (
    id: string,
    name: string,
    costGems: number,
    isSelected: boolean,
    thumb: ReactNode,
  ) => {
    const owned = ownedCosmetics.includes(id);
    const affordable = gems >= costGems;
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${
          owned ? (isSelected ? "selected" : "owned") : `${costGems} gems`
        }`}
        disabled={!owned && !affordable}
        onPress={() => (owned ? onSelect(id) : onBuy(id))}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 2,
          paddingHorizontal: 4,
          borderRadius: 5,
          opacity: pressed ? 0.7 : 1,
          ...(isSelected ? { backgroundColor: "#3a3a2a" } : null),
        })}
      >
        {thumb}
        <Text style={{ ...styles.text, flex: 1 }}>{name}</Text>
        <Text
          style={{
            ...styles.text,
            color: isSelected
              ? "#8f8"
              : owned
                ? "#ccc"
                : affordable
                  ? "#7fd4ff"
                  : "#666",
          }}
        >
          {isSelected ? "✓" : owned ? "Owned" : `${costGems} ${emojis.gem}`}
        </Text>
      </Pressable>
    );
  };

  // Cave theme row: the thumbnail is the theme's 5-swatch depth palette
  // (one tint per tier, shallow to deep) so players see the recolor before
  // buying.
  const renderTheme = (theme: CaveTheme) => {
    const owned = ownedCaveThemes.includes(theme.id);
    const isSelected = selectedCaveTheme === theme.id;
    const affordable = gems >= theme.costGems;
    return (
      <Pressable
        key={theme.id}
        accessibilityRole="button"
        accessibilityLabel={`Cave theme ${theme.name}, ${
          owned
            ? isSelected
              ? "selected"
              : "owned"
            : `${theme.costGems} gems`
        }`}
        disabled={!owned && !affordable}
        onPress={() =>
          owned ? onSelectCaveTheme(theme.id) : onBuyCaveTheme(theme.id)
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 2,
          paddingHorizontal: 4,
          borderRadius: 5,
          opacity: pressed ? 0.7 : 1,
          ...(isSelected ? { backgroundColor: "#3a3a2a" } : null),
        })}
      >
        <View style={{ flexDirection: "row", gap: 2 }}>
          {theme.tints.map((tint, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: tint,
              }}
            />
          ))}
        </View>
        <Text style={{ ...styles.text, flex: 1 }}>{theme.name}</Text>
        <Text
          style={{
            ...styles.text,
            color: isSelected
              ? "#8f8"
              : owned
                ? "#ccc"
                : affordable
                  ? "#7fd4ff"
                  : "#666",
          }}
        >
          {isSelected ? "✓" : owned ? "Owned" : `${theme.costGems} ${emojis.gem}`}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 2, marginTop: 12 }}>
      <Text style={{ ...styles.text, fontWeight: "bold" }}>Cosmetics</Text>

      {/* Current look preview */}
      <View style={{ ...styles.flexCenteredRow, gap: 8, alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Image
            source={{ uri: playerUri }}
            style={{ width: 32, height: 32 }}
            accessibilityRole="image"
          />
          <Image
            source={{ uri: playerPickaxeUri }}
            style={{ width: 24, height: 24, marginLeft: 4, marginBottom: -2 }}
          />
        </View>
        <Button title="🎲 Reroll look" onPress={onReroll} />
      </View>

      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        Outfits (randomized colors per reroll)
      </Text>
      {OUTFITS.map((o) =>
        renderItem(
          o.id,
          o.name,
          o.costGems,
          o.id === selectedOutfit,
          <Image
            source={{ uri: minerSpriteUri(rollMinerLook(SAMPLE_SEED, o.id)) }}
            style={{ width: 18, height: 18 }}
          />,
        ),
      )}

      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa", marginTop: 4 }}>
        Pickaxes
      </Text>
      {PICKAXES.map((p) =>
        renderItem(
          p.id,
          p.name,
          p.costGems,
          p.id === selectedPickaxe,
          <Image
            source={{ uri: pickaxeSpriteUri(p.theme) }}
            style={{ width: 18, height: 18 }}
          />,
        ),
      )}

      {/* Tier-4 unlock (plan §4.6): cave background recolors. Shown but
          locked (visible-but-locked rule) until Crystal Kingdom. */}
      <Text
        style={{ ...styles.text, fontSize: 11, color: "#aaa", marginTop: 4 }}
      >
        {caveThemesUnlocked ? "Cave themes" : "🔒 Cave themes (Crystal Kingdom)"}
      </Text>
      {caveThemesUnlocked ? (
        CAVE_THEMES.map((theme) => renderTheme(theme))
      ) : (
        <Text style={{ ...styles.text, fontSize: 11, color: "#888" }}>
          Unlocks at Crystal Kingdom
        </Text>
      )}
    </View>
  );
}

export default memo(CosmeticsSection);
