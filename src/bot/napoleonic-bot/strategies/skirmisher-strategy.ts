import { OrderType, TerrainCategoryType } from "@lob-sdk/types";
import { BaseUnit } from "@lob-sdk/unit";
import { NapoleonicBotStrategy, NapoleonicBotStrategyContext, INapoleonicBot } from "../types";
import { calculateLinePositions, sortUnitsAlongVector, findCoverNearby, calculatePath } from "../formation-utils";

/**
 * Strategy for skirmishers: dynamic based on enemies and stamina.
 */
export class SkirmisherStrategy implements NapoleonicBotStrategy {
  private static readonly UNIT_SPACING = 40;
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

    const gameDataManager = this._bot.getGameDataManager();

    sortedUnits.forEach((unit, i) => {
      const range = unit.getMaxRange();
      const threshold = range;

      const nearbyEnemies = visibleEnemies.filter(
        (e) => unit.position.distanceTo(e.position) <= threshold,
      );

      if (context.isRetreating) {
        let targetPos = targetPositions[i];
        if (!targetPos) return;

        orders.push({
          id: unit.id,
          type: OrderType.Fallback,
          path: calculatePath(
            unit.position,
            targetPos,
            unit,
            game,
            gameDataManager
          ).map(p => p.toArray()),
          rotation: direction.angle(),
        });
      } else if (nearbyEnemies.length > 0) {
        // Find closest enemy for general targeting
        const closestEnemy = nearbyEnemies.reduce((prev, curr) => 
          unit.position.distanceTo(curr.position) < unit.position.distanceTo(prev.position) ? curr : prev
        );

        // Check if unit is in cover
        const terrain = game.getUnitTerrain(unit);
        const terrainCategory = gameDataManager.getCategoryByTerrain(terrain);
        const isInCover = terrainCategory === TerrainCategoryType.Forest || 
                          terrainCategory === TerrainCategoryType.Building;

        if (isInCover) {
          // Stay where you are and shoot if in cover
          orders.push({
            id: unit.id,
            type: OrderType.Shoot,
            targetId: closestEnemy.id,
          });
        } else {
          // If not in cover, use Fallback Follow order on the closest "core" enemy (non-skirmisher)
          const coreEnemies = nearbyEnemies.filter(e => e.category !== "skirmishInfantry");
          const fallbackTarget = coreEnemies.length > 0 
            ? coreEnemies.reduce((prev, curr) => 
                unit.position.distanceTo(curr.position) < unit.position.distanceTo(prev.position) ? curr : prev
              )
            : closestEnemy;

          orders.push({
            id: unit.id,
            type: OrderType.Fallback,
            targetId: fallbackTarget.id,
          });
        }
      } else {
        // No enemies near, normal movement to assigned slot
        let targetPos = targetPositions[i];
        if (!targetPos) return;

        // Prefers cover (forests, buildings) if nearby
        targetPos = findCoverNearby(targetPos, game, 4); // 4 tiles radius

        const staminaProportion = unit.getStaminaProportion();
        const orderType = staminaProportion >= 0.75 ? OrderType.Run : OrderType.Walk;

        orders.push({
          id: unit.id,
          type: orderType,
          path: calculatePath(
            unit.position,
            targetPos,
            unit,
            game,
            gameDataManager
          ).map(p => p.toArray()),
          rotation: direction.angle(),
        });
      }

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
