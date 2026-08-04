import { parseEvents } from "@/lib/chat/sse";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/chat/stream-response";
import type {
  ChatErrorDebugInfo,
  ChatMessageView,
  ChatStreamEvent,
  ConversationSummary,
  ToolDecision,
} from "@/lib/chat/types";
import { isRetryableStreamError, StreamStalledError } from "@/lib/errors/transient-client-error";

/**
 * Longest gap we tolerate between SSE reads before treating the connection as dead. The server sends
 * a keep-alive comment every `HEARTBEAT_INTERVAL_MS`, so a few missed heartbeats (4x) means the
 * socket was silently reaped by a proxy and `reader.read()` will never resolve.
 */
export const STREAM_IDLE_TIMEOUT_MS = 4 * HEARTBEAT_INTERVAL_MS;

export interface ChatApiEndpoints {
  readonly stream: string;
  readonly confirm: string;
  readonly confirmAll: string;
  readonly retry: string;
  readonly revert: string;
  readonly conversations: string;
  conversation(id: string): string;
}

export interface LoadedConversation {
  readonly id: string;
  readonly title: string;
  readonly adAccountId: string | null;
  readonly model: string | null;
  readonly messages: readonly ChatMessageView[];
}

export interface StreamConsumptionSummary {
  readonly hasAssistantOutput: boolean;
  readonly hasErrorEvent: boolean;
}

export interface ChatErrorState {
  readonly message: string;
  readonly debug?: ChatErrorDebugInfo;
}

export interface ConfirmToolInput {
  readonly conversationId: string;
  readonly toolCallId: string;
  readonly decision: ToolDecision;
  readonly args?: Record<string, unknown>;
  readonly model?: string;
  readonly onEvent: (event: ChatStreamEvent) => void;
  readonly signal: AbortSignal;
}

export interface ConfirmAllPendingInput {
  readonly conversationId: string;
  readonly model?: string;
  readonly onEvent: (event: ChatStreamEvent) => void;
  readonly signal: AbortSignal;
}

export interface ChatApiClientOptions {
  readonly endpoints?: ChatApiEndpoints;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  /** Idle read timeout for the SSE stream; defaults to {@link STREAM_IDLE_TIMEOUT_MS}. */
  readonly streamIdleTimeoutMs?: number;
}

export interface ChatApiClient {
  readonly endpoints: ChatApiEndpoints;
  stream(
    url: string,
    payload: Record<string, unknown>,
    onEvent: (event: ChatStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<StreamConsumptionSummary>;
  fetchConversation(id: string): Promise<LoadedConversation | null>;
  fetchConversations(): Promise<ConversationSummary[]>;
  renameConversation(id: string, title: string): Promise<string>;
  deleteConversation(id: string): Promise<void>;
  confirmTool(input: ConfirmToolInput): Promise<StreamConsumptionSummary>;
  confirmAllPending(input: ConfirmAllPendingInput): Promise<StreamConsumptionSummary>;
  readErrorResponse(response: Response, url: string): Promise<ChatErrorState>;
}

export const DEFAULT_CHAT_ENDPOINTS: ChatApiEndpoints = {
  stream: "/api/chat/stream",
  confirm: "/api/chat/tool/confirm",
  confirmAll: "/api/chat/tool/confirm-all",
  retry: "/api/chat/tool/retry",
  revert: "/api/chat/tool/revert",
  conversations: "/api/chat/conversations",
  conversation: (id: string) => `/api/chat/conversations/${encodeURIComponent(id)}`,
};

const MAX_CLIENT_ERROR_BODY_CHARS = 1200;

export class ChatClientError extends Error {
  readonly state: ChatErrorState;

  constructor(state: ChatErrorState) {
    super(state.message);
    this.name = "ChatClientError";
    this.state = state;
  }
}

export function buildClientError(
  message: string,
  debug: Omit<ChatErrorDebugInfo, "timestamp" | "source">,
  now: () => Date = () => new Date(),
): ChatErrorState {
  return { message, debug: { source: "chat-client", timestamp: now().toISOString(), ...debug } };
}

export function describeClientError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function optionalStringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : undefined;
}

function truncateErrorBody(body: string): string {
  if (body.length <= MAX_CLIENT_ERROR_BODY_CHARS) return body;
  const extraChars = body.length - MAX_CLIENT_ERROR_BODY_CHARS;
  return `${body.slice(0, MAX_CLIENT_ERROR_BODY_CHARS)}...[truncated ${extraChars} chars]`;
}

function parseDebugInfo(value: unknown): ChatErrorDebugInfo | undefined {
  if (!isRecord(value) || typeof value.source !== "string" || typeof value.timestamp !== "string") return undefined;
  return {
    source: value.source,
    timestamp: value.timestamp,
    operation: optionalString(value.operation),
    code: optionalString(value.code),
    status: optionalNumber(value.status),
    statusText: optionalString(value.statusText),
    url: optionalString(value.url),
    model: optionalString(value.model),
    attemptedModels: optionalStringArray(value.attemptedModels),
    conversationId: optionalString(value.conversationId),
    requestId: optionalString(value.requestId),
    detail: optionalString(value.detail),
    cause: optionalString(value.cause),
    context: isRecord(value.context) ? value.context : undefined,
  };
}

function parseErrorBody(body: string): {
  readonly error?: string;
  readonly detail?: string;
  readonly debug?: ChatErrorDebugInfo;
} {
  try {
    const parsed: unknown = body ? JSON.parse(body) : {};
    if (!isRecord(parsed)) return {};
    return {
      error: optionalString(parsed.error),
      detail: optionalString(parsed.detail),
      debug: parseDebugInfo(parsed.debug),
    };
  } catch {
    return {};
  }
}

export function isAssistantOutputEvent(event: ChatStreamEvent): boolean {
  if (event.type === "text") return event.text.trim().length > 0;
  return event.type === "tool_start" || event.type === "tool_result" || event.type === "pending_tool";
}

function addStreamEventToSummary(summary: StreamConsumptionSummary, event: ChatStreamEvent): StreamConsumptionSummary {
  return {
    hasAssistantOutput: summary.hasAssistantOutput || isAssistantOutputEvent(event),
    hasErrorEvent: summary.hasErrorEvent || event.type === "error",
  };
}

/**
 * Proxies often reap idle SSE connections during long tool runs. The browser then
 * throws a network/stream error on the next read — even after tool_result + text
 * already arrived. Treat that as a clean end when we already have visible output.
 */
function shouldIgnorePostSuccessStreamDrop(error: unknown, hasAssistantOutput: boolean): boolean {
  if (!hasAssistantOutput) return false;
  return isRetryableStreamError(error);
}

/**
 * Read the next SSE chunk but reject with a {@link StreamStalledError} if nothing arrives within
 * `idleTimeoutMs`. A fresh timer per call means each received chunk resets the idle window, so only a
 * genuine gap (dead socket) trips it.
 */
async function readWithIdleTimeout<T>(
  reader: ReadableStreamDefaultReader<T>,
  idleTimeoutMs: number,
): Promise<ReadableStreamReadResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StreamStalledError()), idleTimeoutMs);
  });
  try {
    return await Promise.race([reader.read(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function conversationFromValue(value: unknown): LoadedConversation | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") return null;
  const adAccountId = value.adAccountId === null || typeof value.adAccountId === "string" ? value.adAccountId : null;
  const model = value.model === null || typeof value.model === "string" ? value.model : null;
  // Messages are produced by the chat API as ChatMessageView objects. The client
  // narrows the response envelope here and preserves the server-owned message shape.
  const messages = Array.isArray(value.messages) ? (value.messages as ChatMessageView[]) : [];
  return { id: value.id, title: value.title, adAccountId, model, messages };
}

function summaryFromValue(value: unknown): ConversationSummary | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.title !== "string" || typeof value.updatedAt !== "string") {
    return null;
  }
  return { id: value.id, title: value.title, updatedAt: value.updatedAt };
}

function buildConfirmPayload(input: ConfirmToolInput): Record<string, unknown> {
  return {
    conversationId: input.conversationId,
    toolCallId: input.toolCallId,
    decision: input.decision,
    args: input.args,
    model: input.model,
  };
}

export function createChatApiClient(options: ChatApiClientOptions = {}): ChatApiClient {
  const endpoints = options.endpoints ?? DEFAULT_CHAT_ENDPOINTS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const streamIdleTimeoutMs = options.streamIdleTimeoutMs ?? STREAM_IDLE_TIMEOUT_MS;

  async function readErrorResponse(response: Response, url: string): Promise<ChatErrorState> {
    const body = await response.text().catch(() => "");
    const parsed = parseErrorBody(body);
    return buildClientError(
      parsed.error ?? `Request failed (${response.status})`,
      {
        operation: "fetch_stream",
        status: response.status,
        statusText: response.statusText,
        url,
        detail: parsed.detail ?? truncateErrorBody(body),
        context: parsed.debug ? { serverDebug: parsed.debug } : undefined,
      },
      now,
    );
  }

  async function stream(
    url: string,
    payload: Record<string, unknown>,
    onEvent: (event: ChatStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<StreamConsumptionSummary> {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) throw new ChatClientError(await readErrorResponse(response, url));

    const reader = response.body?.getReader();
    if (!reader) return { hasAssistantOutput: false, hasErrorEvent: false };

    const decoder = new TextDecoder();
    let buffer = "";
    let summary: StreamConsumptionSummary = { hasAssistantOutput: false, hasErrorEvent: false };
    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        ({ done, value } = await readWithIdleTimeout(reader, streamIdleTimeoutMs));
      } catch (error) {
        // A stall leaves the underlying read pending; cancel to release the dead socket.
        if (error instanceof StreamStalledError) await reader.cancel().catch(() => undefined);
        if (shouldIgnorePostSuccessStreamDrop(error, summary.hasAssistantOutput)) return summary;
        throw error;
      }
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseEvents(buffer);
      buffer = rest;
      for (const event of events) {
        summary = addStreamEventToSummary(summary, event);
        onEvent(event);
      }
    }
    return summary;
  }

  async function fetchConversation(id: string): Promise<LoadedConversation | null> {
    const url = endpoints.conversation(id);
    const response = await fetchImpl(url);
    if (!response.ok) throw new ChatClientError(await readErrorResponse(response, url));
    const data: unknown = await response.json();
    return isRecord(data) ? conversationFromValue(data.conversation) : null;
  }

  async function fetchConversations(): Promise<ConversationSummary[]> {
    const url = endpoints.conversations;
    const response = await fetchImpl(url);
    if (!response.ok) throw new ChatClientError(await readErrorResponse(response, url));
    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.conversations)) return [];
    return data.conversations.map(summaryFromValue).filter((summary) => summary !== null);
  }

  async function renameConversation(id: string, title: string): Promise<string> {
    const url = endpoints.conversation(id);
    const response = await fetchImpl(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw new ChatClientError(await readErrorResponse(response, url));
    const data: unknown = await response.json();
    if (isRecord(data) && typeof data.title === "string" && data.title.trim().length > 0) {
      return data.title;
    }
    return title;
  }

  async function deleteConversation(id: string): Promise<void> {
    const url = endpoints.conversation(id);
    const response = await fetchImpl(url, { method: "DELETE" });
    if (!response.ok) throw new ChatClientError(await readErrorResponse(response, url));
  }

  async function confirmTool(input: ConfirmToolInput): Promise<StreamConsumptionSummary> {
    return stream(endpoints.confirm, buildConfirmPayload(input), input.onEvent, input.signal);
  }

  async function confirmAllPending(input: ConfirmAllPendingInput): Promise<StreamConsumptionSummary> {
    return stream(
      endpoints.confirmAll,
      { conversationId: input.conversationId, model: input.model },
      input.onEvent,
      input.signal,
    );
  }

  return {
    endpoints,
    stream,
    fetchConversation,
    fetchConversations,
    renameConversation,
    deleteConversation,
    confirmTool,
    confirmAllPending,
    readErrorResponse,
  };
}
