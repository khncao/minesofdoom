import { memo } from "react";
import { View } from "react-native";
import Button from "apps/components/Button";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import {
  CLICK_BOOST_MAX_LEVELS,
  COMBO_RESIST_MAX_LEVELS,
  GEM_CHANCE_MAX_LEVELS,
  PRESTIGE_LEVELS,
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
  gemChanceLevels,
  fastMinerUnlocked,
  prestigeLevel,
  lifetimeMinerals,
  prestigeUnlocked,
  clickBoostLevels,
  comboResistLevels,
  onUpgradePower,
  onBuyMiner,
  onBuyFastMiner,
  onBuyGem,
  onBuyGemChance,
  onBuyClickBoost,
  onBuyComboResist,
  onUpgradeMinerPower,
  onSinkNewShaft,
}: {
  minerals: number;
  gems: number;
  clickPower: number;
  minerPower: number;
  /** Tier-1 goal unlock (goals.ts); the button stays locked until then. */
  minerPowerUnlocked: boolean;
  miners: number;
  fastMiners: number;
  gemChanceLevels: number;
  /** Tier-2 goal unlock (goals.ts): fast miners + gem chance upgrade. */
  fastMinerUnlocked: boolean;
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
  onBuyGem: () => void;
  onBuyGemChance: () => void;
  onBuyClickBoost: () => void;
  onBuyComboResist: () => void;
  onUpgradeMinerPower: () => void;
  onSinkNewShaft: () => void;
}) {
  const fastCost = getFastMinerCost(fastMiners);
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
      <Button
        disabled={minerals < getClickUpgradeCost(clickPower)}
        onPress={onUpgradePower}
        title={`UPGRADE POWER (-${formatNumber(
          getClickUpgradeCost(clickPower),
        )} ${emojis.mineral}) (${clickPower})`}
      />

      <Button
        onPress={onBuyMiner}
        disabled={gems < getMinerUpgradeCost(miners)}
        title={`BUY A MINER (-${formatNumber(
          getMinerUpgradeCost(miners),
        )} ${emojis.gem}) (${miners})`}
      />

      {/* Tier-2 unlock (plan §4.6): second miner type — cheaper gem curve,
          weaker per-miner output. Shown but locked until Deep Shaft. */}
      <Button
        onPress={onBuyFastMiner}
        disabled={!fastMinerUnlocked || gems < fastCost}
        title={
          fastMinerUnlocked
            ? `BUY A FAST MINER (-${formatNumber(fastCost)} ${emojis.gem}) (${
                fastMiners
              }, ${getFastMinerOutput(minerPower)}/s each)`
            : `🔒 BUY FAST MINER (Deep Shaft)`
        }
      />

      {/* First goal-tier unlock (plan §4.6): shown but locked until the
          Prospector's License tier is complete, so players see it coming. */}
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

      <Button
        onPress={onBuyGem}
        disabled={minerals < gemMineralCost}
        title={`BUY A GEM (-${formatNumber(gemMineralCost)} ${emojis.mineral})`}
      />

      {/* Tier-2 unlock: first gem upgrade — +1% base gem chance per level. */}
      <Button
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

      {/* Tier-3 unlock: second gem upgrade line — each level doubles
          tap/answer gains (passive income is unaffected). */}
      <Button
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

      {/* Tier-3 unlock: third gem upgrade line — keep part of the combo on
          a wrong answer / mine tap instead of losing it all. */}
      <Button
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

      {/* Tier-3 unlock (plan §4.1 "New Shaft"): reset the run for a permanent
          multiplier. Banked level is applied now; a higher level banks the
          moment lifetime minerals cross the next rung. Shown but locked until
          Magma Frontier. */}
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
    </View>
  );
});

export default PurchaseButtons;
