"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { nextScrollOverflowState, type ScrollOverflowState } from "@/components/ui/command-scroll-overflow";
import { toCommandKeywords } from "@/components/ui/command-keywords";
import { cn } from "@/lib/utils";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Check, LucideIcon, Search } from "lucide-react";
import React from "react";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

type CommandDialogProps = DialogProps & { className?: string };

const CommandDialog = ({ children, className, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className={cn("overflow-hidden p-0 shadow-lg", className)}>
        <DialogTitle className="hidden" />
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center px-3 border-b border-border" cmdk-input-wrapper="" data-slot="command-input">
      <Search className="w-4 h-4 opacity-50 me-2 shrink-0" />
      <CommandPrimitive.Input
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-hidden text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function useScrollOverflow<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [overflow, setOverflow] = React.useState<ScrollOverflowState>({ top: false, bottom: false });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setOverflow((previous) => nextScrollOverflowState(previous, { scrollTop, scrollHeight, clientHeight }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    // childList only — subtree fires once per badge/tooltip mount inside each
    // row and was a major open-path cost for large command lists.
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(el, { childList: true, subtree: false });
    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return [ref, overflow] as const;
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  const [ref, overflow] = useScrollOverflow<HTMLDivElement>();
  return (
    <div className="relative">
      <CommandPrimitive.List
        ref={ref}
        data-slot="command-list"
        className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
        {...props}
      />
      <div
        aria-hidden
        data-visible={overflow.top || undefined}
        className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-popover to-transparent opacity-0 transition-opacity data-[visible=true]:opacity-100"
      />
      <div
        aria-hidden
        data-visible={overflow.bottom || undefined}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-popover to-transparent opacity-0 transition-opacity data-[visible=true]:opacity-100"
      />
    </div>
  );
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-sm text-center" {...props} />;
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1.5 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1.5 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandItem({ className, keywords, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      keywords={toCommandKeywords(keywords)}
      className={cn(
        "relative flex text-foreground cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
        "dark:hover:bg-accent",
      )}
      {...props}
    />
  );
}

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ms-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
};

interface ButtonArrowProps extends React.SVGProps<SVGSVGElement> {
  icon?: LucideIcon; // Allows passing any Lucide icon
}

function CommandCheck({ icon: Icon = Check, className, ...props }: ButtonArrowProps) {
  return (
    <Icon
      data-slot="command-check"
      data-check="true"
      className={cn("size-4 ms-auto text-primary", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandCheck,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
