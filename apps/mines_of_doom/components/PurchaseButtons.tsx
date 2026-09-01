import { memo } from "react";
import { View } from "react-native";
import Button from "apps/components/Button";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import {
  gemMineralCost,
  getClickUpgradeCost,
  getMinerPowerUpgradeCost,
  getMinerUpgradeCost,
} from "../game";

const PurchaseButtons = memo(function PurchaseButtons({
  minerals,
  gems,
  clickPower,
  minerPower,
  minerPowerUnlocked,
  miners,
  onUpgradePower,
  onBuyMiner,
  onBuyGem,
  onUpgradeMinerPower,
}: {
  minerals: number;
  gems: number;
  clickPower: number;
  minerPower: number;
  /** Tier-1 goal unlock (goals.ts); the button stays locked until then. */
  minerPowerUnlocked: boolean;
  miners: number;
  onUpgradePower: () => void;
  onBuyMiner: () => void;
  onBuyGem: () => void;
  onUpgradeMinerPower: () => void;
}) {
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
    </View>
  );
});

export default PurchaseButtons;
