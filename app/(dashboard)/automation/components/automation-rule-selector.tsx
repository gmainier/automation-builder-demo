"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdRule {
  id: string;
  name: string;
  status: "ENABLED" | "DISABLED";
}

type AutomationRuleSelectorProps = {
  accountId: string;
  value?: string;
  onChange: (ruleId: string, ruleName: string) => void;
  placeholder?: string;
};

export function AutomationRuleSelector({
  accountId,
  value,
  onChange,
  placeholder = "Select a rule...",
}: AutomationRuleSelectorProps) {
  const [rules, setRules] = useState<AdRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountId) {
      fetchRules();
    } else {
      setRules([]);
    }
  }, [accountId]);

  async function fetchRules() {
    if (!accountId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rules?adAccountId=${accountId}`);
      if (response.ok) {
        const data = await response.json();
        setRules(data.rules || []);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || "Failed to fetch rules");
      }
    } catch (err) {
      console.error("Failed to fetch rules:", err);
      setError("Failed to fetch rules");
    } finally {
      setLoading(false);
    }
  }

  const selectRule = (rule: AdRule) => {
    onChange(rule.id, rule.name);
    setIsOpen(false);
  };

  const filteredRules = rules.filter((rule) => rule.name.toLowerCase().includes(search.toLowerCase()));

  const selectedRule = rules.find((r) => r.id === value);

  if (!accountId) {
    return (
      <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground bg-muted/50">
        Select an ad account first
      </div>
    );
  }

  return (
    <div className="relative">
      <Button variant="outline" className="w-full justify-between h-10 bg-white" onClick={() => setIsOpen(!isOpen)}>
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading rules...
          </span>
        ) : selectedRule ? (
          <span className="flex items-center gap-2 truncate">
            <span className="truncate">{selectedRule.name}</span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded shrink-0",
                selectedRule.status === "ENABLED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600",
              )}
            >
              {selectedRule.status}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {isOpen && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto">
            {error ? (
              <div className="py-4 text-center text-sm text-destructive">{error}</div>
            ) : filteredRules.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {rules.length === 0 ? "No rules found in this account" : "No matching rules"}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer",
                      value === rule.id && "bg-primary/5",
                    )}
                    onClick={() => selectRule(rule)}
                  >
                    <div className="w-4 shrink-0">
                      {value === rule.id && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{rule.name}</div>
                    </div>
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded shrink-0",
                        rule.status === "ENABLED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600",
                      )}
                    >
                      {rule.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-between items-center border-t pt-2">
            <span className="text-xs text-muted-foreground">
              {rules.length} rule{rules.length !== 1 ? "s" : ""} in account
            </span>
            <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
