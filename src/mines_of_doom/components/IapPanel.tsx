import { memo, useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import BottomModal from "src/components/BottomModal";
import Button from "src/components/Button";
import { useContent, useI18n } from "src/hooks/useI18n";
import {
  IapEntitlements,
  IapPackLine,
  IapProduct,
  IapProductId,
  IAP_PRODUCT_LIST,
  getIapPackCosmetic,
  getIapProductPreview,
  isIapProductEquipped,
  isIapProductOwned,
} from "../iaps";
import { getPickaxe, rollMinerLook } from "../cosmetics";
import {
  minerSpriteUri,
  pickaxeSpriteUri,
} from "src/utils/graphics/pixelArt";
import { emojis } from "src/utils/graphics/emojis";
import { styles } from "../styles";

/**
 * The unified shop (todo: "move gem shop cosmetics to one time purchase
 * shop with gem and cash buy options"): the SINGLE place cosmetics are
 * bought. Every catalog row (one pack per paid cosmetic, catalog order
 * per line) offers BOTH buy options:
 *  - **gems** — the in-game price (the old gem shop, moved here from the
 *    menu sheet's Shop view; the engine gem buy auto-equips);
 *  - **one-time cash** — the store pack (price label; the store's own
 *    checkout shows its localized price). Rendered only while the IAP
 *    provider is available; until the real store is live the row simply
 *    offers the gem buy, so the shop stays the free path (guardrail 1).
 * The menu sheet no longer has a Shop view: equipping and rerolling live
 * here too (the look preview row), and owned rows equip on tap.
 *
 * The panel renders ALWAYS (gem path is universal); the cash extras
 * (cash buttons, dev-store banner) are gated on `cashAvailable` =
 * provider.isAvailable(). There is no manual restore button: the useIap
 * launch-reconcile silently re-derives every completed purchase from the
 * store's own record on each launch. Copy states plainly that
 * everything is optional and the game stays fully free (guardrails 1 & 4):
 * no urgency language, no default-checked options, no misleading icons.
 */
/**
 * Shop-row thumbnail (todo: "Show cosmetic previews in shop listings"): the
 * actual sprite / palette the pack grants (getIapProductPreview), so a
 * player can see the item before buying.
 */
function ProductThumb({ productId }: { productId: IapProductId }) {
  const preview = getIapProductPreview(productId);
  if (preview.kind === "sprite") {
    return (
      <View style={{ width: 26, alignItems: "center" }}>
        <Image
          source={{ uri: preview.uri }}
          style={{ width: 22, height: 22 }}
          accessibilityRole="image"
        />
      </View>
    );
  }
  if (preview.kind === "swatches") {
    return (
      <View style={{ width: 26, alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 2 }}>
          {preview.tints.map((tint, i) => (
            <View
              key={i}
              style={{
                width: 5,
                height: 22,
                borderRadius: 2,
                backgroundColor: tint,
              }}
            />
          ))}
        </View>
      </View>
    );
  }
  return null;
}

function IapPanel({
  isDevSim,
  isDevBuild,
  realStoreIap,
  onRealStoreChange,
  cashAvailable,
  gems,
  playerSeed,
  selectedOutfit,
  selectedPickaxe,
  selectedCaveTheme,
  purchasing,
  entitlements,
  saveOwnedCosmeticIds,
  themesLocked,
  onBuyGems,
  onPurchase,
  onSelect,
  onReroll,
}: {
  /** Provider is the dev simulation (dev builds only). */
  isDevSim: boolean;
  /** `__DEV__` — dev builds get the banner block + the real-store toggle. */
  isDevBuild: boolean;
  /** The persisted real-store opt-in value (IapPanel only, dev builds). */
  realStoreIap: boolean;
  /** Present on native dev builds (web has no store billing): flips the
   *  real-store opt-in. Absent → the toggle row is not rendered. */
  onRealStoreChange?: (value: boolean) => void;
  /** `provider.isAvailable()` — the cash buy option and the dev-store
   *  banner render only while a store can complete a purchase (the gem
   *  buy is always available). */
  cashAvailable: boolean;
  /** The gem wallet — sizes the gem buttons' disabled state. */
  gems: number;
  /** The player look for the preview row (sprites come from the same
   *  pipeline as the in-game sprites). */
  playerSeed: number;
  selectedOutfit: string;
  selectedPickaxe: string;
  selectedCaveTheme: string;
  purchasing: IapProductId | null;
  /** This device's store entitlements (the cash-buy record). */
  entitlements: IapEntitlements;
  /** Cosmetic/theme ids the current save already owns (any source). */
  saveOwnedCosmeticIds: string[];
  /** Tier-4 goal unlock (goals.ts): the GEM buy of cave themes stays
   *  locked until Crystal Kingdom (visible-but-locked rule, as the old
   *  gem shop enforced); the cash packs are store products and stay
   *  offerable as before. */
  themesLocked: boolean;
  /** The engine gem buy (auto-equips; idempotent, no-op when unaffordable). */
  onBuyGems: (id: IapProductId) => void;
  /** The store purchase (provider flow). */
  onPurchase: (id: IapProductId) => void;
  /** Equip an owned cosmetic/theme (the save's select action). */
  onSelect: (id: IapProductId) => void;
  /** The seeded "reroll look" randomizer. */
  onReroll: () => void;
}) {
  const { t } = useI18n();
  const content = useContent();

  const playerUri = useMemo(
    () => minerSpriteUri(rollMinerLook(playerSeed, selectedOutfit)),
    [playerSeed, selectedOutfit],
  );
  const playerPickaxeUri = useMemo(
    () => pickaxeSpriteUri(getPickaxe(selectedPickaxe).theme),
    [selectedPickaxe],
  );

  const renderProduct = (product: IapProduct) => {
    const text = content("iap", product.id, {
      title: product.label,
      detail: product.blurb,
    });
    const pack = getIapPackCosmetic(product.id);
    const owned = isIapProductOwned(
      product.id,
      entitlements,
      saveOwnedCosmeticIds,
    );
    const equipped = isIapProductEquipped(
      product.id,
      selectedOutfit,
      selectedPickaxe,
      selectedCaveTheme,
    );
    const gemsAffordable = gems >= pack.costGems;
    const gemLocked = product.line === "caveTheme" && themesLocked;
    return (
      <View
        key={product.id}
        style={{ ...styles.flexCenteredRow, gap: 6, alignItems: "flex-start" }}
      >
        <ProductThumb productId={product.id} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.text}>
            {text.title}
            {owned ? " ✓" : ""}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
            {text.detail ?? product.blurb}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
            {t("iap.alsoEarnable", { count: pack.costGems })}
          </Text>
        </View>
        {owned ? (
          <Button
            tone="gem"
            disabled={equipped}
            title={equipped ? t("iap.equipped") : t("iap.equip")}
            onPress={() => onSelect(product.id)}
          />
        ) : (
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Button
              tone="gem"
              disabled={!gemsAffordable || gemLocked || purchasing != null}
              title={`${pack.costGems} ${emojis.gem}`}
              onPress={() => onBuyGems(product.id)}
            />
            {cashAvailable && (
              <Button
                disabled={purchasing != null}
                title={purchasing === product.id ? "…" : product.priceLabel}
                onPress={() => onPurchase(product.id)}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  const GROUP_ORDER: IapPackLine[] = ["pickaxe", "outfit", "caveTheme"];

  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>🛍️</Text>}
      accessibilityLabel={t("iap.a11y")}
      scrollable
    >
      <View style={{ gap: 8, padding: 4 }}>
        <Text style={styles.text}>{t("iap.title")}</Text>
        {cashAvailable && isDevSim && (
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            {t("iap.devSim")}
          </Text>
        )}
        {cashAvailable && isDevBuild && !isDevSim && (
          // Dev build running the REAL provider (real-store opt-in on):
          // say so plainly (transparency guardrail) — this device hits
          // the real store.
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            {t("iap.devRealStoreActive")}
          </Text>
        )}
        {cashAvailable && isDevBuild && onRealStoreChange != null && (
          <Pressable
            accessibilityRole="button"
            onPress={() => onRealStoreChange(!realStoreIap)}
            style={{ padding: 4 }}
          >
            <Text style={{ ...styles.text, fontSize: 11 }}>
              {realStoreIap ? "☑ " : "☐ "}
              {t("iap.realStoreToggle")}
            </Text>
          </Pressable>
        )}

        {/* Look preview + reroll (moved from the menu sheet's Shop view):
            the actual sprites, generated at runtime. */}
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

        {GROUP_ORDER.map((line) => (
          <View key={line} style={{ gap: 4 }}>
            <Text style={{ ...styles.text, opacity: 0.7, fontSize: 12 }}>
              {line === "pickaxe"
                ? t("iap.groupPickaxes")
                : line === "outfit"
                  ? t("iap.groupOutfits")
                  : themesLocked
                    ? t("cosmetics.themesLocked")
                    : t("iap.groupThemes")}
            </Text>
            {line === "caveTheme" && themesLocked && (
              <Text style={{ ...styles.text, fontSize: 11, color: "#999" }}>
                {t("cosmetics.themesUnlockedAt")}
              </Text>
            )}
            {IAP_PRODUCT_LIST.filter((p) => p.line === line).map(
              renderProduct,
            )}
          </View>
        ))}

        {/* Store purchases sync automatically on launch (the useIap
            launch-reconcile): no manual restore button — the store's
            record re-derives every completed purchase on this device. */}
      </View>
    </BottomModal>
  );
}

export default memo(IapPanel);
