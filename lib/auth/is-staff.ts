import { STAFF_DEBUG_USERS } from "@/lib/utils/constants";

/** Email domain treated as internal staff. Set for your own org if you reuse this. */
const STAFF_EMAIL_DOMAIN = "@example.internal";

/**
 * True when the email belongs to internal staff, either by domain or by the
 * explicit allowlist.
 */
export function isStaffEmail(email?: string | null) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return normalized.endsWith(STAFF_EMAIL_DOMAIN) || STAFF_DEBUG_USERS.map((e) => e.toLowerCase()).includes(normalized);
}

/**
 * Strict check: domain only, ignoring the allowlist.
 *
 * Used where the original guard was domain-based. `isStaffEmail` also admits the
 * allowlist, which can contain external accounts and would widen access.
 */
export function isStaffDomainEmail(email?: string | null) {
  if (!email) return false;
  return email.toLowerCase().trim().endsWith(STAFF_EMAIL_DOMAIN);
}
