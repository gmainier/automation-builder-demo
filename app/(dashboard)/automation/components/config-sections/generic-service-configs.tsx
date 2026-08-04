"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "./field-label";
import type { ConfigSectionProps } from "./types";

// Google Drive Action Config
export function GoogleDriveActionConfig({ config, setConfig }: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Google Drive Configuration</h4>
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Folder ID</Label>
          <Input
            className="h-10 text-base md:h-11"
            placeholder=""
            value={config.folderId || ""}
            onChange={(e) => setConfig({ ...config, folderId: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// Box Trigger Config
export function BoxTriggerConfig({ config, setConfig }: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Box Configuration</h4>
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Folder ID</Label>
          <Input
            className="h-10 text-base md:h-11"
            placeholder="Marketing_Reports"
            value={config.folderId || ""}
            onChange={(e) => setConfig({ ...config, folderId: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// HubSpot Trigger Config
export function HubSpotTriggerConfig({ config, setConfig }: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">HubSpot Configuration</h4>
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Pipeline</Label>
          <Input
            className="h-10 text-base md:h-11"
            placeholder="Sales Pipeline"
            value={config.pipeline || ""}
            onChange={(e) => setConfig({ ...config, pipeline: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Stage</Label>
          <Input
            className="h-10 text-base md:h-11"
            placeholder="Closed Won"
            value={config.stage || ""}
            onChange={(e) => setConfig({ ...config, stage: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Minimum Amount</Label>
          <Input
            className="h-10 text-base md:h-11"
            placeholder="5000"
            value={config.minAmount || ""}
            onChange={(e) => setConfig({ ...config, minAmount: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// Filter Config
export function FilterConfig({ config, setConfig }: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Filter Condition</h4>
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Field</Label>
          <Input
            className="h-10 text-base md:h-11"
            placeholder="field_name"
            value={config.field || ""}
            onChange={(e) => setConfig({ ...config, field: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Operator</Label>
          <Select value={config.operator || ""} onValueChange={(value) => setConfig({ ...config, operator: value })}>
            <SelectTrigger className="h-10 text-base md:h-11">
              <SelectValue placeholder="Choose operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="not_equals">Not Equals</SelectItem>
              <SelectItem value="greater_than">Greater Than</SelectItem>
              <SelectItem value="less_than">Less Than</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Value</Label>
          <Input
            className="h-10 text-base md:h-11"
            placeholder="comparison value"
            value={config.value || ""}
            onChange={(e) => setConfig({ ...config, value: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// Timer Config
export function TimerConfig({ config, setConfig }: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Schedule Configuration</h4>
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">Scheduled Date</Label>
          <Input
            type="date"
            className="h-10 text-base md:h-11"
            value={config.scheduledDate || ""}
            onChange={(e) => setConfig({ ...config, scheduledDate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <FieldLabel tooltip="Actions after this timer will execute at the scheduled time">
            Scheduled Time (BST)
          </FieldLabel>
          <Input
            type="time"
            className="h-10 text-base md:h-11"
            value={config.scheduledTime || ""}
            onChange={(e) => setConfig({ ...config, scheduledTime: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// Delay Config - Wait for a duration before continuing
export function DelayConfig({ config, setConfig }: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Delay Configuration</h4>
      <p className="text-xs text-muted-foreground">Wait for a specified duration before the next step executes.</p>
      <div className="space-y-3 md:space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 md:space-y-2">
            <Label className="text-sm">Duration</Label>
            <Input
              type="number"
              min={(config.delayUnit || "hours") === "minutes" ? "5" : "1"}
              step={(config.delayUnit || "hours") === "minutes" ? "5" : "1"}
              className="h-10 text-base md:h-11"
              placeholder={(config.delayUnit || "hours") === "minutes" ? "5" : "1"}
              value={config.delayDuration || ""}
              onChange={(e) => {
                let val = e.target.value;
                if ((config.delayUnit || "hours") === "minutes" && val !== "") {
                  const num = Math.max(5, Math.round(Number(val) / 5) * 5);
                  val = String(num);
                }
                setConfig({ ...config, delayDuration: val });
              }}
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <Label className="text-sm">Unit</Label>
            <Select
              value={config.delayUnit || "hours"}
              onValueChange={(value) => {
                const updated: Record<string, any> = { ...config, delayUnit: value };
                if (value === "minutes" && updated.delayDuration) {
                  const num = Math.max(5, Math.round(Number(updated.delayDuration) / 5) * 5);
                  updated.delayDuration = String(num);
                }
                setConfig(updated);
              }}
            >
              <SelectTrigger className="h-10 text-base md:h-11">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Example: Wait 24 hours before duplicating the ad to a scaling ad set.
        </p>
      </div>
    </div>
  );
}
