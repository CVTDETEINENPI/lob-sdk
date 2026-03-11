import {
  ProceduralScenario,
  InstructionNaturalPath,
  TerrainType,
  Size,
  Range,
  PathPoint,
} from "@lob-sdk/types";
import { deriveSeed, randomSeeded } from "@lob-sdk/seed";
import { NaturalPathGenerator } from "../natural-path-generator";
import { Point2 } from "@lob-sdk/vector";
import { getRandomInt, setHeightRecursively } from "@lob-sdk/utils";

const TOP_EDGE: Range = { min: 0, max: 0 };
const BOTTOM_EDGE: Range = { min: 100, max: 100 };
const LEFT_EDGE: Range = { min: 0, max: 0 };
const RIGHT_EDGE: Range = { min: 100, max: 100 };

export class NaturalPathExecutor {
  private random: () => number;

  constructor(
    private instruction: InstructionNaturalPath,
    private scenario: ProceduralScenario,
    private seed: number,
    private index: number,
    private terrains: TerrainType[][],
    private heightMap: number[][],
    private battleSize: Size,
  ) {
    this.random = randomSeeded(deriveSeed(seed, index + 1));
  }

  execute() {
    const amount = this.instruction.amount;
    const amountNumber = getRandomInt(
      amount.min * (amount.min_scaling_factor?.[this.battleSize] ?? 1),
      amount.max * (amount.max_scaling_factor?.[this.battleSize] ?? 1),
      this.random,
    );

    const { random, terrains, heightMap } = this;
    const {
      width,
      terrainReplacements,
      terrainCosts,
      terrain,
      height,
      curveLen,
      curveWeight,
      noiseWeight,
      noiseSmoothness,
      edgeDistance,
      edgeWeight,
      uphillHeightCost,
      downHillHeightCost,
      heightDiffCost, // deprecated
    } = this.instruction;

    const naturalPathGenerator = new NaturalPathGenerator(
      random,
      terrains,
      heightMap,
      terrain,
      height,
      width,
      terrainReplacements,
      terrainCosts,
      curveLen,
      curveWeight,
      noiseWeight,
      noiseSmoothness,
      edgeDistance,
      edgeWeight,
      uphillHeightCost,
      downHillHeightCost,
      heightDiffCost,
    );

    for (let i = 0; i < amountNumber; i++) {
      let pathPoints = this.generatePathPoints();

      for (let i = 0; i < pathPoints.length - 1; i++) {
        naturalPathGenerator.generatePath(pathPoints[i], pathPoints[i + 1]);
      }
    }
  }

  private generatePathPoints() {
    let start, end;

    const {
      between,
      range = { min: 40, max: 60 },
      midPoints,
      startHeightRanges,
      endHeightRanges,
    } = this.instruction;

    if (between === "edges") {
      const edgeRanges = this.getRandomEdgeRanges(range);
      start = this.findValidPointWithHeightFilter(
        edgeRanges.start.xRange,
        edgeRanges.start.yRange,
        startHeightRanges,
      );
      end = this.findValidPointWithHeightFilter(
        edgeRanges.end.xRange,
        edgeRanges.end.yRange,
        endHeightRanges,
      );
    } else if (between === "points") {
      // do nothing
    } else {
      let startRanges, endRanges;
      ({ start: startRanges, end: endRanges } = (() => {
        switch (between) {
          case "top-bottom":
            return {
              start: { x: range, y: TOP_EDGE },
              end: { x: range, y: BOTTOM_EDGE },
            };
          case "left-right":
            return {
              start: { x: LEFT_EDGE, y: range },
              end: { x: RIGHT_EDGE, y: range },
            };
          case "left-top":
            return {
              start: { x: LEFT_EDGE, y: range },
              end: { x: range, y: TOP_EDGE },
            };
          case "left-bottom":
            return {
              start: { x: LEFT_EDGE, y: range },
              end: { x: range, y: BOTTOM_EDGE },
            };
          case "right-top":
            return {
              start: { x: range, y: TOP_EDGE },
              end: { x: RIGHT_EDGE, y: range },
            };
          case "right-bottom":
            return {
              start: { x: RIGHT_EDGE, y: range },
              end: { x: range, y: BOTTOM_EDGE },
            };
          default: // something went wrong, just pick a random point
            return {
              start: { x: range, y: range },
              end: { x: range, y: range },
            };
        }
      })());

      start = this.findValidPointWithHeightFilter(
        startRanges.x,
        startRanges.y,
        startHeightRanges,
      );
      end = this.findValidPointWithHeightFilter(
        endRanges.x,
        endRanges.y,
        endHeightRanges,
      );
    }

    const pathPoints = [
      ...(start ? [start] : []),
      ...this.generateMidpoints(midPoints ?? []),
      ...(end ? [end] : []),
    ];

    return pathPoints;
  }

  /**
   * Find a valid point that satisfies the height range in the specified area
   * @param originalPoint The original point to search around
   * @param heightRanges Array of height ranges to check against
   * @param between The path direction type
   * @param tilesX Map width in tiles
   * @param tilesY Map height in tiles
   * @returns A valid point or null if none found
   */
  private findValidPointWithHeightFilter(
    xRange: Range,
    yRange: Range,
    heightRanges?: Array<{ min: number; max: number }>,
  ): Point2 | null {
    const tilesX = this.terrains.length;
    const tilesY = this.terrains[0].length;

    const minX = Math.round((xRange.min / 100) * (tilesX - 1));
    const maxX = Math.round((xRange.max / 100) * (tilesX - 1));
    const minY = Math.round((yRange.min / 100) * (tilesY - 1));
    const maxY = Math.round((yRange.max / 100) * (tilesY - 1));

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Random starting offsets
    const xOffset = minX + Math.round(this.random() * width);
    const yOffset = minY + Math.round(this.random() * height);

    // Randomize directions: +1 (forward) or -1 (backward)
    const xStep = this.random() < 0.5 ? 1 : -1;
    const yStep = this.random() < 0.5 ? 1 : -1;

    // Randomize axis order
    const xFirst = this.random() < 0.5;
    if (xFirst) {
      for (let dx = 0; dx < width; dx++) {
        const x = minX + ((xOffset + dx * xStep + width) % width);
        for (let dy = 0; dy < height; dy++) {
          const y = minY + ((yOffset + dy * yStep + height) % height);
          const point = { x, y };
          if (!heightRanges || this.satisfiesHeightRanges(point, heightRanges))
            return point;
        }
      }
    } else {
      for (let dy = 0; dy < height; dy++) {
        const y = minY + ((yOffset + dy * yStep + height) % height);
        for (let dx = 0; dx < width; dx++) {
          const x = minX + ((xOffset + dx * xStep + width) % width);
          const point = { x, y };
          if (!heightRanges || this.satisfiesHeightRanges(point, heightRanges))
            return point;
        }
      }
    }

    // No valid point found (should rarely happen if ranges are correct)
    return null;
  }

  /**
   * Check if a point satisfies the given height ranges
   * @param point The point to check
   * @param ranges Array of height ranges to check against
   * @returns True if the point satisfies at least one range, false otherwise
   */
  private satisfiesHeightRanges(
    point: Point2,
    ranges: Array<{ min: number; max: number }>,
  ): boolean {
    const height = this.heightMap[point.x][point.y];

    return ranges.some((range) => {
      return height >= range.min && height <= range.max;
    });
  }

  private generateMidpoints(midPoints: PathPoint[]): Point2[] {
    const points: Point2[] = [];

    for (const midPoint of midPoints) {
      const point = this.findValidPointWithHeightFilter(
        midPoint.xRange,
        midPoint.yRange,
        midPoint.heightRanges,
      );

      if (point) {
        points.push(point);
      }
    }

    return points;
  }

  private getRandomEdgeRanges(range: Range): {
    start: { xRange: Range; yRange: Range };
    end: { xRange: Range; yRange: Range };
  } {
    // Helper function to get a random edge point with specified edge
    const getEdgeRange = (edge: number): { xRange: Range; yRange: Range } => {
      switch (edge) {
        case 0: // top edge
          return { xRange: range, yRange: TOP_EDGE };
        case 1: // right edge
          return { xRange: RIGHT_EDGE, yRange: range };
        case 2: // bottom edge
          return { xRange: range, yRange: BOTTOM_EDGE };
        default: // left edge (3)
          return { xRange: LEFT_EDGE, yRange: range };
      }
    };

    // Get first random edge
    const startEdge = getRandomInt(0, 3, this.random);

    // Get second edge (ensuring it's different from the first)
    let endEdge = getRandomInt(0, 3, this.random);
    if ((endEdge = startEdge)) endEdge = 3;

    const start = getEdgeRange(startEdge);
    const end = getEdgeRange(endEdge);

    return { start, end };
  }
}
