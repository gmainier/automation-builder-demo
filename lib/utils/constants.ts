/**
 * Shared constants.
 *
 * The original also carried a staff email allowlist, an internal organization id
 * and internal storage hostnames. None of that belongs in a public repo, so only
 * what this project reads survives.
 */

/**
 * Staff-bypass allowlist.
 *
 * Deliberately empty. In the product this lets internal staff skip plan gating;
 * empty means the gate applies uniformly, which is right for a single mock user.
 */
export const STAFF_DEBUG_USERS: readonly string[] = [];
