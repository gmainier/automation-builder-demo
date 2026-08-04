import type { AutomationNode } from "../contexts/automation-context";

/**
 * Stub for the AppLovin (Axon) new-campaign resolver.
 *
 * In the app, saving a flow that contains an "Axon: create new campaign" node
 * first creates that campaign in AppLovin, then rewrites the node's config with
 * the returned id so the saved rule points at a real campaign. That is a live,
 * side-effecting integration call and cannot run in this repo.
 *
 * The real module is `lib/resolve-axon-new-campaigns.ts`. The exported types here
 * are copied from it exactly so `automation-context.tsx` compiles and saves
 * unmodified. With no Axon nodes present the real resolver also returns the nodes
 * untouched with `changed: false`, which is every flow this demo can build.
 */

export type CreateAxonCampaign = (options: unknown) => Promise<unknown>;

export interface ResolveAxonNewCampaignsDeps {
  readonly company: string;
  readonly workspaceId: string;
  readonly createCampaign: CreateAxonCampaign;
  readonly now: Date;
}

export type ResolveAxonNewCampaignsResult =
  | { readonly ok: true; readonly nodes: AutomationNode[]; readonly changed: boolean }
  | { readonly ok: false; readonly error: string };

export async function resolveAxonNewCampaignsForSave(
  nodes: AutomationNode[],
  _deps: ResolveAxonNewCampaignsDeps,
): Promise<ResolveAxonNewCampaignsResult> {
  return { ok: true, nodes, changed: false };
}
