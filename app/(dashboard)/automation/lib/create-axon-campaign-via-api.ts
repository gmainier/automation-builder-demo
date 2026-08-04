/**
 * Stub for the AppLovin (Axon) campaign-create call.
 *
 * The real module posts to the Axon API and returns the new campaign id. It is
 * only ever reached through `resolveAxonNewCampaignsForSave`, which this repo
 * stubs out, so this exists to keep the import in `automation-context.tsx`
 * resolvable and that file unedited.
 */

export async function createAxonCampaignViaApi(_options: unknown): Promise<unknown> {
  return { ok: false, error: "AppLovin is not connected in this demo." };
}
