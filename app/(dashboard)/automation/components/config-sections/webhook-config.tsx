"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface WebhookConfigProps {
  config: Record<string, any>;
  setConfig: (config: Record<string, any>) => void;
}

export function WebhookConfig({ config, setConfig }: WebhookConfigProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; status?: number; body?: string } | null>(null);

  const headers: { key: string; value: string }[] = config.headers || [];

  const addHeader = () => {
    setConfig({ ...config, headers: [...headers, { key: "", value: "" }] });
  };

  const updateHeader = (index: number, field: "key" | "value", val: string) => {
    const updated = [...headers];
    updated[index] = { ...updated[index], [field]: val };
    setConfig({ ...config, headers: updated });
  };

  const removeHeader = (index: number) => {
    setConfig({ ...config, headers: headers.filter((_, i) => i !== index) });
  };

  const testWebhook = async () => {
    if (!config.url) {
      toast.error("Please enter a URL first");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/automation-rules/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: config.url,
          method: config.method || "POST",
          headers,
          body: config.body,
        }),
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        status: data.status,
        body: data.body || data.error,
      });
    } catch (err: any) {
      setTestResult({ success: false, body: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* URL */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          URL <span className="text-destructive">*</span>
        </Label>
        <Input
          value={config.url || ""}
          onChange={(e) => setConfig({ ...config, url: e.target.value })}
          placeholder="https://hooks.slack.com/services/..."
          className="h-10 bg-card"
        />
      </div>

      {/* Method */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Method</Label>
        <Select value={config.method || "POST"} onValueChange={(v) => setConfig({ ...config, method: v })}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Headers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Headers</Label>
          <Button variant="ghost" size="sm" onClick={addHeader} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add Header
          </Button>
        </div>
        {headers.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={h.key}
              onChange={(e) => updateHeader(i, "key", e.target.value)}
              placeholder="Header name"
              className="h-9 flex-1 bg-card text-sm"
            />
            <Input
              value={h.value}
              onChange={(e) => updateHeader(i, "value", e.target.value)}
              placeholder="Value"
              className="h-9 flex-1 bg-card text-sm"
            />
            <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} className="h-8 w-8 shrink-0">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      {/* Body */}
      {(config.method || "POST") !== "GET" && (config.method || "POST") !== "DELETE" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Body</Label>
          <Textarea
            value={config.body || ""}
            onChange={(e) => setConfig({ ...config, body: e.target.value })}
            placeholder={'{"text": "Ad {{trigger.adName}} was approved"}'}
            className="min-h-[100px] bg-card font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            JSON body. Use <code className="rounded bg-muted px-1">{"{{trigger.fieldName}}"}</code>,{" "}
            <code className="rounded bg-muted px-1">{"{{date}}"}</code>,{" "}
            <code className="rounded bg-muted px-1">{"{{datetime}}"}</code> for dynamic values.
          </p>
        </div>
      )}

      {/* Test Webhook */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Test Webhook</span>
          <Button variant="outline" size="sm" onClick={testWebhook} disabled={isTesting || !config.url} className="h-8">
            {isTesting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending...
              </>
            ) : (
              "Send Test Request"
            )}
          </Button>
        </div>
        {testResult && (
          <div
            className={`flex items-start gap-2 rounded p-2 text-sm ${testResult.success ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`}
          >
            {testResult.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              {testResult.status && <span className="font-medium">Status: {testResult.status}</span>}
              {testResult.body && <p className="mt-0.5 break-all text-xs opacity-80">{testResult.body}</p>}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Sends a real request to the URL above. Template variables won't be replaced in test mode.
        </p>
      </div>
    </div>
  );
}
