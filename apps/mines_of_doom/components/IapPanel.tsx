import { memo } from "react";
import { Text, View } from "react-native";
import BottomModal from "apps/components/BottomModal";
import Button from "apps/components/Button";
import { IapProductId, IAP_PRODUCTS } from "../iaps";
import { styles } from "../styles";

/**
 * In-app purchases panel (plan §5.2): the single purchase entry point.
 * Lives in the footer next to the daily bonus / rewarded ads, behind a 🛍️
 * button, and is only rendered when an IAP provider reports itself
 * available — production builds (no store SDK bundled) never show it,
 * and dev builds show the simulation with a clear "development build"
 * banner (transparency guardrail).
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
  purchasing,
  restoring,
  onPurchase,
  onRestore,
}: {
  /** Provider is the dev simulation (dev builds only). */
  isDevSim: boolean;
  purchasing: IapProductId | null;
  restoring: boolean;
  onPurchase: (id: IapProductId) => void;
  onRestore: () => void;
}) {
  const removeAds = IAP_PRODUCTS.removeAds;
  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>🛍️</Text>}
      accessibilityLabel="Purchases"
      scrollable
    >
      <View style={{ gap: 8, padding: 4 }}>
        <Text style={styles.text}>
          🛍️ One-time purchases — all optional. The game is fully free and
          completable without any of them.
        </Text>
        {isDevSim && (
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            ⚠️ Development build: purchases are simulated and no money is
            involved.
          </Text>
        )}

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>
              🚫 {removeAds.label} — {removeAds.priceLabel}
            </Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {removeAds.blurb}
            </Text>
          </View>
          <Button
            tone="gem"
            disabled={purchasing != null}
            title={purchasing === removeAds.id ? "…" : "Buy"}
            onPress={() => onPurchase(removeAds.id)}
          />
        </View>

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>📦 Restore purchases</Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              Re-apply the past store purchases on this device.
            </Text>
          </View>
          <Button
            tone="gem"
            disabled={restoring}
            title={restoring ? "…" : "Restore"}
            onPress={onRestore}
          />
        </View>
      </View>
    </BottomModal>
  );
}

export default memo(IapPanel);
