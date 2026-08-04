"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { useUser } from "@/lib/providers/user-provider";
import Meta from "@/components/ui/icons/meta";

interface AdAccountOption {
  value: string;
  label: string;
  businessId: string;
  type: string | null;
  currency?: string | null;
}

export interface SelectedAccount {
  id: string;
  type: string | null;
  currency?: string | null;
  name?: string;
}

interface AutomationMultiAdAccountSelectorProps {
  values: string[];
  onChange: (values: string[], accounts: SelectedAccount[]) => void;
  placeholder?: string;
}

export function AutomationMultiAdAccountSelector({
  values,
  onChange,
  placeholder = "Select ad accounts...",
}: AutomationMultiAdAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { extendedUser, isLoading: userLoading } = useUser();

  const adAccountOptions = useMemo<AdAccountOption[]>(() => {
    if (!extendedUser?.settings || !extendedUser?.defaultWorkspaceId) {
      return [];
    }

    const relevantSettings = extendedUser.settings.filter(
      (setting: any) => setting.workspaceId === extendedUser.defaultWorkspaceId,
    );

    const currentWorkspace = extendedUser?.workspaces?.find((ws: any) => ws.id === extendedUser.defaultWorkspaceId);

    return relevantSettings
      .map((setting: any) => {
        let matchingAdAccount = null;
        if (currentWorkspace?.adAccounts) {
          const cleanBusinessId = setting.businessId?.startsWith("act_")
            ? setting.businessId.replace("act_", "")
            : setting.businessId;

          matchingAdAccount = currentWorkspace.adAccounts.find(
            (acc: any) => acc.accountId === cleanBusinessId || acc.accountId === setting.businessId,
          );
        }

        const displayName =
          matchingAdAccount?.accountName ||
          setting.businessName ||
          matchingAdAccount?.businessName ||
          setting.businessId ||
          "";

        let platformType = setting.type || (setting.tikId ? "tiktok" : null);
        if (!platformType && setting.businessId) {
          platformType = setting.businessId.startsWith("act_") ? "facebook" : "tiktok";
        }

        return {
          value: setting.businessId || "",
          label: displayName,
          businessId: setting.businessId || "",
          type: platformType,
          currency: matchingAdAccount?.currency || null,
        };
      })
      .filter(
        (option: AdAccountOption) =>
          option.value && option.label && (option.type === "facebook" || option.type === "meta"),
      );
  }, [extendedUser]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return adAccountOptions;
    const searchLower = searchTerm.toLowerCase();
    return adAccountOptions.filter(
      (option) => option.label.toLowerCase().includes(searchLower) || option.value.toLowerCase().includes(searchLower),
    );
  }, [adAccountOptions, searchTerm]);

  const toggleAccount = useCallback(
    (accountValue: string) => {
      const option = adAccountOptions.find((o) => o.value === accountValue);
      if (!option) return;

      let newValues: string[];
      if (values.includes(accountValue)) {
        newValues = values.filter((v) => v !== accountValue);
      } else {
        newValues = [...values, accountValue];
      }

      const newAccounts: SelectedAccount[] = newValues.map((v) => {
        const opt = adAccountOptions.find((o) => o.value === v);
        return { id: v, type: opt?.type || null, currency: opt?.currency, name: opt?.label };
      });

      onChange(newValues, newAccounts);
    },
    [values, adAccountOptions, onChange],
  );

  const toggleAll = useCallback(() => {
    if (values.length === adAccountOptions.length) {
      onChange([], []);
    } else {
      const allValues = adAccountOptions.map((o) => o.value);
      const allAccounts: SelectedAccount[] = adAccountOptions.map((o) => ({
        id: o.value,
        type: o.type,
        currency: o.currency,
      }));
      onChange(allValues, allAccounts);
    }
  }, [values, adAccountOptions, onChange]);

  const getDisplayText = () => {
    if (values.length === 0) return placeholder;
    if (values.length === 1) {
      const opt = adAccountOptions.find((o) => o.value === values[0]);
      return opt?.label || values[0];
    }
    if (values.length === adAccountOptions.length) {
      return `All accounts (${values.length})`;
    }
    return `${values.length} accounts selected`;
  };

  if (userLoading) {
    return (
      <Button variant="outline" className="w-full justify-between h-10" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2">Loading accounts...</span>
      </Button>
    );
  }

  if (adAccountOptions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">
        No Meta ad accounts connected. Please connect an account in Settings.
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-10">
          <div className="flex items-center gap-2 truncate">
            {values.length === 1 &&
              (() => {
                const opt = adAccountOptions.find((o) => o.value === values[0]);
                return opt?.type === "tiktok" ? (
                  <FaTiktok className="shrink-0 w-3 h-3 text-gray-600" />
                ) : (
                  <Meta className="shrink-0 w-3 h-3" grayscale={false} />
                );
              })()}
            {values.length > 1 && (
              <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium h-5 min-w-[20px] px-1.5">
                {values.length}
              </span>
            )}
            <span className="truncate">{getDisplayText()}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 min-w-[300px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search accounts..." value={searchTerm} onValueChange={setSearchTerm} />
          <CommandEmpty>No account found.</CommandEmpty>
          <CommandGroup>
            {/* Select All / Deselect All */}
            <CommandItem key="__toggle_all__" value="__toggle_all__" onSelect={toggleAll} className="cursor-pointer">
              <Check
                className={cn("mr-2 h-4 w-4", values.length === adAccountOptions.length ? "opacity-100" : "opacity-0")}
              />
              <span className="text-muted-foreground font-medium">
                {values.length === adAccountOptions.length ? "Deselect All" : "Select All"}
              </span>
            </CommandItem>

            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => toggleAccount(option.value)}
                className="cursor-pointer"
              >
                <Check className={cn("mr-2 h-4 w-4", values.includes(option.value) ? "opacity-100" : "opacity-0")} />
                <div className="flex items-center gap-2">
                  {option.type === "tiktok" ? (
                    <FaTiktok className="w-3 h-3 text-gray-600" />
                  ) : (
                    <Meta className="w-3 h-3" grayscale={false} />
                  )}
                  <div className="flex flex-col">
                    <span className="truncate">{option.label}</span>
                    <span className="text-xs text-muted-foreground truncate">{option.value}</span>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
