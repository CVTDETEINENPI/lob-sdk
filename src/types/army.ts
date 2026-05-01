import { DynamicBattleType } from "./server-game";
import { UnitCounts } from "../game-data-manager/data-wrappers/unit";

export interface Army {
  dynamicBattleType: DynamicBattleType;
  units: UnitCounts;
}
