import type {
  UnitTemplate as UnitTemplateUnion,
  UnitFormationTemplate,
  UnitType,
  UnitCategoryId,
} from "./unit";
import { STAT_PRECISION_SCALE } from "./scale";

/** Raw shape of a unit-templates.json entry (unscaled). */
export type UnitTemplateJson = UnitTemplateUnion;

/**
 * Holds the fields shared by {@link MeleeUnitTemplate} and
 * {@link RangedUnitTemplate} and applies the stat scaling that is common to
 * both. Subclasses add the variant-specific fields (ranged or melee-only).
 */
abstract class BaseUnitTemplate {
  name: string;
  type: UnitType;
  category: UnitCategoryId;
  meleeAttack: number;
  meleeDefense: number;
  meleeDamageType: string;
  chargeBonus: number;
  chargePenetration?: number;
  flankMeleeOrgModifier?: number;
  flankChargePenBonus?: number;
  walkMovement: number;
  runStartUpMovement?: number;
  runMovement: number;
  timeToRun: number;
  unlimberTime?: number;
  runCost: number;
  startsRunning?: boolean;
  hp: number;
  org: number;
  shattersAtOrg: number;
  routesAtOrg: number;
  recoversAtOrg: number;
  ralliesAtOrg: number;
  stamina?: number;
  supply?: number;
  supplyConsumptionIdle?: number;
  supplyConsumptionMoving?: number;
  supplyConsumptionCombating?: number;
  supplyManpowerCost?: number;
  supplyGoldCost?: number;
  orgRadius: number;
  orgRadiusBonus: number;
  movementSound: string;
  manpower: number;
  gold: number;
  chargeResistance?: number;
  runChargeResistanceModifier?: number;
  pushStrength?: number;
  pushDistance?: number;
  basicPrice?: number;
  premiumPrice?: number;
  locked?: boolean;
  skirmisherRatio?: number;
  canDeployForward?: boolean;
  reducedVisibilityRange?: number;
  unknownType?: UnitType;
  rotationSpeed: number;
  rotationMaxThreshold: number;
  runRotationSpeed: number;
  turningDelay?: number;
  reportStats?: { [key: string]: number };
  formations: UnitFormationTemplate[];
  defaultFormation: string;
  maxEntrenchment?: number;

  protected constructor(json: UnitTemplateJson) {
    this.name = json.name;
    this.type = json.type;
    this.category = json.category;
    this.meleeDamageType = json.meleeDamageType;
    this.movementSound = json.movementSound;
    this.formations = json.formations;
    this.defaultFormation = json.defaultFormation;
    this.chargePenetration = json.chargePenetration;
    this.flankMeleeOrgModifier = json.flankMeleeOrgModifier;
    this.flankChargePenBonus = json.flankChargePenBonus;
    this.walkMovement = json.walkMovement;
    this.runStartUpMovement = json.runStartUpMovement;
    this.runMovement = json.runMovement;
    this.timeToRun = json.timeToRun;
    this.unlimberTime = json.unlimberTime;
    this.startsRunning = json.startsRunning;
    this.supplyManpowerCost = json.supplyManpowerCost;
    this.supplyGoldCost = json.supplyGoldCost;
    this.orgRadius = json.orgRadius;
    this.manpower = json.manpower;
    this.gold = json.gold;
    this.chargeResistance = json.chargeResistance;
    this.runChargeResistanceModifier = json.runChargeResistanceModifier;
    this.pushStrength = json.pushStrength;
    this.pushDistance = json.pushDistance;
    this.basicPrice = json.basicPrice;
    this.premiumPrice = json.premiumPrice;
    this.locked = json.locked;
    this.skirmisherRatio = json.skirmisherRatio;
    this.canDeployForward = json.canDeployForward;
    this.reducedVisibilityRange = json.reducedVisibilityRange;
    this.unknownType = json.unknownType;
    this.rotationSpeed = json.rotationSpeed;
    this.rotationMaxThreshold = json.rotationMaxThreshold;
    this.runRotationSpeed = json.runRotationSpeed;
    this.turningDelay = json.turningDelay;
    this.reportStats = json.reportStats;
    this.maxEntrenchment = json.maxEntrenchment;

    this.meleeAttack = json.meleeAttack * STAT_PRECISION_SCALE;
    this.meleeDefense = json.meleeDefense * STAT_PRECISION_SCALE;
    this.chargeBonus = json.chargeBonus * STAT_PRECISION_SCALE;
    this.runCost = json.runCost * STAT_PRECISION_SCALE;
    this.hp = json.hp * STAT_PRECISION_SCALE;
    this.org = json.org * STAT_PRECISION_SCALE;
    this.shattersAtOrg = json.shattersAtOrg * STAT_PRECISION_SCALE;
    this.routesAtOrg = json.routesAtOrg * STAT_PRECISION_SCALE;
    this.recoversAtOrg = json.recoversAtOrg * STAT_PRECISION_SCALE;
    this.ralliesAtOrg = json.ralliesAtOrg * STAT_PRECISION_SCALE;
    this.orgRadiusBonus = json.orgRadiusBonus * STAT_PRECISION_SCALE;
    this.stamina =
      json.stamina === undefined
        ? undefined
        : json.stamina * STAT_PRECISION_SCALE;
    this.supply =
      json.supply === undefined ? undefined : json.supply * STAT_PRECISION_SCALE;
    this.supplyConsumptionIdle =
      json.supplyConsumptionIdle === undefined
        ? undefined
        : json.supplyConsumptionIdle * STAT_PRECISION_SCALE;
    this.supplyConsumptionMoving =
      json.supplyConsumptionMoving === undefined
        ? undefined
        : json.supplyConsumptionMoving * STAT_PRECISION_SCALE;
    this.supplyConsumptionCombating =
      json.supplyConsumptionCombating === undefined
        ? undefined
        : json.supplyConsumptionCombating * STAT_PRECISION_SCALE;
  }
}

/**
 * Runtime view of a unit template that has no ranged weapon. The ranged
 * fields are typed `never` so consumers can narrow the
 * {@link UnitTemplateUnion} via `if (template.rangedAttack !== undefined)`.
 */
export class MeleeUnitTemplate extends BaseUnitTemplate {
  rangedAttack?: never;
  rangedDamageTypes?: never;
  fireWhileMoving?: never;
  minDistanceToFAA?: never;
  ammo?: never;
  noAmmoRegain?: never;
  panicFireDistance?: never;

  constructor(json: UnitTemplateJson) {
    super(json);
  }
}

/** Runtime view of a unit template with a ranged weapon. */
export class RangedUnitTemplate extends BaseUnitTemplate {
  rangedAttack: number;
  rangedDamageTypes: string[];
  fireWhileMoving?: boolean;
  minDistanceToFAA?: number;
  ammo?: number;
  noAmmoRegain?: boolean;
  panicFireDistance?: number;

  constructor(json: UnitTemplateJson & { rangedAttack: number }) {
    super(json);
    this.rangedAttack = json.rangedAttack * STAT_PRECISION_SCALE;
    this.rangedDamageTypes = json.rangedDamageTypes;
    this.fireWhileMoving = json.fireWhileMoving;
    this.minDistanceToFAA = json.minDistanceToFAA;
    this.noAmmoRegain = json.noAmmoRegain;
    this.panicFireDistance = json.panicFireDistance;
    this.ammo =
      json.ammo === undefined ? undefined : json.ammo * STAT_PRECISION_SCALE;
  }
}
