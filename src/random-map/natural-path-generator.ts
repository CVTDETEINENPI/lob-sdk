import { PriorityQueue } from "@lob-sdk/priority-queue";
import { TerrainType } from "@lob-sdk/types";
import { setHeightRecursively } from "@lob-sdk/utils";
import { Point2 } from "@lob-sdk/vector";
import { createNoise2D, NoiseFunction2D } from "simplex-noise";

interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start to this node
  h: number; // Heuristic cost to the goal
  f: number; // Total cost (g + h)
  dirHistory: number[]; // The direction indices (E=0) how this node was arrived to
  parent: PathNode | null;
}

interface TerrainReplacement {
  fromTerrain: TerrainType;
  toTerrain: TerrainType;
}

interface TerrainCost {
  terrain: TerrainType;
  cost: number;
}

interface Neighbor {
  point: Point2;
  dist: number;
  dirHistory: number[];
}

export class NaturalPathGenerator {
  private terrainReplacements = new Map<TerrainType, TerrainType>();
  private terrainCosts = new Map<TerrainType, number>();
  private noise: NoiseFunction2D;
  private noiseFrequencyX: number;
  private noiseFrequencyY: number;

  // Pre-calculated turn cost for every direction, used to encourage smooth curves rather than hard turns
  private TURN_COST = [
    //E   SE   S    SW   W    NW   N    NE
    [0.0, 0.5, 1.0, 1.5, 2.0, 1.5, 1.0, 0.5], // E
    [0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 1.5, 1.0], // SE
    [1.0, 0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 1.5], // S
    [1.5, 1.0, 0.5, 0.0, 0.5, 1.0, 1.5, 2.0], // SW
    [2.0, 1.5, 1.0, 0.5, 0.0, 0.5, 1.0, 1.5], // W
    [1.5, 2.0, 1.5, 1.0, 0.5, 0.0, 0.5, 1.0], // NW
    [1.0, 1.5, 2.0, 1.5, 1.0, 0.5, 0.0, 0.5], // N
    [0.5, 1.0, 1.5, 2.0, 1.5, 1.0, 0.5, 0.0], // NE
  ];

  constructor(
    private randomFn: () => number,
    private terrains: TerrainType[][],
    private heightMap: number[][],
    private pathTerrain: number,
    private pathHeight?: number,
    private width: number = 1,
    terrainReplacements?: TerrainReplacement[],
    terrainCosts?: TerrainCost[],
    private curveLen = 5, // how long to consider turns
    private curveWeight = 0.25, // how much to weight against turns
    private noiseWeight: number = 1,
    private noiseSmoothness: number = 6, // how many features will be generated in the noise
    private edgeDistance = 5,
    private edgeWeight = 5,
    private uphillHeightCost: number = 1,
    private downHillHeightCost: number = 1,
    heightDiffCost?: number, // only for backwards compat
  ) {
    if (width < 1) {
      throw new Error("Path width must be a positive number");
    }
    if (heightDiffCost) {
      this.uphillHeightCost = heightDiffCost;
      this.downHillHeightCost = heightDiffCost;
    }

    terrainReplacements?.forEach(({ fromTerrain, toTerrain }) =>
      this.terrainReplacements.set(fromTerrain, toTerrain),
    );

    terrainCosts?.forEach(({ terrain, cost }) =>
      this.terrainCosts.set(terrain, cost),
    );

    this.noise = createNoise2D(this.randomFn);
    this.noiseFrequencyX = this.noiseSmoothness / this.terrains.length;
    this.noiseFrequencyY = this.noiseSmoothness / this.terrains[0].length;

    // this.printNoise(terrains.length, terrains[0].length);
  }

  public generatePath(start: Point2, goal: Point2) {
    this.fillPathTiles(this.generatePathPoints(start, goal));
  }

  private generatePathPoints(start: Point2, goal: Point2): Point2[] {
    // Use PriorityQueue for openList
    const openList = new PriorityQueue<PathNode>((a, b) => a - b); // Min-heap for f values
    const closedList: Set<string> = new Set();
    // Hash map for O(1) node lookups
    const nodeMap: Map<string, PathNode> = new Map();

    const startNode: PathNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: this.heuristic(start, goal),
      f: 0,
      dirHistory: [],
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openList.enqueue(startNode, startNode.f);
    nodeMap.set(`${start.x},${start.y}`, startNode);

    const getNeighbors = (node: PathNode): Neighbor[] => {
      const directions = [
        { x: 1, y: 0, dist: 1 }, // 0 E
        { x: 1, y: 1, dist: Math.SQRT2 }, // 1 SE
        { x: 0, y: 1, dist: 1 }, // 2 S
        { x: -1, y: 1, dist: Math.SQRT2 }, // 3 SW
        { x: -1, y: 0, dist: 1 }, // 4 W
        { x: -1, y: -1, dist: Math.SQRT2 }, // 5 NW
        { x: 0, y: -1, dist: 1 }, // 6 N
        { x: 1, y: -1, dist: Math.SQRT2 }, // 7 NE
      ];

      const neighbors = directions
        .map((dir, dirIndex) => ({
          point: { x: node.x + dir.x, y: node.y + dir.y },
          dist: dir.dist,
          dirHistory: this.pushDir(node.dirHistory, dirIndex),
        }))
        .filter((p) => {
          return (
            this.validTurn(p.dirHistory) &&
            this.isValidTile(this.heightMap, p.point.x, p.point.y)
          );
        });

      return neighbors;
    };

    while (!openList.isEmpty()) {
      const currentNode = openList.dequeue()!;
      const currentKey = `${currentNode.x},${currentNode.y}`;
      nodeMap.delete(currentKey); // Remove from nodeMap

      if (currentNode.x === goal.x && currentNode.y === goal.y) {
        return this.reconstructPath(currentNode);
      }

      closedList.add(currentKey);

      const neighbors = getNeighbors(currentNode);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.point.x},${neighbor.point.y}`;
        if (closedList.has(neighborKey)) continue;

        const g =
          currentNode.g +
          neighbor.dist +
          this.calculateTerrainCost(neighbor.point) +
          this.calculateHeightDiffCost(currentNode, neighbor.point) +
          this.calculateEdgeCost(neighbor.point) +
          this.segmentCurvatureCost(neighbor.dirHistory) +
          this.generateNoise(neighbor.point.x, neighbor.point.y);
        const h = this.heuristic(neighbor.point, goal);
        const f = g + h;

        const existingNode = nodeMap.get(neighborKey);

        if (!existingNode || g < existingNode.g) {
          const newNode: PathNode = {
            x: neighbor.point.x,
            y: neighbor.point.y,
            g,
            h,
            f,
            parent: currentNode,
            dirHistory: neighbor.dirHistory,
          };

          if (!existingNode) {
            openList.enqueue(newNode, newNode.f);
            nodeMap.set(neighborKey, newNode);
          } else {
            // Update existing node
            existingNode.g = g;
            existingNode.f = f;
            existingNode.parent = currentNode;
            // PriorityQueue doesn't support priority updates directly,
            // so we re-enqueue with the new priority
            openList.enqueue(existingNode, existingNode.f);
          }
        }
      }
    }

    return []; // No path found
  }

  calculateEdgeCost(point: Point2): number {
    const distToEdge = Math.min(
      point.x,
      point.y,
      this.terrains.length - 1 - point.x,
      this.terrains[0].length - 1 - point.y,
    );
    return (
      this.edgeWeight *
      Math.max((this.edgeDistance - distToEdge) / this.edgeDistance, 0)
    );
  }

  private generateNoise(x: number, y: number): number {
    return (
      this.noise(x * this.noiseFrequencyX, y * this.noiseFrequencyY) *
      this.noiseWeight
    );
  }

  /** This is a test function that I am leaving in because it is useful for debugging/analyzing noise patterns */
  private printNoise(width: number, height: number) {
    const chars = " .:-=+*#%@"; // low → high
    for (let y = 0; y < height; y++) {
      let line = "";
      for (let x = 0; x < width; x++) {
        let n = this.generateNoise(x, y); // assumes -1..1
        n = (n + this.noiseWeight) / (this.noiseWeight * 2); // normalize to 0..1
        const index = Math.floor(n * (chars.length - 1));
        line += chars[index];
      }
      console.log(line);
    }
  }

  /** Adds direction history to a node  */
  private pushDir(dirHistory: number[], dirIndex: number): number[] {
    const h = dirHistory.slice();
    h.push(dirIndex);
    if (h.length > this.curveLen) {
      h.shift();
    }
    return h;
  }

  /** Calculates segment curve cost based on constructor params */
  private segmentCurvatureCost(history: number[]) {
    if (history.length < 2) {
      return 0;
    }

    let sum = 0;
    for (let i = 1; i < history.length; i++) {
      sum += this.TURN_COST[history[i - 1]][history[i]];
    }

    return (sum / (history.length - 1)) * this.curveWeight;
  }

  /** Prevent diagonal criss-crossing as it makes weird thick paths */
  private validTurn(history: number[]) {
    if (history.length < 2) {
      return true;
    }
    return !(
      history[history.length - 2] % 2 &&
      history[history.length - 1] % 2 &&
      history[history.length - 2] !== history[history.length - 1]
    );
  }

  /** Using octile distance as A* Hueristic */
  private heuristic(a: Point2, b: Point2): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); // Octile distance
  }

  private isValidTile(grid: number[][], x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < grid.length && y < grid[0].length;
  }

  private calculateHeightDiffCost(current: PathNode, neighbor: Point2): number {
    const diff =
      this.heightMap[current.x][current.y] -
      this.heightMap[neighbor.x][neighbor.y];
    if (diff > 0) {
      return Math.abs(diff) * this.uphillHeightCost;
    }
    return Math.abs(diff) * this.downHillHeightCost;
  }

  private reconstructPath(node: PathNode): Point2[] {
    const path: Point2[] = [];
    let current: PathNode | null = node;
    while (current) {
      path.push({ x: current.x, y: current.y });
      current = current.parent;
    }
    return path; // This is technically in reverse, but we don't care for this purpose
  }

  private fillPathTiles(path: Point2[]) {
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];

      // Use Bresenham's line algorithm for the center path
      const points = this.orthagonalizeLine(start.x, start.y, end.x, end.y);
      for (const point of points) {
        const terrainType = this.getTerrainForTile(
          point.x,
          point.y,
          this.pathTerrain,
          this.terrains,
        );
        this.terrains[point.x][point.y] = terrainType;

        if (this.pathHeight) {
          setHeightRecursively(
            point.x,
            point.y,
            this.pathHeight,
            this.heightMap,
          );
        }
      }
    }
  }

  private *addWidthTiles(cx: number, cy: number) {
    const halfWidth = Math.floor(this.width / 2);
    const evenAdjust = this.width % 2 === 0 ? 1 : 0;
    for (
      let offsetX = -halfWidth;
      offsetX <= halfWidth - evenAdjust;
      offsetX++
    ) {
      for (
        let offsetY = -halfWidth;
        offsetY <= halfWidth - evenAdjust;
        offsetY++
      ) {
        if (this.isValidTile(this.heightMap, cx + offsetX, cy + offsetY)) {
          yield { x: cx + offsetX, y: cy + offsetY };
        }
      }
    }
  }

  private *orthagonalizeLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): Generator<Point2> {
    let x = x0;
    let y = y0;
    yield* this.addWidthTiles(x, y);

    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);

    while (x !== x1 || y !== y1) {
      const xFirst = dx === dy;

      if (xFirst) {
        if (x !== x1) {
          x += dx;
          yield* this.addWidthTiles(x, y);
        }
        if (y !== y1) {
          y += dy;
          yield* this.addWidthTiles(x, y);
        }
      } else {
        if (y !== y1) {
          y += dy;
          yield* this.addWidthTiles(x, y);
        }
        if (x !== x1) {
          x += dx;
          yield* this.addWidthTiles(x, y);
        }
      }
    }
  }

  /**
   * Determines the appropriate terrain type for a path tile based on terrain replacement rules
   * @param x X coordinate of the tile
   * @param y Y coordinate of the tile
   * @param baseTerrain The base terrain type for the path
   * @param terrains The terrain map to check against
   * @returns The terrain type to use for this tile
   */
  private getTerrainForTile(
    x: number,
    y: number,
    baseTerrain: TerrainType,
    terrains: TerrainType[][],
  ): TerrainType {
    if (!this.terrainReplacements || !this.isValidTile(terrains, x, y)) {
      return baseTerrain;
    }
    // Find a matching replacement rule
    const replacement = this.terrainReplacements.get(terrains[x][y]);

    return replacement ? replacement : baseTerrain;
  }

  /**
   * Calculates the terrain cost for a given position
   * @param position The position to check
   * @returns The terrain cost (defaults to 1 if no cost is specified)
   */
  private calculateTerrainCost(position: Point2): number {
    if (
      !this.terrains ||
      !this.isValidTile(this.terrains, position.x, position.y)
    ) {
      return 1;
    }

    const terrain = this.terrains[position.x][position.y];
    return this.terrainCosts.get(terrain) || 1;
  }
}
