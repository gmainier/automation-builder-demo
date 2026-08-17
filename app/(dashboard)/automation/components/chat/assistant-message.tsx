"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, Loader2, Save } from "lucide-react";
import type { ChatMessage } from "./types";
import { QuestionCard } from "./question-card";
import { FollowUpSuggestions } from "./follow-up-suggestions";
import { cn } from "@/lib/utils";
import type { ToolCallRecord } from "@/lib/chat/types";

interface AssistantMessageProps {
	readonly message: ChatMessage;
	readonly isStreaming?: boolean;
	readonly onQuestionAnswer?: (questionId: string, answer: string) => void;
	readonly onFollowUp?: (text: string) => void;
	readonly onSave?: () => void;
}

export function AssistantMessage({
	message,
	isStreaming,
	onQuestionAnswer,
	onFollowUp,
	onSave,
}: AssistantMessageProps) {
	const hasBuiltSomething = message.toolCalls && message.toolCalls.length > 0;
	const isComplete = !isStreaming && message.text;

	return (
		<div className="flex flex-col gap-3">
			{/* Thinking indicator */}
			{message.thinkingSeconds != null && (
				<ThinkingBlock seconds={message.thinkingSeconds} />
			)}

			{/* Tool calls */}
			{message.toolCalls && message.toolCalls.length > 0 && (
				<div className="space-y-1">
					{message.toolCalls.map((tc) => (
						<ToolCallItem key={tc.id} toolCall={tc} />
					))}
				</div>
			)}

			{/* Text content */}
			{message.text && (
				<div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
					{message.text}
				</div>
			)}

			{/* Streaming indicator */}
			{isStreaming && !message.text && !message.question && (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					<span className="text-xs">Thinking...</span>
				</div>
			)}

			{/* Question card */}
			{message.question && (
				<QuestionCard
					question={message.question}
					onAnswer={(answer) =>
						message.question && onQuestionAnswer?.(message.question.id, answer)
					}
				/>
			)}

			{/* Follow-up suggestions */}
			{message.followUps && message.followUps.length > 0 && (
				<FollowUpSuggestions
					suggestions={message.followUps}
					onSelect={onFollowUp}
				/>
			)}

			{/* Save button — appears after a completed build */}
			{hasBuiltSomething && isComplete && onSave && (
				<SaveButton onSave={onSave} />
			)}
		</div>
	);
}


function ThinkingBlock({ seconds }: { seconds: number }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<button
			type="button"
			onClick={() => setExpanded(!expanded)}
			className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
		>
			{expanded ? (
				<ChevronDown className="h-3 w-3" />
			) : (
				<ChevronRight className="h-3 w-3" />
			)}
			<span>Thought for {seconds.toFixed(1)}s</span>
		</button>
	);
}

function ToolCallItem({ toolCall }: { toolCall: ToolCallRecord }) {
	const [expanded, setExpanded] = useState(false);
	const isDone = toolCall.status === "done";
	const isRunning =
		toolCall.status === "running" || toolCall.status === "queued";

	return (
		<div className="rounded-lg border border-border/50 bg-muted/30">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
			>
				{isDone ? (
					<Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
				) : isRunning ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
				) : (
					<div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
				)}
				<span
					className={cn(
						"flex-1 font-medium",
						isDone && "text-foreground",
						isRunning && "text-blue-600",
					)}
				>
					{formatToolName(toolCall.name)}
				</span>
				{expanded ? (
					<ChevronDown className="h-3 w-3 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 text-muted-foreground" />
				)}
			</button>
			{expanded && toolCall.resultText && (
				<div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
					{toolCall.resultText}
				</div>
			)}
		</div>
	);
}

function formatToolName(name: string): string {
	return name
		.replace(/^automation_/, "")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function SaveButton({ onSave }: { onSave: () => void }) {
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const handleSave = async () => {
		setSaving(true);
		onSave();
		// Small delay so the user sees the transition
		await new Promise((r) => setTimeout(r, 600));
		setSaving(false);
		setSaved(true);
	};

	if (saved) {
		return (
			<div className="flex items-center gap-2 text-sm text-green-600">
				<Check className="h-4 w-4" />
				<span>Automation saved</span>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={handleSave}
			disabled={saving}
			className="mt-1 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
		>
			{saving ? (
				<Loader2 className="h-4 w-4 animate-spin" />
			) : (
				<Save className="h-4 w-4" />
			)}
			{saving ? "Saving..." : "Save automation"}
		</button>
	);
}
