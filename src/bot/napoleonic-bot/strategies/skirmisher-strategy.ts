import { OrderType } from "@lob-sdk/types";
import { BaseUnit } from "@lob-sdk/unit";
import { NapoleonicBotStrategy, NapoleonicBotStrategyContext } from "../types";
import { calculateLinePositions, sortUnitsAlongVector } from "../formation-utils";

/**
 * Strategy for skirmishers: dynamic based on enemies and stamina.
 */
export class SkirmisherStrategy implements NapoleonicBotStrategy {
  private static readonly UNIT_SPACING = 40;
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
      perpendicular 
    } = context;

    if (units.length === 0) {
      this._assignedUnitIds = [];
      return;
    }

    // Check if the group composition changed
    const currentIds = units.map(u => String(u.id)).sort();
    const assignedIdsSorted = [...this._assignedUnitIds].sort();
    const compositionChanged = currentIds.length !== assignedIdsSorted.length || 
                                currentIds.some((id, i) => id !== assignedIdsSorted[i]);

    if (compositionChanged) {
      const sorted = sortUnitsAlongVector(units, perpendicular);
      this._assignedUnitIds = sorted.map(u => String(u.id));
    }

    // Map units to their fixed slots
    const sortedUnits = this._assignedUnitIds
      .map(id => units.find(u => String(u.id) === id))
      .filter((u): u is BaseUnit => u !== undefined);

    const targetPositions = calculateLinePositions(
      sortedUnits,
      formationCenter,
      direction,
      perpendicular,
      0, // Front line
      SkirmisherStrategy.UNIT_SPACING,
      game,
    );

    sortedUnits.forEach((unit, i) => {
      const targetPos = targetPositions[i];
      if (!targetPos) return;

      const range = unit.getMaxRange();
      const threshold = range * 2;

      const isEnemyNear = visibleEnemies.some(
        (e) => unit.position.distanceTo(e.position) <= threshold,
      );

      let orderType: OrderType = OrderType.Walk;

      if (isEnemyNear) {
        orderType = OrderType.FireAndAdvance;
      } else {
        const staminaProportion = unit.getStaminaProportion();
        if (staminaProportion >= 0.75) {
          orderType = OrderType.Run;
        } else {
          orderType = OrderType.Walk;
        }
      }

      orders.push({
        id: unit.id,
        type: orderType,
        path: [targetPos.toArray()],
        rotation: direction.angle(),
      });

      // Target formation for skirmishers
      const targetFormation = "skirmish";
      if (unit.currentFormation !== targetFormation) {
        formationChanges.push({
          unitId: unit.id,
          formationId: targetFormation,
        });
      }
    });
  }
}
