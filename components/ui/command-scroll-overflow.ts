export interface ScrollOverflowState {
  readonly top: boolean;
  readonly bottom: boolean;
}

export interface ScrollOverflowMetrics {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

/**
 * Computes fade-edge visibility for a scrollable command list.
 * Returns the previous state reference when nothing changed so React can skip re-renders.
 * Without that bailout, MutationObserver/ResizeObserver storms re-render every list row on open.
 */
export function nextScrollOverflowState(
  previous: ScrollOverflowState,
  metrics: ScrollOverflowMetrics,
): ScrollOverflowState {
  const top = metrics.scrollTop > 1;
  const bottom = metrics.scrollTop + metrics.clientHeight < metrics.scrollHeight - 1;
  if (previous.top === top && previous.bottom === bottom) {
    return previous;
  }
  return { top, bottom };
}
