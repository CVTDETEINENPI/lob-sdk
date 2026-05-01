import type {
  BattleTypeTemplate as BattleTypeTemplateInterface,
  UnitCounts,
  UnitType,
} from "@lob-sdk/types";
import { STAT_PRECISION_SCALE } from "./scale";

/** Raw shape of a battle-types.json entry (unscaled). */
export type BattleTypeTemplateJson = BattleTypeTemplateInterface;

/**
 * Runtime view of a battle type with `ammoReserve` and `goldToAmmoRate`
 * multiplied by {@link STAT_PRECISION_SCALE}.
 */
export class BattleTypeTemplate implements BattleTypeTemplateInterface {
  manpower: number;
  gold: number;
  ammoReserve: number;
  goldToAmmoRate: number;
  skirmisherRatio?: number[];
  unitCaps: Record<UnitType, number>;
  ticksToCaptureSmall: number;
  ticksToCaptureBig: number;
  bigVps: number;
  smallVps: number;
  defaultArmy: UnitCounts;
  logistics?: number;
  mapSize: Array<string>;
  premiumCurrencyChance: number;
  ranked?: boolean;

  constructor(json: BattleTypeTemplateJson) {
    this.manpower = json.manpower;
    this.gold = json.gold;
    this.ammoReserve = json.ammoReserve * STAT_PRECISION_SCALE;
    this.goldToAmmoRate = json.goldToAmmoRate * STAT_PRECISION_SCALE;
    this.skirmisherRatio = json.skirmisherRatio;
    this.unitCaps = json.unitCaps;
    this.ticksToCaptureSmall = json.ticksToCaptureSmall;
    this.ticksToCaptureBig = json.ticksToCaptureBig;
    this.bigVps = json.bigVps;
    this.smallVps = json.smallVps;
    this.defaultArmy = json.defaultArmy;
    this.logistics = json.logistics;
    this.mapSize = json.mapSize;
    this.premiumCurrencyChance = json.premiumCurrencyChance;
    this.ranked = json.ranked;
  }
}
