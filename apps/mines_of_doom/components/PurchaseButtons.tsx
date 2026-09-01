import { memo } from "react";
import { View } from "react-native";
import Button from "apps/components/Button";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import {
  gemMineralCost,
  getClickUpgradeCost,
  getMinerUpgradeCost,
} from "../game";

const PurchaseButtons = memo(function PurchaseButtons({
  minerals,
  gems,
  clickPower,
  miners,
  onUpgradePower,
  onBuyMiner,
  onBuyGem,
}: {
  minerals: number;
  gems: number;
  clickPower: number;
  miners: number;
  onUpgradePower: () => void;
  onBuyMiner: () => void;
  onBuyGem: () => void;
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

      <Button
        onPress={onBuyGem}
        disabled={minerals < gemMineralCost}
        title={`BUY A GEM (-${formatNumber(gemMineralCost)} ${emojis.mineral})`}
      />
    </View>
  );
});

export default PurchaseButtons;
