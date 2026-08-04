"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAutomation } from "../contexts/automation-context";
import { shouldShowMetaAccountSelector } from "../lib/automation-platform-labels";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Download,
  Upload,
  MoreHorizontal,
  Zap,
  FileJson,
  Copy,
  Check,
  FileCode,
  ArrowLeft,
  Save,
  Loader2,
  X,
  History,
  AlertTriangle,
  Bell,
  Ban,
  Eye,
  Sparkles,
  Pencil,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ExecutionPanel } from "./execution-panel";
import { ImportExportDialog } from "./import-export-dialog";
import { AutomationHistorySheet } from "./automation-history-sheet";
import { NotificationSettingsSheet } from "./notification-settings-sheet";
import { automationTemplates } from "../lib/automation-templates";
import { useUser } from "@/lib/providers/user-provider";
import { canManageAutomationRules } from "@/lib/automation/automation-access";
import { AutomationAdAccountSelector } from "./automation-ad-account-selector";
import { useQueryState, parseAsBoolean } from "nuqs";
import { cn } from "@/lib/utils";

interface AutomationHeaderProps {
  onBackToTable?: () => void;
}

export function AutomationHeader({ onBackToTable }: AutomationHeaderProps) {
  const {
    flow,
    editorIdentity,
    setFlowActive,
    setSelectedAccount,
    exportFlow,
    importFlowAsNew,
    saveAutomation,
    runAutomation,
    cancelExecution,
    isExecuting,
  } = useAutomation();
  const { extendedUser } = useUser();
  const canManageAutomations = canManageAutomationRules(extendedUser?.role);
  const [fullPreviewOpen, setFullPreviewOpen] = useQueryState("fullPreview", parseAsBoolean.withDefault(false));
  const [assistantOpen, setAssistantOpen] = useQueryState("assistant", parseAsBoolean.withDefault(false));
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [localName, setLocalName] = useState(flow.name);
  const initialNameRef = useRef(flow.name);

  const isEditorIdentityReady = editorIdentity.canMutate;
  const getExistingAutomationId = (): number | null => editorIdentity.existingRuleId;

  const rejectStaleEditorAction = (): boolean => {
    if (isEditorIdentityReady) return false;
    toast.error(editorIdentity.error || "Automation is still loading. Try again in a moment.", {
      position: "top-right",
    });
    return true;
  };

  // Check if this is an actively running recurring/polling automation
  const isActivelyRunning =
    flow.isActive && !!flow.frequency && ["hourly", "daily", "weekly", "monthly"].includes(flow.frequency);

  const showMetaAccountSelector = useMemo(() => shouldShowMetaAccountSelector(flow.nodes ?? []), [flow.nodes]);

  // Sync local name when flow.name changes externally
  useEffect(() => {
    setLocalName(flow.name);
    initialNameRef.current = flow.name;
  }, [flow.name]);

  // Check if name has been modified - show buttons whenever name changes
  const isNameModified = localName !== initialNameRef.current && localName.trim() !== "";

  const handleSaveName = async () => {
    if (!isNameModified) return;
    if (rejectStaleEditorAction()) return;
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations", { position: "top-right" });
      return;
    }

    setIsSavingName(true);
    try {
      const result = await saveAutomation({ mode: "update", name: localName });
      if (!result.ok) {
        toast.error(result.error, { position: "top-right" });
        setLocalName(initialNameRef.current); // Revert on error
        return;
      }

      setLocalName(result.name);
      initialNameRef.current = result.name;
      toast.success(`${result.name} saved`, { position: "top-right" });
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle ad account change from ChooseAdAccount component
  const handleAccountChange = (businessId: string) => {
    if (rejectStaleEditorAction()) return;
    // Find the account name from extendedUser settings
    const relevantSettings =
      extendedUser?.settings?.filter((setting: any) => setting.workspaceId === extendedUser.defaultWorkspaceId) || [];
    const matchingSetting = relevantSettings.find((s: any) => s.businessId === businessId);
    const accountName = matchingSetting?.businessName || businessId;
    setSelectedAccount(businessId, accountName);
  };

  const handleCancelName = () => {
    setLocalName(initialNameRef.current);
  };

  const handleExport = () => {
    const json = exportFlow();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Automation exported", { position: "top-right" });
  };

  const handleImport = () => {
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations", { position: "top-right" });
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = event.target?.result as string;
            importFlowAsNew(json);
            toast.success("Automation imported", { position: "top-right" });
          } catch {
            toast.error("Invalid JSON file format", { position: "top-right" });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleCopyJSON = async () => {
    const json = exportFlow();
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast.success("Copied to clipboard", { position: "top-right" });
  };

  const handleLoadTemplate = (template: any) => {
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations", { position: "top-right" });
      return;
    }

    importFlowAsNew(JSON.stringify(template));
    toast.success(`${template.name} loaded`, { position: "top-right" });
  };

  const handleSave = async () => {
    if (rejectStaleEditorAction()) return;
    const existingId = getExistingAutomationId();

    // If editing an actively running recurring automation, show warning dialog
    if (existingId !== null && isActivelyRunning) {
      setShowActiveWarning(true);
      return;
    }

    await performSave("update");
  };

  // Core save logic, used by handleSave, handleSaveAsNew, handlePauseAndSave
  const performSave = async (mode: "update" | "create") => {
    if (rejectStaleEditorAction()) return;
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations", { position: "top-right" });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveAutomation({ mode, name: localName });
      if (!result.ok) {
        toast.error(result.error, { position: "top-right" });
        return;
      }

      setLocalName(result.name);
      initialNameRef.current = result.name;
      toast.success(`${result.name} saved`, { position: "top-right" });
    } finally {
      setIsSaving(false);
    }
  };

  // "Save as New" — creates a copy via POST, leaves the original running
  const handleSaveAsNew = async () => {
    setShowActiveWarning(false);
    await performSave("create");
  };

  // "Pause & Save" — pauses the original, then saves edits to it
  const handlePauseAndSave = async () => {
    if (rejectStaleEditorAction()) return;
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations", { position: "top-right" });
      return;
    }

    setShowActiveWarning(false);
    const existingId = getExistingAutomationId();
    if (existingId === null) return;

    try {
      // Pause the original automation first
      const pauseResponse = await fetch("/api/automation-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existingId, status: "paused" }),
      });

      if (!pauseResponse.ok) {
        toast.error("Failed to pause automation", { position: "top-right" });
        return;
      }

      // Update local state to reflect paused status
      setFlowActive(false);

      // Now save the edits to the same automation
      await performSave("update");
    } catch {
      toast.error("An error occurred while pausing", { position: "top-right" });
    }
  };

  const handleRun = async () => {
    if (rejectStaleEditorAction()) return;
    if (!canManageAutomations) {
      toast.error("You do not have permission to run automations", { position: "top-right" });
      return;
    }

    setShowExecutionPanel(true);
    await runAutomation();
  };

  return (
    <>
      <header className="border-b border-border bg-card">
        {/* Main header row */}
        <div className="flex items-center justify-between px-3 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            {onBackToTable && (
              <Button
                onClick={onBackToTable}
                variant="ghost"
                size="icon"
                className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-primary md:flex flex-shrink-0">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="group relative min-w-0 flex-1 sm:max-w-md">
                  <Input
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    className={cn(
                      "h-10 min-w-0 rounded-lg border-border bg-background pr-10 text-base font-semibold shadow-sm transition-colors md:text-lg",
                      canManageAutomations &&
                        isEditorIdentityReady &&
                        "cursor-text hover:border-primary/60 hover:bg-muted/20 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
                    )}
                    placeholder="Automation name"
                    aria-label="Automation name"
                    title={
                      canManageAutomations && isEditorIdentityReady
                        ? "Click to rename this automation"
                        : "Automation name"
                    }
                    readOnly={!canManageAutomations || !isEditorIdentityReady}
                  />
                  {canManageAutomations && isEditorIdentityReady && (
                    <Pencil
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-hover:text-primary group-focus-within:text-primary"
                    />
                  )}
                </div>
                {getExistingAutomationId() != null && (
                  <span
                    className="text-xs text-muted-foreground font-normal shrink-0"
                    title="Automation ID for debugging"
                  >
                    #{getExistingAutomationId()}
                  </span>
                )}
                {isNameModified && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      onClick={handleSaveName}
                      disabled={isSavingName || !canManageAutomations || !isEditorIdentityReady}
                      size="sm"
                      className="h-8 px-2.5 bg-green-600 hover:bg-green-700 text-white gap-1.5 whitespace-nowrap"
                      title="Save name"
                    >
                      {isSavingName ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span className="text-xs font-medium hidden sm:inline">Save</span>
                    </Button>
                    <Button
                      onClick={handleCancelName}
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 gap-1.5 whitespace-nowrap"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium hidden sm:inline">Cancel</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Ask AI — toggles the MCP assistant dock */}
            <Button
              onClick={() => setAssistantOpen(assistantOpen ? null : true)}
              variant={assistantOpen ? "default" : "outline"}
              size="sm"
              className={cn("gap-2", assistantOpen ? "bg-violet-600 hover:bg-violet-700" : "")}
              title="Ask the AI assistant"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Ask AI</span>
            </Button>

            {/* Desktop buttons */}
            <Button
              onClick={handleSave}
              disabled={isSaving || !canManageAutomations || !isEditorIdentityReady}
              variant="outline"
              size="sm"
              className="hidden gap-2 sm:flex"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Saving..." : "Save"}
            </Button>

            {isExecuting ? (
              <>
                <Button
                  onClick={() => setShowExecutionPanel(true)}
                  size="sm"
                  variant="outline"
                  className="hidden gap-2 sm:flex"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </Button>
                <Button onClick={cancelExecution} size="sm" variant="destructive" className="hidden gap-2 sm:flex">
                  <Ban className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={handleRun}
                size="sm"
                className="hidden gap-2 sm:flex"
                disabled={!canManageAutomations || !isEditorIdentityReady}
              >
                <Play className="h-4 w-4" />
                Run
              </Button>
            )}

            <Button
              data-testid="header-full-preview"
              onClick={() => setFullPreviewOpen(fullPreviewOpen ? null : true)}
              variant={fullPreviewOpen ? "default" : "outline"}
              size="sm"
              className="hidden gap-2 sm:flex"
              title="Full preview"
            >
              <Eye className="h-4 w-4" />
              Full preview
            </Button>

            <Button
              onClick={() => setShowHistoryPanel(true)}
              variant="outline"
              size="sm"
              className="hidden gap-2 sm:flex"
              disabled={getExistingAutomationId() === null}
              title={getExistingAutomationId() === null ? "Save automation to view history" : "View execution history"}
            >
              <History className="h-4 w-4" />
              History
            </Button>

            <Button
              onClick={() => setShowNotificationSettings(true)}
              variant="outline"
              size="sm"
              className="hidden gap-2 sm:flex"
              title="Notification settings"
            >
              <Bell className="h-4 w-4" />
            </Button>

            {/* Mobile save button */}
            <Button
              onClick={handleSave}
              disabled={isSaving || !canManageAutomations || !isEditorIdentityReady}
              variant="outline"
              size="icon"
              className="h-9 w-9 sm:hidden"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>

            {/* Mobile run/cancel button */}
            {isExecuting ? (
              <>
                <Button
                  onClick={() => setShowExecutionPanel(true)}
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 sm:hidden"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Button>
                <Button onClick={cancelExecution} size="icon" variant="destructive" className="h-9 w-9 sm:hidden">
                  <Ban className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                onClick={handleRun}
                size="icon"
                className="h-9 w-9 sm:hidden"
                disabled={!canManageAutomations || !isEditorIdentityReady}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}

            {/* Mobile history button */}
            <Button
              onClick={() => setShowHistoryPanel(true)}
              variant="outline"
              size="icon"
              className="h-9 w-9 sm:hidden"
              disabled={getExistingAutomationId() === null}
            >
              <History className="h-4 w-4" />
            </Button>

            {/* Mobile notification button */}
            <Button
              onClick={() => setShowNotificationSettings(true)}
              variant="outline"
              size="icon"
              className="h-9 w-9 sm:hidden"
            >
              <Bell className="h-4 w-4" />
            </Button>

            {/* Actions dropdown - visible on all sizes */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 bg-transparent">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={handleSave}
                  disabled={isSaving || !canManageAutomations || !isEditorIdentityReady}
                  className="sm:hidden"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Automation"}
                </DropdownMenuItem>
                {isExecuting ? (
                  <>
                    <DropdownMenuItem onClick={() => setShowExecutionPanel(true)} className="sm:hidden">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      View Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={cancelExecution} className="sm:hidden text-red-600">
                      <Ban className="mr-2 h-4 w-4" />
                      Cancel Execution
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onClick={handleRun}
                    disabled={!canManageAutomations || !isEditorIdentityReady}
                    className="sm:hidden"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Run Automation
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setShowImportExport(true)} disabled={!canManageAutomations}>
                  <FileJson className="mr-2 h-4 w-4" />
                  Import/Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyJSON}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copied!" : "Copy JSON"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Download JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImport} disabled={!canManageAutomations}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Load Template</DropdownMenuLabel>
                {automationTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleLoadTemplate(template)}
                    disabled={!canManageAutomations}
                  >
                    <FileCode className="mr-2 h-4 w-4" />
                    {template.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Ad Account selector row — Meta-only; hidden for TikTok/cross-channel flows */}
        {showMetaAccountSelector && (
          <div className="flex items-center px-3 pb-3 pt-0 md:px-6 md:pb-4">
            <div className="w-[260px]">
              <AutomationAdAccountSelector
                value={flow.selectedAccountId ?? ""}
                onChange={(value) => handleAccountChange(value)}
                placeholder="Select ad account..."
                disabled={!canManageAutomations || !isEditorIdentityReady}
              />
            </div>
          </div>
        )}
      </header>

      <ExecutionPanel open={showExecutionPanel} onOpenChange={setShowExecutionPanel} />
      <ImportExportDialog open={showImportExport} onOpenChange={setShowImportExport} />
      <AutomationHistorySheet
        open={showHistoryPanel}
        onOpenChange={setShowHistoryPanel}
        automationRuleId={getExistingAutomationId()}
        automationName={flow.name}
      />
      <NotificationSettingsSheet open={showNotificationSettings} onOpenChange={setShowNotificationSettings} />

      {/* Active automation warning dialog */}
      <AlertDialog open={showActiveWarning} onOpenChange={setShowActiveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Editing Active Automation
            </AlertDialogTitle>
            <AlertDialogDescription>
              This automation is currently running on a <strong>{flow.frequency}</strong> schedule. How would you like
              to save your changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleSaveAsNew} variant="outline" disabled={isSaving || !isEditorIdentityReady}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              Save as New
            </Button>
            <Button onClick={handlePauseAndSave} disabled={isSaving || !canManageAutomations || !isEditorIdentityReady}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Pause &amp; Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
