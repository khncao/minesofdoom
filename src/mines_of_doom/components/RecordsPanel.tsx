import { memo } from "react";
import { Text, View } from "react-native";
import { useT } from "src/hooks/useI18n";
import { SaveData } from "../game";
import { getRecords } from "../records";
import { styles } from "../styles";

/**
 * The "Records" view (plan §4.3, offline-first half): personal bests
 * derived from the lifetime stats on the save — depth, combo, lifetime
 * totals, and how far the tier/achievement chains are along. The rows are
 * computed by the pure getRecords (records.ts); this is a dumb renderer.
 */
const RecordsContent = memo(function RecordsContent({
  stats,
}: {
  stats: SaveData;
}) {
  const t = useT();
  const records = getRecords(stats);
  return (
    <View style={{ gap: 10, padding: 12 }}>
      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        {t("records.header")}
      </Text>
      {records.map((r) => (
        <View
          key={r.id}
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
            {r.icon} {r.label}
          </Text>
          <Text style={{ ...styles.text, fontSize: 13, fontWeight: "bold" }}>
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
});

export default RecordsContent;
