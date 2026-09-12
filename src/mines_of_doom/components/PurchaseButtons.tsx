import { memo, type ReactNode, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Button from "src/components/Button";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";

import {
    CLICK_BOOST_MAX_LEVELS,
    COMBO_RESIST_MAX_LEVELS,
    GEM_CHANCE_MAX_LEVELS,
    PRESTIGE_LEVELS,
    type BuyAllPlan,
    type PurchaseAffordability,
    type PurchaseId,
    computeBuyAll,
    getGemPurchaseCost,
    getClickBoostCost,
    getClickBoostMultiplier,
    getClickUpgradeCost,
    getComboResistCost,
    getComboRetention,
    getFastMinerCost,
    getFastMinerOutput,
    getGemChance,
    getGemChanceCost,
    getLegendaryMinerCost,
    getLegendaryMinerOutput,
    getMinerPowerUpgradeCost,
    getMinerUpgradeCost,
    getPrestigeLevel,
    getPrestigeMultiplier,
} from "../game";

const PurchaseButtons = memo(function PurchaseButtons({
    minerals,
    gems,
    gemsBoughtWithMinerals,
    clickPower,
    minerPower,
    minerPowerUnlocked,
    miners,
    fastMiners,
    legendaryMiners,
    gemChanceLevels,
    fastMinerUnlocked,
    legendaryMinerUnlocked,
    prestigeLevel,
    lifetimeMinerals,
    prestigeUnlocked,
    clickBoostLevels,
    comboResistLevels,
    onUpgradePower,
    onBuyMiner,
    onBuyFastMiner,
    onBuyLegendaryMiner,
    onBuyGem,
    onBuyGemChance,
    onBuyClickBoost,
    onBuyComboResist,
    onUpgradeMinerPower,
    onSinkNewShaft,
    onBuyAllMinerals,
    onBuyAllGems,
    visible,
}: {
    /**
     * Which purchase buttons to render (plan "Adjust"): the core three are
     * always in this set; the rest only appear once the player's lifetime
     * economy has reached their base cost (see getVisiblePurchases in game.ts).
     */
    visible: ReadonlySet<PurchaseId>;
    minerals: bigint;
    gems: number;
    /** Lifetime gem mints (drives the escalating buy price, item 2 todo). */
    gemsBoughtWithMinerals: number;
    clickPower: number;
    minerPower: number;
    /** Tier-1 goal unlock (goals.ts); the button stays locked until then. */
    minerPowerUnlocked: boolean;
    miners: number;
    fastMiners: number;
    legendaryMiners: number;
    gemChanceLevels: number;
    /** Tier-2 goal unlock (goals.ts): fast miners + gem chance upgrade. */
    fastMinerUnlocked: boolean;
    /** Tier-5 goal unlock (goals.ts): legendary miners (endgame). */
    legendaryMinerUnlocked: boolean;
    /** Tier-3 goal unlock (goals.ts): prestige / New Shaft + gem upgrades. */
    prestigeUnlocked: boolean;
    /** Banked prestige level (save). */
    prestigeLevel: number;
    /** Lifetime minerals (drives which multiplier level is available to bank). */
    lifetimeMinerals: bigint;
    /** Tier-3 gem upgrade levels (both survive prestige). */
    clickBoostLevels: number;
    comboResistLevels: number;
    onUpgradePower: () => void;
    onBuyMiner: () => void;
    onBuyFastMiner: () => void;
    onBuyLegendaryMiner: () => void;
    onBuyGem: () => void;
    onBuyGemChance: () => void;
    onBuyClickBoost: () => void;
    onBuyComboResist: () => void;
    onUpgradeMinerPower: () => void;
    onSinkNewShaft: () => void;
    onBuyAllMinerals: (plan: BuyAllPlan) => void;
    onBuyAllGems: (plan: BuyAllPlan) => void;
}) {
    const t = useT();
    const fastCost = getFastMinerCost(fastMiners);
    const legendaryCost = getLegendaryMinerCost(legendaryMiners);
    // Cost-curve context (plan §2.1): once a type is owned, show the NEXT
    // cost too, so the quartic ramp is visible before it surprises the
    // player. Hidden at count 0 (next would just repeat the current cost).
    const minerNext =
        miners > 0
            ? t("purchase.nextCost", {
                  cost: formatNumber(getMinerUpgradeCost(miners + 1)),
              })
            : "";
    const fastNext =
        fastMiners > 0
            ? t("purchase.nextCost", {
                  cost: formatNumber(getFastMinerCost(fastMiners + 1)),
              })
            : "";
    const legendaryNext =
        legendaryMiners > 0
            ? t("purchase.nextCost", {
                  cost: formatNumber(
                      getLegendaryMinerCost(legendaryMiners + 1),
                  ),
              })
            : "";
    // Mineral→gem mint ("BUY A GEM"): escalating per lifetime mint
    // (item 2 todo — GEM_PURCHASE_ESCALATION, game.ts). This used to
    // (wrongly, pre-item-2) share the gem-chance cost below; the mint
    // button displayed/disabled against a different purchase's price.
    const gemMintCost = getGemPurchaseCost(gemsBoughtWithMinerals);
    const gemChanceCost = getGemChanceCost(gemChanceLevels);
    const gemChancePct = Math.round(getGemChance(gemChanceLevels) * 100);
    const gemChanceMaxed = gemChanceLevels >= GEM_CHANCE_MAX_LEVELS;
    // Prestige ("New Shaft", tier 3): the banked multiplier is what's applied
    // now; lifetime minerals decide whether a higher level can be banked.
    const bankedMult = getPrestigeMultiplier(prestigeLevel);
    const availableLevel = getPrestigeLevel(lifetimeMinerals);
    const canBank = availableLevel > prestigeLevel;
    const availableMult = getPrestigeMultiplier(availableLevel);
    const nextLevel = PRESTIGE_LEVELS[prestigeLevel + 1];
    // Tier-3 gem upgrade lines (both unlock with Magma Frontier, both
    // survive a sunk shaft, so the labels can show the banked state).
    const clickBoostCost = getClickBoostCost(clickBoostLevels);
    const clickBoostMult = getClickBoostMultiplier(clickBoostLevels);
    const clickBoostMaxed = clickBoostLevels >= CLICK_BOOST_MAX_LEVELS;
    const comboResistCost = getComboResistCost(comboResistLevels);
    const comboResistMaxed = comboResistLevels >= COMBO_RESIST_MAX_LEVELS;
    const comboKeepPct = Math.round(getComboRetention(comboResistLevels) * 100);
    // "Buy all" plans (todo: buy-all buttons): one greedy per-level plan per
    // currency group, mirroring the individual buttons' disabled flags and
    // visibility — buy-all only ever buys what its group could buy by hand.
    // Cheap enough to recompute per render (this list only mounts while the
    // drawer is open), memo keeps the drawer's memoized rows quiet.
    const affordability: PurchaseAffordability = useMemo(
        () => ({
            minerals,
            gems,
            clickPower,
            minerPower,
            miners,
            fastMiners,
            legendaryMiners,
            gemChanceLevels,
            clickBoostLevels,
            comboResistLevels,
            prestigeLevel,
            lifetimeMinerals,
            minerPowerUnlocked,
            fastMinerUnlocked,
            legendaryMinerUnlocked,
            prestigeUnlocked,
        }),
        [
            minerals,
            gems,
            clickPower,
            minerPower,
            miners,
            fastMiners,
            legendaryMiners,
            gemChanceLevels,
            clickBoostLevels,
            comboResistLevels,
            prestigeLevel,
            lifetimeMinerals,
            minerPowerUnlocked,
            fastMinerUnlocked,
            legendaryMinerUnlocked,
            prestigeUnlocked,
        ],
    );
    const mineralPlan = useMemo(
        () => computeBuyAll("minerals", affordability, visible),
        [affordability, visible],
    );
    const gemPlan = useMemo(
        () => computeBuyAll("gems", affordability, visible),
        [affordability, visible],
    );
    return (
        <View style={{ gap: 5, marginTop: 8 }}>
            {/* Plan §2.1 "button hierarchy": buttons are grouped by the currency
          they spend, with a tinted header per group; gem buttons use the
          gem Button tone so the two groups read at a glance. */}
            <PurchaseGroupHeader
                label={t("purchase.groupMinerals")}
                color="#8fbf8f"
                action={
                    mineralPlan.totalLevels > 0 && (
                        <Pressable
                            testID="btn-buy-all-minerals"
                            accessibilityRole="button"
                            accessibilityLabel={t(
                                "purchase.a11yBuyAllMinerals",
                                {
                                    count: mineralPlan.totalLevels,
                                },
                            )}
                            onPress={() => onBuyAllMinerals(mineralPlan)}
                            style={{
                                backgroundColor: "#503121",
                                borderRadius: 5,
                                paddingHorizontal: 6,
                                paddingVertical: 3,
                            }}
                        >
                            <Text
                                style={{
                                    color: "white",
                                    fontSize: 11,
                                    fontWeight: "bold",
                                    userSelect: "none",
                                }}
                            >
                                {t("purchase.buyAllMinerals", {
                                    count: formatNumber(
                                        mineralPlan.totalLevels,
                                    ),
                                    cost: formatNumber(mineralPlan.totalCost),
                                })}
                            </Text>
                        </Pressable>
                    )
                }
            />
            <Button
                testId="btn-upgrade-power"
                disabled={minerals < BigInt(getClickUpgradeCost(clickPower))}
                onPress={onUpgradePower}
                title={t("purchase.upgradePower", {
                    cost: formatNumber(getClickUpgradeCost(clickPower)),
                    power: clickPower,
                })}
            />

            {/* First goal-tier unlock (plan §4.6): shown but locked until the
          Prospector's License tier is complete, so players see it coming. */}
            {visible.has("minerPower") && (
                <Button
                    onPress={onUpgradeMinerPower}
                    disabled={
                        !minerPowerUnlocked ||
                        minerals < BigInt(getMinerPowerUpgradeCost(minerPower))
                    }
                    title={
                        minerPowerUnlocked
                            ? t("purchase.upgradeMiners", {
                                  cost: formatNumber(
                                      getMinerPowerUpgradeCost(minerPower),
                                  ),
                                  power: minerPower,
                              })
                            : t("purchase.upgradeMinersLocked")
                    }
                />
            )}

            <Button
                testId="btn-buy-gem"
                onPress={onBuyGem}
                disabled={minerals < BigInt(gemMintCost)}
                title={t("purchase.buyGem", {
                    cost: formatNumber(gemMintCost),
                })}
            />

            <PurchaseGroupHeader
                label={t("purchase.groupGems")}
                color="#7fd4ff"
                action={
                    gemPlan.totalLevels > 0 && (
                        <Pressable
                            testID="btn-buy-all-gems"
                            accessibilityRole="button"
                            accessibilityLabel={t("purchase.a11yBuyAllGems", {
                                count: gemPlan.totalLevels,
                            })}
                            onPress={() => onBuyAllGems(gemPlan)}
                            style={{
                                backgroundColor: "#1f4356",
                                borderRadius: 5,
                                paddingHorizontal: 6,
                                paddingVertical: 3,
                            }}
                        >
                            <Text
                                style={{
                                    color: "white",
                                    fontSize: 11,
                                    fontWeight: "bold",
                                    userSelect: "none",
                                }}
                            >
                                {t("purchase.buyAllGems", {
                                    count: formatNumber(gemPlan.totalLevels),
                                    cost: formatNumber(gemPlan.totalCost),
                                })}
                            </Text>
                        </Pressable>
                    )
                }
            />
            <Button
                tone="gem"
                testId="btn-buy-miner"
                onPress={onBuyMiner}
                disabled={gems < getMinerUpgradeCost(miners)}
                title={t("purchase.buyMiner", {
                    cost: formatNumber(getMinerUpgradeCost(miners)),
                    count: miners,
                    next: minerNext,
                })}
            />

            {/* Tier-2 unlock (plan §4.6): second miner type — cheaper gem curve,
          weaker per-miner output. Shown but locked until Deep Shaft. */}
            {visible.has("fastMiner") && (
                <Button
                    tone="gem"
                    onPress={onBuyFastMiner}
                    disabled={!fastMinerUnlocked || gems < fastCost}
                    title={
                        fastMinerUnlocked
                            ? t("purchase.buyFastMiner", {
                                  cost: formatNumber(fastCost),
                                  count: fastMiners,
                                  output: getFastMinerOutput(minerPower),
                                  next: fastNext,
                              })
                            : t("purchase.buyFastMinerLocked")
                    }
                />
            )}

            {/* Tier-5 endgame unlock (plan §4.6): third miner type — the premium
          raw-output sink (double a normal miner's output, 2x the normal
          miner's gem curve). Shown but locked until Motherlode. */}
            {visible.has("legendaryMiner") && (
                <Button
                    tone="gem"
                    onPress={onBuyLegendaryMiner}
                    disabled={!legendaryMinerUnlocked || gems < legendaryCost}
                    title={
                        legendaryMinerUnlocked
                            ? t("purchase.buyLegendaryMiner", {
                                  cost: formatNumber(legendaryCost),
                                  count: legendaryMiners,
                                  output: getLegendaryMinerOutput(minerPower),
                                  next: legendaryNext,
                              })
                            : t("purchase.buyLegendaryMinerLocked")
                    }
                />
            )}

            {/* Tier-2 unlock: first gem upgrade — +1% base gem chance per level. */}
            {visible.has("gemChance") && (
                <Button
                    tone="gem"
                    onPress={onBuyGemChance}
                    disabled={
                        !fastMinerUnlocked ||
                        gemChanceMaxed ||
                        gems < gemChanceCost
                    }
                    title={
                        !fastMinerUnlocked
                            ? t("purchase.gemChanceLocked")
                            : gemChanceMaxed
                              ? t("purchase.gemChanceMaxed", {
                                    pct: gemChancePct,
                                })
                              : t("purchase.gemChance", {
                                    cost: formatNumber(gemChanceCost),
                                    pct: gemChancePct,
                                })
                    }
                />
            )}

            {/* Tier-3 unlock: second gem upgrade line — each level doubles
          tap/answer gains (passive income is unaffected). */}
            {visible.has("clickBoost") && (
                <Button
                    tone="gem"
                    onPress={onBuyClickBoost}
                    disabled={
                        !prestigeUnlocked ||
                        clickBoostMaxed ||
                        gems < clickBoostCost
                    }
                    title={
                        !prestigeUnlocked
                            ? t("purchase.clickBoostLocked")
                            : clickBoostMaxed
                              ? t("purchase.clickBoostMaxed", {
                                    mult: clickBoostMult,
                                })
                              : t("purchase.clickBoost", {
                                    cost: formatNumber(clickBoostCost),
                                    mult: clickBoostMult,
                                })
                    }
                />
            )}

            {/* Tier-3 unlock: third gem upgrade line — keep part of the combo on
          a wrong answer / mine tap instead of losing it all. */}
            {visible.has("comboResist") && (
                <Button
                    tone="gem"
                    onPress={onBuyComboResist}
                    disabled={
                        !prestigeUnlocked ||
                        comboResistMaxed ||
                        gems < comboResistCost
                    }
                    title={
                        !prestigeUnlocked
                            ? t("purchase.comboResistLocked")
                            : comboResistMaxed
                              ? t("purchase.comboResistMaxed", {
                                    pct: comboKeepPct,
                                })
                              : t("purchase.comboResist", {
                                    cost: formatNumber(comboResistCost),
                                    pct: comboKeepPct,
                                })
                    }
                />
            )}

            {/* Tier-3 unlock (plan §4.1 "New Shaft"): reset the run for a permanent
          multiplier. Banked level is applied now; a higher level banks the
          moment lifetime minerals cross the next rung. Shown but locked until
          Magma Frontier. Consumes nothing — its own group, kept apart from
          both currency rows so it can't be mistaken for a purchase. */}
            {visible.has("prestige") && (
                <>
                    <PurchaseGroupHeader
                        label={t("purchase.groupPrestige")}
                        color="#ffaa44"
                    />
                    <Button
                        onPress={onSinkNewShaft}
                        disabled={!prestigeUnlocked || !canBank}
                        title={
                            !prestigeUnlocked
                                ? t("purchase.sinkNewShaftLocked")
                                : canBank
                                  ? t("purchase.sinkNewShaftCanBank", {
                                        next: availableMult,
                                        banked: bankedMult,
                                    })
                                  : nextLevel
                                    ? t("purchase.sinkNewShaftNeed", {
                                          banked: bankedMult,
                                          at: formatNumber(nextLevel.at),
                                          next: nextLevel.multiplier,
                                      })
                                    : t("purchase.sinkNewShaftMax", {
                                          banked: bankedMult,
                                      })
                        }
                    />
                </>
            )}
        </View>
    );
});

/** Small tinted divider labeling which currency a purchase group spends
 *  (plan §2.1 "button hierarchy"). */
function PurchaseGroupHeader({
    label,
    color,
    action,
}: {
    label: string;
    color: string;
    /**
     * Optional trailing control (the buy-all button): it sits after the
     * right-hand line, so the divider still frames the label and the action
     * reads as part of the group, not a separate row.
     */
    action?: ReactNode;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                alignSelf: "stretch",
                marginTop: 2,
            }}
        >
            <View
                style={{
                    height: 1,
                    flex: 1,
                    backgroundColor: color,
                    opacity: 0.5,
                }}
            />
            <Text
                style={{
                    color,
                    fontSize: 11,
                    fontWeight: "bold",
                    userSelect: "none",
                }}
            >
                {label}
            </Text>
            <View
                style={{
                    height: 1,
                    flex: 1,
                    backgroundColor: color,
                    opacity: 0.5,
                }}
            />
            {action}
        </View>
    );
}

export default PurchaseButtons;
