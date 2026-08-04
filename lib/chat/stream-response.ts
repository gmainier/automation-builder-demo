// Wrap the agent event generator in an SSE Response, always emitting a terminal
// [DONE] frame and tearing down the MCP session afterward.

import { encodeComment, encodeDone, encodeEvent } from "./sse";
import { normalizeChatError } from "./error-debug";
import type { ChatErrorStreamEvent, ChatStreamEvent } from "./types";

/**
 * Cadence of the keep-alive SSE comment while a slow tool call runs. Kept under common proxy /
 * load-balancer idle timeouts (~30-60s) so the socket is not reaped mid-stream. The client's idle
 * read timeout is a multiple of this, so a couple of missed heartbeats do not false-trip it.
 */
export const HEARTBEAT_INTERVAL_MS = 10_000;

export function streamAgentResponse(
  generator: AsyncGenerator<ChatStreamEvent>,
  prelude: readonly ChatStreamEvent[],
  close: () => Promise<void>,
  onCancel?: () => void,
  onErrorEvent?: (event: ChatErrorStreamEvent) => void,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Enqueue one SSE frame and, for failed-turn `error` events, notify the
      // optional observer. The observer is best-effort — a throw from it must
      // never break the response stream or skip the teardown below.
      const emit = (event: ChatStreamEvent): void => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
        if (event.type === "error" && onErrorEvent) {
          try {
            onErrorEvent(event);
          } catch {
            // swallow — alerting failures must not affect the user's stream
          }
        }
      };
      // Proxies reap idle SSE connections during long tool runs. A periodic
      // comment frame keeps the socket warm; parseEvents ignores it, so it never
      // reaches the client as an event or trips hasAssistantOutput.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(encodeComment()));
        } catch {
          // controller already closed — nothing left to keep alive
        }
      }, HEARTBEAT_INTERVAL_MS);
      try {
        for (const event of prelude) emit(event);
        for await (const event of generator) emit(event);
      } catch (error) {
        const normalized = normalizeChatError(error, { source: "chat-stream", operation: "sse_response" });
        emit({ type: "error", ...normalized });
      } finally {
        clearInterval(heartbeat);
        // The stream may already be cancelled (client gone), in which case
        // enqueue/close throw — but the MCP teardown MUST still run, so guard
        // the controller calls and always await close().
        try {
          controller.enqueue(encoder.encode(encodeDone()));
        } catch {
          // stream already closed — nothing to flush
        }
        await close().catch(() => undefined);
        try {
          controller.close();
        } catch {
          // stream already closed
        }
      }
    },
    // Fired when the client disconnects / aborts. Signal the agent to stop so it
    // doesn't keep calling the model and persisting turns into a dead stream.
    cancel() {
      onCancel?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
