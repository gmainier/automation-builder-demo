"use client";

import { useState, useMemo, useEffect } from "react";
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

interface AutomationAdAccountSelectorProps {
  value: string;
  onChange: (value: string, type: string | null, currency?: string | null, label?: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
}

const ALL_ACCOUNTS_VALUE = "__all_accounts__";

export function AutomationAdAccountSelector({
  value,
  onChange,
  placeholder = "Select ad account...",
  allowEmpty = false,
  disabled = false,
}: AutomationAdAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Get user data from UserProvider
  const { extendedUser, isLoading: userLoading } = useUser();

  // Build options from extendedUser.settings filtered by defaultWorkspaceId
  const adAccountOptions = useMemo<AdAccountOption[]>(() => {
    if (!extendedUser?.settings || !extendedUser?.defaultWorkspaceId) {
      return [];
    }

    // Filter settings by current workspace
    const relevantSettings = extendedUser.settings.filter(
      (setting: any) => setting.workspaceId === extendedUser.defaultWorkspaceId,
    );

    // Find current workspace for enrichment
    const currentWorkspace = extendedUser?.workspaces?.find((ws: any) => ws.id === extendedUser.defaultWorkspaceId);

    return (
      relevantSettings
        .map((setting: any) => {
          // Try to find matching adAccount for better name
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

          // Determine platform type - some older TikTok accounts have type=null but tikId set
          // Also detect TikTok by ID format (Facebook IDs have 'act_' prefix, TikTok IDs don't)
          let platformType = setting.type || (setting.tikId ? "tiktok" : null);

          // If type is still null, check ID format to detect platform
          // Facebook account IDs have 'act_' prefix, TikTok IDs are pure numbers
          if (!platformType && setting.businessId) {
            const hasActPrefix = setting.businessId.startsWith("act_");
            platformType = hasActPrefix ? "facebook" : "tiktok";
          }

          return {
            value: setting.businessId || "",
            label: displayName,
            businessId: setting.businessId || "",
            type: platformType,
            currency: matchingAdAccount?.currency || null,
          };
        })
        // Only show Meta (Facebook) accounts for automations - filter out non-Meta accounts
        .filter(
          (option: AdAccountOption) =>
            option.value && option.label && (option.type === "facebook" || option.type === "meta"),
        )
    );
  }, [extendedUser]);

  // Filtered options based on search
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return adAccountOptions;
    const searchLower = searchTerm.toLowerCase();
    return adAccountOptions.filter(
      (option) => option.label.toLowerCase().includes(searchLower) || option.value.toLowerCase().includes(searchLower),
    );
  }, [adAccountOptions, searchTerm]);

  // Get currently selected option
  const selectedOption = adAccountOptions.find((opt) => opt.value === value);

  // Auto-select user's default account, or first account if none selected
  // Skip auto-select when allowEmpty is true
  useEffect(() => {
    if (!value && adAccountOptions.length > 0 && !allowEmpty && !disabled) {
      // Try to find user's default account first
      const defaultAccountId = extendedUser?.defaultAccountId;
      let accountToSelect = adAccountOptions[0];

      if (defaultAccountId) {
        const defaultAccount = adAccountOptions.find(
          (opt) => opt.value === defaultAccountId || opt.businessId === defaultAccountId,
        );
        if (defaultAccount) {
          accountToSelect = defaultAccount;
        }
      }

      onChange(accountToSelect.value, accountToSelect.type, accountToSelect.currency, accountToSelect.label);
    }
  }, [value, adAccountOptions, extendedUser?.defaultAccountId, onChange, allowEmpty, disabled]);

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
    <Popover open={open} onOpenChange={(nextOpen) => setOpen(disabled ? false : nextOpen)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-10"
        >
          <div className="flex items-center gap-2 truncate">
            {selectedOption &&
              (selectedOption.type === "tiktok" ? (
                <FaTiktok className="shrink-0 w-3 h-3 text-gray-600" />
              ) : (
                <Meta className="shrink-0 w-3 h-3" grayscale={false} />
              ))}
            <span className="truncate">
              {selectedOption
                ? selectedOption.label
                : allowEmpty && !value
                  ? "All Meta accounts (no filter)"
                  : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 min-w-[300px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search accounts..." value={searchTerm} onValueChange={setSearchTerm} />
          <CommandEmpty>No account found.</CommandEmpty>
          <CommandGroup>
            {allowEmpty && (
              <CommandItem
                key="__all_accounts__"
                value={ALL_ACCOUNTS_VALUE}
                onSelect={() => {
                  onChange("", null, null, "");
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">All Meta accounts (no filter)</span>
                </div>
              </CommandItem>
            )}
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
