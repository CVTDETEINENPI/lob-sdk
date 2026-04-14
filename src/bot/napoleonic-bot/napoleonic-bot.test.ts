import { NapoleonicBot } from "./napoleonic-bot";
import { BaseUnit } from "@lob-sdk/unit";
import { Vector2 } from "@lob-sdk/vector";
import { IServerGame } from "@lob-sdk/types";
import { GameDataManager } from "@lob-sdk/game-data-manager";

describe("NapoleonicBot - category mapping", () => {
  it("maps every napoleonic unit category to a bot group", () => {
    const gameDataManager = GameDataManager.get("napoleonic");
    const mockGame = {
      getPlayerTeam: () => 1,
    } as unknown as IServerGame;
    const bot = new NapoleonicBot(gameDataManager, mockGame, 1);

    const unmapped = gameDataManager
      .getUnitCategories()
      .filter((cat) => bot.getGroup(cat.id) === "");

    expect(unmapped).toEqual([]);
  });
});

describe("NapoleonicBot - calculateAdvanceFormationCenter", () => {
  let bot: NapoleonicBot;
  let mockGameDataManager: any;
  let mockTemplateManager: any;

  beforeEach(() => {
    mockTemplateManager = {
      getTemplate: jest.fn(),
    };

    mockGameDataManager = {
      getUnitTemplateManager: () => mockTemplateManager,
    };

    // Need to mock the game and other dependencies for NapoleonicBot constructor
    const mockGame = {
      id: "game1",
      era: "napoleonic",
      getEntities: () => [],
      getObjectives: () => [],
      getMapWidth: () => 1000,
      getMapHeight: () => 1000,
      getPlayerTeam: () => 1,
    } as unknown as IServerGame;

    bot = new NapoleonicBot(mockGameDataManager, mockGame, 1);
  });

  const createMockUnit = (
    id: string,
    category: string,
    walkSpeed: number,
    runSpeed: number,
    staminaProp: number = 1.0
  ): any => {
    mockTemplateManager.getTemplate.mockImplementation((type: string) => {
      if (type === id) return { category };
      return { category: 'unknown' };
    });

    return {
      id,
      type: id,
      walkMovement: walkSpeed,
      runMovement: runSpeed,
      getStaminaProportion: () => staminaProp,
    };
  };

  it("should calculate correctly for infantry only", () => {
    const infantry = createMockUnit("inf", "infantry", 60, 80);
    const myCentroid = new Vector2(100, 100);
    const direction = new Vector2(0, 1);
    
    const center = bot.calculateAdvanceFormationCenter(
      myCentroid,
      direction,
      50, // armyFront
      [infantry],
      { infantry: [infantry], artillery: [], cavalry: [], skirmishers: [] }
    );
    
    // armyFront (50) + minWalk (60 capped at 48 = 48) + anchorOffset for infantry (96) = 194
    // Center Y should be 100 + 194 = 294
    expect(center.y).toBe(294);
  });

  it("should calculate correctly for artillery only (uses run speed)", () => {
    const artillery = createMockUnit("art", "artillery", 20, 30);
    const myCentroid = new Vector2(100, 100);
    const direction = new Vector2(0, 1);
    
    const center = bot.calculateAdvanceFormationCenter(
      myCentroid,
      direction,
      0, // armyFront
      [artillery],
      { infantry: [], artillery: [artillery], cavalry: [], skirmishers: [] }
    );
    
    // armyFront (0) + min speed (run is 30 capped at 48 = 30) + anchorOffset for artillery (32) = 62
    expect(center.y).toBe(162);
  });

  it("should use run speed for skirmishers with high stamina", () => {
    const skirmisher = createMockUnit("skirm", "skirmishInfantry", 40, 70, 0.8);
    const myCentroid = new Vector2(0, 0);
    const direction = new Vector2(1, 0);
    
    const center = bot.calculateAdvanceFormationCenter(
      myCentroid,
      direction,
      10, 
      [skirmisher],
      { infantry: [], artillery: [], cavalry: [], skirmishers: [skirmisher] }
    );
    
    // speed is 70, capped at 48. Anchor offset for skirm is 0.
    // armyFront (10) + 48 + 0 = 58
    expect(center.x).toBe(58);
  });

  it("should use walk speed for skirmishers with low stamina", () => {
    const skirmisher = createMockUnit("skirm", "skirmishInfantry", 40, 70, 0.5);
    const myCentroid = new Vector2(0, 0);
    const direction = new Vector2(1, 0);
    
    const center = bot.calculateAdvanceFormationCenter(
      myCentroid,
      direction,
      10, 
      [skirmisher],
      { infantry: [], artillery: [], cavalry: [], skirmishers: [skirmisher] }
    );
    
    // speed is 40 (walk), capped at 48 is 40. Anchor offset 0.
    // armyFront (10) + 40 + 0 = 50
    expect(center.x).toBe(50);
  });

  it("should calculate speed based on the slowest unit correctly", () => {
    const fastCav = createMockUnit("cav", "lightCavalry", 120, 180);
    const slowArt = createMockUnit("art", "artillery", 25, 40); // Will use run 40
    const skirm = createMockUnit("skirm", "skirmishInfantry", 45, 60, 0.2); // Uses walk 45
    
    // Must override the mock to return different categories based on type
    mockTemplateManager.getTemplate.mockImplementation((type: string) => {
      if (type === "cav") return { category: "lightCavalry" };
      if (type === "art") return { category: "artillery" };
      if (type === "skirm") return { category: "skirmishInfantry" };
      return { category: 'unknown' };
    });

    const groupUnits = [fastCav, slowArt, skirm];
    const groups = {
      infantry: [],
      artillery: [slowArt],
      cavalry: [fastCav],
      skirmishers: [skirm]
    };

    const myCentroid = new Vector2(0, 0);
    const direction = new Vector2(0, -1);
    
    const center = bot.calculateAdvanceFormationCenter(
      myCentroid,
      direction,
      100, 
      groupUnits,
      groups
    );
    
    // Speeds: Cav walk (120), Art run (40), Skirm walk (45) due to low stamina
    // Min speed across division = 40 (capped at 48 = 40)
    // Anchor offset: Since artillery is present but not infantry, offset is 32.
    // armyFront (100) + speed (40) + anchor (32) = 172
    expect(center.y).toBe(-172);
  });
});
