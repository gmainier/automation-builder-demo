"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { ChatInput } from "./chat-input";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import { useChatAutomation } from "../../hooks/use-chat-automation";

const STARTER_SUGGESTIONS = [
	"Pause ads under 1.5 ROAS after $50 spend",
	"Scale winners above 3 ROAS by 20%",
	"Send me a Slack alert when CPA spikes",
	"Pause ads with frequency above 4",
];

interface ChatPanelProps {
  readonly onOpenBuilder?: () => void;
}

export function ChatPanel({ onOpenBuilder }: ChatPanelProps) {
	const { messages, isStreaming, sendMessage, saveCurrentAutomation } =
		useChatAutomation();
	const bottomRef = useRef<HTMLDivElement>(null);

	const hasMessages = messages.length > 0;

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length]);

  const handleFollowUp = (text: string) => {
  if (text === "Show me the steps it created" && onOpenBuilder) {
    onOpenBuilder();
  } else {
    sendMessage(text);
  }
};
	return (
		<div className="flex h-full flex-col">
			{!hasMessages ? (
				/* Empty state */
				<div className="flex flex-1 flex-col items-center justify-center px-4">
					<div className="mx-auto max-w-md text-center">
						<div className="mb-4 flex justify-center">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5">
								<Sparkles className="h-6 w-6 text-foreground/70" />
							</div>
						</div>
						<h2 className="mb-2 text-lg font-semibold text-foreground">
							Build an automation
						</h2>
						<p className="mb-6 text-sm text-muted-foreground">
							Describe what you want to automate and I&apos;ll set it up.
							I&apos;ll ask for anything I need.
						</p>
						<div className="grid gap-2">
							{STARTER_SUGGESTIONS.map((suggestion) => (
								<button
									type="button"
									key={suggestion}
									onClick={() => sendMessage(suggestion)}
									className="rounded-lg border border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
								>
									{suggestion}
								</button>
							))}
						</div>
					</div>
				</div>
			) : (
				/* Message list */
				<div className="flex-1 overflow-y-auto px-4 py-6">
					<div className="mx-auto max-w-2xl space-y-6">
						{messages.map((msg) =>
							msg.role === "user" ? (
								<UserMessage key={msg.id} message={msg} />
							) : (
								<AssistantMessage
									key={msg.id}
									message={msg}
									isStreaming={
										isStreaming && msg === messages[messages.length - 1]
									}
									onFollowUp={handleFollowUp}
									onSave={saveCurrentAutomation}
								/>
							),
						)}
						<div ref={bottomRef} />
					</div>
				</div>
			)}

			<ChatInput onSend={sendMessage} disabled={isStreaming} />
		</div>
	);
}
