"use client";

import { useState } from "react";
import type { ClarifyingQuestion } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  readonly question: ClarifyingQuestion;
  readonly onAnswer?: (answer: string) => void;
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    question.options?.find((o) => o.recommended)?.value ?? null,
  );
  const [freeText, setFreeText] = useState("");
  const [answered, setAnswered] = useState(false);

  const handleSubmit = () => {
    const answer = question.freeform ? freeText : selectedOption;
    if (!answer) return;
    setAnswered(true);
    onAnswer?.(answer);
  };

  if (answered) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Answered: <span className="font-medium text-foreground">{question.freeform ? freeText : selectedOption}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Step indicator */}
      {question.step != null && question.totalSteps != null && (
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          Step {question.step} of {question.totalSteps}
        </div>
      )}

      {/* Question text */}
      <p className="mb-4 text-sm font-medium text-foreground">{question.text}</p>

      {/* Options */}
      {question.options && !question.freeform && (
        <div className="mb-4 space-y-2">
          {question.options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => setSelectedOption(option.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                selectedOption === option.value
                  ? "border-foreground bg-foreground/5"
                  : "border-border hover:border-foreground/30",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                  selectedOption === option.value ? "border-foreground bg-foreground" : "border-muted-foreground/40",
                )}
              >
                {selectedOption === option.value && (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-background" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">{option.label}</span>
                {option.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                )}
                {option.recommended && (
                  <span className="mt-1 inline-block rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                    Recommended
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Free-text input */}
      {question.freeform && (
        <div className="mb-4">
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Type your answer..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && freeText.trim()) handleSubmit();
            }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setAnswered(true);
            onAnswer?.("__skip__");
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={question.freeform ? !freeText.trim() : !selectedOption}
          className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
