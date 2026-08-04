"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useHorizontalResize } from "@/app/chat/lib/use-horizontal-resize";
import { AssistantPanel } from "./assistant-panel";
import type { AssistantMode } from "../hooks/use-automation-assistant";
import {
  ASSISTANT_PANEL_DEFAULT_WIDTH_PX,
  ASSISTANT_PANEL_EXPANDED_WIDTH_PX,
  ASSISTANT_PANEL_MAX_WIDTH_PX,
  ASSISTANT_PANEL_MIN_WIDTH_PX,
  type AssistantPanelDisplayMode,
} from "../lib/assistant-panel-layout";

export type { AssistantPanelDisplayMode } from "../lib/assistant-panel-layout";

interface AssistantPanelShellProps {
  readonly onClose: () => void;
  readonly seedPrompt?: string | null;
  readonly seedMode?: AssistantMode;
  readonly onSeedConsumed?: () => void;
}

export function AssistantPanelShell({
  onClose,
  seedPrompt,
  seedMode = "build",
  onSeedConsumed,
}: AssistantPanelShellProps): React.ReactElement {
  const [displayMode, setDisplayMode] = useState<AssistantPanelDisplayMode>("normal");
  const { widthPx, handleResizeStart } = useHorizontalResize({
    initialWidthPx: ASSISTANT_PANEL_DEFAULT_WIDTH_PX,
    minWidthPx: ASSISTANT_PANEL_MIN_WIDTH_PX,
    maxWidthPx: ASSISTANT_PANEL_MAX_WIDTH_PX,
    growOnDragLeft: true,
  });

  const handleExpand = useCallback(() => setDisplayMode("expanded"), []);
  const handleMinimize = useCallback(() => setDisplayMode("normal"), []);

  const panelProps = {
    onClose,
    seedPrompt,
    seedMode,
    onSeedConsumed,
    displayMode,
    onExpandPanel: handleExpand,
    onMinimizePanel: handleMinimize,
  };

  if (displayMode === "expanded") {
    return (
      <>
        <button
          type="button"
          aria-label="Minimize assistant panel"
          className="fixed inset-0 z-40 hidden bg-black/25 md:block"
          onClick={handleMinimize}
        />
        <aside
          className={cn("fixed inset-y-0 right-0 z-50 flex flex-col border-l bg-card shadow-2xl", "hidden md:flex")}
          style={{ width: `min(${ASSISTANT_PANEL_EXPANDED_WIDTH_PX}px, 92vw)` }}
        >
          <AssistantPanel {...panelProps} />
        </aside>
        <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-2xl border-t bg-card shadow-2xl md:hidden">
          <AssistantPanel {...panelProps} />
        </aside>
      </>
    );
  }

  return (
    <aside className="relative hidden h-full flex-shrink-0 md:flex" style={{ width: widthPx }}>
      <div
        className="group relative w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/20 active:bg-primary/30"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
        <div className="absolute left-1/2 top-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary/40" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col border-l bg-card">
        <AssistantPanel {...panelProps} />
      </div>
    </aside>
  );
}
