import type { ChatErrorDebugInfo } from "./types";

const MAX_DEBUG_TEXT_CHARS = 1200;

export interface ChatErrorFallback {
  readonly source: string;
  readonly operation?: string;
  readonly message?: string;
  readonly context?: Record<string, unknown>;
}

export interface NormalizedChatError {
  readonly message: string;
  readonly debug: ChatErrorDebugInfo;
}

export class ChatDebugError extends Error {
  readonly debug: Omit<ChatErrorDebugInfo, "timestamp">;

  constructor(
    message: string,
    debug: Omit<ChatErrorDebugInfo, "timestamp">,
    options: { readonly cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ChatDebugError";
    this.debug = debug;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function truncateDebugText(text: string, limit = MAX_DEBUG_TEXT_CHARS): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...[truncated ${text.length - limit} chars]`;
}

function describeUnknown(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function describeCause(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const cause = (error as Error & { cause?: unknown }).cause;
  return cause === undefined ? undefined : truncateDebugText(describeUnknown(cause));
}

function mergeContext(
  fallbackContext: Record<string, unknown> | undefined,
  errorContext: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!fallbackContext && !errorContext) return undefined;
  return { ...(fallbackContext ?? {}), ...(errorContext ?? {}) };
}

export function normalizeChatError(error: unknown, fallback: ChatErrorFallback): NormalizedChatError {
  const timestamp = new Date().toISOString();
  if (error instanceof ChatDebugError) {
    return {
      message: error.message,
      debug: {
        ...error.debug,
        timestamp,
        cause: error.debug.cause ?? describeCause(error),
        context: mergeContext(fallback.context, error.debug.context),
      },
    };
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (fallback.message ?? "Chat request failed.");
  const name = error instanceof Error ? error.name : typeof error;
  return {
    message: fallback.message ? `${fallback.message}: ${message}` : message,
    debug: {
      source: fallback.source,
      operation: fallback.operation,
      timestamp,
      code: name,
      detail: truncateDebugText(describeUnknown(error)),
      cause: describeCause(error),
      context: fallback.context,
    },
  };
}
