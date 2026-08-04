/**
 * Client-safe Canva URL helpers.
 *
 * These pure functions are split out of `canva-import.ts` so client components
 * can import them without pulling in server-only deps (sharp, storage client,
 * prisma) that the import flow uses.
 */

const CANVA_LINK_HOSTNAMES = ["canva.link", "canva.com"] as const;

export function isCanvaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return CANVA_LINK_HOSTNAMES.some(
      (hostname) => parsed.hostname === hostname || parsed.hostname.endsWith(`.${hostname}`),
    );
  } catch {
    return false;
  }
}

export function extractCanvaDesignId(url: string): string | null {
  const match = url.match(/\/design\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Extract a 1-based page number from a Canva view URL's `#N` anchor
 * (e.g. .../view#2 — how Canva addresses pages in shared view links).
 * Returns null when the anchor is missing or not a plain positive integer.
 */
export function extractCanvaPageFromUrl(url: string): number | null {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const fragment = url.slice(hashIndex + 1).trim();
  if (!/^\d+$/.test(fragment)) return null;
  const page = Number(fragment);
  return page > 0 ? page : null;
}

export type CanvaVideoOrientation = "horizontal" | "vertical";

// Aspect ratios within 5% of 1:1 are treated as square — mirrors the launch
// UI's SQUARE_RATIO_TOLERANCE so both layers classify designs identically.
const CANVA_SQUARE_RATIO_TOLERANCE = 0.05;

/**
 * Derive the MP4 export orientation from design/thumbnail dimensions.
 * Canva thumbnails preserve the design's aspect ratio, so the thumbnail's
 * width/height is a reliable orientation signal even though the API never
 * exposes the design's own pixel size. Returns undefined for square or
 * missing dimensions — the quality ladder then hedges both orientations.
 */
export function inferCanvaVideoOrientation(
  width: number | null | undefined,
  height: number | null | undefined,
): CanvaVideoOrientation | undefined {
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  const ratio = width / height;
  if (ratio > 1 + CANVA_SQUARE_RATIO_TOLERANCE) return "horizontal";
  if (ratio < 1 - CANVA_SQUARE_RATIO_TOLERANCE) return "vertical";
  return undefined;
}
