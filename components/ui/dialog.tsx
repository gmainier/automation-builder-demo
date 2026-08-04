"use client";

import { cn } from "@/lib/utils";
import { scheduleReleaseStuckModalPointerEvents } from "@/lib/dom/release-stuck-modal-pointer-events";
import { useReleaseStuckModalPointerEventsOnUnmount } from "@/lib/hooks/use-release-stuck-modal-pointer-events";
import { cva, VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

const dialogContentVariants = cva(
  "flex flex-col fixed outline-0 z-[300] border border-border bg-background p-6 shadow-lg shadow-black/5 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
  {
    variants: {
      variant: {
        default: "left-[50%] top-[50%] max-w-lg translate-x-[-50%] translate-y-[-50%] w-full",
        fullscreen: "inset-5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function isInteractivePortalTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest("[data-sonner-toast]") ||
      target.closest("[data-launch-progress-popup]") ||
      target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-radix-portal]") ||
      target.closest('[role="alertdialog"]') ||
      target.closest('[data-slot="alert-dialog-overlay"]') ||
      target.closest("[data-portal-dropdown]") ||
      target.closest("[data-ai-clone-overlay]") ||
      target.closest('[role="menu"]') ||
      target.closest('[role="listbox"]'),
  );
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[300] bg-black/30 [backdrop-filter:blur(4px)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlay = true,
  overlayClassName,
  variant,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants> & {
    showCloseButton?: boolean;
    overlay?: boolean;
    overlayClassName?: string;
  }) {
  // Radix can leave the underlying dialog's `pointer-events: none` lock stuck
  // when a dialog closes on top of another dialog, freezing it. Heal it on
  // close and on a close-while-mounted unmount.
  // https://github.com/radix-ui/primitives/issues/1241
  useReleaseStuckModalPointerEventsOnUnmount();
  return (
    <DialogPortal>
      {overlay && <DialogOverlay className={overlayClassName} />}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onPointerDownOutside={(e) => {
          if (isInteractivePortalTarget(e.target)) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (isInteractivePortalTarget(e.target)) {
            e.preventDefault();
          }
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          scheduleReleaseStuckModalPointerEvents();
        }}
        className={cn(dialogContentVariants({ variant }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogClose className="cursor-pointer outline-0 absolute end-5 top-5 z-50 rounded-sm bg-muted border border-border text-foreground shadow-sm p-1.5 opacity-90 ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted/80 focus:outline-hidden disabled:pointer-events-none">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export default DialogContent;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn("flex flex-col space-y-1 text-center sm:text-start mb-5", className)}
    {...props}
  />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end pt-5 sm:space-x-2.5", className)}
    {...props}
  />
);

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="dialog-body" className={cn("grow", className)} {...props} />
);

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
