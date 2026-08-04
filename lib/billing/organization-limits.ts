/**
 * Plan entitlements.
 *
 * The product resolves these from a Stripe subscription: a plans table maps
 * price ids to entitlements, then overrides, add-ons and subscription status are
 * layered on top. None of that is reachable here, and the pricing table itself is
 * commercial information, so this repo answers the one question the automation UI
 * actually asks — "which plan is this organization on?" — from the organization's
 * own `plan` field.
 *
 * The `essential` tier is the only value with behaviour attached: it restricts
 * which triggers an automation may use. Everything else reads as unrestricted.
 */

const FREE_PLAN_NAME = "free";

export interface OrganizationLimits {
  basePlanName: string;
  effectivePlanName: string;
  canLaunch: boolean;
}

interface OrganizationLike {
  plan?: string | null;
  planOverride?: string | null;
}

/**
 * Resolves an organization's effective plan.
 *
 * @param organization - The organization, or null/undefined for a signed-out user.
 * @returns Its base and effective plan name. An override wins over the base plan,
 *   matching the product's precedence.
 */
export function getEffectiveOrganizationLimits(organization: OrganizationLike | null | undefined): OrganizationLimits {
  const basePlanName = organization?.plan?.trim().toLowerCase() || FREE_PLAN_NAME;
  const override = organization?.planOverride?.trim().toLowerCase();
  const effectivePlanName = override || basePlanName;

  return {
    basePlanName,
    effectivePlanName,
    canLaunch: effectivePlanName !== FREE_PLAN_NAME,
  };
}
