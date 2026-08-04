import { useEffect } from "react";

import { scheduleReleaseStuckModalPointerEvents } from "@/lib/dom/release-stuck-modal-pointer-events";

/**
 * Defense-in-depth companion to the shared dialogs' `onCloseAutoFocus` healing:
 * clears a stuck Radix `pointer-events: none` modal lock when the component is
 * removed *while still open* (e.g. a route change or conditional unmount), where
 * the close callback never fires.
 *
 * Without this, closing a dialog opened on top of another dialog can leave the
 * underlying dialog's buttons unclickable (e.g. picking a partner in the launch
 * Partnership Ads dialog froze the configuration dialog underneath it).
 *
 * @see https://github.com/radix-ui/primitives/issues/1241
 */
export function useReleaseStuckModalPointerEventsOnUnmount(): void {
  useEffect(() => {
    // Defer past Radix's synchronous on-close restore so we only clear a lock
    // it actually left behind.
    return () => scheduleReleaseStuckModalPointerEvents();
  }, []);
}
