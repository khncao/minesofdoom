import { memo } from "react";
import { Text, TextInput, View } from "react-native";
import BottomModal from "src/components/BottomModal";
import Button from "src/components/Button";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import {
  DEFAULT_DISPLAY_NAME,
  LEADERBOARD_TOP_LIMIT,
  type LeaderboardRow,
} from "../leaderboard";
import { LEADERBOARD_NAME_MAX, type LeaderboardHandle } from "../hooks/useLeaderboard";
import { styles } from "../styles";

/**
 * Leaderboard entry point + board (docs/store-integration.md
 * §Leaderboard "Display"): a small trophy button in the footer (rendered
 * by MinesOfDoom ONLY while the provider is available — the "hidden
 * until configured" rule, same as the ad/IAP entry points) opens a
 * bottom sheet with the top-10 (rank, display name, depth,
 * achievement-badge count), a pinned "you" row, the display-name input,
 * and a refresh button.
 *
 * The board data and its refresh policy (60s cache, 5s tap throttle)
 * live in the useLeaderboard hook; this component only renders the
 * handle. Offline/error renders an "unavailable right now" line — never
 * a spinner trap (plan §Leaderboard).
 */
const LeaderboardPanel = memo(function LeaderboardPanel({
  handle,
  isDevSim,
}: {
  handle: LeaderboardHandle;
  /** Dev build (the labeled in-memory row, same rule as the cloud sim). */
  isDevSim: boolean;
}) {
  const t = useT();
  const { rows, yourRank, status, refresh, displayName, setDisplayName } =
    handle;
  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>🏆</Text>}
      accessibilityLabel={t("main.a11yLeaderboard")}
      scrollable
      testID="leaderboard-button"
      sheetTestID="leaderboard-sheet"
      onToggle={(open) => {
        // Refresh on open: the 60s cache in the hook makes a reopen
        // within a minute free, and the 5s throttle guards the rest.
        if (open) refresh();
      }}
    >
      <View style={{ gap: 10, padding: 12 }}>
        <Text style={{ ...styles.text, fontWeight: "bold", fontSize: 14 }}>
          {t("leaderboard.title", { limit: LEADERBOARD_TOP_LIMIT })}
          {isDevSim ? t("settings.cloudSim") : ""}
        </Text>
        <View style={{ gap: 2 }}>
          <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
            {t("leaderboard.name")}
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={LEADERBOARD_NAME_MAX}
            placeholder={DEFAULT_DISPLAY_NAME}
            placeholderTextColor="#999"
            style={styles.saveCodeInput}
            testID="leaderboard-name-input"
            accessibilityLabel={t("leaderboard.name")}
          />
        </View>
        {status === "error" && rows == null ? (
          <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
            {t("leaderboard.unavailable")}
          </Text>
        ) : rows == null ? (
          <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
            {t("leaderboard.loading")}
          </Text>
        ) : (
          <View style={{ gap: 4 }}>
            {rows.map((row) => (
              <LeaderboardRowView key={row.rank} row={row} />
            ))}
            {yourRank != null ? (
              <Text
                style={{ ...styles.text, fontSize: 12, color: "#ffd28a" }}
              >
                {t("leaderboard.youRow", {
                  rank: yourRank.rank,
                  depth: formatNumber(yourRank.bestDepth),
                })}
              </Text>
            ) : (
              <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
                {t("leaderboard.notRanked", { limit: LEADERBOARD_TOP_LIMIT })}
              </Text>
            )}
          </View>
        )}
        <Button
          title={t("leaderboard.refresh")}
          onPress={refresh}
          testId="leaderboard-refresh"
        />
      </View>
    </BottomModal>
  );
});

/** One board row: rank + name on the left, depth + badge count on the
 *  right. Depth is meters (a Number by contract — the board never
 *  carries bigint). */
function LeaderboardRowView({ row }: { row: LeaderboardRow }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ ...styles.text, fontSize: 12 }}>
        #{row.rank} {row.displayName}
      </Text>
      <Text style={{ ...styles.text, fontSize: 12, color: "#aaa" }}>
        {formatNumber(row.bestDepth)}m · {row.achievementCount} 🏅
      </Text>
    </View>
  );
}

export default LeaderboardPanel;
