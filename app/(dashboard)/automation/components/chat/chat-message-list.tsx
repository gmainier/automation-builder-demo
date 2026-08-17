"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "./types";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";

interface ChatMessageListProps {
	readonly messages: readonly ChatMessage[];
	readonly isStreaming: boolean;
	readonly onQuestionAnswer?: (questionId: string, answer: string) => void;
	readonly onFollowUp?: (text: string) => void;
}

export function ChatMessageList({
	messages,
	isStreaming,
	onQuestionAnswer,
	onFollowUp,
}: ChatMessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	const messagesLength = messages.length;

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messagesLength]);

	return (
		<div className="flex-1 overflow-y-auto px-4 py-6">
			<div className="mx-auto max-w-2xl space-y-6">
				{messages.map((message) =>
					message.role === "user" ? (
						<UserMessage key={message.id} message={message} />
					) : (
						<AssistantMessage
							key={message.id}
							message={message}
							isStreaming={
								isStreaming && message === messages[messages.length - 1]
							}
							onQuestionAnswer={onQuestionAnswer}
							onFollowUp={onFollowUp}
						/>
					),
				)}
				<div ref={bottomRef} />
			</div>
		</div>
	);
}
