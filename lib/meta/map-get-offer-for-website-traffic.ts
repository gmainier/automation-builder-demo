/** Keep in sync with apps/launcher/.../map-get-offer-for-website-traffic.ts. */

export const WEBSITE_DESTINATION_OBJECTIVES = [
  "OUTCOME_SALES",
  "OUTCOME_TRAFFIC",
  "OUTCOME_LEADS",
  "CONVERSIONS",
  "LINK_CLICKS",
  "LEAD_GENERATION",
  "PRODUCT_CATALOG_SALES",
] as const;

export interface MapGetOfferContext {
  readonly link?: string;
  readonly isLeadGenForm?: boolean;
  readonly objective?: string;
  readonly destinationType?: string;
}

function hasWebsiteLink(link: string | undefined): boolean {
  return link !== undefined && link !== "" && typeof link === "string" && /^https?:\/\//i.test(link.trim());
}

export function shouldMapGetOfferToGetOfferView(context: MapGetOfferContext): boolean {
  if (context.isLeadGenForm) {
    return false;
  }
  if (context.destinationType === "MESSENGER" || context.destinationType === "ON_EVENT") {
    return false;
  }
  if (
    context.objective === "OUTCOME_APP_PROMOTION" ||
    context.objective === "APP_INSTALLS" ||
    context.objective === "MESSAGES"
  ) {
    return false;
  }
  if (hasWebsiteLink(context.link)) {
    return true;
  }
  const objective = context.objective?.trim();
  if (objective && (WEBSITE_DESTINATION_OBJECTIVES as readonly string[]).includes(objective)) {
    return true;
  }
  return false;
}

export function mapGetOfferForWebsiteTraffic(cta: string, context: MapGetOfferContext = {}): string {
  const trimmed = cta.trim();
  if (trimmed !== "GET_OFFER") {
    return trimmed;
  }
  if (!shouldMapGetOfferToGetOfferView(context)) {
    return trimmed;
  }
  return "GET_OFFER_VIEW";
}

export function normalizeMetaCtaForQaComparison(cta: string | undefined, context: MapGetOfferContext): string {
  if (!cta) {
    return "";
  }
  return mapGetOfferForWebsiteTraffic(cta, context);
}

export function needsGetOfferViewLiveFix(liveCta: string | undefined, context: MapGetOfferContext): boolean {
  const live = liveCta?.trim().toUpperCase();
  if (live !== "GET_OFFER") {
    return false;
  }
  return shouldMapGetOfferToGetOfferView(context);
}

export function resolveGetOfferViewFixTargetCta(
  currentCta: string | undefined,
  context: MapGetOfferContext,
): "GET_OFFER_VIEW" | "LEARN_MORE" | null {
  if (needsGetOfferViewLiveFix(currentCta, context)) {
    return "GET_OFFER_VIEW";
  }
  return null;
}
