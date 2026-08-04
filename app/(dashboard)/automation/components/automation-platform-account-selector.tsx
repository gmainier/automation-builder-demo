"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useUser } from "@/lib/providers/user-provider";
import type { CrossChannelPlatform } from "@/lib/automation/crossChannelTypes";

interface AdAccountOption {
  value: string;
  label: string;
  businessId: string;
  type: string | null;
  currency?: string | null;
}

interface AutomationPlatformAccountSelectorProps {
  platform: CrossChannelPlatform;
  value: string;
  onChange: (value: string, type: string | null, currency?: string | null, name?: string | null) => void;
  placeholder?: string;
}

const PLATFORM_TYPE_MAP: Record<CrossChannelPlatform, string[]> = {
  tiktok: ["tiktok"],
  snapchat: ["snapchat"],
  pinterest: ["pinterest"],
  axon: ["axon"],
};

const PLATFORM_LABELS: Record<CrossChannelPlatform, string> = {
  tiktok: "TikTok",
  snapchat: "Snapchat",
  pinterest: "Pinterest",
  axon: "AppLovin",
};

export function AutomationPlatformAccountSelector({
  platform,
  value,
  onChange,
  placeholder,
}: AutomationPlatformAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { extendedUser, isLoading: userLoading } = useUser();

  const platformLabel = PLATFORM_LABELS[platform];
  const defaultPlaceholder = placeholder || `Select ${platformLabel} ad account...`;
  const validTypes = PLATFORM_TYPE_MAP[platform];

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

        const platformType = setting.type || null;

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
          option.value && option.label && option.type != null && validTypes.includes(option.type),
      );
  }, [extendedUser, validTypes]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return adAccountOptions;
    const searchLower = searchTerm.toLowerCase();
    return adAccountOptions.filter(
      (option) => option.label.toLowerCase().includes(searchLower) || option.value.toLowerCase().includes(searchLower),
    );
  }, [adAccountOptions, searchTerm]);

  const selectedOption = adAccountOptions.find((opt) => opt.value === value);

  // Auto-select first account if none selected
  useEffect(() => {
    if (!value && adAccountOptions.length > 0) {
      const first = adAccountOptions[0];
      onChange(first.value, first.type, first.currency, first.label);
    }
  }, [value, adAccountOptions, onChange]);

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
        No {platformLabel} ad accounts connected. Please connect an account in Settings.
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-10">
          <span className="truncate">{selectedOption ? selectedOption.label : defaultPlaceholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 min-w-[300px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search accounts..." value={searchTerm} onValueChange={setSearchTerm} />
          <CommandEmpty>No {platformLabel} account found.</CommandEmpty>
          <CommandGroup>
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => {
                  onChange(option.value, option.type, option.currency, option.label);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                <div className="flex flex-col">
                  <span className="truncate">{option.label}</span>
                  <span className="text-xs text-muted-foreground truncate">{option.value}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
