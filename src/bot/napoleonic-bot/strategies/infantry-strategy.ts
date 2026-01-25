import { OrderType } from "@lob-sdk/types";
import { BaseUnit } from "@lob-sdk/unit";
import { NapoleonicBotStrategy, NapoleonicBotStrategyContext } from "../types";
import { calculateLinePositions, splitIntoLines, sortUnitsAlongVector } from "../formation-utils";

/**
 * Strategy for infantry: multi-line formations with dynamic orders and formations.
 */
export class InfantryStrategy implements NapoleonicBotStrategy {
  private static readonly UNIT_SPACING = 48;
  private static readonly LINE_SPACING = 48;
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

    // Split infantry into at most 2 lines, ensuring each line has at least 10 units (priority)
    // and no line exceeds 50% of the total units.
    let unitsPerLine = sortedUnits.length;
    if (sortedUnits.length >= 20) {
      unitsPerLine = Math.ceil(sortedUnits.length / 2);
    }

    const infantryLines = splitIntoLines(sortedUnits, unitsPerLine);
    infantryLines.forEach((line, index) => {
      const targetPositions = calculateLinePositions(
        line,
        formationCenter,
        direction,
        perpendicular,
        -InfantryStrategy.LINE_SPACING * (index + 2), // Behind artillery
        InfantryStrategy.UNIT_SPACING,
        game,
      );

      line.forEach((unit, i) => {
        const targetPos = targetPositions[i];
        if (!targetPos) return;

        const range = unit.getMaxRange();
        const threshold = range * 2;

        const isEnemyNear = visibleEnemies.some(
          (e) => unit.position.distanceTo(e.position) <= threshold,
        );

        let orderType: OrderType = OrderType.Walk;
        let targetFormation = "line";

        if (isEnemyNear) {
          orderType = OrderType.FireAndAdvance;
          targetFormation = "line";
        } else {
          orderType = OrderType.Walk;
          targetFormation = "column";
        }

        orders.push({
          id: unit.id,
          type: orderType,
          path: [targetPos.toArray()],
          rotation: direction.angle(),
        });

        if (unit.currentFormation !== targetFormation) {
          formationChanges.push({
            unitId: unit.id,
            formationId: targetFormation,
          });
        }
      });
    });
  }
}
