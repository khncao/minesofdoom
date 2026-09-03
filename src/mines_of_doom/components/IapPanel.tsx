import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import BottomModal from "src/components/BottomModal";
import Button from "src/components/Button";
import { useContent, useI18n } from "src/hooks/useI18n";
import {
  IapPackLine,
  IapProduct,
  IapProductId,
  IAP_PACK_GRANTS,
  IAP_PRODUCT_LIST,
  IAP_PRODUCTS,
  getIapPackCosmetic,
} from "../iaps";
import { styles } from "../styles";

/**
 * In-app purchases panel (plan §5.2): the single purchase entry point.
 * Lives in the footer next to the daily bonus / rewarded ads, behind a 🛍️
 * button, and is only rendered when an IAP provider reports itself
 * available — production builds (no store SDK bundled) never show it,
 * and dev builds show the simulation with a clear "development build"
 * banner (transparency guardrail).
 *
 * Rows come straight from the catalog (IAP_PRODUCT_LIST): Remove Ads on
 * top, then the cosmetic packs grouped by line (pickaxes / outfits / cave
 * themes) — one pack per paid cosmetic. Packs additionally show their
 * "also earnable in-game for N 💎" line (guardrails 1 & 4: buying is
 * convenience, not access) and read as Owned either from a
 * purchase/restore OR from having bought the same cosmetic with gems
 * already (the save is the source of truth for what the player can see
 * in Cosmetics).
 *
 * Once Remove Ads is owned, MinesOfDoom hides BOTH this panel and the
 * rewarded-ads panel (plan §5.1: it "permanently disables even the
 * opt-in buttons").
 *
 * Copy states plainly what the purchase does and that the game stays
 * fully free and completable without it (guardrails 1 & 4): no urgency
 * language, no default-checked options, no misleading icons.
 */
function IapPanel({
  isDevSim,
  isDevBuild,
  realStoreIap,
  onRealStoreChange,
  purchasing,
  restoring,
  ownedPackIds,
  saveOwnedCosmeticIds,
  onPurchase,
  onRestore,
}: {
  /** Provider is the dev simulation (dev builds only). */
  isDevSim: boolean;
  /** `__DEV__` — dev builds get the banner block + the real-store toggle. */
  isDevBuild: boolean;
  /** The persisted real-store opt-in value (IapPanel only, dev builds). */
  realStoreIap: boolean;
  /** Present on native dev builds (web has no store billing): flips the
 *   real-store opt-in. Absent → the toggle row is not rendered. */
  onRealStoreChange?: (value: boolean) => void;
  purchasing: IapProductId | null;
  restoring: boolean;
  /** Pack products this device already owns (entitlements). */
  ownedPackIds: string[];
  /** Cosmetic/theme ids the current save already owns (any source). */
  saveOwnedCosmeticIds: string[];
  onPurchase: (id: IapProductId) => void;
  onRestore: () => void;
}) {
  const { t } = useI18n();
  const content = useContent();

  const renderProduct = (product: IapProduct) => {
    const text = content("iap", product.id, {
      title: product.label,
      detail: product.blurb,
    });
    const pack = getIapPackCosmetic(product.id);
    const grant = IAP_PACK_GRANTS[product.id];
    const owned =
      product.id === "removeAds"
        ? false // owning Remove Ads hides the whole panel
        : ownedPackIds.includes(product.id) ||
          (grant != null && saveOwnedCosmeticIds.includes(grant.id));
    return (
      <View key={product.id} style={styles.flexCenteredRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.text}>
            {product.id === "removeAds" ? "🚫" : "🎁"} {text.title} —{" "}
            {product.priceLabel}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
            {text.detail ?? product.blurb}
          </Text>
          {pack != null && (
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {t("iap.alsoEarnable", { count: pack.costGems })}
            </Text>
          )}
        </View>
        <Button
          tone="gem"
          disabled={owned || purchasing != null}
          title={
            owned
              ? t("iap.owned")
              : purchasing === product.id
                ? "…"
                : t("iap.buy")
          }
          onPress={() => onPurchase(product.id)}
        />
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
        {isDevSim && (
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            {t("iap.devSim")}
          </Text>
        )}
        {isDevBuild && !isDevSim && (
          // Dev build running the REAL provider (real-store opt-in on):
          // say so plainly (transparency guardrail) — this device hits
          // the real store.
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            {t("iap.devRealStoreActive")}
          </Text>
        )}
        {isDevBuild && onRealStoreChange != null && (
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

        {renderProduct(IAP_PRODUCTS.removeAds)}

        {GROUP_ORDER.map((line) => (
          <View key={line} style={{ gap: 4 }}>
            <Text style={{ ...styles.text, opacity: 0.7, fontSize: 12 }}>
              {line === "pickaxe"
                ? t("iap.groupPickaxes")
                : line === "outfit"
                  ? t("iap.groupOutfits")
                  : t("iap.groupThemes")}
            </Text>
            {IAP_PRODUCT_LIST.filter((p) => p.line === line).map(
              renderProduct,
            )}
          </View>
        ))}

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>{t("iap.restore")}</Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {t("iap.restoreDetail")}
            </Text>
          </View>
          <Button
            tone="gem"
            disabled={restoring}
            title={restoring ? "…" : t("iap.restoreButton")}
            onPress={onRestore}
          />
        </View>
      </View>
    </BottomModal>
  );
}

export default memo(IapPanel);
