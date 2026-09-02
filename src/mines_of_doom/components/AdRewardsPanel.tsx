import { memo, useEffect, useState } from "react";
import { Text, View } from "react-native";
import BottomModal from "src/components/BottomModal";
import Button from "src/components/Button";
import { useI18n } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import {
  AdKind,
  AD_GEM_ROLLS_PER_DAY,
  AD_GEM_ROLLS_PER_USE,
  AD_MAX_REWARDS_PER_DAY,
} from "../ads";
import { offlineTopUpTicks } from "../game";
import { styles } from "../styles";

/** m:ss for the combo-save window countdown ("1:00", "0:42", …). */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Rewarded-ads panel (plan §5.1): the single opt-in entry point for ad
 * rewards. Lives in the footer next to the daily bonus, behind a 🎬
 * button, and is only rendered when an ad provider reports itself
 * available — production builds (no SDK bundled) never show it, and dev
 * builds show the simulation with a clear "development build" banner
 * (transparency guardrail).
 *
 * Copy states plainly what each button does (guardrail 4): a "Watch" tap
 * plays an ad, finishing it grants the reward, closing early grants
 * nothing. No urgency language, no countdowns, no dark patterns.
 */
function AdRewardsPanel({
  isDevSim,
  gemRollsLeft,
  comboSave,
  comboSaveUntil,
  dailyCapLeft,
  offlineDouble,
  offlineTopUp,
  claiming,
  onClaim,
}: {
  /** Provider is the dev simulation (dev builds only). */
  isDevSim: boolean;
  gemRollsLeft: number;
  /** Combo a completed ad would restore (null = no recent loss to save). */
  comboSave: number | null;
  /** When the pending save stops being restorable (ms epoch). */
  comboSaveUntil: number | null;
  dailyCapLeft: number;
  offlineDouble: bigint | null;
  /** Minerals withheld beyond the 8h cap that a completed ad would grant. */
  offlineTopUp: bigint | null;
  claiming: AdKind | null;
  onClaim: (kind: AdKind) => void;
}) {
  const { t } = useI18n();
  // 1s tick while a save is pending so the window countdown stays honest.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (comboSaveUntil == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [comboSaveUntil]);
  const saveWindowLeft =
    comboSave != null && comboSaveUntil != null
      ? Math.max(0, (comboSaveUntil - now) / 1000)
      : 0;
  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>🎬</Text>}
      accessibilityLabel={t("ads.a11y")}
      scrollable
    >
      <View style={{ gap: 8, padding: 4 }}>
        <Text style={styles.text}>{t("ads.title")}</Text>
        {isDevSim && (
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            {t("ads.devSim")}
          </Text>
        )}

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>
              {t("ads.gemRolls", { count: AD_GEM_ROLLS_PER_USE })}
            </Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {gemRollsLeft > 0
                ? t("ads.leftToday", {
                    left: gemRollsLeft,
                    total: AD_GEM_ROLLS_PER_DAY,
                  })
                : t("ads.backTomorrow")}
            </Text>
          </View>
          <Button
            tone="gem"
            disabled={claiming != null || gemRollsLeft <= 0 || dailyCapLeft <= 0}
            title={claiming === "gemRolls" ? t("ads.watching") : t("ads.watch")}
            onPress={() => onClaim("gemRolls")}
          />
        </View>

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>{t("ads.comboSave")}</Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {comboSave != null
                ? t("ads.comboSaveDetail", {
                    combo: formatNumber(comboSave),
                    time: formatCountdown(saveWindowLeft),
                  })
                : t("ads.comboSaveNone")}
            </Text>
          </View>
          <Button
            tone="gem"
            disabled={
              claiming != null ||
              comboSave == null ||
              comboSaveUntil == null ||
              saveWindowLeft <= 0 ||
              dailyCapLeft <= 0
            }
            title={
              claiming === "comboSave" ? t("ads.watching") : t("ads.watch")
            }
            onPress={() => onClaim("comboSave")}
          />
        </View>

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>{t("ads.double")}</Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {offlineDouble != null && offlineDouble > 0n
                ? t("ads.doubleDetail", {
                    count: formatNumber(offlineDouble),
                  })
                : t("ads.doubleNone")}
            </Text>
          </View>
          <Button
            disabled={
              claiming != null ||
              (offlineDouble ?? 0n) <= 0n ||
              dailyCapLeft <= 0
            }
            title={claiming === "offlineDouble" ? t("ads.watching") : t("ads.watch")}
            onPress={() => onClaim("offlineDouble")}
          />
        </View>

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>
              {t("ads.topUp", { hours: offlineTopUpTicks / 3600 })}
            </Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {offlineTopUp != null && offlineTopUp > 0n
                ? t("ads.topUpDetail", {
                    hours: offlineTopUpTicks / 3600,
                    count: formatNumber(offlineTopUp),
                  })
                : t("ads.topUpNone")}
            </Text>
          </View>
          <Button
            disabled={
              claiming != null ||
              (offlineTopUp ?? 0n) <= 0n ||
              dailyCapLeft <= 0
            }
            title={claiming === "offlineTopUp" ? t("ads.watching") : t("ads.watch")}
            onPress={() => onClaim("offlineTopUp")}
          />
        </View>

        <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
          {t("ads.cap", { count: AD_MAX_REWARDS_PER_DAY })}
        </Text>
      </View>
    </BottomModal>
  );
}

export default memo(AdRewardsPanel);
