import { getDeploymentZoneBySize, getMapSizeIndex } from "./map-size";
import { Size } from "@lob-sdk/types";
import {
  ObjectiveDto,
  TeamDeploymentZone,
  GenerateRandomMapResult,
  GenerateRandomMapProps,
  InstructionType,
  AnyInstruction,
  ProceduralScenario,
  TerrainType,
  Range,
} from "@lob-sdk/types";
import { TerrainNoiseExecutor } from "./executors/terrain-noise";
import { HeightNoiseExecutor } from "./executors/height-noise";
import { TerrainCircleExecutor } from "./executors/terrain-circle";
import { TerrainRectangleExecutor } from "./executors/terrain-rectangle";
import { NaturalPathExecutor } from "./executors/natural-path";
import { ConnectClustersExecutor } from "./executors/connect-clusters";
import { ObjectiveExecutor } from "./executors/objective";
import { ObjectiveLayerExecutor } from "./executors/objective-layer";
import { LakeExecutor } from "./executors/lake";
import { generateRandomSeed } from "@lob-sdk/seed";
import { GameDataManager } from "@lob-sdk/game-data-manager";

export class RandomMapGenerator {
  generate({
    scenario,
    dynamicBattleType,
    maxPlayers,
    seed,
    tileSize,
    era,
    tilesX,
    tilesY,
  }: GenerateRandomMapProps): GenerateRandomMapResult {
    const gameDataManager = GameDataManager.get(era);
    const battleType = gameDataManager.getBattleType(dynamicBattleType);
    const mapSizeIndex = getMapSizeIndex(maxPlayers, battleType.mapSize.length);
    const battleSize = battleType.mapSize[mapSizeIndex] as Size;
    const mapSizes = gameDataManager.getMapSizes();
    const { map } = mapSizes[battleSize];

    if (!tilesX) {
      tilesX = map.tilesX;
    }
    if (!tilesY) {
      tilesY = map.tilesY;
    }

    const widthPx = tilesX * tileSize;
    const heightPx = tilesY * tileSize;

    const deploymentZones: [TeamDeploymentZone, TeamDeploymentZone] = [
      getDeploymentZoneBySize(battleSize, widthPx, heightPx, 1, era, tileSize),
      getDeploymentZoneBySize(battleSize, widthPx, heightPx, 2, era, tileSize),
    ];
    const objectives: ObjectiveDto<false>[] = [];

    const mapSeed = seed ?? generateRandomSeed();

    const terrains: TerrainType[][] = [];
    const heightMap: number[][] = [];

    // Initialize arrays
    for (let x = 0; x < tilesX; x++) {
      terrains[x] = [];
      heightMap[x] = [];
      for (let y = 0; y < tilesY; y++) {
        terrains[x][y] = TerrainType.Grass;
        heightMap[x][y] = 0;
      }
    }

    // Use baseTerrain from scenario if present, otherwise default to Grass
    const baseTerrain = scenario.baseTerrain ?? TerrainType.Grass;

    // Generate terrain and height
    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        // Start with base terrain
        terrains[x][y] = baseTerrain;
      }
    }

    this.executeInstructions(
      scenario,
      mapSeed,
      terrains,
      heightMap,
      objectives,
      widthPx,
      heightPx,
      tilesX,
      tilesY,
      tileSize,
      battleSize,
    );

    return {
      map: {
        width: tilesX * tileSize,
        height: tilesY * tileSize,
        terrains,
        heightMap,
        deploymentZones,
        seed: mapSeed,
      },
      objectives,
    };
  }

  private executeInstructions(
    scenario: ProceduralScenario,
    seed: number,
    terrains: TerrainType[][],
    heightMap: number[][],
    objectives: ObjectiveDto<false>[],
    widthPx: number,
    heightPx: number,
    tilesX: number,
    tilesY: number,
    tileSize: number,
    battleSize: Size,
  ) {
    scenario.instructions.forEach(
      (instruction: AnyInstruction, index: number) => {
        let boundedTerrains = terrains;
        let boundedHeightMap = heightMap;
        if (instruction.xBounds && instruction.yBounds) {
          boundedTerrains = this.create2DSliceProxy(
            terrains,
            instruction.xBounds,
            instruction.yBounds,
          );
          boundedHeightMap = this.create2DSliceProxy(
            heightMap,
            instruction.xBounds,
            instruction.yBounds,
          );
        }
        switch (instruction.type) {
          case InstructionType.HeightNoise: {
            new HeightNoiseExecutor(
              instruction,
              scenario,
              seed,
              index,
              boundedTerrains,
              boundedHeightMap,
            ).execute();
            break;
          }
          case InstructionType.TerrainNoise: {
            new TerrainNoiseExecutor(
              instruction,
              scenario,
              seed,
              index,
              boundedTerrains,
              boundedHeightMap,
            ).execute();
            break;
          }
          case InstructionType.TerrainCircle: {
            new TerrainCircleExecutor(
              instruction,
              scenario,
              seed,
              index,
              boundedTerrains,
              boundedHeightMap,
            ).execute();
            break;
          }
          case InstructionType.TerrainRectangle: {
            new TerrainRectangleExecutor(
              instruction,
              scenario,
              seed,
              index,
              boundedTerrains,
              boundedHeightMap,
            ).execute();
            break;
          }
          case InstructionType.NaturalPath: {
            new NaturalPathExecutor(
              instruction,
              scenario,
              seed,
              index,
              boundedTerrains,
              boundedHeightMap,
              battleSize,
            ).execute();
            break;
          }
          case InstructionType.ConnectClusters: {
            new ConnectClustersExecutor(
              instruction,
              scenario,
              seed,
              index,
              boundedTerrains,
              boundedHeightMap,
            ).execute();
            break;
          }
          case InstructionType.Objective: {
            new ObjectiveExecutor(
              instruction,
              scenario,
              seed,
              index,
              widthPx,
              heightPx,
              objectives,
            ).execute();
            break;
          }
          case InstructionType.Lake: {
            new LakeExecutor(
              instruction,
              scenario,
              seed,
              index,
              boundedTerrains,
              boundedHeightMap,
            ).execute();
            break;
          }
          case InstructionType.ObjectiveLayer: {
            new ObjectiveLayerExecutor(
              instruction,
              tileSize,
              scenario,
              seed,
              index,
              boundedTerrains,
              boundedHeightMap,
              objectives,
              tilesX,
              tilesY,
            ).execute();
            break;
          }

          default: {
            throw new Error(
              `Unknown instruction type: ${(instruction as any)?.type}`,
            );
          }
        }
      },
    );
  }

  // Creates a proxy for a slice of a 2D array. So we can pass bounded areas without having to reprogram all executors
  private create2DSliceProxy<T>(
    array: T[][],
    xRange: Range,
    yRange: Range,
  ): T[][] {
    // Slice the 2D array according to specified rows and columns
    const xStart = Math.floor((xRange.min / 100) * array.length);
    const xEnd = Math.floor((xRange.max / 100) * array.length);
    const yStart = Math.floor((yRange.min / 100) * array[0].length);
    const yEnd = Math.floor((yRange.max / 100) * array[0].length);

    // Create proxied rows
    const proxiedRows: T[][] = [];
    for (let i = xStart; i < xEnd; i++) {
      const originalRow = array[i];
      const rowSlice = originalRow.slice(yStart, yEnd);

      // Wrap the row slice in a proxy
      const rowProxy = new Proxy(rowSlice, {
        set(target, colKey, value) {
          const colIndex = Number(colKey);
          if (!isNaN(colIndex) && colIndex < rowSlice.length) {
            // Update original array
            array[i][yStart + colIndex] = value;
            // Update proxy
            target[colIndex] = value;
            return true;
          }
          return false;
        },
      });

      proxiedRows.push(rowProxy);
    }
    return proxiedRows;
  }
}
