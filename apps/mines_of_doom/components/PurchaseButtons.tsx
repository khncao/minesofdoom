import { memo } from "react";
import { Text, View } from "react-native";
import Button from "apps/components/Button";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import {
  CLICK_BOOST_MAX_LEVELS,
  COMBO_RESIST_MAX_LEVELS,
  GEM_CHANCE_MAX_LEVELS,
  PRESTIGE_LEVELS,
  type PurchaseId,
  gemMineralCost,
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
  visible,
}: {
  /**
   * Which purchase buttons to render (plan "Adjust"): the core three are
   * always in this set; the rest only appear once the player's lifetime
   * economy has reached their base cost (see getVisiblePurchases in game.ts).
   */
  visible: ReadonlySet<PurchaseId>;
  minerals: number;
  gems: number;
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
  lifetimeMinerals: number;
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
}) {
  const fastCost = getFastMinerCost(fastMiners);
  const legendaryCost = getLegendaryMinerCost(legendaryMiners);
  // Cost-curve context (plan §2.1): once a type is owned, show the NEXT
  // cost too, so the quartic ramp is visible before it surprises the
  // player. Hidden at count 0 (next would just repeat the current cost).
  const minerNext =
    miners > 0
      ? `, next ${formatNumber(getMinerUpgradeCost(miners + 1))}`
      : "";
  const fastNext =
    fastMiners > 0
      ? `, next ${formatNumber(getFastMinerCost(fastMiners + 1))}`
      : "";
  const legendaryNext =
    legendaryMiners > 0
      ? `, next ${formatNumber(getLegendaryMinerCost(legendaryMiners + 1))}`
      : "";
  const gemCost = getGemChanceCost(gemChanceLevels);
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
  return (
    <View style={{ gap: 5, marginTop: 8 }}>
      {/* Plan §2.1 "button hierarchy": buttons are grouped by the currency
          they spend, with a tinted header per group; gem buttons use the
          gem Button tone so the two groups read at a glance. */}
      <PurchaseGroupHeader label={`SPEND ${emojis.mineral} MINERALS`} color="#8fbf8f" />
      <Button
        disabled={minerals < getClickUpgradeCost(clickPower)}
        onPress={onUpgradePower}
        title={`UPGRADE POWER (-${formatNumber(
          getClickUpgradeCost(clickPower),
        )} ${emojis.mineral}) (${clickPower})`}
      />

      {/* First goal-tier unlock (plan §4.6): shown but locked until the
          Prospector's License tier is complete, so players see it coming. */}
      {visible.has("minerPower") && (
        <Button
          onPress={onUpgradeMinerPower}
          disabled={!minerPowerUnlocked || minerals < getMinerPowerUpgradeCost(minerPower)}
          title={
            minerPowerUnlocked
              ? `UPGRADE MINERS (-${formatNumber(
                  getMinerPowerUpgradeCost(minerPower),
                )} ${emojis.mineral}) (${minerPower})`
              : `🔒 UPGRADE MINERS (Prospector's License)`
          }
        />
      )}

      <Button
        onPress={onBuyGem}
        disabled={minerals < gemMineralCost}
        title={`BUY A GEM (-${formatNumber(gemMineralCost)} ${emojis.mineral})`}
      />

      <PurchaseGroupHeader label={`SPEND ${emojis.gem} GEMS`} color="#7fd4ff" />
      <Button
        tone="gem"
        onPress={onBuyMiner}
        disabled={gems < getMinerUpgradeCost(miners)}
        title={`BUY A MINER (-${formatNumber(
          getMinerUpgradeCost(miners),
        )} ${emojis.gem}) (${miners}${minerNext})`}
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
              ? `BUY A FAST MINER (-${formatNumber(fastCost)} ${emojis.gem}) (${
                  fastMiners
                }, ${getFastMinerOutput(minerPower)}/s each${fastNext})`
              : `🔒 BUY FAST MINER (Deep Shaft)`
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
              ? `BUY A LEGENDARY MINER (-${formatNumber(legendaryCost)} ${
                  emojis.gem
                }) (${legendaryMiners}, ${getLegendaryMinerOutput(minerPower)}/s each${legendaryNext})`
              : `🔒 BUY LEGENDARY MINER (Motherlode)`
          }
        />
      )}

      {/* Tier-2 unlock: first gem upgrade — +1% base gem chance per level. */}
      {visible.has("gemChance") && (
        <Button
          tone="gem"
          onPress={onBuyGemChance}
          disabled={
            !fastMinerUnlocked || gemChanceMaxed || gems < gemCost
          }
          title={
            !fastMinerUnlocked
              ? `🔒 GEM CHANCE +1% (Deep Shaft)`
              : gemChanceMaxed
                ? `GEM CHANCE ${gemChancePct}% (MAX)`
                : `GEM CHANCE +1% (-${formatNumber(gemCost)} ${emojis.gem}) (now ${gemChancePct}%)`
          }
        />
      )}

      {/* Tier-3 unlock: second gem upgrade line — each level doubles
          tap/answer gains (passive income is unaffected). */}
      {visible.has("clickBoost") && (
        <Button
          tone="gem"
          onPress={onBuyClickBoost}
          disabled={!prestigeUnlocked || clickBoostMaxed || gems < clickBoostCost}
          title={
            !prestigeUnlocked
              ? `🔒 CLICK ×2 (Magma Frontier)`
              : clickBoostMaxed
                ? `CLICK POWER ×${clickBoostMult} (MAX)`
                : `CLICK ×2 (-${formatNumber(clickBoostCost)} ${emojis.gem}) (now ×${clickBoostMult})`
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
            !prestigeUnlocked || comboResistMaxed || gems < comboResistCost
          }
          title={
            !prestigeUnlocked
              ? `🔒 COMBO RESISTANCE (Magma Frontier)`
              : comboResistMaxed
                ? `COMBO RESISTANCE (keep ${comboKeepPct}%) (MAX)`
                : `COMBO RESISTANCE (-${formatNumber(comboResistCost)} ${emojis.gem}) (keep ${comboKeepPct}%)`
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
          <PurchaseGroupHeader label="PRESTIGE" color="#ffaa44" />
          <Button
            onPress={onSinkNewShaft}
            disabled={!prestigeUnlocked || !canBank}
            title={
              !prestigeUnlocked
                ? `🔒 SINK NEW SHAFT (Magma Frontier)`
                : canBank
                  ? `⛏️ SINK NEW SHAFT → ×${availableMult} (now ×${bankedMult})`
                  : nextLevel
                    ? `⛏️ SINK NEW SHAFT ×${bankedMult} — need ${formatNumber(
                        nextLevel.at,
                      )} ${emojis.mineral} total for ×${nextLevel.multiplier}`
                    : `⛏️ SINK NEW SHAFT ×${bankedMult} (MAX)`
            }
          />
        </>
      )}
    </View>
  );
});

/** Small tinted divider labeling which currency a purchase group spends
 *  (plan §2.1 "button hierarchy"). */
function PurchaseGroupHeader({ label, color }: { label: string; color: string }) {
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
      <View style={{ height: 1, flex: 1, backgroundColor: color, opacity: 0.5 }} />
      <Text
        style={{ color, fontSize: 11, fontWeight: "bold", userSelect: "none" }}
      >
        {label}
      </Text>
      <View style={{ height: 1, flex: 1, backgroundColor: color, opacity: 0.5 }} />
    </View>
  );
}

export default PurchaseButtons;
