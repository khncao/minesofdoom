import { memo, useMemo } from "react";
import { Image, Text, View } from "react-native";
import { useContent, useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import { minerSpriteUri, pickaxeSpriteUri } from "src/utils/graphics/pixelArt";
import { emojis } from "src/utils/graphics/emojis";
import { SaveData } from "../game";
import { getAchievement } from "../achievements";
import {
  COSMETIC_PREVIEW_SEED,
  OUTFITS,
  PICKAXES,
  getCostGems,
  getCaveTheme,
  getPickaxe,
  getOutfit,
  rollMinerLook,
} from "../cosmetics";
import { getCollection, CollectionGroup } from "../collection";
import { styles } from "../styles";

/**
 * The "Collection" view (features.md §7 "cosmetic compendium / collection",
 * landed iteration 23): one read-only catalog of EVERYTHING collectible —
 * pickaxes, outfits, cave themes and achievement badges — with owned vs.
 * not-yet and the group/total progress, turning the shop into a long-term
 * goal. Pure presentation over getCollection(save) (collection.ts): no
 * purchases, no equipping (the shop stays the single buy/equip surface,
 * as IapPanel's contract requires); this is the "completeness" surface
 * the idle genre's pets-and-creatures pattern calls for.
 */

/** One compendium row: thumbnail, name/blurb, status on the right. */
function EntryRow({
  thumb,
  title,
  detail,
  status,
  dim,
}: {
  thumb: React.ReactNode;
  title: string;
  detail?: string;
  status: string;
  dim: boolean;
}) {
  return (
    <View
      style={{
        ...styles.flexCenteredRow,
        gap: 6,
        alignItems: "center",
        paddingVertical: 4,
        opacity: dim ? 0.45 : 1,
      }}
    >
      <View style={{ width: 30, alignItems: "center" }}>{thumb}</View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.text}>{title}</Text>
        {detail != null && (
          <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
            {detail}
          </Text>
        )}
      </View>
      <Text style={{ ...styles.text, fontSize: 12 }}>{status}</Text>
    </View>
  );
}

const CollectionContent = memo(function CollectionContent({
  stats,
}: {
  stats: SaveData;
}) {
  const t = useT();
  const content = useContent();

  // Sprites are data-URIs generated once per outfit id (the shop's fixed
  // preview seed), so they're safe to memoize on the catalog alone.
  const outfitThumbs = useMemo(
    () =>
      new Map(
        OUTFITS.map((o) => [
          o.id,
          minerSpriteUri(rollMinerLook(COSMETIC_PREVIEW_SEED, o.id)),
        ]),
      ),
    [],
  );
  const pickaxeThumbs = useMemo(
    () => new Map(PICKAXES.map((p) => [p.id, pickaxeSpriteUri(p.theme)])),
    [],
  );

  const renderGroup = (group: CollectionGroup) => {
    const title =
      group.kind === "pickaxe"
        ? t("collection.groupPickaxes", {
            owned: group.owned,
            total: group.total,
          })
        : group.kind === "outfit"
          ? t("collection.groupOutfits", {
              owned: group.owned,
              total: group.total,
            })
          : group.kind === "caveTheme"
            ? t("collection.groupThemes", {
                owned: group.owned,
                total: group.total,
              })
            : t("collection.groupBadges", {
                owned: group.owned,
                total: group.total,
              });
    return (
      <View key={group.kind} style={{ gap: 2 }}>
        <Text style={{ ...styles.text, opacity: 0.7, fontSize: 12 }}>
          {title}
        </Text>
        {group.entries.map((entry) => {
          if (entry.kind === "achievement") {
            const a = getAchievement(entry.id)!;
            const label = content("achievement", a.id, {
              title: a.label,
            }).title;
            return (
              <EntryRow
                key={entry.id}
                thumb={<Text style={{ fontSize: 18 }}>{a.icon}</Text>}
                title={label}
                status={
                  entry.completed
                    ? t("collection.earned")
                    : `+${formatNumber(a.bonusMinerals)} ${emojis.gem}`
                }
                dim={!entry.completed}
              />
            );
          }
          const owned = entry.owned;
          const status = entry.equipped
            ? t("collection.equipped")
            : owned
              ? "✓"
              : `${formatNumber(getCostGems(entry.id) ?? 0)} ${emojis.gem}`;
          if (entry.kind === "caveTheme") {
            const theme = getCaveTheme(entry.id);
            return (
              <EntryRow
                key={entry.id}
                thumb={
                  <View style={{ flexDirection: "row", gap: 1 }}>
                    {theme.tints.map((tint, i) => (
                      <View
                        key={i}
                        style={{
                          width: 4,
                          height: 20,
                          borderRadius: 2,
                          backgroundColor: tint,
                        }}
                      />
                    ))}
                  </View>
                }
                title={
                  content("caveTheme", theme.id, {
                    title: theme.name,
                    detail: theme.blurb,
                  }).title
                }
                detail={
                  content("caveTheme", theme.id, {
                    title: theme.name,
                    detail: theme.blurb,
                  }).detail
                }
                status={status}
                dim={!owned}
              />
            );
          }
          const outfit = getOutfit(entry.id);
          return (
            <EntryRow
              key={entry.id}
              thumb={
                entry.kind === "pickaxe" ? (
                  <Image
                    source={{ uri: pickaxeThumbs.get(entry.id)! }}
                    style={{ width: 20, height: 20 }}
                    accessibilityRole="image"
                  />
                ) : (
                  <Image
                    source={{ uri: outfitThumbs.get(entry.id)! }}
                    style={{ width: 20, height: 20 }}
                    accessibilityRole="image"
                  />
                )
              }
              title={
                entry.kind === "pickaxe"
                  ? content("pickaxe", entry.id, {
                      title: getPickaxe(entry.id).name,
                    }).title
                  : content("outfit", entry.id, {
                      title: outfit.name,
                      detail: outfit.blurb,
                    }).title
              }
              detail={
                entry.kind === "pickaxe"
                  ? undefined
                  : content("outfit", entry.id, {
                      title: outfit.name,
                      detail: outfit.blurb,
                    }).detail
              }
              status={status}
              dim={!owned}
            />
          );
        })}
      </View>
    );
  };

  const collection = getCollection(stats);
  return (
    <View style={{ gap: 10, padding: 12 }}>
      <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
        {t("collection.header", {
          owned: collection.totalOwned,
          total: collection.totalItems,
        })}
      </Text>
      {collection.groups.map(renderGroup)}
    </View>
  );
});

export default CollectionContent;
