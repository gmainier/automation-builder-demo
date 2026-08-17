"use client";
import { useCallback, useEffect, useState } from "react";
import { FlowBuilder } from "./components/flow-builder";
import { AutomationHeader } from "./components/automation-header";
import { AssistantPanelShell } from "./components/assistant-panel-shell";
import { AutomationHomeHero } from "./components/automation-home-hero";
import { AutomationProvider } from "./contexts/automation-context";
import { AutomationsTable } from "./components/automations-table";
import { AutomationHistory } from "./components/automation-history";
import { PendingApprovalsTab } from "./components/pending-approvals-tab";
import { ActiveAutomationsTab } from "./components/active-automations-tab";
import { AutomationTemplatesTab } from "./components/automation-templates-tab";
import { NotificationApprovalHistory } from "./components/notification-approval-history";
import { RateLimitBanner } from "./components/rate-limit-banner";
import { ChatPanel } from "./components/chat/chat-panel";
import { cn } from "@/lib/utils";
import {
	useQueryState,
	parseAsString,
	parseAsInteger,
	parseAsBoolean,
} from "nuqs";
import { Badge } from "@/components/ui/badge";
import { Lock, MessageSquare, List } from "lucide-react";
import { useUser } from "@/lib/providers/user-provider";
import { canViewAutomations } from "@/lib/automation/automation-access";

export default function Home() {
	const [view, setView] = useQueryState(
		"view",
		parseAsString.withDefault("chat"),
	);
	const [selectedAutomationId, setSelectedAutomationId] = useQueryState(
		"automationId",
		parseAsString,
	);
	const [activeTab, setActiveTab] = useQueryState(
		"tab",
		parseAsString.withDefault("automations"),
	);
	const [historyId, setHistoryId] = useQueryState("historyId", parseAsInteger);
	const [assistantOpen, setAssistantOpen] = useQueryState(
		"assistant",
		parseAsBoolean.withDefault(false),
	);
	const [assistantSeed, setAssistantSeed] = useQueryState(
		"assistantSeed",
		parseAsString,
	);
	const [assistantSeedMode, setAssistantSeedMode] = useQueryState(
		"assistantSeedMode",
		parseAsString,
	);
	const [automationRuleId, setAutomationRuleId] = useQueryState(
		"automationRuleId",
		parseAsInteger,
	);
	const [pendingCount, setPendingCount] = useState(0);
	const [activeCount, setActiveCount] = useState(0);

	// Analysts and commenters are blocked from the Automations area.
	// canViewAutomations is permissive while the role is still loading, so this
	// never flashes the access-denied screen before the real role resolves.
	const { extendedUser } = useUser();
	const canView = canViewAutomations(extendedUser?.role);

	// Fetch pending approvals count and active count
	useEffect(() => {
		if (!canView) return;
		let isMounted = true;
		const controller = new AbortController();
		const isAbortLikeError = (error: unknown) => {
			if (error instanceof DOMException) return error.name === "AbortError";
			if (!(error instanceof Error)) return false;
			return (
				error.name === "AbortError" ||
				error.message.toLowerCase().includes("aborted")
			);
		};

		const fetchCounts = async () => {
			try {
				const [pendingRes, activeRes] = await Promise.all([
					fetch("/api/automation/approval/pending", {
						signal: controller.signal,
					}),
					fetch("/api/automation/active", { signal: controller.signal }),
				]);
				if (!pendingRes.ok || !activeRes.ok) {
					return;
				}
				const pendingData = await pendingRes.json();
				const activeData = await activeRes.json();
				if (!isMounted) return;
				setPendingCount(pendingData.count || 0);
				setActiveCount(activeData.counts?.total || 0);
			} catch (error) {
				if (isAbortLikeError(error)) {
					return;
				}
				console.error("Failed to fetch counts:", error);
			}
		};
		fetchCounts();
		const interval = setInterval(fetchCounts, 30000);
		return () => {
			isMounted = false;
			controller.abort();
			clearInterval(interval);
		};
	}, [canView]);

	const handleOpenAutomation = (id: number | string) => {
		setSelectedAutomationId(String(id));
		setView("builder");
	};

	const handleBackToTable = () => {
		setView("table");
		setSelectedAutomationId(null);
		setHistoryId(null);
		setAssistantOpen(null);
		setAssistantSeed(null);
		setAssistantSeedMode(null);
	};

	// Hero submit → open a fresh builder with the assistant dock, seeded with the goal.
	// "suggest" chips ask the assistant to scan the account and recommend automations first.
	const handleBuildWithAi = (goal: string, mode?: "suggest" | "build") => {
		setSelectedAutomationId("new");
		setAssistantSeed(goal);
		setAssistantSeedMode(mode === "suggest" ? "suggest" : null);
		setAssistantOpen(true);
		setView("builder");
	};

	// Parse automationId - could be numeric or "new"
	const parsedAutomationId = selectedAutomationId
		? selectedAutomationId === "new"
			? "new"
			: isNaN(Number(selectedAutomationId))
				? selectedAutomationId
				: Number(selectedAutomationId)
		: null;
	const handleAutomationIdChange = useCallback(
		(id: number | string | null) =>
			setSelectedAutomationId(id == null ? null : String(id)),
		[setSelectedAutomationId],
	);

	if (!canView) {
		return (
			<div className="flex h-[calc(100vh-1rem)] flex-col items-center justify-center bg-background px-6 text-center">
				<div className="flex max-w-md flex-col items-center gap-4">
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
						<Lock className="h-6 w-6 text-muted-foreground" />
					</div>
					<h2 className="text-xl font-semibold text-foreground">
						Automations are not available for your role
					</h2>
					<p className="text-sm text-muted-foreground">
						Your current role does not include access to Automations. Contact an
						admin or editor on your team if you need access.
					</p>
				</div>
			</div>
		);
	}

	return (
		<AutomationProvider
			automationId={parsedAutomationId}
			onAutomationIdChange={handleAutomationIdChange}
		>
			<div className="flex h-[calc(100vh-1rem)] flex-col bg-background">
				{view === "chat" ? (
					/* Chat-first view */
					<div className="flex h-full flex-col">
						{/* Tab switcher */}
						<div className="flex items-center border-b border-border px-4 py-2">
							<div className="inline-flex items-center gap-1 rounded-lg bg-muted/50 p-1">
								<button
									type="button"
									onClick={() => setView("chat")}
									className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-card text-foreground shadow-sm"
								>
									<MessageSquare className="h-3.5 w-3.5" />
									Build
								</button>
								<button
									type="button"
									onClick={() => setView("table")}
									className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground"
								>
									<List className="h-3.5 w-3.5" />
									Automations
								</button>
							</div>
						</div>
						<ChatPanel onOpenBuilder={() => {
              setView("builder");
              }} 
            />
					</div>
				) : view !== "builder" ? (
					<div className="flex h-full flex-col">
						{/* Rate-limit warning banner (current workspace) */}
						<div className="px-4 md:px-8 pt-4 md:pt-6 empty:hidden">
							<RateLimitBanner />
						</div>

						{/* AI hero — describe an automation and let the assistant build it live */}
						{activeTab === "automations" && (
							<div className="px-4 md:px-8 pt-4 md:pt-6">
								<AutomationHomeHero onSubmitGoal={handleBuildWithAi} />
							</div>
						)}

						{/* Custom Tabs Header */}
						<div className="px-4 md:px-8 pt-4 md:pt-6">
							<div className="inline-flex items-center gap-1 rounded-lg bg-muted/50 p-1">
								<button
                type="button"
									onClick={() => {
										setActiveTab("automations");
										setHistoryId(null);
										setAutomationRuleId(null);
									}}
									className={cn(
										"relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
										activeTab === "automations"
											? "bg-card text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
									)}
								>
									My Automations
								</button>
								<button
                  type="button"
									onClick={() => setActiveTab("templates")}
									className={cn(
										"relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
										activeTab === "templates"
											? "bg-card text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
									)}
								>
									Templates
								</button>
								<button
                  type="button"
									onClick={() => setActiveTab("active")}
									className={cn(
										"relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2",
										activeTab === "active"
											? "bg-card text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
									)}
								>
									Active
									{activeCount > 0 && (
										<Badge
											variant="secondary"
											className="bg-green-100 text-green-700 text-xs px-1.5 py-0"
										>
											{activeCount}
										</Badge>
									)}
								</button>
								<button
                  type="button"
									onClick={() => setActiveTab("approvals")}
									className={cn(
										"relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2",
										activeTab === "approvals"
											? "bg-card text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
									)}
								>
									Approvals
									{pendingCount > 0 && (
										<Badge
											variant="secondary"
											className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0"
										>
											{pendingCount}
										</Badge>
									)}
								</button>
								<button
                  type="button"
									onClick={() => setActiveTab("notifications")}
									className={cn(
										"relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
										activeTab === "notifications"
											? "bg-card text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
									)}
								>
									Notifications
								</button>
								<button
                  type="button"
									onClick={() => setActiveTab("history")}
									className={cn(
										"relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
										activeTab === "history"
											? "bg-card text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
									)}
								>
									History
								</button>
							</div>
						</div>

						{/* Tab Content */}
						<div className="flex-1 overflow-hidden min-h-0 flex flex-col">
							{activeTab === "automations" ? (
								<AutomationsTable
									callbacks={{ onOpenAutomation: handleOpenAutomation }}
								/>
							) : activeTab === "templates" ? (
								<AutomationTemplatesTab
									onUseTemplate={(id) => handleOpenAutomation(id)}
								/>
							) : activeTab === "active" ? (
								<ActiveAutomationsTab
									onCountChange={setActiveCount}
									onOpenAutomation={handleOpenAutomation}
								/>
							) : activeTab === "approvals" ? (
								<PendingApprovalsTab onCountChange={setPendingCount} />
							) : activeTab === "notifications" ? (
								<NotificationApprovalHistory
									automationRuleId={automationRuleId}
									onClearAutomationRuleId={() => setAutomationRuleId(null)}
								/>
							) : (
								<AutomationHistory
									selectedHistoryId={historyId}
									onClearHistoryId={() => setHistoryId(null)}
									automationRuleId={automationRuleId}
									onClearAutomationRuleId={() => setAutomationRuleId(null)}
								/>
							)}
						</div>
					</div>
				) : (
					<div className="flex h-full flex-col">
						<AutomationHeader onBackToTable={handleBackToTable} />
						<div className="flex flex-1 overflow-hidden min-h-0">
							<main className="flex-1 overflow-hidden min-h-0">
								<FlowBuilder />
							</main>
							{assistantOpen && (
								<AssistantPanelShell
									seedPrompt={assistantSeed}
									seedMode={
										assistantSeedMode === "suggest" ? "suggest" : "build"
									}
									onSeedConsumed={() => {
										setAssistantSeed(null);
										setAssistantSeedMode(null);
									}}
									onClose={() => setAssistantOpen(null)}
								/>
							)}
						</div>
					</div>
				)}
			</div>
		</AutomationProvider>
	);
}
