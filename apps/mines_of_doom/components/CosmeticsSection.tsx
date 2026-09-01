import { memo, useMemo, type ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Button from "apps/components/Button";
import { getPickaxe, OUTFITS, PICKAXES, rollMinerLook } from "../cosmetics";
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
 * sprite, generated at runtime.
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
}: {
  gems: number;
  playerSeed: number;
  ownedCosmetics: string[];
  selectedOutfit: string;
  selectedPickaxe: string;
  onBuy: (id: string) => void;
  onSelect: (id: string) => void;
  onReroll: () => void;
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
    </View>
  );
}

export default memo(CosmeticsSection);
