import { apiClient } from "../../_lib/api/client";

// ============================================
// Types
// ============================================

export interface AutomationConditions {
  sentimentFilter?: "all" | "positive" | "neutral" | "negative";
  sentimentMin?: number;
  sentimentMax?: number;
  keywords?: string[];
  excludeKeywords?: string[];
  authorIds?: string[];
  excludeAuthorIds?: string[];
  adIds?: string[];
  campaignIds?: string[];
  adsetIds?: string[];
  isAdOnly?: boolean;
  minLikes?: number;
  commenterHistory?: "returning" | "new";
  commentLength?: "short" | "medium" | "long";
  // Restrict matching by thread position. "comment" = top-level only,
  // "reply" = replies only, "all" or omitted = both.
  targetType?: "all" | "comment" | "reply";
}

export interface AutomationActionConfig {
  replyTemplate?: string;
  useAI?: boolean;
  aiPrompt?: string;
  aiTone?: "friendly" | "professional" | "empathetic";
  // When true on a "reply" action, the rule posts the reply directly to the
  // comment instead of creating an entry in the approval queue.
  autoSend?: boolean;
}

/** Which surface a rule (and its comments) live on. */
export type CommentPlatform = "facebook" | "instagram";

export interface AutomationRule {
  id: number;
  name: string;
  status: "active" | "paused" | "executing";
  platform?: CommentPlatform;
  triggerType: "realtime" | "scheduled" | "manual";
  conditions: AutomationConditions;
  actionType: "hide" | "delete" | "reply";
  actionConfig: AutomationActionConfig;
  frequency?: string;
  scheduledTime?: string;
  userId: string;
  company: string;
  workspaceId?: string;
  adAccountId?: string;
  pageId?: string;
  processedCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleParams {
  name: string;
  platform?: CommentPlatform;
  triggerType: "realtime" | "scheduled" | "manual";
  conditions: AutomationConditions;
  actionType: "hide" | "delete" | "reply";
  actionConfig?: AutomationActionConfig;
  frequency?: string;
  scheduledTime?: string;
  userId: string;
  company: string;
  workspaceId?: string;
  adAccountId?: string;
  pageIds: string[];
}

export interface UpdateRuleParams {
  name?: string;
  status?: "active" | "paused";
  platform?: CommentPlatform;
  triggerType?: "realtime" | "scheduled" | "manual";
  conditions?: AutomationConditions;
  actionType?: "hide" | "delete" | "reply";
  actionConfig?: AutomationActionConfig;
  frequency?: string;
  scheduledTime?: string;
  pageId?: string;
}

export interface ExecuteRuleParams {
  // Option 1: Execute on specific comments (used by BulkActionsBar)
  commentIds?: string[];
  // Option 2: Execute on all matching comments for ad account/page
  adAccountId?: string;
  pageId?: string;
  // Required for all executions
  encryptedUserToken: string;
}

/** Acknowledgement for background (adAccountId/pageId) executions. */
export interface ExecuteRuleStarted {
  status: string;
  ruleId: number;
}

/** Synchronous per-comment outcome when executing on specific commentIds. */
export interface ExecuteRuleOnCommentsResult {
  processed: number;
  success: number;
  failed: number;
  results: Array<{ commentId: string; success: boolean; error?: string }>;
}

export type ExecuteRuleResult = ExecuteRuleStarted | ExecuteRuleOnCommentsResult;

export interface CancelRuleExecutionResult {
  status: string;
  ruleId: number;
}

export interface ProcessedComment {
  id: number;
  ruleId: number;
  commentId: string;
  actionTaken: string;
  result?: string;
  errorMsg?: string;
  replyId?: string;
  runId?: number;
  commentSnapshot?: {
    message?: string;
    authorName?: string;
    sentiment?: number;
  };
  processedAt: string;
  /** Source post id (FB post id / IG media id), joined server-side from the synced comment. */
  postId?: string | null;
  /** Permalink to the source post/comment on the platform, when synced. */
  postPermalinkUrl?: string | null;
  /** Page (FB) or IG account that owns the commented post. */
  pageId?: string | null;
}

export interface AutomationRun {
  id: number;
  ruleId: number;
  triggerType: string;
  status: string; // "running", "completed", "failed", "cancelled", "interrupted"
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  startedAt: string;
  completedAt?: string;
}

export interface RuleRunsResponse {
  ruleId: number;
  runs: AutomationRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface AccountRun extends AutomationRun {
  ruleName: string;
  actionType: string;
  /**
   * Number of processed comments in this run still awaiting approval
   * (drafted replies whose `replyId` is `pending:*`). Drives the
   * "Pending approval" status. Optional for back-compat with responses that
   * don't compute it.
   */
  pendingCount?: number;
  /**
   * Number of processed comments in this run whose drafted reply was discarded
   * (pending reply status `rejected`). Drives the "Discarded" status. Optional
   * for back-compat with responses that don't compute it.
   */
  discardedCount?: number;
  /**
   * Snapshot of the first comment processed in this run (the trigger for
   * realtime runs), so list rows can show the actual comment text instead of
   * just a count. Optional for back-compat; null when no snapshot was stored.
   */
  firstComment?: {
    message?: string;
    authorName?: string;
    sentiment?: number;
  } | null;
}

export interface AccountRunsResponse {
  runs: AccountRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface RunDetailsResponse {
  run: AutomationRun;
  comments: ProcessedComment[];
  total: number;
  limit: number;
  offset: number;
  /** Platform the rule executes on. Optional for back-compat; defaults to facebook. */
  platform?: "facebook" | "instagram";
  /** Page (or IG account) the rule is scoped to. */
  pageId?: string | null;
  /** Ad account stored on the rule — needed for page-token resolution on comment actions. */
  adAccountId?: string | null;
}

// ============================================
// Automation API
// ============================================

/**
 * Get all automation rules filtered by pageId or adAccountId
 * Priority: pageId > adAccountId (only one is used, not both)
 * @param company - Company identifier (unused, kept for backwards compatibility)
 * @param workspaceId - Optional workspace ID (unused, kept for backwards compatibility)
 * @param adAccountId - Ad account ID to filter by (used if no pageId)
 * @param pageId - Page ID to filter by (takes priority, "all" means use adAccountId instead)
 */
export const getRules = async (
  _company: string,
  _workspaceId?: string,
  adAccountId?: string,
  pageId?: string,
): Promise<AutomationRule[]> => {
  const params: Record<string, string | undefined> = {};

  // Always send adAccountId to scope rules properly
  if (adAccountId) {
    params.adAccountId = adAccountId;
  }

  // Additionally filter by pageId if a specific page is selected
  if (pageId && pageId !== "all") {
    params.pageId = pageId;
  }

  return apiClient.get<AutomationRule[]>("/comment-automation/rules", params);
};

/**
 * Get a single rule by ID
 */
export const getRule = async (ruleId: number): Promise<AutomationRule> => {
  return apiClient.get<AutomationRule>(`/comment-automation/rules/${ruleId}`);
};

/**
 * Create one or more automation rules.
 * Backend creates one rule per pageId in `pageIds` and returns the full array.
 */
export const createRule = async (params: CreateRuleParams): Promise<AutomationRule[]> => {
  const result = await apiClient.post<AutomationRule[]>(
    "/comment-automation/rules",
    params as unknown as Record<string, unknown>,
  );

  return result;
};

/**
 * Update an automation rule
 */
export const updateRule = async (ruleId: number, params: UpdateRuleParams): Promise<AutomationRule> => {
  const result = await apiClient.patch<AutomationRule>(
    `/comment-automation/rules/${ruleId}`,
    params as unknown as Record<string, unknown>,
  );

  return result;
};

/**
 * Delete an automation rule
 */
export const deleteRule = async (ruleId: number): Promise<{ success: boolean; message: string }> => {
  return apiClient.delete<{ success: boolean; message: string }>(`/comment-automation/rules/${ruleId}`);
};

/**
 * Toggle rule status (active/paused)
 */
export const toggleRule = async (ruleId: number): Promise<AutomationRule> => {
  return apiClient.post<AutomationRule>(`/comment-automation/rules/${ruleId}/toggle`);
};

/**
 * Execute a rule manually on selected comments
 */
export const executeRule = async (ruleId: number, params: ExecuteRuleParams): Promise<ExecuteRuleResult> => {
  const { encryptedUserToken, ...bodyParams } = params;

  return apiClient.post<ExecuteRuleResult>(
    `/comment-automation/rules/${ruleId}/execute`,
    bodyParams as unknown as Record<string, unknown>,
    { token: encryptedUserToken },
  );
};

/**
 * Request cancellation of an in-flight rule execution.
 */
export const cancelRuleExecution = async (ruleId: number): Promise<CancelRuleExecutionResult> => {
  return apiClient.post<CancelRuleExecutionResult>(`/comment-automation/rules/${ruleId}/cancel`);
};

/**
 * Get processing history for a rule
 */
export const getRuleHistory = async (
  ruleId: number,
  limit: number = 50,
  offset: number = 0,
): Promise<{
  ruleId: number;
  history: ProcessedComment[];
  limit: number;
  offset: number;
}> => {
  return apiClient.get<{
    ruleId: number;
    history: ProcessedComment[];
    limit: number;
    offset: number;
  }>(`/comment-automation/rules/${ruleId}/history`, { limit, offset });
};

/**
 * Get all runs (batches) for a rule
 */
export const getRuleRuns = async (
  ruleId: number,
  limit: number = 20,
  offset: number = 0,
): Promise<RuleRunsResponse> => {
  return apiClient.get<RuleRunsResponse>(`/comment-automation/rules/${ruleId}/runs`, { limit, offset });
};

/**
 * Get details of a specific run including processed comments
 */
export const getRunDetails = async (
  runId: number,
  limit: number = 50,
  offset: number = 0,
): Promise<RunDetailsResponse> => {
  return apiClient.get<RunDetailsResponse>(`/comment-automation/runs/${runId}`, { limit, offset });
};

/**
 * Get all runs across all rules for an ad account
 */
export const getRunsByAdAccount = async (
  adAccountId: string,
  limit: number = 20,
  offset: number = 0,
): Promise<AccountRunsResponse> => {
  return apiClient.get<AccountRunsResponse>("/comment-automation/runs/by-account", {
    adAccountId,
    limit,
    offset,
  });
};

/**
 * Get all runs across one or more pages.
 * Scopes by pageId (stable) instead of adAccountId, which can drift when a
 * page is re-subscribed under a different ad account.
 */
export const getRunsByPages = async (
  pageIds: string[],
  limit: number = 20,
  offset: number = 0,
): Promise<AccountRunsResponse> => {
  return apiClient.get<AccountRunsResponse>("/comment-automation/runs/by-page", {
    pageIds: pageIds.join(","),
    limit,
    offset,
  });
};

/**
 * Get unique pages for an ad account (pages that have comments)
 */
export const getPagesForAdAccount = async (
  adAccountId: string,
): Promise<Array<{ pageId: string; pageName: string; commentCount: number }>> => {
  return apiClient.get<Array<{ pageId: string; pageName: string; commentCount: number }>>("/comment-automation/pages", {
    adAccountId,
  });
};

export const automationApi = {
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  executeRule,
  cancelRuleExecution,
  getRuleHistory,
  getRuleRuns,
  getRunDetails,
  getRunsByAdAccount,
  getRunsByPages,
  getPagesForAdAccount,
};

export default automationApi;
