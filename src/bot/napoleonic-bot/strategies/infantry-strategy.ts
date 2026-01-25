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

    // Split infantry into at most 2 lines
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

        const moveVector = targetPos.subtract(unit.position);
        const isMovingBackwards = moveVector.dot(direction) < 0;

        // --- Square Formation Logic ---
        const threatRadius = 250;
        const quadrants = [
          { name: "Front", vec: direction },
          { name: "Back", vec: direction.scale(-1) },
          { name: "Right", vec: perpendicular },
          { name: "Left", vec: perpendicular.scale(-1) },
        ];

        let threatenedSides = 0;
        const allUnits = game.getUnits();
        
        const isCoreUnit = (u: BaseUnit) => {
          // Accessing category directly as property (BaseUnit usually has it)
          const category = (u as any).category || "";
          return category.includes("infantry") || category.includes("cavalry");
        };

        for (const quad of quadrants) {
          const isEnemyInQuad = visibleEnemies.some(enemy => {
            const relPos = enemy.position.subtract(unit.position);
            return relPos.length() <= threatRadius && relPos.normalize().dot(quad.vec) > 0.707; // ~45 deg cone
          });

          if (isEnemyInQuad) {
            const isAllyProtecting = allUnits.some(ally => {
               if (ally.player !== unit.player || ally.id === unit.id) return false;
               if (!isCoreUnit(ally)) return false;
               const relPos = ally.position.subtract(unit.position);
               return relPos.length() <= threatRadius && relPos.normalize().dot(quad.vec) > 0.707;
            });

            if (!isAllyProtecting) {
              threatenedSides++;
            }
          }
        }

        let orderType: OrderType = OrderType.Walk;
        let targetFormation = "column";
        let finalPath = [targetPos.toArray()];

        if (threatenedSides >= 2) {
          targetFormation = "square";
          orderType = OrderType.Walk; // Keep walk but path is current position
          finalPath = [unit.position.toArray()];
        } else if (index === 0 && isEnemyNear) {
          // Only the first line (index 0) can form "line" if enemies are near.
          // Subsequent lines (reserves) always stay in "column".
          if (isMovingBackwards) {
            orderType = OrderType.Fallback;
          } else {
            orderType = OrderType.FireAndAdvance;
          }

          // TACO: Use "mass" for the ends of the first line for flank protection
          const isEdge = i === 0 || i === line.length - 1;
          targetFormation = isEdge ? "mass" : "line";
        } else {
          if (isEnemyNear && isMovingBackwards) {
            orderType = OrderType.Fallback;
          } else {
            orderType = OrderType.Walk;
          }
          targetFormation = "column";
        }

        orders.push({
          id: unit.id,
          type: orderType,
          path: finalPath,
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
