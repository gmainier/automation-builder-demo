import { useCallback, useState } from "react";

interface ChatInputProps {
  readonly onSend: (text: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

export function ChatInput ({ onSend, disabled, placeholder }: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    if (text.trim() === "") return;
    onSend(text);
    setText("");
  }, [text, onSend]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-center gap-2 border-t border-gray-300 px-4 py-2">
      <textarea
        className="flex-1 resize-none rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? "Type your message..."}
        rows={1}
      />
      <button 
        type="button"
        onClick={handleSend}
        disabled={disabled || text.trim() === ""}
        className="rounded-md bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}