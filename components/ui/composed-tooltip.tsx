"use client";

import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { Badge } from "./badge";
import { Button, ButtonProps, buttonVariants } from "./button";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={150}>{children}</TooltipPrimitive.Provider>;
}

export interface TooltipProps extends Omit<TooltipPrimitive.TooltipContentProps, "content"> {
  content: ReactNode | string | ((props: { setOpen: (open: boolean) => void }) => ReactNode);
  contentClassName?: string;
  disableHoverableContent?: TooltipPrimitive.TooltipProps["disableHoverableContent"];
  delayDuration?: TooltipPrimitive.TooltipProps["delayDuration"];
}

export function ComposedTooltip({
  children,
  content,
  contentClassName,
  side = "top",
  disableHoverableContent,
  delayDuration = 0,
  ...rest
}: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipPrimitive.Root
      open={open}
      onOpenChange={setOpen}
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
    >
      <TooltipPrimitive.Trigger
        asChild
        onClick={() => {
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
        }}
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={8}
          side={side}
          className="animate-slide-up-fade pointer-events-auto z-[400] items-center overflow-hidden rounded-xl border bg-popover shadow-xs"
          collisionPadding={0}
          {...rest}
        >
          {typeof content === "string" ? (
            <span
              className={cn(
                "block max-w-xs text-pretty px-4 py-2 text-center text-sm text-popover-foreground",
                contentClassName,
              )}
            >
              {content}
            </span>
          ) : typeof content === "function" ? (
            content({ setOpen })
          ) : (
            content
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function TooltipContent({
  title,
  cta,
  href,
  target,
  onClick,
}: {
  title: ReactNode;
  cta?: string;
  href?: string;
  target?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex max-w-xs flex-col items-center space-y-3 p-4 text-center">
      <p className="text-sm text-popover-foreground">{title}</p>
      {cta &&
        (href ? (
          <Link
            href={href}
            {...(target ? { target } : {})}
            className={cn(
              buttonVariants({ variant: "default" }),
              "flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg border px-4 text-sm",
            )}
          >
            {cta}
          </Link>
        ) : onClick ? (
          <Button onClick={onClick} variant="default" className="h-9">
            {cta}
          </Button>
        ) : null)}
    </div>
  );
}

export function SimpleTooltipContent({ title, cta, href }: { title: string; cta: string; href: string }) {
  return (
    <div className="max-w-xs px-4 py-2 text-center text-sm text-popover-foreground">
      {title}{" "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex text-muted-foreground underline underline-offset-4 hover:text-popover-foreground"
      >
        {cta}
      </a>
    </div>
  );
}

export function InfoTooltip(props: Omit<TooltipProps, "children">) {
  return (
    <ComposedTooltip {...props}>
      <HelpCircle className="h-4 w-4 text-muted-foreground" />
    </ComposedTooltip>
  );
}

export function BadgeTooltip({ children, content, ...props }: TooltipProps) {
  return (
    <ComposedTooltip content={content} {...props}>
      <div className="flex cursor-pointer items-center">
        <Badge variant="gray" className="transition-all hover:bg-muted">
          {children}
        </Badge>
      </div>
    </ComposedTooltip>
  );
}

export function ButtonTooltip({
  children,
  tooltipProps,
  ...props
}: {
  children: ReactNode;
  tooltipProps: TooltipProps;
} & ButtonProps) {
  return (
    <ComposedTooltip {...tooltipProps}>
      <button
        type="button"
        {...props}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-75 hover:bg-muted/80 active:bg-muted disabled:cursor-not-allowed disabled:hover:bg-transparent",
          props.className,
        )}
      >
        {children}
      </button>
    </ComposedTooltip>
  );
}
