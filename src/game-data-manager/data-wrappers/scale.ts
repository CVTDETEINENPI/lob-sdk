/**
 * Internal scale factor applied to resource stats (hp, org, stamina, ammo,
 * attack/defense, costs, regain rates) when JSON is loaded into the wrapper
 * template classes. Stats live in JSON at human-readable magnitude and are
 * multiplied by this factor at construction time so runtime math can use
 * Math.round without losing precision. Divide by it before showing values
 * in the UI.
 */
export const STAT_PRECISION_SCALE = 100;
