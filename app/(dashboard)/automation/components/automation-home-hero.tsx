"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUGGESTED_PROMPTS } from "../lib/automation-registry";
import type { AssistantMode } from "../hooks/use-automation-assistant";

const HERO_PROMPT_LIMIT = 4;

interface AutomationHomeHeroProps {
  /** Called with the typed/selected goal to open the builder and seed the assistant. */
  readonly onSubmitGoal: (goal: string, mode?: AssistantMode) => void;
}

/**
 * Home landing hero (handoff `home.jsx`): a soft gradient panel inviting the
 * user to describe an automation in natural language. Submitting hands the goal
 * to the live AI assistant, which builds the flow on the canvas step by step.
 */
export function AutomationHomeHero({ onSubmitGoal }: AutomationHomeHeroProps): React.ReactElement {
  const [value, setValue] = useState("");

  const submit = (goal: string, mode?: AssistantMode) => {
    const trimmed = goal.trim();
    if (!trimmed) return;
    onSubmitGoal(trimmed, mode);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] via-background to-violet-500/[0.06] px-5 py-6 md:px-8 md:py-8">
      {/* Soft ornament */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl" />

      <div className="relative">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-700">
          <Sparkles className="h-3.5 w-3.5" />
          AI Assistant · builds it live
        </div>
        <h2 className="text-xl font-semibold text-foreground md:text-2xl">Describe what you want to automate</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          The assistant uses the MCP toolset tools to draft the flow on the canvas, step by step, and preview which ads it
          would affect. You stay in control of Save and Turn on.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(value);
          }}
          className="mt-4 flex max-w-2xl gap-2"
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="e.g. Pause Meta ads under 1.0 ROAS after $50 spend"
            className="h-11 flex-1 bg-card shadow-sm focus-visible:ring-2 focus-visible:ring-violet-400/40"
          />
          <Button type="submit" disabled={!value.trim()} className="h-11 gap-2 bg-violet-600 px-5 hover:bg-violet-700">
            Build with AI
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {SUGGESTED_PROMPTS.slice(0, HERO_PROMPT_LIMIT).map((prompt) => {
            const isSuggest = prompt.mode === "suggest";
            return (
              <button
                key={prompt.text}
                type="button"
                onClick={() => submit(prompt.text, prompt.mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  isSuggest
                    ? cn(
                        "border border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white",
                        "shadow-sm shadow-violet-500/30 ring-1 ring-violet-400/40",
                        "hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/40",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                      )
                    : cn("border border-border bg-card text-foreground", "hover:border-violet-200 hover:bg-violet-50"),
                )}
              >
                {isSuggest && <Sparkles className="h-3.5 w-3.5" />}
                {prompt.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
