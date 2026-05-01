import type { ScenarioName, UnitCategoryId } from "@lob-sdk/types";
import { STAT_PRECISION_SCALE } from "./scale";

export interface FlankingRule {
  meleeOrgDamageModifier: number;
  rearMeleeOrgDamageModifier: number;
  chargePenetrationModifier: number;
  rearChargePenetrationModifier: number;
}

export interface StaminaRule {
  meleeTurnCost: number;
  rangedTurnCost: number;
  hasRanMeleeStaminaCostModifier: number;
  regainRates: {
    range1: number;
    range2: number;
    range3: number;
    range4: number;
    range5: number;
  };
  upperModifierLimit: number;
  lowerModifierLimit: number;
  chargeResistanceModifier: number;
  runningMovementPenalty: number;
  rangedAttackPenalty: number;
  meleeAttackPenalty: number;
  meleeDefensePenalty: number;
}

export interface AmmoRule {
  baseReserve: number;
  regenerationBaseRate: number;
  regenerationBonusRate: number;
}

export interface SkirmishersRule {
  unitType: number;
}

export interface SupplyLinesRule {
  roadTerrainTypes?: number[];
  influenceRadius: number;
  supplyHubRadius: number;
  supplyHubRadiusWithInfluence: number;
  defaultLogistics: number;
  defaultManpowerPerTurn?: number;
  defaultGoldPerTurn?: number;
  noSupplyHpAttrition?: number;
  noSupplyOrgAttrition?: number;
  supplyManpowerCost?: number;
  supplyGoldCost?: number;
  reinforcementRate?: number;
  noSupplyMovementPenalty?: Partial<Record<UnitCategoryId, number>>;
  movementCategory: UnitCategoryId;
}

export interface EntrenchmentRule {
  ranges: Array<{ min: number; max: number; color: string }>;
  meleeAttackBonusPerLevel: number;
  meleeDefenseBonusPerLevel: number;
  pushStrengthModifierPerLevel: number;
}

export interface ObjectivesRule {
  radius: number;
  pressureThreshold: number;
}

export interface AllyCollisionRule {
  collisionBounceScale: number;
  overlapStopCharge: number;
  maxSpeedPenalty: number;
  maxOrgDamageReceived: number;
  maxMeleeAttackPenalty: number;
  maxRangedAttackPenalty: number;
  upperModifierLimit: number;
  lowerModifierLimit: number;
  maxOrgRadiusModifier: number;
}

export interface TutorialRule {
  scenario: ScenarioName | null;
}

export interface OrganizationRule {
  speedModifier: number;
  maxOrgDebuffMinHpProportion: number;
  maxOrgDebuffHp: number;
  maxOrgDebuffStamina: number;
  maxOrgDebuffStaminaHighProportion: number;
  maxOrgDebuffStaminaLowProportion: number;
  maxOrgRangedAttackPenalty: number;
  maxOrgMeleeAttackBonus: number;
  maxOrgMeleeAttackPenalty: number;
  regainRate: number;
  upperModifierLimit: number;
  lowerModifierLimit: number;
  nearbyUnitsDistance: number;
  nearbyUnitsPositiveOrgBonusCap: number;
  nearbyUnitsNegativeOrgBonusCap: number;
  nearbyUnitsOrgDamageModifierCap: number;
  nearbyUnitsOrgDamageModifierPenaltyCap: number;
  routingUnitNearbyUnitsOrgBonus: number;
  startedRoutingOrgRadiusModifier: number;
  startedRoutingOrgRadiusDistance: number;
  startedRoutingOrgRadiusDistanceRunSpeedBonus: number;
  routingRunCostModifier: number;
  startedRoutingRunCostModifier: number;
  orgRadiusBonusHpLossReduction: number;
  safeOrgRecoveryModifier: number;
  safeDistance: number;
  distantThreatOrgRecoveryModifier: number;
  distantThreatDistance: number;
  routingOrgRecoveryModifier: number;
  maxOrgRecoveryByHpModifier: number;
  vpDebuffGraceZone: number;
  vpDebuffMultiplier: number;
}

/**
 * Raw shape of `game-rules.json` (unscaled, human-readable). The
 * {@link GameRules} class implements this and scales the rule fields that
 * mix with stat values during construction.
 */
export interface GameRulesJson {
  flanking?: FlankingRule;
  stamina?: StaminaRule;
  ammo?: AmmoRule;
  skirmisherSpawning?: SkirmishersRule;
  supplyLines?: SupplyLinesRule;
  entrenchment?: EntrenchmentRule;
  objectives: ObjectivesRule;
  organization: OrganizationRule;
  allyCollision?: AllyCollisionRule;
  tutorial?: TutorialRule;
}

function scaleStamina(json: StaminaRule): StaminaRule {
  return {
    meleeTurnCost: json.meleeTurnCost * STAT_PRECISION_SCALE,
    rangedTurnCost: json.rangedTurnCost * STAT_PRECISION_SCALE,
    hasRanMeleeStaminaCostModifier: json.hasRanMeleeStaminaCostModifier,
    regainRates: {
      range1: json.regainRates.range1 * STAT_PRECISION_SCALE,
      range2: json.regainRates.range2 * STAT_PRECISION_SCALE,
      range3: json.regainRates.range3 * STAT_PRECISION_SCALE,
      range4: json.regainRates.range4 * STAT_PRECISION_SCALE,
      range5: json.regainRates.range5 * STAT_PRECISION_SCALE,
    },
    upperModifierLimit: json.upperModifierLimit,
    lowerModifierLimit: json.lowerModifierLimit,
    chargeResistanceModifier: json.chargeResistanceModifier,
    runningMovementPenalty: json.runningMovementPenalty,
    rangedAttackPenalty: json.rangedAttackPenalty,
    meleeAttackPenalty: json.meleeAttackPenalty,
    meleeDefensePenalty: json.meleeDefensePenalty,
  };
}

function scaleAmmo(json: AmmoRule): AmmoRule {
  return {
    baseReserve: json.baseReserve * STAT_PRECISION_SCALE,
    regenerationBaseRate: json.regenerationBaseRate,
    regenerationBonusRate: json.regenerationBonusRate,
  };
}

function scaleOrganization(json: OrganizationRule): OrganizationRule {
  return {
    speedModifier: json.speedModifier,
    maxOrgDebuffMinHpProportion: json.maxOrgDebuffMinHpProportion,
    maxOrgDebuffHp: json.maxOrgDebuffHp,
    maxOrgDebuffStamina: json.maxOrgDebuffStamina,
    maxOrgDebuffStaminaHighProportion: json.maxOrgDebuffStaminaHighProportion,
    maxOrgDebuffStaminaLowProportion: json.maxOrgDebuffStaminaLowProportion,
    maxOrgRangedAttackPenalty: json.maxOrgRangedAttackPenalty,
    maxOrgMeleeAttackBonus: json.maxOrgMeleeAttackBonus,
    maxOrgMeleeAttackPenalty: json.maxOrgMeleeAttackPenalty,
    regainRate: json.regainRate,
    upperModifierLimit: json.upperModifierLimit,
    lowerModifierLimit: json.lowerModifierLimit,
    nearbyUnitsDistance: json.nearbyUnitsDistance,
    nearbyUnitsPositiveOrgBonusCap:
      json.nearbyUnitsPositiveOrgBonusCap * STAT_PRECISION_SCALE,
    nearbyUnitsNegativeOrgBonusCap:
      json.nearbyUnitsNegativeOrgBonusCap * STAT_PRECISION_SCALE,
    nearbyUnitsOrgDamageModifierCap: json.nearbyUnitsOrgDamageModifierCap,
    nearbyUnitsOrgDamageModifierPenaltyCap:
      json.nearbyUnitsOrgDamageModifierPenaltyCap,
    routingUnitNearbyUnitsOrgBonus:
      json.routingUnitNearbyUnitsOrgBonus * STAT_PRECISION_SCALE,
    startedRoutingOrgRadiusModifier: json.startedRoutingOrgRadiusModifier,
    startedRoutingOrgRadiusDistance: json.startedRoutingOrgRadiusDistance,
    startedRoutingOrgRadiusDistanceRunSpeedBonus:
      json.startedRoutingOrgRadiusDistanceRunSpeedBonus,
    routingRunCostModifier: json.routingRunCostModifier,
    startedRoutingRunCostModifier: json.startedRoutingRunCostModifier,
    orgRadiusBonusHpLossReduction: json.orgRadiusBonusHpLossReduction,
    safeOrgRecoveryModifier: json.safeOrgRecoveryModifier,
    safeDistance: json.safeDistance,
    distantThreatOrgRecoveryModifier: json.distantThreatOrgRecoveryModifier,
    distantThreatDistance: json.distantThreatDistance,
    routingOrgRecoveryModifier: json.routingOrgRecoveryModifier,
    maxOrgRecoveryByHpModifier: json.maxOrgRecoveryByHpModifier,
    vpDebuffGraceZone: json.vpDebuffGraceZone,
    vpDebuffMultiplier: json.vpDebuffMultiplier,
  };
}

/**
 * Runtime view of game rules: stamina costs and regain rates, base ammo
 * reserve, and organization caps that compare against scaled stats are
 * multiplied by {@link STAT_PRECISION_SCALE} on construction.
 */
export class GameRules implements GameRulesJson {
  flanking?: FlankingRule;
  stamina?: StaminaRule;
  ammo?: AmmoRule;
  skirmisherSpawning?: SkirmishersRule;
  supplyLines?: SupplyLinesRule;
  entrenchment?: EntrenchmentRule;
  objectives: ObjectivesRule;
  organization: OrganizationRule;
  allyCollision?: AllyCollisionRule;
  tutorial?: TutorialRule;

  constructor(json: GameRulesJson) {
    this.flanking = json.flanking;
    this.skirmisherSpawning = json.skirmisherSpawning;
    this.supplyLines = json.supplyLines;
    this.entrenchment = json.entrenchment;
    this.objectives = json.objectives;
    this.allyCollision = json.allyCollision;
    this.tutorial = json.tutorial;
    this.stamina = json.stamina ? scaleStamina(json.stamina) : undefined;
    this.ammo = json.ammo ? scaleAmmo(json.ammo) : undefined;
    this.organization = scaleOrganization(json.organization);
  }
}
