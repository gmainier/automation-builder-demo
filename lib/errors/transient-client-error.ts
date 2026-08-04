type ClientErrorLike = Pick<Error, "message" | "name">;

/** Stable name so the error survives serialization boundaries and can be matched by classifiers. */
export const STREAM_STALLED_ERROR_NAME = "StreamStalledError";

/**
 * Raised by the chat SSE reader when no bytes arrive within the idle timeout. In production a proxy
 * or load balancer can silently reap the socket mid-stream: the underlying `reader.read()` then
 * neither resolves nor rejects, so without this watchdog the client hangs forever. We surface it as
 * a typed, retryable error instead.
 */
export class StreamStalledError extends Error {
  constructor(message = "The response stream stalled and was closed.") {
    super(message);
    this.name = STREAM_STALLED_ERROR_NAME;
  }
}

const NETWORK_ERROR_MESSAGES = new Set([
  "network error",
  "failed to fetch",
  "networkerror when attempting to fetch resource.",
]);

const ROUTE_LOAD_ERROR_MESSAGES = new Set(["connection closed", "connection closed."]);

// React's opaque production message when a Server Component render is interrupted (most often the
// RSC flight stream is severed in transit by a proxy / flaky network). The real error is omitted and
// only a digest is exposed, so the message text is a stable fingerprint we can match on.
const SERVER_COMPONENTS_RENDER_SIGNATURE = "error occurred in the server components render";

export function isBrowserNetworkError(error: ClientErrorLike): boolean {
  const message = error.message.toLowerCase();
  const name = error.name;

  return (
    NETWORK_ERROR_MESSAGES.has(message) ||
    message.includes("network request failed") ||
    message.includes("fetch failed") ||
    (name === "TypeError" && message.includes("network")) ||
    (name === "TypeError" && message.includes("failed to fetch"))
  );
}

export function isInputStreamError(error: ClientErrorLike): boolean {
  const message = error.message.toLowerCase();
  const name = error.name;

  return (
    (name === "TypeError" && message.includes("input stream")) ||
    message.includes("error in input stream") ||
    message.includes("body stream") ||
    message.includes("stream unexpectedly ended")
  );
}

export function isRouteLoadConnectionError(error: ClientErrorLike): boolean {
  return ROUTE_LOAD_ERROR_MESSAGES.has(error.message.toLowerCase().trim());
}

export function isStreamStalledError(error: ClientErrorLike): boolean {
  return error.name === STREAM_STALLED_ERROR_NAME;
}

/**
 * True for transient stream failures that are safe to auto-retry: a browser network drop, a severed
 * body/input stream, or our own idle-timeout stall. Domain and HTTP-status errors are excluded so we
 * never silently re-run a request the server rejected for a real reason.
 */
export function isRetryableStreamError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return isBrowserNetworkError(error) || isInputStreamError(error) || isStreamStalledError(error);
}

export function isServerComponentsRenderError(error: ClientErrorLike): boolean {
  return error.message.toLowerCase().includes(SERVER_COMPONENTS_RENDER_SIGNATURE);
}

export function isRecoverableRouteLoadError(error: ClientErrorLike): boolean {
  return isInputStreamError(error) || isRouteLoadConnectionError(error) || isServerComponentsRenderError(error);
}
