import { memo } from "react";
import { View } from "react-native";
import { T as Text } from "../textScale";
import { useContent, useT } from "src/hooks/useI18n";
import { formatDuration, formatNumber } from "src/utils/format";
import { SaveData } from "../game";
import { getRecords } from "../records";
import { SessionStats } from "../session";
import { styles } from "../styles";

function RecordRow({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: "#1f1f1f",
        borderRadius: 6,
      }}
    >
      <Text style={{ ...styles.text, fontSize: 13 }}>
        {icon} {title}
      </Text>
      <Text style={{ ...styles.text, fontSize: 13, fontWeight: "bold" }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * The "Records" view (plan §4.3, offline-first half): personal bests
 * derived from the lifetime stats on the save — depth, combo, lifetime
 * totals, and how far the tier/achievement chains are along. The rows are
 * computed by the pure getRecords (records.ts); this is a dumb renderer.
 *
 * Below the lifetime rows: a "This session" block (todo: statistics
 * detail) — the same counters since the app was last opened, computed by
 * the pure getSessionStats (session.ts) from a baseline the parent
 * snapshotted at launch. `session` is null until the save has loaded.
 */
const RecordsContent = memo(function RecordsContent({
  stats,
  session,
}: {
  stats: SaveData;
  session: SessionStats | null;
}) {
  const t = useT();
  const content = useContent();
  const records = getRecords(stats);
  return (
    <View style={{ gap: 10, padding: 12 }}>
      <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
        {t("records.header")}
      </Text>
      {records.map((r) => (
        <RecordRow
          key={r.id}
          icon={r.icon}
          title={content("record", r.id, { title: r.label }).title}
          value={r.value}
        />
      ))}
      {session != null && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {t("records.session")}
          </Text>
          <RecordRow
            icon="🪨"
            title={t("records.sessionMinerals")}
            value={formatNumber(session.mineralsMined)}
          />
          <RecordRow
            icon="🧮"
            title={t("records.sessionAnswers")}
            value={formatNumber(session.correct)}
          />
          <RecordRow
            icon="⏱️"
            title={t("records.sessionTime")}
            value={formatDuration(session.seconds)}
          />
        </View>
      )}
    </View>
  );
});

export default RecordsContent;
