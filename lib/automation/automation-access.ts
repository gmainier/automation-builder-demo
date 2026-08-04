import { getPermissionsByRole, type PermissionAction } from "@/lib/api/rbac/permissions";
import { USER_ROLES_ENUM } from "@/lib/auth/constants";

type Role = (typeof USER_ROLES_ENUM)[number];

export const MANAGE_AUTOMATIONS_PERMISSION: PermissionAction = "adaccounts.write";

export function isKnownRole(role: string | null | undefined): role is Role {
  return USER_ROLES_ENUM.some((knownRole) => knownRole === role);
}

export function canManageAutomationRules(role: string | null | undefined): boolean {
  if (!isKnownRole(role)) {
    return false;
  }

  // Roles hidden from the Automations area must not manage automations either,
  // even when they hold the write permission (launchers keep `adaccounts.write`
  // for launching but are denied here).
  if (!canViewAutomations(role)) {
    return false;
  }

  return getPermissionsByRole(role).includes(MANAGE_AUTOMATIONS_PERMISSION);
}

/**
 * Roles that must not see or open the Automations area at all (sidebar link +
 * page route), per an earlier fix (analyst, commenter) and Ced's 2026-07-02 request
 * (launcher). This is a deny-list, intentionally separate from
 * MANAGE_AUTOMATIONS_PERMISSION (which gates create/edit/run): the manage
 * permission (`adaccounts.write`) excludes `owner` and `member`, so reusing it
 * as a view gate would wrongly lock those roles out of automations entirely.
 *
 * `drafter` is here for the same reason as `launcher`: it holds
 * `adaccounts.write` so it can save launch drafts, but an agency's client must
 * not author automations against the ad account.
 */
export const AUTOMATIONS_RESTRICTED_ROLES: readonly Role[] = ["analyst", "commenter", "launcher", "drafter"];

/**
 * Whether a role is allowed to view/navigate to the Automations area.
 *
 * Permissive by default: only the explicitly restricted roles are blocked.
 * Unknown / missing roles (e.g. while the user is still loading) return `true`
 * so we never flash an access-denied screen before the real role resolves.
 */
export function canViewAutomations(role: string | null | undefined): boolean {
  return !AUTOMATIONS_RESTRICTED_ROLES.some((restrictedRole) => restrictedRole === role);
}
