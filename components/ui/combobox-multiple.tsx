"use client";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { substringCommandFilter } from "@/components/ui/combobox-multiple-filter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import React, { useState } from "react";

type ComboboxMultipleOption = { label: string; value: string };
type CommandFilterFn = NonNullable<React.ComponentProps<typeof Command>["filter"]>;

interface ComboboxMultipleProps {
  options: ComboboxMultipleOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxSelected?: number;
  className?: string;
  contentClassName?: string;
  contentAlign?: "start" | "center" | "end";
  searchPlaceholder?: string;
  /**
   * Notified as the user types in the search box. Provide this to drive a
   * server-side search; pair it with `shouldFilter={false}` so the already
   * server-filtered options aren't filtered again client-side.
   */
  onSearchValueChange?: (search: string) => void;
  /**
   * When false, the underlying cmdk list is not filtered client-side. Defaults
   * to true to preserve the existing client-side filtering behavior.
   */
  shouldFilter?: boolean;
  /**
   * Custom cmdk filter scoring each option against the search query. Defaults to
   * {@link substringCommandFilter} (predictable substring/word matching);
   * override to restore cmdk's fuzzy default or supply bespoke ranking. Ignored
   * when `shouldFilter` is false.
   */
  filter?: CommandFilterFn;
  /** Shows a "Searching..." row while an async option fetch is in flight. */
  isLoading?: boolean;
  renderOption?: (
    option: ComboboxMultipleOption,
    state: { isSelected: boolean; isDisabled: boolean },
  ) => React.ReactNode;
  renderSelectedValue?: (selectedOptions: ComboboxMultipleOption[], selectedValues: string[]) => React.ReactNode;
  getOptionKeywords?: (option: ComboboxMultipleOption) => string[];
  getOptionClassName?: (
    option: ComboboxMultipleOption,
    state: { isSelected: boolean; isDisabled: boolean },
  ) => string | undefined;
  groupClassName?: string;
  /**
   * Pin the currently-selected options to the top of the list so the user can
   * see/deselect them without scrolling a long list. Off by default to preserve
   * the stable ordering existing consumers rely on.
   */
  sortSelectedFirst?: boolean;
}

export default function ComboboxMultiple({
  options,
  value,
  onChange,
  placeholder = "Select items...",
  maxSelected,
  className,
  contentClassName,
  contentAlign = "center",
  searchPlaceholder,
  onSearchValueChange,
  shouldFilter = true,
  filter = substringCommandFilter,
  isLoading = false,
  renderOption,
  renderSelectedValue,
  getOptionKeywords,
  getOptionClassName,
  groupClassName,
  sortSelectedFirst = false,
}: ComboboxMultipleProps) {
  const [open, setOpen] = useState(false);

  const selectedOptions = React.useMemo(() => {
    const optionByValue = new Map(options.map((option) => [option.value, option]));
    return value.flatMap((selectedValue) => {
      const option = optionByValue.get(selectedValue);
      return option ? [option] : [];
    });
  }, [options, value]);

  // Optionally float selected options to the top (stable within each group).
  const displayOptions = React.useMemo(() => {
    if (!sortSelectedFirst || value.length === 0) return options;
    const selectedSet = new Set(value);
    const selected: typeof options = [];
    const rest: typeof options = [];
    for (const option of options) {
      (selectedSet.has(option.value) ? selected : rest).push(option);
    }
    return [...selected, ...rest];
  }, [options, value, sortSelectedFirst]);

  const handleSelect = (selectedValue: string) => {
    const isSelected = value.includes(selectedValue);

    if (isSelected) {
      // Remove from selection
      onChange(value.filter((v) => v !== selectedValue));
    } else {
      // Add to selection
      if (maxSelected && value.length >= maxSelected) {
        return; // Max limit reached
      }
      onChange([...value, selectedValue]);
    }
  };

  const getButtonContent = () => {
    if (value.length === 0) {
      return placeholder;
    }

    if (renderSelectedValue) {
      return renderSelectedValue(selectedOptions, value);
    }

    if (value.length === 1) {
      return selectedOptions[0]?.label || placeholder;
    }

    return `${value.length} selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", value.length === 0 && "text-muted-foreground", className)}
        >
          <span className={cn("min-w-0 flex-1 text-left", !renderSelectedValue && "truncate")}>
            {getButtonContent()}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={contentAlign} className={cn("w-(--radix-popover-trigger-width) p-0", contentClassName)}>
        <Command shouldFilter={shouldFilter} filter={filter}>
          <CommandInput
            placeholder={searchPlaceholder ?? `Search ${placeholder.toLowerCase()}...`}
            onValueChange={onSearchValueChange}
          />
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </div>
          ) : (
            <CommandEmpty>No option found.</CommandEmpty>
          )}
          <CommandGroup className={cn("max-h-64 overflow-auto", groupClassName)}>
            {displayOptions.map((option) => {
              const isSelected = value.includes(option.value);
              const isDisabled = Boolean(!isSelected && maxSelected && value.length >= maxSelected);
              const optionState = { isSelected, isDisabled };

              return (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={getOptionKeywords ? getOptionKeywords(option) : [option.label]}
                  onSelect={() => handleSelect(option.value)}
                  disabled={isDisabled}
                  className={cn(
                    getOptionClassName?.(option, optionState),
                    isDisabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    {renderOption ? renderOption(option, optionState) : option.label}
                  </span>
                  <Check className={cn("ml-2 h-3 w-3", isSelected ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
