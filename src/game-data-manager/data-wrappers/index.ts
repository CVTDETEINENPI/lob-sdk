export { STAT_PRECISION_SCALE } from "./scale";
export {
  MeleeDamageTypeTemplate,
  RangedDamageTypeTemplate,
  type DamageTypeTemplate,
  type DamageTypeTemplateJson,
  type MeleeDamageTypeJson,
  type RangedDamageTypeJson,
  type CircularAoEConfig,
  type TrapezoidalAoeConfig,
  type AoeConfig,
  type DamageTypeRange,
} from "./damage-type-template";
export {
  GameRules,
  type GameRulesJson,
  type FlankingRule,
  type StaminaRule,
  type AmmoRule,
  type SkirmishersRule,
  type SupplyLinesRule,
  type EntrenchmentRule,
  type ObjectivesRule,
  type AllyCollisionRule,
  type TutorialRule,
  type OrganizationRule,
} from "./game-rules";
export {
  GameConstants,
  type GameConstantsJson,
} from "./game-constants";

// `BattleTypeTemplate` class is intentionally NOT re-exported here: its
// name collides with the interface in `@lob-sdk/types/server-game`.
// GameDataManager imports it directly from its module. The `Scenario` class
// shares a name with its JSON-shape interface via declaration merging in
// `./scenario` and is reachable through `@lob-sdk/types` already.
export {
  MeleeUnitTemplate,
  RangedUnitTemplate,
  type UnitTemplateJson,
} from "./unit-template";
export type { BattleTypeTemplateJson } from "./battle-type-template";
