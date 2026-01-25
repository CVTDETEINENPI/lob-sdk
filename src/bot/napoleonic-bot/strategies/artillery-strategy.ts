import { OrderType } from "@lob-sdk/types";
import { BaseUnit } from "@lob-sdk/unit";
import { NapoleonicBotStrategy, NapoleonicBotStrategyContext } from "../types";
import { calculateLinePositions, sortUnitsAlongVector, findHighGroundNearby } from "../formation-utils";

/**
 * Strategy for artillery: always run to position, but prefer high ground 
 * and stop if in range of enemies.
 */
export class ArtilleryStrategy implements NapoleonicBotStrategy {
  private static readonly UNIT_SPACING = 60; // 40 * 1.5
  private static readonly LINE_SPACING = 32;
  private _assignedUnitIds: string[] = [];

  assignOrders(
    units: BaseUnit[],
    context: NapoleonicBotStrategyContext,
  ): void {
    const { 
      game, 
      visibleEnemies,
      orders, 
      formationChanges, 
      formationCenter, 
      direction, 
      perpendicular, 
    } = context;

    if (units.length === 0) {
      this._assignedUnitIds = [];
      return;
    }

    // Check composition for strict slot assignment
    const currentIds = units.map(u => String(u.id)).sort();
    const assignedIdsSorted = [...this._assignedUnitIds].sort();
    const compositionChanged = currentIds.length !== assignedIdsSorted.length || 
                                currentIds.some((id, i) => id !== assignedIdsSorted[i]);

    if (compositionChanged) {
      const sorted = sortUnitsAlongVector(units, perpendicular);
      this._assignedUnitIds = sorted.map(u => String(u.id));
    }

    const sortedUnits = this._assignedUnitIds
      .map(id => units.find(u => String(u.id) === id))
      .filter((u): u is BaseUnit => u !== undefined);

    const baseTargetPositions = calculateLinePositions(
      sortedUnits,
      formationCenter,
      direction,
      perpendicular,
      -ArtilleryStrategy.LINE_SPACING, // Second line (behind skirmishers)
      ArtilleryStrategy.UNIT_SPACING,
      game,
    );

    sortedUnits.forEach((unit, i) => {
      let targetPos = baseTargetPositions[i];
      if (!targetPos) return;

      // 1. High Ground Preference
      // Search nearby for better elevation
      targetPos = findHighGroundNearby(targetPos, game, 4); // 4 tiles radius

      // 2. Stop if in range
      const range = unit.getMaxRange();
      const inRangeOfAnyEnemy = visibleEnemies.some(
        (enemy) => unit.position.distanceTo(enemy.position) <= range
      );

      // If we are already in range, we might want to stay put 
      // instead of moving closer to the formation center.
      if (inRangeOfAnyEnemy) {
        targetPos = unit.position;
      }

      orders.push({
        id: unit.id,
        type: OrderType.Run,
        path: [targetPos.toArray()],
        rotation: direction.angle(),
      });

      // Target formation for artillery
      const targetFormation = "artillery";
      if (unit.currentFormation !== targetFormation) {
        formationChanges.push({
          unitId: unit.id,
          formationId: targetFormation,
        });
      }
    });
  }
}
