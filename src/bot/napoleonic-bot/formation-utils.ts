import { IServerGame } from "@lob-sdk/types";
import { BaseUnit } from "@lob-sdk/unit";
import { Vector2 } from "@lob-sdk/vector";

/**
 * Clamps a position to the map boundaries with a margin.
 */
export function clampToMap(pos: Vector2, game: IServerGame): Vector2 {
  const margin = 50;
  return new Vector2(
    Math.max(margin, Math.min(game.map.width - margin, pos.x)),
    Math.max(margin, Math.min(game.map.height - margin, pos.y)),
  );
}

/**
 * Splits an array of units into lines of a maximum size.
 */
export function splitIntoLines(units: BaseUnit[], maxPerLine: number): BaseUnit[][] {
  const lines: BaseUnit[][] = [];
  for (let i = 0; i < units.length; i += maxPerLine) {
    lines.push(units.slice(i, i + maxPerLine));
  }
  return lines;
}

/**
 * Splits cavalry units into left and right flanks.
 * Uses slice to maintain distance optimization if units are pre-sorted.
 */
export function splitCavalry(units: BaseUnit[]) {
  const mid = Math.floor(units.length / 2);
  return {
    left: units.slice(0, mid),
    right: units.slice(mid),
  };
}

/**
 * Calculates positions for units in a line and calls a callback for each.
 */
export function calculateLinePositions(
  units: BaseUnit[],
  center: Vector2,
  direction: Vector2,
  perpendicular: Vector2,
  forwardOffset: number,
  spacing: number,
  game: IServerGame,
): Vector2[] {
  if (units.length === 0) return [];

  const lineCenter = center.add(direction.scale(forwardOffset));
  const startOffset = -((units.length - 1) * spacing) / 2;

  return units.map((_, i) => {
    const pos = lineCenter.add(perpendicular.scale(startOffset + i * spacing));
    return clampToMap(pos, game);
  });
}

/**
 * Calculates positions for units on a flank and returns them.
 */
export function calculateFlankPositions(
  units: BaseUnit[],
  center: Vector2,
  direction: Vector2,
  perpendicular: Vector2,
  sideOffset: number,
  spacing: number,
  game: IServerGame,
  maxRows: number = 2,
): Vector2[] {
  if (units.length === 0) return [];

  const unitsPerLine = Math.ceil(units.length / maxRows);
  const flankStart = center.add(perpendicular.scale(sideOffset));

  return units.map((_, i) => {
    const row = Math.floor(i / unitsPerLine);
    const col = i % unitsPerLine;

    const lateralDirection = sideOffset > 0 ? 1 : -1;
    const lateralOffset = col * spacing * lateralDirection;

    const pos = flankStart
      .add(perpendicular.scale(lateralOffset))
      .subtract(direction.scale(row * spacing));

    return clampToMap(pos, game);
  });
}

/**
 * Sorts units along a given vector (e.g. the perpendicular of a line).
 * Uses position projection and unit ID tie-breaking for perfect determinism.
 */
export function sortUnitsAlongVector(units: BaseUnit[], vector: Vector2): BaseUnit[] {
  const normVec = vector.normalize();

  return [...units].sort((a, b) => {
    const projA = a.position.dot(normVec);
    const projB = b.position.dot(normVec);

    if (Math.abs(projA - projB) < 1) {
      return String(a.id).localeCompare(String(b.id));
    }

    return projA - projB;
  });
}
