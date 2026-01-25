import { OrderType } from "@lob-sdk/types";
import { BaseUnit } from "@lob-sdk/unit";
import { NapoleonicBotStrategy, NapoleonicBotStrategyContext } from "../types";
import { calculateFlankPositions, splitCavalry, sortUnitsAlongVector } from "../formation-utils";

/**
 * Strategy for cavalry: flank protection.
 */
export class CavalryStrategy implements NapoleonicBotStrategy {
  private static readonly UNIT_SPACING = 40;
  private static readonly LINE_SPACING = 32;
  private _assignedUnitIds: string[] = [];

  assignOrders(
    units: BaseUnit[],
    context: NapoleonicBotStrategyContext,
  ): void {
    const { 
      game, 
      orders, 
      formationChanges, 
      formationCenter, 
      direction, 
      perpendicular, 
      mainBodyWidth 
    } = context;

    if (units.length === 0) {
      this._assignedUnitIds = [];
      return;
    }

    // Check composition
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

    const cavalrySplit = splitCavalry(sortedUnits);
    
    // Left Flank
    const leftPositions = calculateFlankPositions(
      cavalrySplit.left,
      formationCenter,
      direction,
      perpendicular,
      -mainBodyWidth / 2 - CavalryStrategy.UNIT_SPACING,
      CavalryStrategy.LINE_SPACING,
      game
    );

    cavalrySplit.left.forEach((unit, i) => {
      const targetPos = leftPositions[i];
      if (!targetPos) return;
      orders.push({
        id: unit.id,
        type: OrderType.Walk,
        path: [targetPos.toArray()],
        rotation: direction.angle(),
      });

      // Target formation for cavalry
      const targetFormation = "line";
      if (unit.currentFormation !== targetFormation) {
        formationChanges.push({
          unitId: unit.id,
          formationId: targetFormation,
        });
      }
    });

    // Right Flank
    const rightPositions = calculateFlankPositions(
      cavalrySplit.right,
      formationCenter,
      direction,
      perpendicular,
      mainBodyWidth / 2 + CavalryStrategy.UNIT_SPACING,
      CavalryStrategy.LINE_SPACING,
      game
    );

    cavalrySplit.right.forEach((unit, i) => {
      const targetPos = rightPositions[i];
      if (!targetPos) return;
      orders.push({
        id: unit.id,
        type: OrderType.Walk,
        path: [targetPos.toArray()],
        rotation: direction.angle(),
      });

      // Target formation for cavalry
      const targetFormation = "line";
      if (unit.currentFormation !== targetFormation) {
        formationChanges.push({
          unitId: unit.id,
          formationId: targetFormation,
        });
      }
    });
  }
}
