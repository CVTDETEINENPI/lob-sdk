
/**
 * Generic constructor type for mixins.
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Generic abstract constructor type for mixins.
 */
export type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

/**
 * Interface representing the safety state provided by the WithSafety mixin.
 */
export interface HasSafety {
  /**
   * Safe status updated by the organization system.
   * This is a volatile property not shared over network.
   */
  isSafe: boolean;
}

/**
 * Mixin that adds safety-related state to a unit.
 * Safe status is usually volatile and recalculated every tick.
 */
export function WithSafety<TBase extends AbstractConstructor>(Base: TBase) {
  abstract class Mixed extends Base {
    /**
     * Is the unit safe?
     */
    isSafe?: boolean;
  }
  return Mixed;
}
