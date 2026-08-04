// Shared types and helpers for cross-channel ad launching
// This file has NO server-side imports (no Prisma, no DB) so it's safe to use in client components.

export type CrossChannelPlatform = "tiktok" | "snapchat" | "pinterest" | "axon";

/**
 * Get platform-specific ad group label
 */
export function getAdGroupLabel(platform: CrossChannelPlatform): string {
  const labels: Record<CrossChannelPlatform, string> = {
    tiktok: "Ad Group",
    snapchat: "Ad Squad",
    pinterest: "Ad Group",
    axon: "Creative Set",
  };
  return labels[platform];
}
