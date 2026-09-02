import { memo, useMemo, type ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Button from "src/components/Button";
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
} from "src/utils/graphics/pixelArt";
import { emojis } from "src/utils/graphics/emojis";
import { useContent, useI18n } from "src/hooks/useI18n";
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

/** Name (+ optional one-line blurb) cell shared by every row. */
function NameCell({ name, blurb }: { name: string; blurb?: string }) {
  return (
    <View style={{ flex: 1, flexDirection: "column" }}>
      <Text style={{ ...styles.text, flexShrink: 1 }}>{name}</Text>
      {blurb ? (
        <Text style={{ ...styles.text, fontSize: 9, color: "#888" }}>
          {blurb}
        </Text>
      ) : null}
    </View>
  );
}

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
  const { t } = useI18n();
  // Data-driven names: the data modules (cosmetics.ts) are the English
  // source of truth; `content` overlays the locale's translation on top.
  const content = useContent();
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
    blurb?: string,
  ) => {
    const owned = ownedCosmetics.includes(id);
    const affordable = gems >= costGems;
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${
          owned
            ? isSelected
              ? t("cosmetics.a11ySelected")
              : t("cosmetics.a11yOwned")
            : t("cosmetics.a11yGems", { count: costGems })
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
        <NameCell name={name} blurb={blurb} />
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
          {isSelected ? "✓" : owned ? t("cosmetics.owned") : `${costGems} ${emojis.gem}`}
        </Text>
      </Pressable>
    );
  };

  // Cave theme row: the thumbnail is the theme's 5-swatch depth palette
  // (one tint per tier, shallow to deep) so players see the recolor before
  // buying.
  const renderTheme = (theme: CaveTheme) => {
    const text = content("caveTheme", theme.id, {
      title: theme.name,
      detail: theme.blurb,
    });
    const owned = ownedCaveThemes.includes(theme.id);
    const isSelected = selectedCaveTheme === theme.id;
    const affordable = gems >= theme.costGems;
    return (
      <Pressable
        key={theme.id}
        accessibilityRole="button"
        accessibilityLabel={t("cosmetics.a11yTheme", {
          name: text.title,
          state: owned
            ? isSelected
              ? t("cosmetics.a11ySelected")
              : t("cosmetics.a11yOwned")
            : t("cosmetics.a11yGems", { count: theme.costGems }),
        })}
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
        <NameCell name={text.title} blurb={text.detail} />
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
          {isSelected ? "✓" : owned ? t("cosmetics.owned") : `${theme.costGems} ${emojis.gem}`}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 2, marginTop: 12 }}>
      <Text style={{ ...styles.text, fontWeight: "bold" }}>
        {t("cosmetics.header")}
      </Text>

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
        <Button title={t("cosmetics.reroll")} onPress={onReroll} />
      </View>

      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        {t("cosmetics.outfits")}
      </Text>
      {OUTFITS.map((o) => {
        const text = content("outfit", o.id, {
          title: o.name,
          detail: o.blurb,
        });
        return renderItem(
          o.id,
          text.title,
          o.costGems,
          o.id === selectedOutfit,
          <Image
            source={{ uri: minerSpriteUri(rollMinerLook(SAMPLE_SEED, o.id)) }}
            style={{ width: 18, height: 18 }}
          />,
          text.detail,
        );
      })}

      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa", marginTop: 4 }}>
        {t("cosmetics.pickaxes")}
      </Text>
      {PICKAXES.map((p) => {
        const text = content("pickaxe", p.id, { title: p.name });
        return renderItem(
          p.id,
          text.title,
          p.costGems,
          p.id === selectedPickaxe,
          <Image
            source={{ uri: pickaxeSpriteUri(p.theme) }}
            style={{ width: 18, height: 18 }}
          />,
        );
      })}

      {/* Tier-4 unlock (plan §4.6): cave background recolors. Shown but
          locked (visible-but-locked rule) until Crystal Kingdom. */}
      <Text
        style={{ ...styles.text, fontSize: 11, color: "#aaa", marginTop: 4 }}
      >
        {caveThemesUnlocked
          ? t("cosmetics.themes")
          : t("cosmetics.themesLocked")}
      </Text>
      {caveThemesUnlocked ? (
        CAVE_THEMES.map((theme) => renderTheme(theme))
      ) : (
        <Text style={{ ...styles.text, fontSize: 11, color: "#888" }}>
          {t("cosmetics.themesUnlockedAt")}
        </Text>
      )}
    </View>
  );
}

export default memo(CosmeticsSection);
