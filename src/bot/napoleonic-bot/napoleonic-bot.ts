import { OnBotPlayScript } from "../types";
import { Vector2 } from "@lob-sdk/vector";
import {
  AnyOrder,
  TurnSubmission,
  IServerGame,
  UnitFormationChange,
  ObjectiveType,
} from "@lob-sdk/types";
import { GameDataManager } from "@lob-sdk/game-data-manager";
import { BaseUnit } from "@lob-sdk/unit";
import {
  NapoleonicBotStrategyContext,
  INapoleonicBot,
} from "./types";
import { EntityId } from "@lob-sdk/types";
import { splitIntoLines } from "./formation-utils";
import { medianPoint } from "../../utils/utils";
import { ArmyGroup } from "./army-group";

/**
 * A bot implementation for Napoleonic era gameplay.
 * Uses unit grouping and strategic decision-making to control units.
 */
export class NapoleonicBot implements INapoleonicBot {
  private _onBotPlayScript: OnBotPlayScript | null = null;
  private _scriptName: string | null = null;
  private _team: number;

  private _armyGroups: ArmyGroup[] = [];

  /**
   * Static mapping of unit categories to bot formation groups.
   * @param gameDataManager - The game data manager instance.
   * @param game - The server game instance.
   * @param playerNumber - The player number this bot controls.
   */
  constructor(
    private _gameDataManager: GameDataManager,
    private _game: IServerGame,
    private _playerNumber: number,
  ) {
    this._team = this._game.getPlayerTeam(this._playerNumber);
  }

  /**
   * Sets a custom bot play script that overrides the default bot behavior.
   * @param onBotPlayScript - The custom script function.
   * @param scriptName - Optional name for the script.
   */
  setOnBotPlayScript(onBotPlayScript: OnBotPlayScript, scriptName?: string) {
    this._onBotPlayScript = onBotPlayScript;
    this._scriptName = scriptName || null;
  }

  /**
   * Gets the name of the currently set bot script, if any.
   * @returns The script name, or null if no custom script is set.
   */
  getScriptName(): string | null {
    return this._scriptName;
  }

  /**
   * Executes the bot's turn, generating orders for all controlled units.
   * @returns A promise that resolves to the turn submission with orders.
   */
  async play(): Promise<TurnSubmission> {
    if (this._onBotPlayScript) {
      try {
        const result = await this._onBotPlayScript(
          this._game,
          this._playerNumber,
        );

        if (result) {
          /**
           * If the custom bot script returns a turn submission,
           * use it instead of the default bot behavior.
           */
          return result;
        }
      } catch (error) {
        console.error("Error executing custom bot script:", error);
        // Fall back to default bot behavior on error
      }
    }

    const myUnits = this._getMyUnits();
    const enemies = this._getEnemyUnits();

    const turnSubmission: TurnSubmission = {
      turn: this._game.turnNumber,
      orders: [],
      autofireConfigChanges: [],
      formationChanges: [],
    };

    if (myUnits.length === 0) {
      return turnSubmission;
    }

    this._maintainArmyGroups(myUnits);

    // Determine if we should retreat based on VP
    const myTeamVp = this._game.getTeamVictoryPoints(this._team);
    const teams = new Set<number>();
    this._game.getPlayers().forEach((p) => {
      teams.add(this._game.getPlayerTeam(p.playerNumber));
    });

    let totalVp = 0;
    teams.forEach((t) => {
      totalVp += this._game.getTeamVictoryPoints(t);
    });
    const avgVp = totalVp / (teams.size || 1);

    // Determine if we should retreat or advance aggressively based on average VP
    // Retreat: 20% less than the average. Advance: 25% more than the average.
    const isLosingBadly = myTeamVp <= avgVp * 0.8;
    const isWinningBig = myTeamVp >= avgVp * 1.25;

    const orders: AnyOrder[] = [];
    const formationChanges: UnitFormationChange[] = [];

    this._armyGroups.forEach(armyGroup => {
      const groupUnits = myUnits.filter(u => armyGroup.hasUnit(u.id));
      if (groupUnits.length === 0) return;

      let targetObjectivePos: Vector2 | null = null;
      let enemyBigObjectivePos: Vector2 | null = null;

      const myCentroid = Vector2.fromPoint(
        medianPoint(groupUnits.map((u: BaseUnit) => u.position))
      );

      const enemyBigObjective = this.getClosestEnemyBigObjective(myCentroid);
      if (enemyBigObjective) {
        enemyBigObjectivePos = enemyBigObjective.position;
      }

      if (isLosingBadly) {
        // Find our own big objective to retreat to
        const bigObjective = this.getClosestAllyBigObjective(myCentroid);
        if (bigObjective) {
          targetObjectivePos = bigObjective.position;
        }
      } else if (isWinningBig) {
        // Find the best enemy's big objective to advance to
        const enemyBigObj = this.getClosestEnemyBigObjective(myCentroid);
        if (enemyBigObj) {
          targetObjectivePos = enemyBigObj.position;
        }
      }

      // Determine direction towards enemy (always face the target)
      let enemyTargetPos: Vector2;
      if (isWinningBig && targetObjectivePos) {
        enemyTargetPos = targetObjectivePos;
      } else if (enemies.length > 0) {
        enemyTargetPos = Vector2.fromPoint(
          medianPoint(enemies.map((u: BaseUnit) => u.position))
        );
      } else {
        enemyTargetPos = new Vector2(
          this._game.map.width / 2,
          this._game.map.height / 2,
        );
      }

      const direction = enemyTargetPos.subtract(myCentroid).normalize();
      if (direction.isZero()) {
        return;
      }

      const perpendicular = direction.perp();
      const forwardAngle = direction.angle();

      // 2. Group units by category
      const groups = this._groupUnits(groupUnits);

      // 3. Determine formation center
      let formationCenter: Vector2;
      if (isLosingBadly && targetObjectivePos) {
        // If retreating, the formation center is offset forward so the rear (at ~160) is at the objective
        const rearDepth = 160;
        formationCenter = targetObjectivePos.add(direction.scale(rearDepth));
      } else if (isWinningBig && targetObjectivePos) {
        // If winning big, the formation center is directly the enemy objective (aggressive advance)
        formationCenter = targetObjectivePos;
      } else {
        // Advance Logic: base the formation center on the furthest skirmisher in the direction of the enemy
        const referenceUnits =
          groups.skirmishers.length > 0 ? groups.skirmishers : groupUnits;

        const projections = referenceUnits.map((u: BaseUnit) =>
          u.position.subtract(myCentroid).dot(direction),
        );
        const armyFront = Math.max(...projections);
        
        formationCenter = this.calculateAdvanceFormationCenter(
          myCentroid,
          direction,
          armyFront,
          groupUnits,
          groups,
        );
      }

      // 4. Calculate positions for each group via strategies
      const infantryLines = splitIntoLines(groups.infantry, 10);
      const mainBodyWidth =
        Math.max(
          groups.skirmishers.length,
          groups.artillery.length,
          infantryLines.length > 0 ? infantryLines[0].length : 0,
        ) * 40; // Default unit spacing for width calculation

      const strategyContext: NapoleonicBotStrategyContext = {
        game: this._game,
        visibleEnemies: enemies,
        allyUnits: myUnits, // passing all global units for threat detection
        orders,
        formationChanges,
        formationCenter,
        direction,
        perpendicular,
        mainBodyWidth,
        forwardAngle,
        isRetreating: isLosingBadly,
        closestEnemyObjectivePos: enemyBigObjectivePos,
      };

      armyGroup.strategies.skirmishers.assignOrders(groups.skirmishers, strategyContext);
      armyGroup.strategies.artillery.assignOrders(groups.artillery, strategyContext);
      armyGroup.strategies.infantry.assignOrders(groups.infantry, strategyContext);
      armyGroup.strategies.cavalry.assignOrders(groups.cavalry, strategyContext);
    });

    turnSubmission.orders = orders;
    turnSubmission.formationChanges = formationChanges;

    return turnSubmission;
  }

  private _maintainArmyGroups(units: BaseUnit[]) {
    const DISTANCE_THRESHOLD = 160;

    const currentUnitMap = new Map<EntityId, BaseUnit>();
    units.forEach(u => currentUnitMap.set(u.id, u));

    this._armyGroups.forEach((group) => {
      for (const id of group.getUnits()) {
        if (!currentUnitMap.has(id)) {
          group.removeUnit(id);
        }
      }
    });

    this._armyGroups = this._armyGroups.filter(g => g.size > 0);

    const assignedUnitIds = new Set<EntityId>();
    this._armyGroups.forEach((group) => {
      group.getUnits().forEach((id) => assignedUnitIds.add(id));
    });
    const unassignedUnits = units.filter((u) => !assignedUnitIds.has(u.id));

    if (unassignedUnits.length === 0) return;

    const stillUnassigned: BaseUnit[] = [];
    unassignedUnits.forEach(unit => {
      let joined = false;
      for (const group of this._armyGroups) {
        const groupUnits = group.getUnits().map(id => currentUnitMap.get(id)).filter(u => u !== undefined) as BaseUnit[];
        const isClose = groupUnits.some(gu => gu.position.distanceTo(unit.position) <= DISTANCE_THRESHOLD);
        if (isClose) {
          group.addUnit(unit.id);
          joined = true;
          break;
        }
      }
      if (!joined) {
        stillUnassigned.push(unit);
      }
    });

    if (stillUnassigned.length > 0) {
      const clusters: BaseUnit[][] = [];
      const visited = new Set<EntityId>();

      stillUnassigned.forEach(unit => {
        if (visited.has(unit.id)) return;

        const cluster: BaseUnit[] = [];
        const queue: BaseUnit[] = [unit];
        visited.add(unit.id);

        while (queue.length > 0) {
          const current = queue.shift()!;
          cluster.push(current);

          stillUnassigned.forEach(other => {
            if (!visited.has(other.id) && current.position.distanceTo(other.position) <= DISTANCE_THRESHOLD) {
              visited.add(other.id);
              queue.push(other);
            }
          });
        }
        clusters.push(cluster);
      });

      clusters.forEach(cluster => {
        const group = new ArmyGroup(this);
        cluster.forEach(u => group.addUnit(u.id));
        this._armyGroups.push(group);
      });
    }
  }

  private _groupUnits(units: BaseUnit[]) {
    const groups: Record<string, BaseUnit[]> = {
      skirmishers: [],
      artillery: [],
      infantry: [],
      cavalry: [],
    };

    units.forEach((unit) => {
      const category = this._gameDataManager
        .getUnitTemplateManager()
        .getTemplate(unit.type).category;

      const groupName = this.getGroup(category);
      if (groupName && groups[groupName]) {
        groups[groupName].push(unit);
      }
    });

    return {
      skirmishers: groups.skirmishers,
      artillery: groups.artillery,
      infantry: groups.infantry,
      cavalry: groups.cavalry,
    };
  }

  private _getMyUnits() {
    return this._game
      .getUnits()
      .filter((unit) => unit.player === this._playerNumber);
  }

  private _getEnemyUnits() {
    // Use fog of war filtered method to only see visible enemy units
    return this._game.getVisibleEnemyUnits(this._playerNumber);
  }

  /**
   * Gets the high-level group name for a given unit category.
   * @param categoryId - The unit category ID.
   * @returns The group name (e.g., "infantry", "cavalry").
   */
  getGroup(categoryId: string): string {
    return NapoleonicBot._CATEGORY_TO_GROUP[categoryId] || "";
  }

  /**
   * Gets the player number this bot controls.
   * @returns The player number.
   */
  getPlayerNumber(): number {
    return this._playerNumber;
  }

  /**
   * Gets the game data manager instance.
   */
  getGameDataManager(): GameDataManager {
    return this._gameDataManager;
  }

  /**
   * Gets the team number this bot belongs to.
   * @returns The team number.
   */
  getTeam(): number {
    return this._team;
  }

  getClosestAllyBigObjective(position: Vector2) {
    const objectives = this._game
      .getObjectives()
      .filter((o) => o.team === this._team && o.type === ObjectiveType.Big);

    if (objectives.length === 0) return null;

    return objectives.reduce((prev, curr) => {
      const prevDist = position.squaredDistanceTo(prev.position);
      const currDist = position.squaredDistanceTo(curr.position);
      return currDist < prevDist ? curr : prev;
    });
  }

  getClosestEnemyBigObjective(position: Vector2) {
    const objectives = this._game
      .getObjectives()
      .filter((o) => o.team !== this._team && o.type === ObjectiveType.Big);

    if (objectives.length === 0) return null;

    return objectives.reduce((prev, curr) => {
      const prevDist = position.squaredDistanceTo(prev.position);
      const currDist = position.squaredDistanceTo(curr.position);
      return currDist < prevDist ? curr : prev;
    });
  }

  private static readonly _CATEGORY_TO_GROUP: Record<string, string> = {
    skirmishInfantry: "skirmishers",
    artillery: "artillery",
    infantry: "infantry",
    militiaInfantry: "infantry",
    lightCavalry: "cavalry",
    midCavalry: "cavalry",
    heavyCavalry: "cavalry",
    scoutCavalry: "cavalry",
  };

  public calculateAdvanceFormationCenter(
    myCentroid: Vector2,
    direction: Vector2,
    armyFront: number,
    groupUnits: BaseUnit[],
    groups: Record<string, BaseUnit[]>,
  ): Vector2 {
    let advanceDistance = 64;
    if (groupUnits.length > 0) {
      advanceDistance = Math.min(
        ...groupUnits.map((u) => {
          const category = this._gameDataManager
            .getUnitTemplateManager()
            .getTemplate(u.type).category;
          const groupName = this.getGroup(category);

          if (groupName === "artillery") {
            return u.runMovement || u.walkMovement;
          } else if (groupName === "skirmishers") {
            return u.getStaminaProportion() >= 0.75
              ? u.runMovement || u.walkMovement
              : u.walkMovement;
          }
          return u.walkMovement;
        }),
      );
      advanceDistance = Math.min(advanceDistance, 48);
    }
    let anchorOffset = 0;
    if (groups.infantry.length > 0) anchorOffset = 96;
    else if (groups.artillery.length > 0) anchorOffset = 32;
    else if (groups.cavalry.length > 0) anchorOffset = 160;

    return myCentroid.add(
      direction.scale(armyFront + advanceDistance + anchorOffset),
    );
  }
}
