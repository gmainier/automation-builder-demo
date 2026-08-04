/** The exact inline value Radix writes to lock a layer. */
const POINTER_EVENTS_LOCK = "none";

/**
 * Open Radix modal content. While a higher modal is open, Radix disables the
 * layers beneath it by writing inline `pointer-events: none` on their content.
 */
const OPEN_MODAL_CONTENT_SELECTOR = '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]';

/** Minimal slice of an element we mutate — keeps the helper unit-testable. */
type LockableElement = { style: { pointerEvents: string } };

function unlock(element: LockableElement | null | undefined): boolean {
  if (element && element.style.pointerEvents === POINTER_EVENTS_LOCK) {
    element.style.pointerEvents = "";
    return true;
  }
  return false;
}

function resolveDocument(doc?: Document | null): Document | null {
  if (doc !== undefined) return doc;
  return typeof document === "undefined" ? null : document;
}

/**
 * Clears a stuck Radix `pointer-events: none` lock that survives a modal close.
 *
 * Two mechanisms, depending on the layer kind:
 *  - **Dialog over dialog** (the launch Partnership Ads freeze): Radix locks the
 *    *underlying* dialog content while the higher one is open. If that lock is
 *    not restored when the higher dialog closes, the now-topmost dialog is
 *    frozen — so we re-enable the topmost still-open dialog/alertdialog content.
 *  - **Popover/Select (modal) and older Radix Dialog**: the lock lands on
 *    `document.body`, so we clear that too.
 *
 * No-op unless something is genuinely locked, so it is safe on every close.
 * Lower layers in a deeper stack stay locked — only the topmost open content is
 * touched. Pass `null` (or run during SSR) and it returns `false`.
 *
 * @see https://github.com/radix-ui/primitives/issues/1241
 * @returns `true` when a stuck lock was cleared, otherwise `false`.
 */
export function releaseStuckModalPointerEvents(doc?: Document | null): boolean {
  const target = resolveDocument(doc);
  if (!target) return false;

  let healed = unlock(target.body);

  const openContents = target.querySelectorAll<HTMLElement>(OPEN_MODAL_CONTENT_SELECTOR);
  const topmost = openContents.length > 0 ? openContents[openContents.length - 1] : null;
  healed = unlock(topmost) || healed;

  return healed;
}

/**
 * Defers {@link releaseStuckModalPointerEvents} to the next macrotask.
 *
 * Use from a modal's close callback (e.g. `onCloseAutoFocus`): Radix restores
 * its locks synchronously while closing, so we wait one tick to only clear a
 * lock it genuinely left stuck. Falls back to a synchronous clear when there is
 * no `window` (server-side render).
 */
export function scheduleReleaseStuckModalPointerEvents(): void {
  if (typeof window === "undefined") {
    releaseStuckModalPointerEvents();
    return;
  }
  window.setTimeout(() => releaseStuckModalPointerEvents(), 0);
}
