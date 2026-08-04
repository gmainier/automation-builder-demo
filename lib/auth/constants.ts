export const PASSWORD_RESET_TOKEN_EXPIRY = 1 * 60 * 60; // 1 hour

export const MAX_LOGIN_ATTEMPTS = 10;

export const EMAIL_OTP_EXPIRY_IN = 2 * 60; // 2 minutes

export const USER_ROLES_ENUM = [
  "owner",
  "admin",
  "member",
  "editor",
  "launcher",
  "drafter",
  "uploader",
  "analyst",
  "commenter",
] as const;

export type UserRole = (typeof USER_ROLES_ENUM)[number];

/**
 * Roles a team admin can assign from the team role picker. Excludes `owner`
 * (org creator only) and the legacy `member` default, which is never chosen
 * explicitly.
 */
export const ASSIGNABLE_USER_ROLES = [
  "admin",
  "editor",
  "launcher",
  "drafter",
  "uploader",
  "analyst",
  "commenter",
] as const satisfies readonly UserRole[];

export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

/**
 * Roles an invite may be created with: everything except `owner`, which is
 * conferred by creating the org, never by invitation.
 */
export const INVITABLE_USER_ROLES: readonly UserRole[] = USER_ROLES_ENUM.filter((role) => role !== "owner");

/**
 * Roles accepted when redeeming an invite. Wider than INVITABLE because
 * pre-existing invites and memberships can carry any stored role, including
 * `owner`.
 */
export const JOINABLE_USER_ROLES: readonly UserRole[] = USER_ROLES_ENUM;

export function isInvitableUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && (INVITABLE_USER_ROLES as readonly string[]).includes(role);
}

export function isJoinableUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && (JOINABLE_USER_ROLES as readonly string[]).includes(role);
}
