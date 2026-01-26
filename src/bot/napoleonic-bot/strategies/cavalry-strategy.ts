import { OrderType } from "@lob-sdk/types";
import { BaseUnit } from "@lob-sdk/unit";
import { NapoleonicBotStrategy, NapoleonicBotStrategyContext, INapoleonicBot } from "../types";
import { calculateFlankPositions, splitCavalry, sortUnitsAlongVector, calculatePath } from "../formation-utils";

/**
 * Strategy for cavalry: flank protection.
 */
export class CavalryStrategy implements NapoleonicBotStrategy {
  private static readonly UNIT_SPACING = 40;
  private static readonly LINE_SPACING = 32;
  private static readonly REAR_OFFSET = -160; // Behind infantry
  private static readonly CHARGE_ORG_THRESHOLD = 0.6;
  private static readonly MAX_CHARGE_DISTANCE = 600;
  private static readonly INFANTRY_LINE_RADIUS = 400;
  private _assignedUnitIds: string[] = [];

  constructor(private _bot: INapoleonicBot) {}

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
      game,
      2,
      CavalryStrategy.REAR_OFFSET
    );

    const getPriorityTarget = (unit: BaseUnit) => {
      let bestTarget: BaseUnit | null = null;
      let bestDist = Infinity;

      for (const enemy of visibleEnemies) {
        const dist = unit.position.distanceTo(enemy.position);
        if (dist > CavalryStrategy.MAX_CHARGE_DISTANCE) continue;

        const enemyGroup = this._bot.getGroup(enemy.category);
        let isPriority = false;

        // 1. Enemy cav near infantry line
        if (enemyGroup === "cavalry") {
          const distToFormation = enemy.position.distanceTo(formationCenter);
          if (distToFormation < CavalryStrategy.INFANTRY_LINE_RADIUS) {
            isPriority = true;
          }
        }

        // 2. Weak enemy infantry
        if (enemyGroup === "infantry" && enemy.getOrgProportion() <= CavalryStrategy.CHARGE_ORG_THRESHOLD) {
          isPriority = true;
        }

        if (isPriority && dist < bestDist) {
          bestDist = dist;
          bestTarget = enemy;
        }
      }
      return bestTarget;
    };

    cavalrySplit.left.forEach((unit, i) => {
      const priorityTarget = getPriorityTarget(unit);
      let targetPos = leftPositions[i];
      let orderType: OrderType = OrderType.Walk;
      let targetRotation = direction.angle();

      if (context.isRetreating) {
        orderType = OrderType.Fallback;
      } else if (priorityTarget) {
        targetPos = priorityTarget.position;
        orderType = OrderType.Run;
        targetRotation = targetPos.subtract(unit.position).angle();
      }

      if (!targetPos) return;
      orders.push({
        id: unit.id,
        type: orderType,
        path: calculatePath(
          unit.position,
          targetPos,
          unit,
          game,
          this._bot.getGameDataManager()
        ).map(p => p.toArray()),
        rotation: targetRotation,
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
      game,
      2,
      CavalryStrategy.REAR_OFFSET
    );

    cavalrySplit.right.forEach((unit, i) => {
      const priorityTarget = getPriorityTarget(unit);
      let targetPos = rightPositions[i];
      let orderType: OrderType = OrderType.Walk;
      let targetRotation = direction.angle();

      if (context.isRetreating) {
        orderType = OrderType.Fallback;
      } else if (priorityTarget) {
        targetPos = priorityTarget.position;
        orderType = OrderType.Run;
        targetRotation = targetPos.subtract(unit.position).angle();
      }

      if (!targetPos) return;
      orders.push({
        id: unit.id,
        type: orderType,
        path: calculatePath(
          unit.position,
          targetPos,
          unit,
          game,
          this._bot.getGameDataManager()
        ).map(p => p.toArray()),
        rotation: targetRotation,
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
