"use client";

import { useState, useRef, useEffect, useCallback, type ReactElement } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { useSearchParams } from "next/navigation";
import { useAutomation, type AutomationNode } from "../contexts/automation-context";
import { FlowNode } from "./flow-node";
import { AddNodeButton } from "./add-node-button";
import { ConfigPanel } from "./config-panel";
import { AppSelectorDialog } from "./app-selector-dialog";
import { FlowConnectorSection } from "./flow-connector";
import { FullPreviewPanel } from "./full-preview-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Loader2, Zap, Plus } from "lucide-react";
import { useIsEssentialAutomationPlan } from "@/lib/automation/use-essential-automation-plan";
import { getPlanLockedTriggerServiceIdsForEssential } from "@/lib/automation/essential-plan-automation-access";
import { getAutomationNodeEditorKey } from "@/lib/automation/editor-identity";

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 700;
const PANEL_DEFAULT_WIDTH = 420;
const LOADING_STEP_COUNT = 4;
const CANVAS_DOT_SIZE = "22px 22px";

/**
 * Atmospheric builder backdrop: a subtle violet dot-grid with a faint vignette
 * so the flow cards read as floating above depth.
 */
function CanvasBackground(): ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(99, 102, 241, 0.13) 1px, transparent 1px)",
          backgroundSize: CANVAS_DOT_SIZE,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,transparent_55%,rgba(15,23,42,0.035))]" />
    </div>
  );
}

export function FlowBuilder() {
  const { flow, editorIdentity, updateNode, addNode } = useAutomation();
  const searchParams = useSearchParams();
  const isEssentialPlan = useIsEssentialAutomationPlan();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [appSelectorOpen, setAppSelectorOpen] = useState(false);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [fullPreviewOpen, setFullPreviewOpen] = useQueryState("fullPreview", parseAsBoolean.withDefault(false));
  const pendingSelectNodeId = useRef<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startWidth = panelWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        // Panel is on the right, so dragging left increases width
        const delta = startX - e.clientX;
        const newWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, startWidth + delta));
        setPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [panelWidth],
  );

  // Auto-select node when flow is imported from copilot
  useEffect(() => {
    if (pendingSelectNodeId.current && flow.nodes.length > 0) {
      const nodeToSelect = flow.nodes.find((n) => n.id === pendingSelectNodeId.current);
      if (nodeToSelect) {
        if (!nodeToSelect.service) {
          setPendingNodeId(nodeToSelect.id);
          setAppSelectorOpen(true);
        } else {
          setSelectedNodeId(nodeToSelect.id);
        }
        pendingSelectNodeId.current = null;
      }
    }
  }, [flow.nodes]);

  // When opening a template from the Templates tab, auto-select the first node
  // so the configuration panel opens immediately.
  const autoSelectedFlowIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    const isTemplate = typeof flow.id === "string" && flow.id.startsWith("template-");
    const isOpenedFromTemplatesTab = searchParams?.get("tab") === "templates";
    const isBuilderView = searchParams?.get("view") === "builder";
    if (!isTemplate && !isOpenedFromTemplatesTab && !isBuilderView) return;
    if (autoSelectedFlowIdRef.current === flow.id) return;
    if (flow.nodes.length === 0) return;
    autoSelectedFlowIdRef.current = flow.id;
    const firstConfigured = flow.nodes.find((n) => !!n.service) || flow.nodes[0];
    if (firstConfigured?.service) setSelectedNodeId(firstConfigured.id);
  }, [flow.id, flow.nodes, searchParams]);

  const handleNodeClick = (node: AutomationNode) => {
    if (!node.service) {
      setPendingNodeId(node.id);
      setAppSelectorOpen(true);
    } else {
      setSelectedNodeId(node.id);
    }
  };

  const handleAppSelect = (appId: string) => {
    // Slack and Email are aliases that route to the notification action
    const resolvedAppId = appId === "slack" || appId === "email" ? "notification" : appId;
    if (pendingNode) {
      updateNode(pendingNode.id, { service: resolvedAppId });
      setSelectedNodeId(pendingNode.id);
      setPendingNodeId(null);
    }
  };

  const handleAddTrigger = () => {
    addNode("trigger", 0);
  };

  const selectedNode = selectedNodeId ? flow.nodes.find((node) => node.id === selectedNodeId) || null : null;
  const pendingNode = pendingNodeId ? flow.nodes.find((node) => node.id === pendingNodeId) || null : null;
  const showConfigPanel = !fullPreviewOpen && selectedNode && selectedNode.service;
  const showFullPreview = fullPreviewOpen && flow.nodes.length > 0;
  const hasTrigger = flow.nodes.some((node) => node.type === "trigger");

  const openFullPreview = () => {
    setSelectedNodeId(null);
    setFullPreviewOpen(true);
  };
  const closeFullPreview = () => setFullPreviewOpen(null);

  // Determine which services should be disabled for the app selector
  // Scheduled trigger can only be added once
  const hasScheduledTrigger = flow.nodes.some((node) => node.type === "trigger" && node.service === "scheduled");
  const disabledServices = hasScheduledTrigger && pendingNode?.type === "trigger" ? ["scheduled"] : [];
  const planLockedTriggerServices =
    isEssentialPlan && pendingNode?.type === "trigger" ? getPlanLockedTriggerServiceIdsForEssential() : [];

  if (editorIdentity.status === "loading") {
    return <FlowBuilderLoadingState />;
  }

  if (editorIdentity.status === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h3 className="font-semibold text-foreground">Automation could not be loaded</h3>
          <p className="text-sm text-muted-foreground">{editorIdentity.error || "Try opening it again."}</p>
        </div>
      </div>
    );
  }

  // Empty state when no nodes exist
  if (flow.nodes.length === 0) {
    return (
      <div className="relative flex h-full flex-col md:flex-row">
        <CanvasBackground />

        <div className="flex flex-1 items-center justify-center p-6 relative z-10">
          <div className="flex flex-col items-center gap-5 text-center">
            {/* Icon with gradient background */}
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Zap className="h-7 w-7 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">Build your automation</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Start by adding a trigger - the event that kicks off your automation workflow.
              </p>
            </div>

            <Button onClick={handleAddTrigger} size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
              <Plus className="h-4 w-4" />
              Add Trigger
            </Button>
          </div>
        </div>

        <AppSelectorDialog
          open={appSelectorOpen}
          onOpenChange={setAppSelectorOpen}
          nodeType={pendingNode?.type === "approval" ? "action" : pendingNode?.type || "trigger"}
          onSelectApp={handleAppSelect}
          disabledServices={disabledServices}
          planLockedServices={planLockedTriggerServices}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col md:flex-row">
      <CanvasBackground />

      {/* Flow area */}
      <div
        className={`flex flex-1 items-start justify-center overflow-auto p-3 pt-4 transition-all md:p-6 relative z-10 ${showConfigPanel ? "md:pr-0" : ""}`}
      >
        <div className="mx-auto w-full max-w-md py-4 md:max-w-xl md:py-8">
          <div className="space-y-0">
            {/* Show "Add Trigger" placeholder when no trigger exists */}
            {!hasTrigger && flow.nodes.length > 0 && (
              <div>
                <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                  <p className="mb-2 text-sm text-muted-foreground">No trigger configured</p>
                  <Button onClick={handleAddTrigger} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Trigger
                  </Button>
                </div>
                <FlowConnectorSection animated={true}>
                  <div />
                </FlowConnectorSection>
              </div>
            )}
            {flow.nodes.map((node, index) => {
              const isLastNode = index === flow.nodes.length - 1;
              return (
                <div key={node.id}>
                  <FlowNode
                    node={node}
                    index={index}
                    onNodeClick={handleNodeClick}
                    isSelected={selectedNodeId === node.id}
                  />

                  {/* Connector with AddNodeButton - disable animation on last one */}
                  <FlowConnectorSection animated={!isLastNode}>
                    <AddNodeButton position={index + 1} isLast={isLastNode} />
                  </FlowConnectorSection>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showFullPreview && (
        <>
          {/* Mobile overlay backdrop */}
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={closeFullPreview} />

          {/* Mobile: bottom sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-hidden rounded-t-2xl bg-card md:hidden">
            <FullPreviewPanel onClose={closeFullPreview} />
          </div>

          {/* Desktop: side panel */}
          <div className="relative hidden flex-shrink-0 border-l md:flex" style={{ width: panelWidth }}>
            <div className="flex-1 min-w-0 overflow-hidden">
              <FullPreviewPanel onClose={closeFullPreview} />
            </div>
          </div>
        </>
      )}

      {showConfigPanel && (
        <>
          {/* Mobile overlay backdrop */}
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSelectedNodeId(null)} />

          {/* Mobile: bottom sheet (no resize) */}
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-hidden rounded-t-2xl bg-card md:hidden">
            <ConfigPanel
              key={getAutomationNodeEditorKey(flow.id, selectedNode.id)}
              node={selectedNode}
              callbacks={{
                onClose: () => setSelectedNodeId(null),
                onContinue: (nextNodeId: string) => {
                  const nextNode = flow.nodes.find((n) => n.id === nextNodeId);
                  if (nextNode) {
                    if (!nextNode.service) {
                      setPendingNodeId(nextNode.id);
                      setAppSelectorOpen(true);
                    } else {
                      setSelectedNodeId(nextNode.id);
                    }
                  }
                },
              }}
            />
          </div>

          {/* Desktop: resizable side panel */}
          <div className="relative hidden md:flex flex-shrink-0 h-full" style={{ width: panelWidth }}>
            {/* Drag handle */}
            <div
              className="w-1.5 cursor-col-resize flex-shrink-0 bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors relative group"
              onMouseDown={handleResizeStart}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/40 transition-colors" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden bg-card">
              <ConfigPanel
                key={getAutomationNodeEditorKey(flow.id, selectedNode.id)}
                node={selectedNode}
                callbacks={{
                  onClose: () => setSelectedNodeId(null),
                  onContinue: (nextNodeId: string) => {
                    const nextNode = flow.nodes.find((n) => n.id === nextNodeId);
                    if (nextNode) {
                      if (!nextNode.service) {
                        setPendingNodeId(nextNode.id);
                        setAppSelectorOpen(true);
                      } else {
                        setSelectedNodeId(nextNode.id);
                      }
                    }
                  },
                }}
              />
            </div>
          </div>
        </>
      )}

      <AppSelectorDialog
        open={appSelectorOpen}
        onOpenChange={setAppSelectorOpen}
        nodeType={pendingNode?.type === "approval" ? "action" : pendingNode?.type || "action"}
        onSelectApp={handleAppSelect}
        disabledServices={disabledServices}
        planLockedServices={planLockedTriggerServices}
      />
    </div>
  );
}

function FlowBuilderLoadingState(): ReactElement {
  return (
    <div className="relative flex h-full flex-col md:flex-row">
      <CanvasBackground />

      <div className="relative z-10 flex flex-1 items-start justify-center overflow-auto p-3 pt-4 md:p-6">
        <div className="mx-auto w-full max-w-md py-4 md:max-w-xl md:py-8">
          <div className="mb-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading automation template
          </div>
          <div className="space-y-0">
            {Array.from({ length: LOADING_STEP_COUNT }, (_, index) => (
              <div key={index}>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-2 w-2 rounded-full" />
                  </div>
                </div>
                {index < LOADING_STEP_COUNT - 1 && (
                  <div className="flex h-14 items-center justify-center">
                    <div className="h-full w-px bg-primary/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
