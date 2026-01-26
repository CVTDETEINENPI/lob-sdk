import { AnyOrder, IServerGame, UnitFormationChange } from "@lob-sdk/types";
import { BaseUnit } from "@lob-sdk/unit";
import { Vector2 } from "@lob-sdk/vector";
import { IBot } from "../types";
import { GameDataManager } from "@lob-sdk/game-data-manager";

/**
 * Interface for Napoleonic unit strategies.
 * Strategies are now responsible for assigning actual orders to a group of units.
 */
export interface NapoleonicBotStrategyContext {
  game: IServerGame;
  visibleEnemies: BaseUnit[];
  orders: AnyOrder[];
  formationChanges: UnitFormationChange[];
  formationCenter: Vector2;
  direction: Vector2;
  perpendicular: Vector2;
  mainBodyWidth: number;
  forwardAngle: number;
  isRetreating: boolean;
}

export interface NapoleonicBotStrategy {
  assignOrders(
    units: BaseUnit[],
    context: NapoleonicBotStrategyContext,
  ): void;
}

/**
 * Interface for the Napoleonic bot to avoid circular dependencies.
 */
export interface INapoleonicBot extends IBot {
  /**
   * Gets the high-level group name for a given unit category.
   * @param categoryId - The unit category ID.
   * @returns The group name (e.g., "infantry", "cavalry").
   */
  getGroup(categoryId: string): string;

  /**
   * Gets the game data manager instance.
   */
  getGameDataManager(): GameDataManager;
}
