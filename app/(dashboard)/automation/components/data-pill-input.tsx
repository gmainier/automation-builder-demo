"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Minus, X } from "lucide-react";
import { type AutomationNode } from "../contexts/automation-context";
import { getOutputsForEvent } from "./data-pill-selector";
import { cn } from "@/lib/utils";

export interface TemplateVariable {
  key: string; // e.g. "date", "original_name"
  label: string; // e.g. "Date", "Original Name"
  example?: string; // e.g. "2026-03-31"
}

interface DataPillInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  previousNodes: AutomationNode[];
  currentNodePosition: number;
  // Optional: filter which output fields to show (e.g., only "name" fields)
  fieldFilter?: (field: string, label: string) => boolean;
  // Built-in template variables to show as insertable buttons
  templateVariables?: TemplateVariable[];
  defaultExpanded?: boolean;
}

// Format field name to be human-readable (e.g., "qualifyingAdIds" -> "Qualifying Ad IDs")
function formatFieldName(field: string): string {
  if (!field) return "Unknown";
  // Handle camelCase and convert to Title Case with spaces
  return field
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .replace(/Id$/, "ID") // Fix "Id" -> "ID"
    .replace(/Ids$/, "IDs") // Fix "Ids" -> "IDs"
    .trim();
}

// Special template variables that are NOT data pills from previous steps
const TEMPLATE_VARIABLES = [
  "date",
  "assetName",
  "original_name",
  "timestamp",
  "filename",
  "boardName",
  "adSetName",
  "campaignName",
  "aiName",
  "counter",
];

// Parse data pills from value and get their display info
function parsePills(
  value: string,
  availableOutputs: { nodeId: string; stepNumber: number; field: string; label: string }[],
  previousNodes: { id: string; position: number }[],
) {
  const pillRegex = /\{\{([^}]+)\}\}/g;
  const pills: { raw: string; nodeId: string; field: string; stepNumber: number; label: string }[] = [];
  let match;

  while ((match = pillRegex.exec(value)) !== null) {
    const [fullMatch, inner] = match;

    // Skip template variables like {{date}}, {{assetName}} - they don't have a dot
    if (!inner.includes(".")) {
      // Check if it's a known template variable
      if (TEMPLATE_VARIABLES.includes(inner)) {
        continue; // Skip, don't show as a pill
      }
      continue; // Skip any single-word placeholder
    }

    const [nodeId, field] = inner.split(".");
    const output = availableOutputs.find((o) => o.nodeId === nodeId && o.field === field);

    // Find step number from previousNodes if not in availableOutputs
    const nodeInfo = previousNodes.find((n) => n.id === nodeId);
    const stepNumber = output?.stepNumber || (nodeInfo ? nodeInfo.position + 1 : 1);

    pills.push({
      raw: fullMatch,
      nodeId,
      field,
      stepNumber,
      label: output?.label || formatFieldName(field),
    });
  }

  return pills;
}

export function DataPillInput({
  value,
  onChange,
  placeholder,
  className,
  previousNodes,
  currentNodePosition,
  fieldFilter,
  templateVariables,
  defaultExpanded = false,
}: DataPillInputProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Get all available outputs from previous steps
  // Pass node config to enable dynamic outputs (e.g., Google Sheets data mappings)
  const availableOutputs = previousNodes
    .filter((n) => n.position < currentNodePosition)
    .flatMap((node) => {
      const outputs = getOutputsForEvent(node.event || "", node.type, node.service, node.config);
      return outputs
        .filter((out) => !fieldFilter || fieldFilter(out.field, out.label))
        .map((out) => ({
          nodeId: node.id,
          stepNumber: node.position + 1,
          field: out.field,
          label: out.label,
        }));
    });

  // Parse pills from current value
  const pills = useMemo(
    () => parsePills(value, availableOutputs, previousNodes),
    [value, availableOutputs, previousNodes],
  );
  const hasPills = pills.length > 0;

  // Extract non-pill text (the parts between/around data pill references)
  const nonPillText = useMemo(() => {
    if (!hasPills) return value;
    let text = value;
    for (const pill of pills) {
      text = text.replace(pill.raw, "");
    }
    return text;
  }, [value, pills, hasPills]);

  const insertPill = (nodeId: string, field: string) => {
    const pillRef = `{{${nodeId}.${field}}}`;
    onChange(value + pillRef);
    setIsExpanded(false); // Collapse after inserting
  };

  const removePill = (pillRaw: string) => {
    onChange(value.replace(pillRaw, "").trim());
  };

  // Show button if there are outputs from previous steps or template variables
  const hasOutputs = availableOutputs.length > 0;
  const hasTemplateVars = (templateVariables?.length ?? 0) > 0;
  const showToggle = hasOutputs || hasTemplateVars;

  const insertTemplateVar = (key: string) => {
    onChange(value + `{{${key}}}`);
    setIsExpanded(false);
  };

  return (
    <div className="space-y-2">
      {/* Input container with pills inside */}
      <div
        className={cn(
          "relative flex flex-wrap items-center gap-1.5 min-h-[40px] md:min-h-[44px] px-3 py-2 rounded-md border border-input bg-white",
          showToggle && "pr-12",
          className,
        )}
      >
        {/* Show existing pills as badges inside input */}
        {pills.map((pill, idx) => (
          <div
            key={`${pill.raw}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-xs font-medium shadow-sm"
          >
            <Zap className="h-3 w-3" />
            <span>
              Step {pill.stepNumber}: {pill.label}
            </span>
            <button
              type="button"
              onClick={() => removePill(pill.raw)}
              className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Inline input for typing */}
        <input
          type="text"
          value={hasPills ? nonPillText : value}
          onChange={(e) => {
            if (hasPills) {
              // Keep pill refs, replace non-pill text with new input
              const pillRefs = pills.map((p) => p.raw).join("");
              onChange(pillRefs + e.target.value);
            } else {
              onChange(e.target.value);
            }
          }}
          placeholder={hasPills ? "Add text (e.g. _{{date}})" : placeholder}
          className="flex-1 min-w-[100px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
        />

        {/* Toggle button */}
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("absolute right-1 h-7 px-2", isExpanded && "text-blue-600 bg-blue-50")}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Zap className="h-3.5 w-3.5" />
            {isExpanded ? <Minus className="h-3 w-3 ml-0.5" /> : <Plus className="h-3 w-3 ml-0.5" />}
          </Button>
        )}
      </div>

      {/* Expandable pill section */}
      {isExpanded && showToggle && (
        <div className="p-2 bg-blue-50 rounded border border-blue-100 animate-in slide-in-from-top-1 duration-150 space-y-2">
          {/* Template variables */}
          {hasTemplateVars && (
            <div>
              <p className="text-xs text-blue-600 mb-1.5 font-medium">Dynamic variables:</p>
              <div className="flex flex-wrap gap-1.5">
                {templateVariables!.map((tv) => (
                  <button
                    key={tv.key}
                    type="button"
                    className="text-xs bg-white border border-violet-200 rounded-full px-3 py-1.5 hover:bg-violet-50 hover:border-violet-300 transition-colors font-medium"
                    onClick={() => insertTemplateVar(tv.key)}
                    title={tv.example ? `e.g. ${tv.example}` : undefined}
                  >
                    <span className="text-violet-600">{`{{${tv.key}}}`}</span>
                    <span className="text-muted-foreground ml-1">— {tv.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Data pills from previous steps */}
          {hasOutputs && (
            <div>
              <p className="text-xs text-blue-600 mb-1.5 font-medium">Insert data from previous steps:</p>
              <div className="flex flex-wrap gap-1.5">
                {availableOutputs.map((opt) => (
                  <button
                    key={`${opt.nodeId}-${opt.field}`}
                    type="button"
                    className="text-xs bg-white border border-blue-200 rounded-full px-3 py-1.5 hover:bg-blue-100 hover:border-blue-300 transition-colors font-medium"
                    onClick={() => insertPill(opt.nodeId, opt.field)}
                  >
                    <span className="text-blue-600">Step {opt.stepNumber}:</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
