"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { ConfigSectionProps } from "./types";
import { FieldLabel } from "./field-label";

export function ManualTriggerConfig({ config, setConfig }: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Schedule Configuration</h4>
      <p className="text-xs text-muted-foreground">Set when and how often this automation should run.</p>
      <div className="space-y-3 md:space-y-4">
        {/* Frequency Selector */}
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">
            Frequency <span className="text-destructive">*</span>
          </Label>
          <Select
            value={config.frequency || "one-time"}
            onValueChange={(value) => setConfig({ ...config, frequency: value })}
          >
            <SelectTrigger className="h-10 text-base md:h-11 bg-white">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-time">One-time</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* One-time: Date picker */}
        {(config.frequency === "one-time" || !config.frequency) && (
          <div className="space-y-1.5 md:space-y-2">
            <Label className="text-sm">
              Scheduled Date <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              className="h-10 text-base md:h-11 bg-white"
              value={config.scheduledDate || ""}
              onChange={(e) => setConfig({ ...config, scheduledDate: e.target.value })}
            />
          </div>
        )}

        {/* Weekly: Day of week picker */}
        {config.frequency === "weekly" && (
          <div className="space-y-1.5 md:space-y-2">
            <Label className="text-sm">
              Day of Week <span className="text-destructive">*</span>
            </Label>
            <Select
              value={config.dayOfWeek || ""}
              onValueChange={(value) => setConfig({ ...config, dayOfWeek: value })}
            >
              <SelectTrigger className="h-10 text-base md:h-11 bg-white">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="tuesday">Tuesday</SelectItem>
                <SelectItem value="wednesday">Wednesday</SelectItem>
                <SelectItem value="thursday">Thursday</SelectItem>
                <SelectItem value="friday">Friday</SelectItem>
                <SelectItem value="saturday">Saturday</SelectItem>
                <SelectItem value="sunday">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Monthly: Day of month picker */}
        {config.frequency === "monthly" && (
          <div className="space-y-1.5 md:space-y-2">
            <Label className="text-sm">
              Day of Month <span className="text-destructive">*</span>
            </Label>
            <Select
              value={config.dayOfMonth || ""}
              onValueChange={(value) => setConfig({ ...config, dayOfMonth: value })}
            >
              <SelectTrigger className="h-10 text-base md:h-11 bg-white">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                    {day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"}
                  </SelectItem>
                ))}
                <SelectItem value="last">Last day of month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Time picker - always shown */}
        <div className="space-y-1.5 md:space-y-2">
          <Label className="text-sm">
            Time (BST) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="time"
            className="h-10 text-base md:h-11 bg-white"
            value={config.scheduledTime || ""}
            onChange={(e) => setConfig({ ...config, scheduledTime: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {config.frequency === "daily" && "Runs every day at this time."}
            {config.frequency === "weekly" && `Runs every ${config.dayOfWeek || "week"} at this time.`}
            {config.frequency === "monthly" &&
              `Runs on the ${config.dayOfMonth || "selected day"}${config.dayOfMonth === "1" ? "st" : config.dayOfMonth === "2" ? "nd" : config.dayOfMonth === "3" ? "rd" : "th"} of each month.`}
            {(config.frequency === "one-time" || !config.frequency) && "Time is in British Summer Time (BST)."}
          </p>
        </div>

        {/* Start date for recurring */}
        {(config.frequency === "daily" || config.frequency === "weekly" || config.frequency === "monthly") && (
          <div className="space-y-1.5 md:space-y-2">
            <FieldLabel tooltip="The automation will start running from this date." required>
              Start Date
            </FieldLabel>
            <Input
              type="date"
              className="h-10 text-base md:h-11 bg-white"
              value={config.startDate || ""}
              onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
            />
          </div>
        )}

        {/* End date for recurring (optional) */}
        {(config.frequency === "daily" || config.frequency === "weekly" || config.frequency === "monthly") && (
          <div className="space-y-1.5 md:space-y-2">
            <FieldLabel tooltip="Leave empty to run indefinitely.">End Date (optional)</FieldLabel>
            <Input
              type="date"
              className="h-10 text-base md:h-11 bg-white"
              value={config.endDate || ""}
              onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
