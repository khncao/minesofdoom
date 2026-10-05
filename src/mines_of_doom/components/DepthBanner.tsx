import { memo } from "react";
import { Image, Pressable, View } from "react-native";
import { T as Text } from "../textScale";
import { emojis } from "src/utils/graphics/emojis";
import { formatNumber } from "src/utils/format";
import {
  gemSpriteUri,
  mineralChunkSpriteUri,
} from "src/utils/graphics/artPack";
import { useT } from "src/hooks/useI18n";
import { styles } from "../styles";

/**
 * The cave's currency glyph: the emoji on the low-end emoji-art setting,
 * otherwise the art pack's pixel sprite (the same seam every other sprite
 * in the game goes through — see AGENTS.md "the art-pack seam").
 *
 * Sized down from the 20px the crew column used: this is 12px text, and a
 * 20px sprite next to a 12px figure reads as a different weight.
 */
function CurrencyIcon({
  kind,
  emojiArt,
}: {
  kind: "mineral" | "gem";
  emojiArt: boolean;
}) {
  if (emojiArt) {
    return (
      <Text style={styles.depthIconGlyph}>
        {kind === "mineral" ? emojis.mineral : emojis.gem}
      </Text>
    );
  }
  return (
    <Image
      source={{ uri: kind === "mineral" ? mineralChunkSpriteUri() : gemSpriteUri() }}
      style={styles.depthIcon}
    />
  );
}

/**
 * The depth bar: depth + tier on the LEFT, the ⛏ UPGRADES button hard
 * right (todo: "Move upgrades to same bar as depth (far right)").
 *
 * The upgrades button was a floating pill in the cave's bottom-right
 * corner, which put a purchase surface on top of the play area and put it
 * under the numpad in landscape (the keypad is ~320 wide and covered it
 * completely). Every other entry point in the game already lives in the top
 * strip; putting this one there too makes the strip the one place the
 * controls are, and frees the corner.
 *
 * It carries ONLY depth and the tier now: the wallet used to share this bar
 * and had to wrap the tier name to three lines on a 360px phone to fit
 * beside two more figures. See `DepthWallet` below for where they went.
 *
 * The tier name is the only unbounded-length text here (the Spanish names
 * run ~25 characters), so it is the side allowed to wrap.
 */
const DepthBanner = memo(function DepthBanner({
  depth,
  tierName,
  clickBonus,
  upgradesOpen,
  onToggleUpgrades,
  anyPurchaseAffordable,
}: {
  depth: bigint;
  /** Current depth-tier/biome name (DEPTH_TIERS in game.ts). */
  tierName: string;
  /** Depth-tier click multiplier (1 = no bonus yet). */
  clickBonus: number;
  upgradesOpen: boolean;
  onToggleUpgrades: () => void;
  /** Lights the button's corner dot (something in the drawer is affordable). */
  anyPurchaseAffordable: boolean;
}) {
  const t = useT();
  return (
    <View style={styles.depthBanner} testID="depth-banner">
      <Text style={styles.depthText}>
        ⛏ {formatNumber(depth)}m · {tierName}
        {clickBonus > 1 ? ` (×${clickBonus} ⛏)` : ""}
      </Text>
      <Pressable
        testID="upgrades-toggle"
        accessibilityRole="button"
        accessibilityLabel={
          upgradesOpen ? t("main.a11yHideUpgrades") : t("main.a11yShowUpgrades")
        }
        accessibilityHint={
          anyPurchaseAffordable ? t("main.a11yAffordablePurchase") : undefined
        }
        onPress={onToggleUpgrades}
        style={({ pressed }) => [
          styles.depthUpgradesToggle,
          pressed && styles.depthUpgradesTogglePressed,
        ]}
      >
        <Text style={styles.upgradesToggleText}>
          ⛏ {t("main.upgrades")}
        </Text>
        {anyPurchaseAffordable && (
          <View
            testID="upgrades-affordable-dot"
            accessibilityElementsHidden
            style={styles.upgradesAffordableDot}
          />
        )}
      </Pressable>
    </View>
  );
});

/**
 * The wallet — minerals, income rate and gems, on their own RIGHT-ALIGNED
 * line directly UNDER the depth bar (todo: "move resource counts mineral
 * and gems to top right, right aligned under upgrades but outside of the
 * bar").
 *
 * Deliberately outside the bar's translucent box: the bar is a single line
 * whose width is already spoken for by depth + tier on the left and the
 * upgrades button on the right, and two more figures in it forced the tier
 * name to wrap to three lines on a 360px phone. As their own line they sit
 * in the same top-right corner as the button they relate to, and the bar
 * stays one clean line.
 *
 * They started INSIDE the cave canvas, stacked above the crew column — two
 * rows drawn over the sprites, which is the one place the player is not
 * looking for numbers.
 *
 * `mineral-count` keeps its old testID AND its old contract: the text of
 * that node is the bare formatted number and nothing else (the icon is a
 * sibling, the `/s` rate a third sibling), because both the Maestro flows
 * and `e2e/web/helpers.ts` parse that node's text as a number.
 */
const DepthWallet = memo(function DepthWallet({
  minerals,
  gems,
  mineralsPerSec,
  emojiArt,
}: {
  minerals: bigint;
  gems: number;
  mineralsPerSec: bigint;
  /** Low-end fallback: emoji icons instead of pixel sprites. */
  emojiArt: boolean;
}) {
  return (
    <View style={styles.depthWallet}>
      <View style={styles.depthWalletRow}>
        <CurrencyIcon kind="mineral" emojiArt={emojiArt} />
        <Text testID="mineral-count" style={styles.walletText}>
          {formatNumber(minerals)}
        </Text>
        {mineralsPerSec > 0n && (
          <Text style={styles.depthRateText}>
            {formatNumber(mineralsPerSec)}/s
          </Text>
        )}
      </View>
      <View style={styles.depthWalletRow}>
        <CurrencyIcon kind="gem" emojiArt={emojiArt} />
        <Text testID="gem-count" style={styles.walletText}>
          {formatNumber(gems)}
        </Text>
      </View>
    </View>
  );
});

export { DepthWallet };
export default DepthBanner;
