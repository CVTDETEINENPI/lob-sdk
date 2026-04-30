import {
  GameScenarioType,
  LegacyHybridScenario,
  LegacyPresetScenario,
  LegacyRandomScenario,
  Scenario,
} from "@lob-sdk/types";
import { SCENARIO_SCHEMA_VERSION } from "./constants";

/** Any shape the normalizer accepts: current {@link Scenario} or a legacy type. */
export type RawScenarioInput =
  | Scenario
  | LegacyPresetScenario
  | LegacyHybridScenario
  | LegacyRandomScenario;

/**
 * Normalize any scenario input into the current feature-based {@link Scenario}
 * schema. Current-schema scenarios are returned unchanged; legacy shapes are
 * migrated based on their `type` discriminator.
 */
export function normalizeScenario(raw: RawScenarioInput): Scenario {
  if (_isCurrent(raw)) return _backfillCurrent(raw);
  switch (raw.type) {
    case GameScenarioType.Preset:
      return _fromPreset(raw);
    case GameScenarioType.Hybrid:
      return _fromHybrid(raw);
    case GameScenarioType.Random:
      return _fromRandom(raw);
    default: {
      const _exhaustive: never = raw;
      throw new Error(
        `Unknown scenario shape: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}

// Scenarios authored before `allowDeploymentPhase` existed fall back to the
// old coupling: dynamic-army implied a deployment phase, fixed-roster skipped
// it. Warn so an author who forgot the flag sees it instead of debugging a
// missing-feature symptom.
const _backfillCurrent = (raw: Scenario): Scenario => {
  if (raw.allowDeploymentPhase !== undefined) return raw;
  const fallback = raw.allowDynamicArmy === true;
  console.warn(
    `[normalizeScenario] "${raw.name}" missing 'allowDeploymentPhase' (using ${fallback}).`,
  );
  return { ...raw, allowDeploymentPhase: fallback };
};

const _isCurrent = (raw: RawScenarioInput): raw is Scenario =>
  raw.version === SCENARIO_SCHEMA_VERSION;

const _baseFields = (
  raw: LegacyPresetScenario | LegacyHybridScenario | LegacyRandomScenario,
) => ({
  version: SCENARIO_SCHEMA_VERSION,
  name: raw.name,
  description: raw.description,
  ranked: raw.ranked,
  hidden: raw.hidden,
  triggers: raw.triggers,
  conquestVictory: raw.conquestVictory,
  locales: raw.locales,
});

const _fromPreset = (raw: LegacyPresetScenario): Scenario => ({
  ..._baseFields(raw),
  map: raw.map,
  players: raw.players,
  units: raw.units,
  objectives: raw.objectives,
  allowDynamicArmy: false,
  allowDeploymentPhase: false,
});

const _fromHybrid = (raw: LegacyHybridScenario): Scenario => ({
  ..._baseFields(raw),
  map: raw.map,
  units: raw.units ?? [],
  objectives: raw.objectives ?? [],
  allowDynamicArmy: raw.fixedArmy !== true,
  // Legacy hybrids always granted a deployment phase regardless of fixedArmy,
  // so the player could reposition the pre-placed roster. Preserve that.
  allowDeploymentPhase: true,
});

const _fromRandom = (raw: LegacyRandomScenario): Scenario => ({
  ..._baseFields(raw),
  baseTerrain: raw.baseTerrain,
  instructions: raw.instructions,
  randomDeploymentZones: raw.defaultDeploymentZones,
  scaledDeploymentZones: raw.scaledDeploymentZones,
  allowDynamicArmy: true,
  allowDeploymentPhase: true,
});
