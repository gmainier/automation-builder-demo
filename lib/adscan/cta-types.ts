/**
 * Canonical Adscan CTA enum used by automation triggers.
 *
 * Why a local constant instead of fetching from Adscan?
 * - Adscan stores CTA copy as free text on `adCard.ctaText` (no enum column);
 *   the backend filter (`packages/api/src/trpc/router/ads/adFilters.ts`) takes
 *   the value, replaces underscores with spaces, and runs `ILIKE %text%`
 *   against the column. So the wire value (`SHOP_NOW`) only matters for
 *   round-tripping from the UI — it's not a database enum.
 * - The canonical option list lives in adscan-web's discovery filter UI at
 *   `packages/ui/src/discovery/search-header/SearchHeader.tsx` (`CTA_OPTIONS`).
 *   This file mirrors that list 1:1 so the Automation Builder trigger-config dropdown
 *   shows the same set of values users see on Adscan.
 *
 * If upstream adds a new CTA type, sync this file (search for `CTA_OPTIONS`
 * in adscan-web). The wire format (`SHOP_NOW` style — uppercase + underscores)
 * matches what `adFilters.ts` expects: it converts underscores to spaces
 * before the `ILIKE` match, so `SHOP_NOW` matches an `adCard.ctaText` of
 * "Shop Now".
 *
 * @see an earlier fix — Adscan automation: pre-populate CTA type field with real options
 * @see packages/ui/src/discovery/search-header/SearchHeader.tsx (upstream source)
 * @see packages/api/src/trpc/router/ads/adFilters.ts (backend filter — uses ilike)
 */

export interface AdscanCtaOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Canonical CTA options exposed in the Adscan trigger-config dropdown.
 * Order mirrors the upstream discovery filter UI (alphabetical by label).
 */
export const ADSCAN_CTA_OPTIONS: readonly AdscanCtaOption[] = [
  { value: "APPLY_NOW", label: "Apply Now" },
  { value: "BOOK_TRAVEL", label: "Book Travel" },
  { value: "BUY_NOW", label: "Buy Now" },
  { value: "BUY_TICKETS", label: "Buy Tickets" },
  { value: "CALL_NOW", label: "Call Now" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "DONATE_NOW", label: "Donate Now" },
  { value: "DOWNLOAD", label: "Download" },
  { value: "EVENT_RSVP", label: "Event RSVP" },
  { value: "GET_DIRECTIONS", label: "Get Directions" },
  { value: "GET_OFFER", label: "Get Offer" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "INSTAGRAM_MESSAGE", label: "Instagram Message" },
  { value: "INSTALL_APP", label: "Install App" },
  { value: "INSTALL_MOBILE_APP", label: "Install Mobile App" },
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "LIKE_PAGE", label: "Like Page" },
  { value: "LISTEN_NOW", label: "Listen Now" },
  { value: "MESSAGE_PAGE", label: "Message Page" },
  { value: "NO_BUTTON", label: "No Button" },
  { value: "ORDER_NOW", label: "Order Now" },
  { value: "PLAY_GAME", label: "Play Game" },
  { value: "REQUEST_TIME", label: "Request Time" },
  { value: "SEE_MENU", label: "See Menu" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "SUBSCRIBE", label: "Subscribe" },
  { value: "USE_APP", label: "Use App" },
  { value: "USE_MOBILE_APP", label: "Use Mobile App" },
  { value: "VIEW_INSTAGRAM_PROFILE", label: "View Instagram Profile" },
  { value: "WATCH_MORE", label: "Watch More" },
  { value: "WHATSAPP_MESSAGE", label: "WhatsApp Message" },
] as const;

/**
 * Resolve a stored CTA value back to its display label. Returns the value
 * itself when unknown — covers legacy free-text saves from before the
 * dropdown change (the comma-separated input let users type anything).
 *
 * Matching is case-insensitive on the underlying value so a saved
 * `shop_now` still resolves to "Shop Now".
 */
export function getAdscanCtaLabel(value: string): string {
  const normalized = value.trim().toUpperCase();
  const match = ADSCAN_CTA_OPTIONS.find((opt) => opt.value === normalized);
  return match ? match.label : value;
}

/**
 * Return true when `value` is one of the canonical CTA wire values.
 * Used to gate UI affordances that only make sense for known options
 * (legacy free-text values are still rendered but flagged differently).
 */
export function isCanonicalAdscanCta(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return ADSCAN_CTA_OPTIONS.some((opt) => opt.value === normalized);
}
