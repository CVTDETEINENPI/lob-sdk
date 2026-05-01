import type { UnitCategoryId } from "@lob-sdk/types";
import { STAT_PRECISION_SCALE } from "./scale";

export interface CircularAoEConfig {
  type: "circular";
  ranges: {
    start: number;
    end: number;
    startRadius: number;
    endRadius: number;
  }[];
  edgeDamageModifier: number;
  absorptionModifier?: number;
}

export interface TrapezoidalAoeConfig {
  type: "trapezoidal";
  ranges: {
    start: number;
    end: number;
    startTopWidth: number;
    endTopWidth: number;
    startBottomWidth: number;
    endBottomWidth: number;
    startHeight: number;
    endHeight: number;
  }[];
  absorptionModifier?: number;
  offset?: number;
  elevationModifiers?: {
    heightModifierPerLevel: number;
    damageModifierPerLevel: number;
    maxElevationDiff: number;
  };
}

export type AoeConfig = CircularAoEConfig | TrapezoidalAoeConfig;

export interface DamageTypeRange {
  start: number;
  end: number;
  startMod: number;
  endMod: number;
  name?: string;
}

/** Raw shape for a melee entry in `damage-types.json`. */
export interface MeleeDamageTypeJson {
  id: number;
  name: string;
  ranged?: false;
  ammoCost?: never;
  damageModifier?: number;
  orgDamageRatio: number;
  cannotChargeAgainst?: UnitCategoryId[];
  reorgDebuff?: number;
  attackEffectDuration?: number;
  imageAlias?: string;
}

/** Raw shape for a ranged entry in `damage-types.json`. */
export interface RangedDamageTypeJson {
  id: number;
  name: string;
  ranged: true;
  projectileWidth: number;
  damageModifier?: number;
  orgDamageRatio: number;
  orgModifierByTargetOrg?: { start: number; end: number; modifier: number };
  damageModifierByTargetHp?: { start: number; end: number; modifier: number };
  ranges: DamageTypeRange[];
  arcHeight?: number;
  areaOfEffect: AoeConfig;
  enfiladeFire?: boolean;
  cannotUseAfterRun?: boolean;
  projectilePenetration?: number;
  shotSound: string;
  shotAnim: string;
  shotImpactAnim?: string;
  ammoCost?: number;
  reorgDebuff?: number;
  attackEffectDuration?: number;
  extendRange?: boolean;
  imageAlias?: string;
}

export type DamageTypeTemplateJson = MeleeDamageTypeJson | RangedDamageTypeJson;

/** Runtime view of a melee damage type with `orgDamageRatio` scaled. */
export class MeleeDamageTypeTemplate implements MeleeDamageTypeJson {
  id: number;
  name: string;
  ranged?: false;
  ammoCost?: never;
  damageModifier?: number;
  orgDamageRatio: number;
  cannotChargeAgainst?: UnitCategoryId[];
  reorgDebuff?: number;
  attackEffectDuration?: number;
  imageAlias?: string;

  constructor(json: MeleeDamageTypeJson) {
    this.id = json.id;
    this.name = json.name;
    this.ranged = json.ranged;
    this.damageModifier = json.damageModifier;
    this.orgDamageRatio = json.orgDamageRatio * STAT_PRECISION_SCALE;
    this.cannotChargeAgainst = json.cannotChargeAgainst;
    this.reorgDebuff = json.reorgDebuff;
    this.attackEffectDuration = json.attackEffectDuration;
    this.imageAlias = json.imageAlias;
  }
}

/**
 * Runtime view of a ranged damage type with `orgDamageRatio` and `ammoCost`
 * scaled.
 */
export class RangedDamageTypeTemplate implements RangedDamageTypeJson {
  id: number;
  name: string;
  ranged: true;
  projectileWidth: number;
  damageModifier?: number;
  orgDamageRatio: number;
  orgModifierByTargetOrg?: { start: number; end: number; modifier: number };
  damageModifierByTargetHp?: { start: number; end: number; modifier: number };
  ranges: DamageTypeRange[];
  arcHeight?: number;
  areaOfEffect: AoeConfig;
  enfiladeFire?: boolean;
  cannotUseAfterRun?: boolean;
  projectilePenetration?: number;
  shotSound: string;
  shotAnim: string;
  shotImpactAnim?: string;
  ammoCost?: number;
  reorgDebuff?: number;
  attackEffectDuration?: number;
  extendRange?: boolean;
  imageAlias?: string;

  constructor(json: RangedDamageTypeJson) {
    this.id = json.id;
    this.name = json.name;
    this.ranged = true;
    this.projectileWidth = json.projectileWidth;
    this.damageModifier = json.damageModifier;
    this.orgDamageRatio = json.orgDamageRatio * STAT_PRECISION_SCALE;
    this.orgModifierByTargetOrg = json.orgModifierByTargetOrg;
    this.damageModifierByTargetHp = json.damageModifierByTargetHp;
    this.ranges = json.ranges;
    this.arcHeight = json.arcHeight;
    this.areaOfEffect = json.areaOfEffect;
    this.enfiladeFire = json.enfiladeFire;
    this.cannotUseAfterRun = json.cannotUseAfterRun;
    this.projectilePenetration = json.projectilePenetration;
    this.shotSound = json.shotSound;
    this.shotAnim = json.shotAnim;
    this.shotImpactAnim = json.shotImpactAnim;
    this.ammoCost =
      json.ammoCost === undefined
        ? undefined
        : json.ammoCost * STAT_PRECISION_SCALE;
    this.reorgDebuff = json.reorgDebuff;
    this.attackEffectDuration = json.attackEffectDuration;
    this.extendRange = json.extendRange;
    this.imageAlias = json.imageAlias;
  }
}

export type DamageTypeTemplate = MeleeDamageTypeTemplate | RangedDamageTypeTemplate;
