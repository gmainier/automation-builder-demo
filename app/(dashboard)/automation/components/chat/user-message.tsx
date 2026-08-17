import { ChatMessage } from "./types";

interface UserMessageProps {
	readonly message: ChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
	return (
		<div className="flex justify-end">
			<div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-background">
				<p className="text-sm leading-relaxed">{message.text}</p>
			</div>
		</div>
	);
}
