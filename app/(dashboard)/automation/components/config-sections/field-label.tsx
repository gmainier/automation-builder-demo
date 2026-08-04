"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FieldLabelProps {
  /** The label text/content for the field. */
  children: ReactNode;
  /** Guidance shown in an info-icon tooltip instead of an inline helper paragraph. */
  tooltip?: ReactNode;
  /** Append a red required asterisk after the label. */
  required?: boolean;
  /** Optional extra classes for the wrapper row. */
  className?: string;
  /** Tooltip placement; defaults to "top". */
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

/**
 * A form-field label with an optional inline info-icon tooltip. Use this in
 * automation config sections to replace inline `<p>` helper paragraphs with a
 * compact hover tooltip, keeping panels visually lighter.
 *
 * Self-contained: wraps its own TooltipProvider so callers don't need one.
 */
export function FieldLabel({ children, tooltip, required = false, className, tooltipSide = "top" }: FieldLabelProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Label className="text-sm">
        {children}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {tooltip && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                aria-label="More information"
                className="inline-flex items-center justify-center text-muted-foreground/70 transition-colors hover:text-muted-foreground focus-visible:outline-none"
              >
                <Info className="h-3.5 w-3.5 cursor-help" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} className="max-w-[280px] p-2 text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
