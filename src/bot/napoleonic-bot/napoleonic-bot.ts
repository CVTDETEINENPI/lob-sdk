import { IBot, OnBotPlayScript } from "../types";
import { Vector2 } from "@lob-sdk/vector";
import { OrderType, AnyOrder, TurnSubmission, IServerGame } from "@lob-sdk/types";
import { GameDataManager } from "@lob-sdk/game-data-manager";
import { BaseUnit } from "@lob-sdk/unit";

/**
 * A bot implementation for Napoleonic era gameplay.
 * Uses unit grouping and strategic decision-making to control units.
 */
export class NapoleonicBot implements IBot {
  /** The team number this bot belongs to. */
  public team: number;
  private onBotPlayScript: OnBotPlayScript | null = null;
  private scriptName: string | null = null;

  /**
   * Creates a new BotNapoleonic instance.
   * @param gameDataManager - The game data manager instance.
   * @param game - The server game instance.
   * @param playerNumber - The player number this bot controls.
   */
  constructor(
    private gameDataManager: GameDataManager,
    private game: IServerGame,
    private playerNumber: number,
  ) {
    this.team = this.game.getPlayerTeam(this.playerNumber);
  }

  /**
   * Sets a custom bot play script that overrides the default bot behavior.
   * @param onBotPlayScript - The custom script function.
   * @param scriptName - Optional name for the script.
   */
  setOnBotPlayScript(onBotPlayScript: OnBotPlayScript, scriptName?: string) {
    this.onBotPlayScript = onBotPlayScript;
    this.scriptName = scriptName || null;
  }

  /**
   * Gets the name of the currently set bot script, if any.
   * @returns The script name, or null if no custom script is set.
   */
  getScriptName(): string | null {
    return this.scriptName;
  }

  /**
   * Executes the bot's turn, generating orders for all controlled units.
   * @returns A promise that resolves to the turn submission with orders.
   */
  /**
   * Executes the bot's turn, generating orders for all controlled units.
   * @returns A promise that resolves to the turn submission with orders.
   */
  async play(): Promise<TurnSubmission> {
    if (this.onBotPlayScript) {
      try {
        const result = await this.onBotPlayScript(this.game, this.playerNumber);

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

    const myUnits = this.getMyUnits();
    const enemies = this.getEnemyUnits();

    const turnSubmission: TurnSubmission = {
      turn: this.game.turnNumber,
      orders: [],
      autofireConfigChanges: [],
      formationChanges: [],
    };

    if (myUnits.length === 0) {
      return turnSubmission;
    }

    // 1. Determine direction towards enemy
    let targetPos: Vector2;
    if (enemies.length > 0) {
      const enemyCentroid = Vector2.center(
        enemies.map((u: BaseUnit) => u.position),
      );
      targetPos = enemyCentroid;
    } else {
      // If no visible enemies, just stay or move towards map center?
      // For now, let's just stay put or move to map center if map is available
      const mapCenter = new Vector2(
        this.game.map.width / 2,
        this.game.map.height / 2,
      );
      targetPos = mapCenter;
    }

    const myCentroid = Vector2.center(
      myUnits.map((u: BaseUnit) => u.position),
    );
    const direction = targetPos.subtract(myCentroid).normalize();
    if (direction.isZero()) {
      return turnSubmission; // Already at target?
    }

    const perpendicular = direction.perp();
    const forwardAngle = direction.angle();

    // 2. Group units by category
    const groups = this.groupUnits(myUnits);

    // Advance Logic: base the formation center on the furthest skirmisher in the direction of the enemy
    // If no skirmishers, use the front-most unit overall.
    const referenceUnits =
      groups.skirmishers.length > 0 ? groups.skirmishers : myUnits;

    // Calculate projections relative to myCentroid
    const projections = referenceUnits.map((u: BaseUnit) =>
      u.position.subtract(myCentroid).dot(direction),
    );
    const armyFront = Math.max(...projections);
    const advanceDistance = 64; // Requested distance
    const formationCenter = myCentroid.add(
      direction.scale(armyFront + advanceDistance),
    );

    // 3. Define spacing
    const unitSpacing = 40; // Distance between units in a line
    const lineSpacing = 32; // Distance between lines

    // 4. Calculate positions for each group
    const orders: AnyOrder[] = [];

    // Line 1: Skirmishers
    this.assignPositionsToLine(
      groups.skirmishers,
      formationCenter,
      direction,
      perpendicular,
      0, // First line
      unitSpacing,
      forwardAngle,
      orders,
      OrderType.Walk,
    );

    // Line 2: Artillery
    this.assignPositionsToLine(
      groups.artillery,
      formationCenter,
      direction,
      perpendicular,
      -lineSpacing, // Second line (behind skirmishers)
      unitSpacing * 1.5,
      forwardAngle,
      orders,
      OrderType.Run,
    );

    // Line 3 & 4: Infantry
    const infantryLines = this.splitIntoLines(groups.infantry, 10); // Max 10 units per line
    infantryLines.forEach((line, index) => {
      this.assignPositionsToLine(
        line,
        formationCenter,
        direction,
        perpendicular,
        -lineSpacing * (index + 2), // Behind artillery
        unitSpacing,
        forwardAngle,
        orders,
      );
    });

    // Flanks: Cavalry
    const cavalrySplit = this.splitCavalry(groups.cavalry);
    const mainBodyWidth =
      Math.max(
        groups.skirmishers.length,
        groups.artillery.length,
        infantryLines.length > 0 ? infantryLines[0].length : 0,
      ) * unitSpacing;

    this.assignPositionsToFlank(
      cavalrySplit.left,
      formationCenter,
      direction,
      perpendicular,
      -mainBodyWidth / 2 - unitSpacing, // Left flank
      lineSpacing,
      forwardAngle,
      orders,
    );

    this.assignPositionsToFlank(
      cavalrySplit.right,
      formationCenter,
      direction,
      perpendicular,
      mainBodyWidth / 2 + unitSpacing, // Right flank
      lineSpacing,
      forwardAngle,
      orders,
    );

    turnSubmission.orders = orders;

    // Optional: add formation changes if needed (e.g. skirmishers to skirmish formation)
    myUnits.forEach((unit: BaseUnit) => {
      const category = this.gameDataManager.getUnitTemplateManager().getTemplate(
        unit.type,
      ).category;
      let targetFormation = "";
      if (category === "skirmishInfantry") targetFormation = "skirmish";
      else if (category === "artillery") targetFormation = "artillery";
      else if (category === "infantry" || category === "militiaInfantry")
        targetFormation = "line";

      if (targetFormation && unit.currentFormation !== targetFormation) {
        turnSubmission.formationChanges!.push({
          unitId: unit.id,
          formationId: targetFormation,
        });
      }
    });

    return turnSubmission;
  }

  private groupUnits(units: BaseUnit[]) {
    const skirmishers: BaseUnit[] = [];
    const artillery: BaseUnit[] = [];
    const infantry: BaseUnit[] = [];
    const cavalry: BaseUnit[] = [];

    units.forEach((unit) => {
      const category = this.gameDataManager.getUnitTemplateManager().getTemplate(
        unit.type,
      ).category;

      if (category === "skirmishInfantry") {
        skirmishers.push(unit);
      } else if (category === "artillery") {
        artillery.push(unit);
      } else if (category === "infantry" || category === "militiaInfantry") {
        infantry.push(unit);
      } else if (
        category === "lightCavalry" ||
        category === "midCavalry" ||
        category === "heavyCavalry" ||
        category === "scoutCavalry"
      ) {
        cavalry.push(unit);
      }
    });

    return { skirmishers, artillery, infantry, cavalry };
  }

  private assignPositionsToLine(
    units: BaseUnit[],
    center: Vector2,
    direction: Vector2,
    perpendicular: Vector2,
    forwardOffset: number,
    spacing: number,
    angle: number,
    orders: AnyOrder[],
    orderType: OrderType.Walk | OrderType.Run | OrderType.Fallback | OrderType.FireAndAdvance = OrderType.Walk,
  ) {
    if (units.length === 0) return;

    const lineCenter = center.add(direction.scale(forwardOffset));
    const startOffset = -((units.length - 1) * spacing) / 2;

    units.forEach((unit, i) => {
      const pos = lineCenter.add(
        perpendicular.scale(startOffset + i * spacing),
      );
      const clampedPos = this.clampToMap(pos);
      orders.push({
        id: unit.id,
        type: orderType,
        path: [clampedPos.toArray()],
        rotation: angle,
      } as any);
    });
  }

  private assignPositionsToFlank(
    units: BaseUnit[],
    center: Vector2,
    direction: Vector2,
    perpendicular: Vector2,
    sideOffset: number,
    spacing: number,
    angle: number,
    orders: AnyOrder[],
  ) {
    if (units.length === 0) return;

    const flankStart = center.add(perpendicular.scale(sideOffset));

    units.forEach((unit: BaseUnit, i: number) => {
      const pos = flankStart.subtract(direction.scale(i * spacing));
      const clampedPos = this.clampToMap(pos);
      orders.push({
        id: unit.id,
        type: OrderType.Walk,
        path: [clampedPos.toArray()],
        rotation: angle,
      });
    });
  }

  private clampToMap(pos: Vector2): Vector2 {
    const margin = 50; // Keep units away from the very edge
    return new Vector2(
      Math.max(margin, Math.min(this.game.map.width - margin, pos.x)),
      Math.max(margin, Math.min(this.game.map.height - margin, pos.y)),
    );
  }

  private splitIntoLines(units: BaseUnit[], maxPerLine: number): BaseUnit[][] {
    const lines: BaseUnit[][] = [];
    for (let i = 0; i < units.length; i += maxPerLine) {
      lines.push(units.slice(i, i + maxPerLine));
    }
    return lines;
  }

  private splitCavalry(units: BaseUnit[]) {
    const left: BaseUnit[] = [];
    const right: BaseUnit[] = [];
    units.forEach((unit: BaseUnit, i: number) => {
      if (i % 2 === 0) left.push(unit);
      else right.push(unit);
    });
    return { left, right };
  }

  private getMyUnits() {
    return this.game
      .getUnits()
      .filter((unit) => unit.player === this.playerNumber);
  }

  private getEnemyUnits() {
    // Use fog of war filtered method to only see visible enemy units
    return this.game.getVisibleEnemyUnits(this.playerNumber);
  }

  private _getTerrainCost(movementModifier: number) {
    // Calculate speed factor: 1 is base speed, +modifier increases it, -modifier decreases it
    const speedFactor = 1 + movementModifier; // e.g., +0.5 -> 1.5, -0.5 -> 0.5

    // Cost is inverse of speed: faster = lower cost, slower = higher cost
    const cost = 1 / speedFactor;

    // Round to nearest integer, but allow fractional costs for positive modifiers
    return cost;
  }

  /**
   * Gets the player number this bot controls.
   * @returns The player number.
   */
  getPlayerNumber(): number {
    return this.playerNumber;
  }

  /**
   * Gets the team number this bot belongs to.
   * @returns The team number.
   */
  getTeam(): number {
    return this.team;
  }
}
