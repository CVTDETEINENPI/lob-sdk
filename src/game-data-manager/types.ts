import {
  ScenarioName,
  SkinTier,
  UnitCategoryId,
  UnitType,
} from "@lob-sdk/types";

export type GameEra = "napoleonic" | "ww2";

export type DamageTypeId = number;
export type DamageTypeName = string;

export interface Avatar {
  id: number;
  name: string;
  tier: SkinTier;
  premiumPrice: number;
  discount?: number;
  locked?: boolean;
}

export interface ObjectiveSkin {
  id: number;
  name: string;
  tier: SkinTier;
  premiumPrice: number;
  locked?: boolean;
  /** Name of the base sprite */
  base?: string;
  discount?: number;
}

export interface GameDataManagerConfig {
  autoDetectEra?: boolean;
  fallbackToDefault?: boolean;
  cacheEnabled?: boolean;
}

export type BaseSpeed = "walk" | "run";

export interface RoutingBehavior {
  baseSpeed: BaseSpeed;
  /** Whether the unit flees when in Routed state. Defaults to true. */
  fleeWhenRouted?: boolean;
}

export interface EnfiladeFireConfig {
  damageModifier: number;
  orgModifier: number;
}

export interface RearFireConfig {
  orgModifier: number;
}

export type DeploymentSection = "center" | "flank" | "front";

export interface UnitCategoryTemplate {
  id: UnitCategoryId;
  /**
   * The deployment section where units of this category should be deployed.
   * Possible values: "flank" (split left/right), "center", "front"
   * Default value: "center"
   */
  deploymentSection?: DeploymentSection;
  allyCollisionLevel?: number;
  enemyCollisionLevel?: number;
  damageTypeResistances?: Partial<Record<string, number>>;
  firingAltitude: number;
  captureSpeed?: number;
  autofirePriority?: Partial<Record<UnitCategoryId, number>>;
  routingBehavior?: RoutingBehavior;
  enfiladeFire?: EnfiladeFireConfig;
  rearFire?: RearFireConfig;
  /**
   * List of allowed order names for this category.
   */
  allowedOrders?: string[];
  /**
   * The altitude of the unit's hitbox for impact hits.
   * Impact hits weaken the projectile and deal damage.
   */
  impactAltitude?: number;
  /**
   * The altitude of the unit's hitbox for grazing hits.
   * Grazing hits weaken the projectile but don't deal damage.
   */
  grazingAltitude?: number;
}

export interface UnitSkin {
  id: number;
  name: string;
  /**
   * Formation-specific sprites. Each formation must define its own base and overlay sprites.
   */
  formations: {
    [formationId: string]: {
      /** Name of the base sprite */
      base?: string;
      /** Name of the overlay sprite */
      overlay?: string | null;
    };
  };
  tier: SkinTier;
  premiumPrice: number;
  unitType: UnitType;
  attackColor?: string;
  locked?: boolean;
  discount?: number;
}

export interface MapSizeTemplate {
  map: { tilesX: number; tilesY: number };
  mainDeployment: { tilesX: number; tilesY: number; zoneSeparation: number };
  forwardDeployment: { tilesX: number; tilesY: number; zoneSeparation: number };
}

// TODO: rename to MatchmakingConfig
export interface MatchmakingPresetsData {
  /** Scenario IDs that must always be included in ranked matchmaking for this era. Optional; empty if omitted. */
  rankedRequiredScenarios?: ScenarioName[];
  /** Minimum number of scenarios a player must have selected for ranked matchmaking. Optional. */
  rankedMinScenarios?: number;
}
