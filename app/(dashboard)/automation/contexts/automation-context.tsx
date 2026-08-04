"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { normalizeLaunchAdTargetConfig } from "../lib/normalize-launch-ad-target";
import { sampleAutomations } from "../lib/sample-automations";
import { AUTOMATION_TEMPLATES } from "../lib/automation-templates";
import { appendTerminalLog } from "../lib/execution-log-state";
import { generateAutoName, isDefaultName } from "../lib/generate-auto-name";
import { isAutomationEditorIdentityReady, resolveExistingAutomationRuleId } from "@/lib/automation/editor-identity";
import {
  buildCommentAutomationId,
  buildCommentSavePayloadFromFlow,
  isCommentAutomationFlow,
  mapCommentRuleToFlowNodes,
  parseCommentAutomationId,
  toCreateRuleParams,
  toUpdateRuleParams,
} from "../lib/comment-flow-mapper";
import { useUser } from "@/lib/providers/user-provider";
import { createAxonCampaignViaApi } from "../lib/create-axon-campaign-via-api";
import { resolveAxonNewCampaignsForSave, type ResolveAxonNewCampaignsResult } from "../lib/resolve-axon-new-campaigns";
import { upsertAssistantNodeInFlow } from "../lib/assistant-step-order";
import {
  isMetaAutomationAccountId,
  warmAutomationSuggestInsightsCache,
} from "@/lib/automation/warm-suggest-insights-cache";

export type NodeType = "trigger" | "action" | "filter" | "delay" | "approval";

export interface AutomationNode {
  id: string;
  type: NodeType;
  service?: string;
  event?: string;
  config?: Record<string, any>;
  position: number;
}

export interface AutomationFlow {
  id: number | string;
  name: string;
  nodes: AutomationNode[];
  isActive: boolean;
  frequency?: string;
  lastRun?: Date;
  selectedAccountId?: string;
  selectedAccountName?: string;
  notificationSettings?: any;
}

/** One incremental step the assistant adds/edits on the canvas (id required). */
export interface AssistantStepInput {
  id: string;
  type?: NodeType;
  service?: string;
  event?: string;
  config?: Record<string, any>;
  position?: number;
}

interface AutomationRuleResponse {
  rule?: SavedAutomationRule | null;
  rules?: SavedAutomationRule[];
}

interface SavedAutomationRule {
  id: number | string;
  name: string;
  flow?: {
    nodes?: SavedAutomationNode[];
    notificationSettings?: AutomationFlow["notificationSettings"];
  } | null;
  accountId?: string | null;
  accountName?: string | null;
  status?: string | null;
  frequency?: string | null;
}

interface SavedAutomationNode {
  id?: string;
  type: NodeType;
  service?: string;
  event?: string;
  config?: AutomationNode["config"];
  position?: number;
}

const DYNAMIC_TEMPLATE_ACTION_EVENTS = new Set([
  "Duplicate Ad Set from Sheet Row",
  "Prepare Dynamic Ad Set from Sheet Row",
  "Create Media from Templates",
  "Create Dynamic Media from Templates",
  "Launch Template Ads",
  "Create Media + Launch Ads from Templates",
]);

function resolveAutomationActionType(event: string | undefined): string {
  if (event && DYNAMIC_TEMPLATE_ACTION_EVENTS.has(event)) return "dynamic-template-ads";
  if (event === "Duplicate Ad Set") return "duplicate-adset";
  if (event === "Duplicate Campaign") return "duplicate-campaign";
  if (event === "Duplicate Ad") return "duplicate-ad";
  if (event === "Launch Campaign") return "launch-campaign";
  if (event === "Pause Campaign") return "pause-campaign";
  if (event === "Launch Ad") return "launch-ad";
  return "unknown";
}

const HUNCH_SHARED_CONFIG_KEYS = [
  "accountId",
  "accountName",
  "accountType",
  "accountCurrency",
  "campaignId",
  "campaignName",
  "sourceAdSetId",
  "sourceAdSetName",
  "targetId",
  "templateIds",
  "locationTargetingMode",
  "locationSource",
  "locationColumn",
  "hiddenGeoColumn",
  "countryColumn",
  "radiusColumn",
  "manualLocation",
  "manualCountry",
  "manualRadius",
  "leadFormId",
  "pageId",
  "facebookPageId",
  "instagramId",
  "instaId",
  "launchStatus",
  "adStatus",
  "adSetNameTemplate",
  "adNameTemplate",
  "headlineTemplate",
  "descriptionTemplate",
  "linkUrlTemplate",
  "callToActionTemplate",
  "dynamicFieldMappings",
  "defaultDailyBudget",
] as const;

interface AutomationContextType {
  flow: AutomationFlow;
  editorIdentity: AutomationEditorIdentity;
  updateFlowName: (name: string) => void;
  setFlowActive: (isActive: boolean) => void;
  setSelectedAccount: (accountId: string, accountName: string) => void;
  updateNotificationSettings: (settings: any) => void;
  addNode: (type: NodeType, position: number) => void;
  updateNode: (id: string, updates: Partial<AutomationNode>) => void;
  deleteNode: (id: string) => void;
  moveNode: (id: string, newPosition: number) => void;
  exportFlow: () => string;
  importFlowAsNew: (json: string) => void;
  applyAssistantFlow: (flow: AutomationFlow) => void;
  startAssistantFlow: (input: { name: string; selectedAccountId?: string; selectedAccountName?: string }) => void;
  upsertAssistantStep: (step: AssistantStepInput) => void;
  removeAssistantStep: (id: string) => void;
  /** Node the assistant is currently adding/editing — drives the live "building" highlight. */
  assistantActiveStepId: string | null;
  clearAssistantActiveStep: () => void;
  /**
   * Node a failed save blamed — drives the error highlight on the canvas.
   * Cleared by the next save attempt, or by editing/deleting that node.
   */
  invalidNodeId: string | null;
  saveAutomation: (options: SaveAutomationOptions) => Promise<SaveAutomationResult>;
  runAutomation: () => Promise<void>;
  cancelExecution: () => void;
  executionLog: ExecutionLog[];
  isExecuting: boolean;
  loadAutomation: (id: string) => void;
  lastExecutionId: number | null;
  fetchLastExecution: () => Promise<void>;
}

export type AutomationEditorOrigin = "persisted" | "new" | "template" | "import";

export interface AutomationEditorIdentity {
  status: "loading" | "ready" | "error";
  origin: AutomationEditorOrigin;
  requestedId: number | string | null;
  loadedFlowId: number | string;
  existingRuleId: number | null;
  canMutate: boolean;
  error?: string;
}

export interface SaveAutomationOptions {
  mode: "update" | "create";
  name?: string;
}

export type SaveAutomationResult =
  | { ok: true; name: string; ruleId: number | null }
  | { ok: false; error: string; nodeId?: string };

export interface ExecutionLog {
  id: string;
  nodeId: string;
  status: "success" | "error" | "running" | "skipped" | "cancelled";
  message: string;
  timestamp: Date;
  data?: any;
  duration?: number;
}

const AutomationContext = createContext<AutomationContextType | undefined>(undefined);

export function AutomationProvider({
  children,
  automationId,
  onAutomationIdChange,
}: {
  children: ReactNode;
  automationId?: number | string | null;
  onAutomationIdChange?: (id: number | string | null) => void;
}) {
  const { extendedUser } = useUser();

  const [flow, setFlow] = useState<AutomationFlow>({
    id: "flow-1",
    name: "Untitled Zap",
    nodes: [
      {
        id: "node-trigger-1",
        type: "trigger",
        position: 0,
      },
      {
        id: "node-action-1",
        type: "action",
        position: 1,
      },
    ],
    isActive: false,
  });

  const [executionLog, setExecutionLog] = useState<ExecutionLog[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingFlow, setIsLoadingFlow] = useState(Boolean(automationId));
  const [flowOrigin, setFlowOrigin] = useState<AutomationEditorOrigin>("new");
  const [flowLoadError, setFlowLoadError] = useState<string | null>(null);
  const [lastExecutionId, setLastExecutionId] = useState<number | null>(null);
  const [assistantActiveStepId, setAssistantActiveStepId] = useState<string | null>(null);
  const [invalidNodeId, setInvalidNodeId] = useState<string | null>(null);
  const executionAbortRef = useRef<AbortController | null>(null);

  // Derive default account from UserProvider context (no extra fetch)
  const getDefaultAccount = useCallback(() => {
    if (!extendedUser) return null;
    const { defaultAccountId, defaultWorkspaceId, settings } = extendedUser;

    if (defaultAccountId && defaultWorkspaceId) {
      const relevantSettings = settings?.filter((s: any) => s.workspaceId === defaultWorkspaceId) || [];
      const matchingSetting = relevantSettings.find((s: any) => s.businessId === defaultAccountId);
      const accountName = matchingSetting?.businessName || defaultAccountId;
      return { accountId: defaultAccountId, accountName };
    }

    // Fallback to first available non-Google Ads account
    if (settings?.length > 0 && defaultWorkspaceId) {
      const relevantSettings = (settings || []).filter(
        (s: any) => s.workspaceId === defaultWorkspaceId && s.type !== "google_ads",
      );
      if (relevantSettings.length > 0) {
        const firstAccount = relevantSettings[0];
        return {
          accountId: firstAccount.businessId,
          accountName: firstAccount.businessName || firstAccount.businessId,
        };
      }
    }
    return null;
  }, [extendedUser]);

  // Track which automationId we last initialized to avoid re-running on extendedUser changes
  // but still re-initialize when automationId actually changes (client-side navigation)
  const lastLoadedAutomationIdRef = useRef<string | number | null | undefined>(undefined);

  // When "new"/template initialized before extendedUser was ready, lastLoaded skips re-init.
  // Backfill the default Meta account so the assistant seed does not race an empty selection.
  useEffect(() => {
    if (flow.selectedAccountId) return;
    if (flowOrigin !== "new" && flowOrigin !== "template") return;
    const defaultAccount = getDefaultAccount();
    if (!defaultAccount?.accountId) return;
    setFlow((prev) => {
      if (prev.selectedAccountId) return prev;
      return {
        ...prev,
        selectedAccountId: defaultAccount.accountId,
        selectedAccountName: defaultAccount.accountName,
      };
    });
  }, [flow.selectedAccountId, flowOrigin, getDefaultAccount]);

  // Warm the 1-day Redis cache for suggest-mode account insights when a Meta account
  // is available (builder selection or default account on table/home).
  useEffect(() => {
    const accountId = flow.selectedAccountId ?? getDefaultAccount()?.accountId;
    if (!accountId || !isMetaAutomationAccountId(accountId)) return;

    const timer = window.setTimeout(() => {
      warmAutomationSuggestInsightsCache(accountId);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [flow.selectedAccountId, getDefaultAccount]);

  // Initialize flow based on automationId and user data
  useEffect(() => {
    const requestedAutomationId = automationId ?? null;

    // Skip if we already loaded this exact automationId
    if (lastLoadedAutomationIdRef.current === requestedAutomationId) return;

    setIsLoadingFlow(Boolean(automationId));
    setFlowLoadError(null);

    // Reset execution state when switching automations — previously `isExecuting`
    // stayed true if the user navigated away mid-run, causing every other
    // automation's Run button to look "Running...".
    if (executionAbortRef.current) {
      executionAbortRef.current.abort();
      executionAbortRef.current = null;
    }
    setIsExecuting(false);
    setExecutionLog([]);
    setLastExecutionId(null);

    // Abort controller to cancel in-flight fetches when automationId changes
    const abortController = new AbortController();

    if (automationId && automationId !== "new") {
      // First check if it's a template
      if (typeof automationId === "string" && automationId.startsWith("template-")) {
        const template = AUTOMATION_TEMPLATES.find((t) => t.id === automationId);
        if (template) {
          console.log("[v0] Loading template:", template.name);
          const defaultAccount = getDefaultAccount();
          const accId = defaultAccount?.accountId;
          const accName = defaultAccount?.accountName;
          setFlow({
            id: template.id,
            name: template.flow.name,
            nodes: template.flow.nodes.map((node, idx) => {
              // Pre-fill the workspace's default ad account into each meta-ads node's config
              // so templates don't prompt the user to re-pick the account they're already on.
              const isMetaAds = node.service === "meta-ads";
              const isComments = node.service === "comments";
              const cfg = { ...(node.config || {}) };
              if (isMetaAds && accId) {
                if (!cfg.accountId) cfg.accountId = accId;
                if (!cfg.accountIds || cfg.accountIds.length === 0) cfg.accountIds = [accId];
                if (!cfg.accountName && accName) cfg.accountName = accName;
              }
              if (isComments && accId && !cfg.adAccountId) {
                cfg.adAccountId = accId;
              }
              return {
                ...node,
                config: cfg,
                position: idx,
              };
            }),
            isActive: false,
            selectedAccountId: accId,
            selectedAccountName: accName,
          });
          setFlowOrigin("template");
          lastLoadedAutomationIdRef.current = requestedAutomationId;
          setIsLoadingFlow(false);
          return;
        }
      }

      // Then check sample automations
      const sampleAutomation = sampleAutomations.find((a) => a.id === automationId);
      if (sampleAutomation) {
        console.log("[v0] Loading sample automation:", sampleAutomation.name);
        setFlow({
          id: sampleAutomation.id,
          name: sampleAutomation.name,
          nodes: sampleAutomation.nodes.map((node, idx) => ({
            id: node.id,
            type: node.type,
            service: node.service,
            event: node.config?.event || node.config?.action,
            config: node.config,
            position: idx,
          })),
          isActive: sampleAutomation.status === "on",
        });
        setFlowOrigin("template");
        lastLoadedAutomationIdRef.current = requestedAutomationId;
        setIsLoadingFlow(false);
      } else {
        const commentRuleId = parseCommentAutomationId(String(automationId));
        if (commentRuleId !== null) {
          console.log("[v0] Fetching comment automation from API:", commentRuleId);
          fetch(`/api/comment-automation-rules?id=${commentRuleId}`, { signal: abortController.signal })
            .then((res) => res.json())
            .then((data: { rule?: Record<string, unknown> | null; error?: string }) => {
              if (abortController.signal.aborted) return;
              const rule = data.rule;
              if (!rule || typeof rule.id !== "number") {
                setFlowLoadError(data.error || "Comment automation could not be found.");
                lastLoadedAutomationIdRef.current = requestedAutomationId;
                setIsLoadingFlow(false);
                return;
              }

              const nodes = mapCommentRuleToFlowNodes({
                id: rule.id,
                name: typeof rule.name === "string" ? rule.name : "Comment Automation",
                status: typeof rule.status === "string" ? rule.status : undefined,
                platform: rule.platform === "instagram" ? "instagram" : "facebook",
                triggerType: typeof rule.triggerType === "string" ? rule.triggerType : "realtime",
                conditions:
                  rule.conditions && typeof rule.conditions === "object" && !Array.isArray(rule.conditions)
                    ? (rule.conditions as import("@/app/(dashboard)/comments/lib/api/automation").AutomationConditions)
                    : {},
                actionType: typeof rule.actionType === "string" ? rule.actionType : "hide",
                actionConfig:
                  rule.actionConfig && typeof rule.actionConfig === "object" && !Array.isArray(rule.actionConfig)
                    ? (rule.actionConfig as import("@/app/(dashboard)/comments/lib/api/automation").AutomationActionConfig)
                    : {},
                frequency: typeof rule.frequency === "string" ? rule.frequency : undefined,
                scheduledTime: typeof rule.scheduledTime === "string" ? rule.scheduledTime : undefined,
                adAccountId: typeof rule.adAccountId === "string" ? rule.adAccountId : null,
                pageId: typeof rule.pageId === "string" ? rule.pageId : null,
              });

              setFlow({
                id: buildCommentAutomationId(rule.id),
                name: typeof rule.name === "string" ? rule.name : "Comment Automation",
                nodes: nodes.map((node, idx) => ({ ...node, position: idx })),
                isActive: rule.status === "active" || rule.status === "executing",
                selectedAccountId: typeof rule.adAccountId === "string" ? rule.adAccountId : undefined,
              });
              setFlowOrigin("persisted");
              lastLoadedAutomationIdRef.current = requestedAutomationId;
              setIsLoadingFlow(false);
            })
            .catch((err) => {
              if (err.name === "AbortError") return;
              console.error("[v0] Failed to fetch comment automation:", err);
              setFlowLoadError("Comment automation could not be loaded. Try again.");
              lastLoadedAutomationIdRef.current = requestedAutomationId;
              setIsLoadingFlow(false);
            });
          return;
        }

        // Fetch from API if not a sample automation
        console.log("[v0] Fetching automation from API:", automationId);
        const automationRuleUrl =
          typeof automationId === "number" || /^\d+$/.test(String(automationId))
            ? `/api/automation-rules?id=${encodeURIComponent(String(automationId))}`
            : "/api/automation-rules";
        fetch(automationRuleUrl, { signal: abortController.signal })
          .then((res) => res.json())
          .then((data: AutomationRuleResponse) => {
            if (abortController.signal.aborted) return;
            const rule =
              data.rule ??
              data.rules?.find((automationRule) => String(automationRule.id) === String(automationId)) ??
              null;
            if (rule) {
              console.log("[v0] Loaded automation from API:", rule.name);
              // Parse nodes from flow
              const flowNodes = rule.flow?.nodes ?? [];

              // If no accountId in the rule, use user's default from context
              let accountId = rule.accountId;
              let accountName = rule.accountName;

              if (!accountId) {
                const defaultAccount = getDefaultAccount();
                if (defaultAccount) {
                  accountId = defaultAccount.accountId;
                  accountName = defaultAccount.accountName;
                  console.log("[v0] Using default account for automation:", accountId);
                }
              }

              setFlow({
                id: rule.id,
                name: rule.name,
                nodes: flowNodes.map((node, idx) => ({
                  id: node.id || `node-${idx}`,
                  type: node.type,
                  service: node.service,
                  event: node.event,
                  config: node.config,
                  position: node.position ?? idx,
                })),
                isActive: rule.status === "active",
                frequency: rule.frequency || undefined,
                selectedAccountId: accountId || undefined,
                selectedAccountName: accountName || undefined,
                notificationSettings: rule.flow?.notificationSettings || undefined,
              });
              setFlowOrigin("persisted");
            } else {
              console.warn("[v0] Automation not found:", automationId);
              setFlowLoadError("Automation could not be found.");
            }
            lastLoadedAutomationIdRef.current = requestedAutomationId;
            setIsLoadingFlow(false);
          })
          .catch((err) => {
            if (err.name === "AbortError") return;
            console.error("[v0] Failed to fetch automation:", err);
            setFlowLoadError("Automation could not be loaded. Try again.");
            lastLoadedAutomationIdRef.current = requestedAutomationId;
            setIsLoadingFlow(false);
          });
      }
    } else if (automationId === "new") {
      console.log("[v0] Creating new automation");
      const defaultAccount = getDefaultAccount();
      setFlow({
        id: `flow-${Date.now()}`,
        name: "Untitled Zap",
        nodes: [
          {
            id: "node-trigger-1",
            type: "trigger",
            position: 0,
          },
          {
            id: "node-action-1",
            type: "action",
            position: 1,
          },
        ],
        isActive: false,
        selectedAccountId: defaultAccount?.accountId,
        selectedAccountName: defaultAccount?.accountName,
      });
      setFlowOrigin("new");
      lastLoadedAutomationIdRef.current = requestedAutomationId;
      setIsLoadingFlow(false);
    } else {
      lastLoadedAutomationIdRef.current = requestedAutomationId;
      setIsLoadingFlow(false);
    }

    return () => {
      abortController.abort();
    };
  }, [automationId, extendedUser, getDefaultAccount]);

  const editorIdentity = useMemo<AutomationEditorIdentity>(() => {
    const requestedId = automationId ?? null;
    const identityReady = isAutomationEditorIdentityReady({
      flowId: flow.id,
      selectedAutomationId: requestedId == null ? null : String(requestedId),
      isLoadingFlow,
    });
    const status: AutomationEditorIdentity["status"] = flowLoadError ? "error" : identityReady ? "ready" : "loading";
    const canMutate = status === "ready";

    return {
      status,
      origin: flowOrigin,
      requestedId,
      loadedFlowId: flow.id,
      existingRuleId:
        flowOrigin === "persisted"
          ? resolveExistingAutomationRuleId({ flowId: flow.id, isIdentityReady: canMutate })
          : null,
      canMutate,
      ...(flowLoadError ? { error: flowLoadError } : {}),
    };
  }, [automationId, flow.id, flowLoadError, flowOrigin, isLoadingFlow]);

  const updateFlowName = useCallback((name: string) => {
    setFlow((prev) => ({ ...prev, name }));
  }, []);

  const setFlowActive = useCallback((isActive: boolean) => {
    setFlow((prev) => ({ ...prev, isActive }));
  }, []);

  const setSelectedAccount = useCallback((accountId: string, accountName: string) => {
    setFlow((prev) => ({
      ...prev,
      selectedAccountId: accountId,
      selectedAccountName: accountName,
    }));
  }, []);

  const updateNotificationSettings = useCallback((settings: any) => {
    setFlow((prev) => ({ ...prev, notificationSettings: settings }));
  }, []);

  const addNode = useCallback((type: NodeType, position: number) => {
    const newNode: AutomationNode = {
      id: `node-${Date.now()}`,
      type,
      position,
      // Auto-configure delay nodes with service and event
      ...(type === "delay" && {
        service: "delay",
        event: "Wait for Duration",
      }),
      // Auto-configure approval nodes with service and event
      ...(type === "approval" && {
        service: "approval",
        event: "Approval Required",
      }),
    };
    setFlow((prev) => ({
      ...prev,
      nodes: [...prev.nodes.slice(0, position), newNode, ...prev.nodes.slice(position)].map((node, idx) => ({
        ...node,
        position: idx,
      })),
    }));
  }, []);

  // Editing or removing the blamed step clears its error highlight: the user has
  // acted on the feedback, so leaving the card red would be stale.
  const clearInvalidNodeIfMatches = useCallback((id: string) => {
    setInvalidNodeId((current) => (current === id ? null : current));
  }, []);

  const updateNode = useCallback(
    (id: string, updates: Partial<AutomationNode>) => {
      clearInvalidNodeIfMatches(id);
      setFlow((prev) => ({
        ...prev,
        nodes: syncHunchNodeConfigs(
          prev.nodes.map((node) => (node.id === id ? { ...node, ...updates } : node)),
          id,
          updates.config,
        ),
      }));
    },
    [clearInvalidNodeIfMatches],
  );

  const deleteNode = useCallback(
    (id: string) => {
      clearInvalidNodeIfMatches(id);
      setFlow((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((node) => node.id !== id).map((node, idx) => ({ ...node, position: idx })),
      }));
    },
    [clearInvalidNodeIfMatches],
  );

  const moveNode = useCallback((id: string, newPosition: number) => {
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes
        .map((node) => (node.id === id ? { ...node, position: newPosition } : node))
        .sort((a, b) => a.position - b.position),
    }));
  }, []);

  const exportFlow = useCallback(() => {
    return JSON.stringify(flow, null, 2);
  }, [flow]);

  const importFlowAsNew = useCallback(
    (json: string) => {
      try {
        const imported = JSON.parse(json);
        // Always assign a new flow ID so imported automations cannot target the source rule.
        imported.id = `flow-${Date.now()}`;
        if (imported.name && !imported.name.endsWith("(Copy)")) {
          imported.name = `${imported.name} (Copy)`;
        }
        delete imported.ruleId;
        delete imported.savedRuleId;
        setFlow(imported);
        setFlowOrigin("import");
        setFlowLoadError(null);
        setIsLoadingFlow(false);
        onAutomationIdChange?.(null);
      } catch (error) {
        console.error("[v0] Import failed:", error);
        throw error;
      }
    },
    [onAutomationIdChange],
  );

  // Render an assistant-proposed flow onto the canvas as a fresh, unsaved draft.
  // Unlike importFlowAsNew it keeps the assistant's name (no "(Copy)" suffix) and
  // assigns a new client id so save/activate stay explicit user actions.
  const applyAssistantFlow = useCallback(
    (assistantFlow: AutomationFlow) => {
      setFlow({
        ...assistantFlow,
        id: `flow-${Date.now()}`,
        isActive: false,
        nodes: assistantFlow.nodes.map((node, idx) => ({ ...node, position: idx })),
      });
      setFlowOrigin("new");
      setFlowLoadError(null);
      setIsLoadingFlow(false);
      onAutomationIdChange?.(null);
    },
    [onAutomationIdChange],
  );

  // Begin a fresh assistant-built draft on the canvas (empty nodes). Used by the
  // live builder tools before steps stream in. Nothing is persisted.
  const startAssistantFlow = useCallback(
    (input: { name: string; selectedAccountId?: string; selectedAccountName?: string }) => {
      setFlow({
        id: `flow-${Date.now()}`,
        name: input.name,
        nodes: [],
        isActive: false,
        selectedAccountId: input.selectedAccountId,
        selectedAccountName: input.selectedAccountName,
      });
      setFlowOrigin("new");
      setFlowLoadError(null);
      setIsLoadingFlow(false);
      setAssistantActiveStepId(null);
      onAutomationIdChange?.(null);
    },
    [onAutomationIdChange],
  );

  const clearAssistantActiveStep = useCallback(() => setAssistantActiveStepId(null), []);

  // Insert a new node, or merge into an existing one by id, then reindex. Drives
  // the live "node appears / node edits" animation as builder tool calls stream.
  const upsertAssistantStep = useCallback((step: AssistantStepInput) => {
    setFlow((prev) => ({
      ...prev,
      nodes: upsertAssistantNodeInFlow(prev.nodes, step),
    }));
    setAssistantActiveStepId(step.id);
  }, []);

  const removeAssistantStep = useCallback((id: string) => {
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((node) => node.id !== id).map((node, index) => ({ ...node, position: index })),
    }));
  }, []);

  const saveAutomation = useCallback(
    async ({ mode, name }: SaveAutomationOptions): Promise<SaveAutomationResult> => {
      if (!editorIdentity.canMutate) {
        return { ok: false, error: editorIdentity.error || "Automation is still loading. Try again." };
      }

      const nameToSave = isDefaultName(name ?? flow.name) ? generateAutoName(flow.nodes) : (name ?? flow.name);

      // Each save attempt re-derives the blame, so drop any highlight from the last one.
      setInvalidNodeId(null);

      // Comment automations persist to CommentsServer, not Prisma AutomationRule.
      if (isCommentAutomationFlow(flow.nodes)) {
        const mapped = buildCommentSavePayloadFromFlow({
          name: nameToSave,
          nodes: flow.nodes,
          selectedAccountId: flow.selectedAccountId,
        });
        if (!mapped.ok) {
          if (mapped.nodeId) setInvalidNodeId(mapped.nodeId);
          return { ok: false, error: mapped.error, nodeId: mapped.nodeId };
        }

        const existingId = mode === "update" ? editorIdentity.existingRuleId : null;
        const isExisting = existingId !== null;

        try {
          if (isExisting) {
            const response = await fetch("/api/comment-automation-rules", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: existingId,
                ...toUpdateRuleParams(mapped.value),
              }),
            });
            const result = await response.json();
            if (!response.ok) {
              return { ok: false, error: result.error || "Failed to save comment automation" };
            }

            const savedId = buildCommentAutomationId(existingId);
            setFlow((previous) => ({ ...previous, id: savedId, name: nameToSave }));
            setFlowOrigin("persisted");
            onAutomationIdChange?.(savedId);
            return { ok: true, name: nameToSave, ruleId: existingId };
          }

          const createParams = toCreateRuleParams(mapped.value, {
            userId: extendedUser?.email || "",
            company: extendedUser?.company || "",
            workspaceId: extendedUser?.defaultWorkspaceId || undefined,
          });
          const response = await fetch("/api/comment-automation-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createParams),
          });
          const result = await response.json();
          if (!response.ok) {
            return { ok: false, error: result.error || "Failed to create comment automation" };
          }

          const returnedRuleId = Number(result.rule?.id ?? result.rules?.[0]?.id);
          if (!Number.isSafeInteger(returnedRuleId) || returnedRuleId <= 0) {
            return { ok: false, error: "Comment automation was created but no id was returned" };
          }

          const savedId = buildCommentAutomationId(returnedRuleId);
          setFlow((previous) => ({ ...previous, id: savedId, name: nameToSave }));
          setFlowOrigin("persisted");
          onAutomationIdChange?.(savedId);
          return { ok: true, name: nameToSave, ruleId: returnedRuleId };
        } catch {
          return { ok: false, error: "An error occurred while saving the comment automation" };
        }
      }

      // Create any pending "new AppLovin campaign" up-front so the saved flow carries a
      // resolved campaignId; creation errors surface via the normal toast.
      const campaignResolution = await resolveAxonNewCampaignsForSave(flow.nodes, {
        company: extendedUser?.company ?? "",
        workspaceId: extendedUser?.defaultWorkspaceId ?? "",
        createCampaign: createAxonCampaignViaApi,
        now: new Date(),
      }).catch(
        (error): ResolveAxonNewCampaignsResult => ({
          ok: false,
          error: error instanceof Error ? error.message : "Failed to create the AppLovin campaign.",
        }),
      );
      if (!campaignResolution.ok) {
        return { ok: false, error: campaignResolution.error };
      }
      const nodesToSave = campaignResolution.nodes;
      if (campaignResolution.changed) {
        setFlow((previous) => ({ ...previous, nodes: nodesToSave }));
      }

      const existingId = mode === "update" ? editorIdentity.existingRuleId : null;
      const isExisting = existingId !== null;
      const scheduledTriggerNode = nodesToSave.find((node) => node.type === "trigger" && node.service === "scheduled");
      const anyTriggerNode = nodesToSave.find((node) => node.type === "trigger");
      const actionNode = nodesToSave.find((node) => node.type === "action");
      const scheduledConfig = scheduledTriggerNode?.config || {};
      const triggerConfig = anyTriggerNode?.config || {};
      const effectiveFrequency =
        anyTriggerNode?.service === "manual"
          ? "one-time"
          : scheduledConfig.frequency || triggerConfig.checkFrequency || "one-time";
      const flowNameToSave = isDefaultName(name ?? flow.name) ? generateAutoName(nodesToSave) : (name ?? flow.name);

      const payload = {
        ...(isExisting ? { id: existingId } : {}),
        name: flowNameToSave,
        flow: {
          nodes: normalizeAutomationNodesForSave(nodesToSave),
          notificationSettings: flow.notificationSettings || undefined,
        },
        actionType: resolveAutomationActionType(actionNode?.event),
        targetId: actionNode?.config?.targetId || null,
        accountId: flow.selectedAccountId || actionNode?.config?.accountId || "",
        newName: actionNode?.config?.newName || null,
        frequency: effectiveFrequency,
        scheduledDate: scheduledConfig.scheduledDate || null,
        scheduledTime: scheduledConfig.scheduledTime || null,
        dayOfWeek: scheduledConfig.dayOfWeek || null,
        dayOfMonth: scheduledConfig.dayOfMonth || null,
        startDate: scheduledConfig.startDate || null,
        endDate: scheduledConfig.endDate || null,
        company: extendedUser?.company || null,
        workspaceId: extendedUser?.defaultWorkspaceId || null,
      };

      try {
        const response = await fetch("/api/automation-rules", {
          method: isExisting ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok) {
          return { ok: false, error: result.error || "Failed to save automation" };
        }

        const returnedRuleId = Number(result.rule?.id);
        const savedRuleId = Number.isSafeInteger(returnedRuleId) && returnedRuleId > 0 ? returnedRuleId : existingId;
        setFlow((previous) => ({
          ...previous,
          ...(savedRuleId !== null ? { id: savedRuleId } : {}),
          name: flowNameToSave,
        }));

        if (savedRuleId !== null) {
          setFlowOrigin("persisted");
          onAutomationIdChange?.(savedRuleId);
        }

        return { ok: true, name: flowNameToSave, ruleId: savedRuleId };
      } catch {
        return { ok: false, error: "An error occurred while saving" };
      }
    },
    [editorIdentity, extendedUser, flow, onAutomationIdChange],
  );

  const runAutomation = useCallback(async () => {
    if (!editorIdentity.canMutate) return;

    if (isCommentAutomationFlow(flow.nodes)) {
      setExecutionLog([
        {
          id: `log-${Date.now()}-comment-info`,
          nodeId: "system",
          status: "skipped",
          message:
            "Comment automations run from Comments (realtime/scheduled/manual). Save the rule, then manage runs in Comments.",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const abortController = new AbortController();
    executionAbortRef.current = abortController;

    setIsExecuting(true);
    setExecutionLog([]);
    console.log("[v0] Starting automation execution (SSE)");

    try {
      // Create any pending "new AppLovin campaign" before executing so the run targets a
      // real campaignId, mirroring save.
      const campaignResolution = await resolveAxonNewCampaignsForSave(flow.nodes, {
        company: extendedUser?.company ?? "",
        workspaceId: extendedUser?.defaultWorkspaceId ?? "",
        createCampaign: createAxonCampaignViaApi,
        now: new Date(),
      }).catch(
        (error): ResolveAxonNewCampaignsResult => ({
          ok: false,
          error: error instanceof Error ? error.message : "Failed to create the AppLovin campaign.",
        }),
      );
      if (!campaignResolution.ok) {
        setExecutionLog([
          {
            id: `log-${Date.now()}-campaign-error`,
            nodeId: "system",
            status: "error",
            message: campaignResolution.error,
            timestamp: new Date(),
          },
        ]);
        setIsExecuting(false);
        return;
      }
      if (campaignResolution.changed) {
        setFlow((previous) => ({ ...previous, nodes: campaignResolution.nodes }));
      }
      const runNodes = campaignResolution.nodes;

      const triggerNode = runNodes.find((n) => n.type === "trigger");
      const actionNode = runNodes.find((n) => n.type === "action");

      const actionType = resolveAutomationActionType(actionNode?.event);

      // Show initial running status
      const initialLog: ExecutionLog = {
        id: `log-${Date.now()}-init`,
        nodeId: "system",
        status: "running",
        message: "Starting automation...",
        timestamp: new Date(),
      };
      setExecutionLog([initialLog]);

      const isMediaLibraryTrigger = triggerNode?.service === "media-library";

      const executePayload = {
        name: flow.name,
        flow: { nodes: runNodes, notificationSettings: flow.notificationSettings || undefined },
        actionType,
        targetId: actionNode?.config?.targetId || null,
        accountId: flow.selectedAccountId || actionNode?.config?.accountId || null,
        newName: actionNode?.config?.newName || null,
        ruleId: editorIdentity.existingRuleId,
        dryRun: triggerNode?.config?.dryRun || false,
        testWithLatestAsset: isMediaLibraryTrigger,
      };

      // Try SSE streaming endpoint first
      const response = await fetch("/api/automation-rules/execute/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(executePayload),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        // Fallback to standard endpoint
        console.log("[v0] SSE failed, falling back to standard endpoint");
        const fallbackResponse = await fetch("/api/automation-rules/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(executePayload),
          signal: abortController.signal,
        });
        const executeResult = await fallbackResponse.json();
        // Handle result same as before
        flow.nodes.forEach((node) => {
          const isSuccess = executeResult.success;
          setExecutionLog((prev) => [
            ...prev.filter((log) => log.nodeId !== node.id),
            {
              id: `log-${Date.now()}-${node.id}-complete`,
              nodeId: node.id,
              status: isSuccess ? "success" : "error",
              message: isSuccess
                ? `Completed ${node.type}: ${node.service} - ${node.event}`
                : `Failed: ${executeResult.error || "Unknown error"}`,
              timestamp: new Date(),
              data:
                node.type === "action"
                  ? {
                      resultId: executeResult.resultId,
                      logs: executeResult.logs,
                      actionType: executeResult.actionType,
                      accountId: executeResult.accountId,
                      stepResults: executeResult.stepResults,
                    }
                  : undefined,
            },
          ]);
        });
        const historyLogEntry: ExecutionLog = {
          id: `log-history-${Date.now()}`,
          nodeId: "history",
          status: executeResult.executionId ? "success" : "error",
          message: executeResult.executionId ? "Saved to history" : "History save failed",
          timestamp: new Date(),
          data: {
            historyId: executeResult.executionId,
            resultId: executeResult.resultId,
            actionType,
            accountId: actionNode?.config?.accountId,
          },
        };
        setExecutionLog((prev) => [...prev, historyLogEntry]);
        // Store execution ID for later retrieval
        if (executeResult.executionId) {
          setLastExecutionId(executeResult.executionId);
        }
        setFlow((prev) => ({ ...prev, lastRun: new Date() }));
        return;
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                // Update the latest progress message
                setExecutionLog((prev) => {
                  const progressEntry: ExecutionLog = {
                    id: `log-progress-${Date.now()}`,
                    nodeId: event.nodeId || "system",
                    status: "running",
                    message: event.message,
                    timestamp: new Date(),
                    data: event.data,
                  };
                  // Replace the last "running" entry or add new
                  const withoutOldRunning = prev.filter((log) => log.status !== "running" || log.nodeId === "system");
                  // Keep "system" running entry for the spinner, add new progress
                  return [...withoutOldRunning, progressEntry];
                });
              } else if (event.type === "step_result") {
                setExecutionLog((prev) => [
                  ...prev,
                  {
                    id: `log-step-${Date.now()}`,
                    nodeId: event.nodeId || "system",
                    status: "success",
                    message: event.message,
                    timestamp: new Date(),
                    data: event.data,
                  },
                ]);
              } else if (event.type === "complete") {
                const completeData = event.data || {};

                // Media-library watch mode activation - no execution, just activation
                if (completeData.activated) {
                  setExecutionLog((prev) => [
                    ...prev.filter((log) => log.status !== "running"),
                    {
                      id: `log-activated-${Date.now()}`,
                      nodeId: "system",
                      status: "success",
                      message: completeData.message || "Automation activated - watching for new uploads",
                      timestamp: new Date(),
                      data: { description: completeData.description },
                    },
                  ]);
                  setFlow((prev) => ({ ...prev, status: "active" }));
                } else {
                  // Add final completion logs with all data
                  flow.nodes.forEach((node) => {
                    setExecutionLog((prev) => [
                      ...prev.filter((log) => (log.status === "running" ? false : true)),
                      {
                        id: `log-${Date.now()}-${node.id}-complete`,
                        nodeId: node.id,
                        status: completeData.success ? "success" : "error",
                        message: completeData.success
                          ? `Completed ${node.type}: ${node.service} - ${node.event}`
                          : `Failed: ${event.message || "Unknown error"}`,
                        timestamp: new Date(),
                        data:
                          node.type === "action"
                            ? {
                                resultId: completeData.resultId,
                                logs: completeData.logs,
                                actionType: completeData.actionType || actionType,
                                accountId: completeData.accountId || actionNode?.config?.accountId,
                                stepResults: completeData.stepResults,
                              }
                            : undefined,
                      },
                    ]);
                  });
                  // History log
                  setExecutionLog((prev) => [
                    ...prev,
                    {
                      id: `log-history-${Date.now()}`,
                      nodeId: "history",
                      status: completeData.executionId ? "success" : "error",
                      message: completeData.executionId ? "Saved to history" : "History save failed",
                      timestamp: new Date(),
                      data: {
                        historyId: completeData.executionId,
                        resultId: completeData.resultId,
                        actionType: completeData.actionType || actionType,
                        accountId: completeData.accountId || actionNode?.config?.accountId,
                      },
                    },
                  ]);
                  // Store execution ID for later retrieval
                  if (completeData.executionId) {
                    setLastExecutionId(completeData.executionId);
                  }
                  setFlow((prev) => ({ ...prev, lastRun: new Date() }));
                }
              } else if (event.type === "cancelled") {
                setExecutionLog((prev) => [
                  ...prev.filter((log) => log.status !== "running"),
                  {
                    id: `log-cancelled-${Date.now()}`,
                    nodeId: "system",
                    status: "cancelled",
                    message: event.message || "Execution was cancelled",
                    timestamp: new Date(),
                    data: event.data,
                  },
                ]);
                if (event.data?.executionId) {
                  setLastExecutionId(event.data.executionId);
                }
              } else if (event.type === "error") {
                setExecutionLog((prev) => [
                  ...prev.filter((log) => log.status !== "running"),
                  {
                    id: `log-error-${Date.now()}`,
                    nodeId: "system",
                    status: "error",
                    message: event.message || "Execution failed",
                    timestamp: new Date(),
                  },
                ]);
              }
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }
      }

      console.log("[v0] SSE stream complete");
    } catch (error) {
      // AbortError means user cancelled — handle gracefully
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("[v0] Automation execution cancelled by user");
        setExecutionLog((prev) => {
          // Only add cancelled log if we didn't already receive a cancelled SSE event
          if (prev.some((log) => log.status === "cancelled")) return prev;
          return [
            ...prev.filter((log) => log.status !== "running"),
            {
              id: `log-cancelled-${Date.now()}`,
              nodeId: "system",
              status: "cancelled",
              message: "Execution was cancelled",
              timestamp: new Date(),
            },
          ];
        });
      } else {
        console.error("[v0] Automation execution failed:", error);
        const errorLog: ExecutionLog = {
          id: `log-error-${Date.now()}`,
          nodeId: "system",
          status: "error",
          message: `Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        };
        // Drop any lingering "running" entries so the panel's derived
        // `isExecuting` flips false — otherwise the spinner keeps spinning and
        // the now-inert Cancel button stays on screen forever.
        setExecutionLog((prev) => appendTerminalLog(prev, errorLog));
      }
    } finally {
      executionAbortRef.current = null;
      setIsExecuting(false);
    }
  }, [editorIdentity.canMutate, editorIdentity.existingRuleId, flow.nodes, flow.name, flow.selectedAccountId]);

  const cancelExecution = useCallback(() => {
    if (executionAbortRef.current) {
      executionAbortRef.current.abort();
      executionAbortRef.current = null;
    }
  }, []);

  const loadAutomation = useCallback((id: string) => {
    const sampleAutomation = sampleAutomations.find((a) => a.id === id);
    if (sampleAutomation) {
      setFlow({
        id: sampleAutomation.id,
        name: sampleAutomation.name,
        nodes: sampleAutomation.nodes.map((node, idx) => ({
          id: node.id,
          type: node.type,
          service: node.service,
          event: node.config?.event || node.config?.action,
          config: node.config,
          position: idx,
        })),
        isActive: sampleAutomation.status === "on",
      });
      setFlowOrigin("template");
    }
  }, []);

  // Fetch last execution results from database
  const fetchLastExecution = useCallback(async () => {
    if (!lastExecutionId || isExecuting) return;

    try {
      const response = await fetch(`/api/automation/execution/${lastExecutionId}`);
      if (!response.ok) return;

      const execution = await response.json();

      // Convert database execution to execution logs
      const logs: ExecutionLog[] = [];

      // Add step results as logs
      if (execution.stepResults && Array.isArray(execution.stepResults)) {
        for (const step of execution.stepResults) {
          logs.push({
            id: `log-step-${step.nodeId}-${Date.now()}`,
            nodeId: step.nodeId || "system",
            status: step.success ? "success" : "error",
            message: step.success
              ? `Completed ${step.stepType}: ${step.service} - ${step.event}`
              : step.error || "Failed",
            timestamp: new Date(execution.executedAt),
            data: {
              stepResults: execution.stepResults,
              logs: execution.executionLogs,
            },
          });
        }
      }

      // Add history log entry
      logs.push({
        id: `log-history-${Date.now()}`,
        nodeId: "history",
        status: execution.status === "completed" ? "success" : execution.status === "failed" ? "error" : "running",
        message: execution.status === "scheduled_delay" ? "Scheduled for later" : "Loaded from history",
        timestamp: new Date(execution.executedAt),
        data: {
          historyId: execution.id,
          resultId: execution.resultId,
          actionType: execution.actionType,
          accountId: execution.accountId,
          stepResults: execution.stepResults,
          logs: execution.executionLogs,
        },
      });

      setExecutionLog(logs);
    } catch (error) {
      console.error("Failed to fetch last execution:", error);
    }
  }, [lastExecutionId, isExecuting]);

  return (
    <AutomationContext.Provider
      value={{
        flow,
        editorIdentity,
        updateFlowName,
        setFlowActive,
        setSelectedAccount,
        updateNotificationSettings,
        addNode,
        updateNode,
        deleteNode,
        moveNode,
        exportFlow,
        importFlowAsNew,
        applyAssistantFlow,
        startAssistantFlow,
        upsertAssistantStep,
        removeAssistantStep,
        assistantActiveStepId,
        invalidNodeId,
        clearAssistantActiveStep,
        saveAutomation,
        runAutomation,
        cancelExecution,
        executionLog,
        isExecuting,
        loadAutomation,
        lastExecutionId,
        fetchLastExecution,
      }}
    >
      {children}
    </AutomationContext.Provider>
  );
}

export function useAutomation() {
  const context = useContext(AutomationContext);
  if (!context) {
    throw new Error("useAutomation must be used within AutomationProvider");
  }
  return context;
}

function syncHunchNodeConfigs(
  nodes: AutomationNode[],
  updatedNodeId: string,
  updatedConfig: AutomationNode["config"] | undefined,
): AutomationNode[] {
  const hunchGroupId = readConfigString(updatedConfig, "hunchGroupId");
  if (!hunchGroupId) return nodes;

  const sharedConfig = buildHunchSharedConfig(updatedConfig || {});
  if (Object.keys(sharedConfig).length === 0) return nodes;

  return nodes.map((node) => {
    if (node.id === updatedNodeId) return node;
    if (readConfigString(node.config, "hunchGroupId") !== hunchGroupId) return node;
    return { ...node, config: { ...node.config, ...sharedConfig } };
  });
}

function buildHunchSharedConfig(config: Record<string, any>): Record<string, any> {
  const sharedConfig: Record<string, any> = {};
  for (const key of HUNCH_SHARED_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      sharedConfig[key] = config[key];
    }
  }
  if (sharedConfig.targetId && !sharedConfig.sourceAdSetId) {
    sharedConfig.sourceAdSetId = sharedConfig.targetId;
  }
  if (sharedConfig.sourceAdSetId && !sharedConfig.targetId) {
    sharedConfig.targetId = sharedConfig.sourceAdSetId;
  }
  if (sharedConfig.targetId && !sharedConfig.targetAdSetId) {
    sharedConfig.targetAdSetId = sharedConfig.targetId;
  }
  if (sharedConfig.targetAdSetId && !sharedConfig.targetId) {
    sharedConfig.targetId = sharedConfig.targetAdSetId;
  }
  return sharedConfig;
}

function normalizeAutomationNodesForSave(nodes: AutomationNode[]): AutomationNode[] {
  return nodes.map((node) => {
    if (node.type !== "action" || node.event !== "Launch Ad") return node;
    return { ...node, config: normalizeLaunchAdTargetConfig(node.config || {}) };
  });
}

function readConfigString(config: AutomationNode["config"] | undefined, key: string): string {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}
