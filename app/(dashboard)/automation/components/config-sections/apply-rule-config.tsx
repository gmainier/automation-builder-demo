"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutomationAdAccountSelector } from "../automation-ad-account-selector";
import { AutomationRuleSelector } from "../automation-rule-selector";
import { DataPillInput } from "../data-pill-input";
import { FieldLabel } from "./field-label";
import type { ConfigSectionPropsWithFlow } from "./types";

export function ApplyRuleConfig({ config, setConfig, node, flowNodes = [] }: ConfigSectionPropsWithFlow) {
  // Find previous action nodes that create ads/adsets
  const previousCreationNodes = flowNodes
    .filter((n) => n.position < (node?.position || 0))
    .filter((n) => ["Launch Ad", "Duplicate Ad Set", "Duplicate Ad"].includes(n.event || ""));

  return (
    <div className="space-y-4">
      <FieldLabel
        tooltip="Select an existing Facebook Ad Rule from your account and apply it to ads created in this automation."
        className="font-semibold"
      >
        Apply Existing Rule
      </FieldLabel>

      {/* Ad Account Selector */}
      <div className="space-y-1.5 md:space-y-2">
        <FieldLabel required>Ad Account</FieldLabel>
        <AutomationAdAccountSelector
          value={config.accountId || ""}
          onChange={(value, type, currency, label) =>
            setConfig({
              ...config,
              accountId: value,
              accountType: type,
              accountCurrency: currency,
              accountName: label || "",
            })
          }
          placeholder="Select ad account..."
          allowEmpty={true}
        />
      </div>

      {/* Rule Selector */}
      {config.accountId && (
        <div className="space-y-1.5 md:space-y-2">
          <FieldLabel required>Select Rule</FieldLabel>
          <AutomationRuleSelector
            accountId={config.accountId}
            value={config.ruleId}
            onChange={(ruleId, ruleName) => setConfig({ ...config, ruleId, ruleName })}
            placeholder="Choose an existing rule..."
          />
          {config.ruleName && <p className="text-xs text-muted-foreground">Selected: {config.ruleName}</p>}
        </div>
      )}

      {/* Apply To Selection */}
      {config.ruleId && (
        <>
          <div className="space-y-1.5 md:space-y-2">
            <FieldLabel required>Apply Rule To</FieldLabel>
            <Select
              value={config.applyTo || "new_ads"}
              onValueChange={(value) => setConfig({ ...config, applyTo: value })}
            >
              <SelectTrigger className="h-10 text-base md:h-11 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_ads">New Ads Created in This Flow</SelectItem>
                <SelectItem value="new_adsets">New Ad Sets Created in This Flow</SelectItem>
                <SelectItem value="specific">Specific IDs (manual entry)</SelectItem>
              </SelectContent>
            </Select>

            {/* Show data pill suggestions for new_ads/new_adsets */}
            {config.applyTo === "new_ads" && previousCreationNodes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Will automatically use ad IDs from previous steps ({previousCreationNodes.length} step
                {previousCreationNodes.length !== 1 ? "s" : ""} found)
              </p>
            )}
            {config.applyTo === "new_ads" && previousCreationNodes.length === 0 && (
              <p className="text-xs text-amber-600">
                No ad creation steps found. Add a "Launch Ad" or "Duplicate Ad" step before this.
              </p>
            )}

            {config.applyTo === "specific" && (
              <DataPillInput
                value={config.targetIds || ""}
                onChange={(val) => setConfig({ ...config, targetIds: val })}
                placeholder="Enter IDs or use {{node-action-1.adIds}}"
                className="mt-2 h-10 text-base md:h-11 bg-white"
                previousNodes={flowNodes}
                currentNodePosition={node.position}
              />
            )}
          </div>

          {/* Enable Immediately Toggle */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="enableImmediately"
              checked={config.enableImmediately ?? true}
              onChange={(e) => setConfig({ ...config, enableImmediately: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="enableImmediately" className="text-sm font-normal cursor-pointer">
              Enable rule immediately after applying
            </Label>
          </div>
        </>
      )}
    </div>
  );
}
