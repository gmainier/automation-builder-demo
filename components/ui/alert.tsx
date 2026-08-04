"use client";
import { Slot } from "@radix-ui/react-slot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VariantProps, cva } from "class-variance-authority";
import { Info, XIcon } from "lucide-react";
import * as React from "react";
import { isReactElement } from "@/lib/utils/is-react-element";

const defaultRootClasses =
  "antialiased flex text-sm leading-6 bg-muted items-start relative w-full border px-4 py-3 [&>svg]:text-foreground";

export const alertVariants = cva(defaultRootClasses, {
  variants: {
    variant: {
      inline: "rounded-lg p-3 sm:items-center",
      expanded: "gap-1 rounded-lg border p-4 pl-14px",
    },
    color: {
      gray: "text-foreground",
      primary: "border-primary text-primary-foreground bg-primary ",
      info: "border-sky-100 bg-sky-50 text-sky-600 dark:bg-opacity-20 dark:bg-sky-800 dark:text-sky-50",
      success: "border-success bg-success text-success-foreground dark:bg-success/10 dark:border-success/20",
      error: "border-destructive bg-destructive/5 text-destructive",
      warning: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-100",
    },
  },
  defaultVariants: {
    variant: "inline",
    color: "gray",
  },
});

export const alertTitleVariants = cva("text-start font-medium", {
  variants: {
    color: {
      gray: "text-foreground",
      primary: "text-primary-foreground",
      info: "text-sky-800",
      success: "text-success-foreground",
      error: "text-destructive",
      warning: "text-yellow-800 ",
    },
  },
  defaultVariants: {
    color: "gray",
  },
});

export const alertIconVariants = cva("stroke-current mb-auto mt-1", {
  variants: {
    color: {
      gray: "stroke-foreground",
      primary: "stroke-primary",
      info: "stroke-sky-600 dark:stroke-sky-50",
      success: "stroke-success-foreground",
      error: "stroke-destructive",
      warning: "stroke-amber-700 dark:stroke-amber-100",
    },
  },
  defaultVariants: {
    color: "gray",
  },
});

/* ---------------------------------- Types --------------------------------- */
type ClosableProps = {
  /**
   * Is the alert closable? If true, a close icon will be displayed.
   * @default true
   */
  closable: true;

  /**
   * An optional callback function to be called when the close icon is clicked.
   * This can be used to handle the removal of the tag.
   * If provided, the close icon will be displayed.
   */
  onClose?: React.MouseEventHandler<HTMLButtonElement>;
};

type NotClosableProps = {
  /**
   * Is the alert closable? If true, a close button will be displayed and
   * when clicked on it will hide the alert element
   * @default true
   */
  closable?: false;

  /**
   * An optional callback function to be called when the close button is clicked.
   * Requires the `closable` prop to be set to `true`.
   */
  onClose?: never;
};

export type AlertProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> &
  VariantProps<typeof alertVariants> & {
    /**
     * The slot to be rendered before the description.
     * This can be used to render an icon
     * or any other element before the description. Also accepts a string,
     * number, or any valid React element.
     * If the `before` prop is omitted, the default icon will be displayed.
     *
     * @example
     * // Display an alert with icon
     * <Alert before={<SuccessIcon />} />
     */
    before?: React.ReactNode;

    /**
     * The slot to be rendered after the description.
     * This can be a string, number or any valid React element.
     * If omitted, it will not be displayed.
     *
     * @example
     * // Display an alert with button
     * <Alert after={<Button size='sm'>Save</Button>} />
     */
    after?: React.ReactNode;

    /**
     * The title to display within the Alert component.
     * This can be a string, number or any valid React element.
     * If omitted, no title will be displayed.
     * If a string is provided, it will be wrapped in an <AlertTitle /> component.
     * If a React element is provided, it will be rendered as-is.
     */
    title?: React.ReactNode;
  } & (ClosableProps | NotClosableProps);

/* ------------------------------- Components ------------------------------- */

/**
 * The Alert component is used to display important messages to the user.
 * @example
 * // Display an inline alert
 * <Alert variant='inline' color='info' title='Info'>
 *  This is an inline alert
 * </Alert>
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ after, before, className, closable, color, variant = "inline", children, title, onClose, ...otherProps }, ref) => {
    const [visible, setVisible] = React.useState(true);

    /**
     * Handle the close event.
     * @param event - The event object
     */
    const handleClose = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        // Do not close if the event is prevented by the onClose callback
        if (!event.defaultPrevented) {
          setVisible(false);
        }

        if (onClose) {
          onClose(event);
        }
      },
      [onClose],
    );

    if (!visible) {
      return null;
    }

    return (
      <AlertRoot ref={ref} className={cn(alertVariants({ variant, color, className }))} {...otherProps}>
        <AlertBefore color={color}>{before}</AlertBefore>

        <div
          className={cn(
            "flex grow flex-col",
            variant === "expanded" && "items-stretch gap-3 px-2",
            variant === "inline" && "items-start px-2 sm:flex-row sm:items-center sm:gap-2",
            variant === "inline" && closable && "pr-8",
          )}
        >
          <div
            className={cn(
              "flex grow flex-col",
              variant === "expanded" && "min-w-0 w-full items-stretch",
              variant === "inline" && "items-start sm:flex-row sm:items-center sm:gap-2",
            )}
          >
            {title && <AlertTitle color={color}>{title}</AlertTitle>}
            {children && <AlertDescription>{children}</AlertDescription>}
          </div>

          {after && (
            <div className={cn(variant === "inline" && "mt-3 sm:ml-auto sm:mt-0")}>
              <AlertAfter>{after}</AlertAfter>
            </div>
          )}
        </div>

        {closable && <AlertCloseButton onClick={handleClose} />}
      </AlertRoot>
    );
  },
);

/* Root */
const AlertRoot = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...otherProps }, ref) => {
    return (
      <div ref={ref} className={cn(className)} role="alert" {...otherProps}>
        {children}
      </div>
    );
  },
);

/* Before */
const AlertBefore = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & VariantProps<typeof alertIconVariants>
>(({ className, color, children, ...props }, ref) => {
  const Component = isReactElement(children) ? Slot : "span";

  if (!children) {
    return <Info size={16} className={cn(alertIconVariants({ color, className }), "shrink-0")} />;
  }

  return (
    <Component ref={ref} className={cn(alertIconVariants({ color, className }))} {...props}>
      {children}
    </Component>
  );
});

/* After */
const AlertAfter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => {
    const Component = isReactElement(children) ? Slot : "span";

    return (
      <Component ref={ref} className={className} {...props}>
        {children}
      </Component>
    );
  },
);

/* Title */
const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & VariantProps<typeof alertTitleVariants>
>(({ className, color, children, ...props }, ref) => {
  const Component = isReactElement(children) ? Slot : "p";

  return (
    <Component ref={ref} className={cn(alertTitleVariants({ color } as any), className)} {...props}>
      {children}
    </Component>
  );
});

/* Description */
const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const Component = isReactElement(children) ? Slot : "div";

    return (
      <Component ref={ref} className={cn("text-start", className)} {...props}>
        {children}
      </Component>
    );
  },
);

/* CloseButton */
const AlertCloseButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ children, ...otherProps }, ref) => {
  const renderCloseIcon = (children: React.ReactNode) => {
    return isReactElement(children) ? children : <XIcon size={16} aria-label="Close" />;
  };

  return (
    <Button ref={ref} className="absolute top-1 right-1" size="icon" variant="ghost" {...otherProps}>
      {renderCloseIcon(children)}
    </Button>
  );
});

Alert.displayName = "Alert";
AlertRoot.displayName = "AlertRoot";
AlertAfter.displayName = "AlertAfter";
AlertBefore.displayName = "AlertBefore";
AlertCloseButton.displayName = "AlertCloseButton";
AlertDescription.displayName = "AlertDescription";
AlertTitle.displayName = "AlertTitle";

export { Alert, AlertDescription, AlertTitle, AlertRoot, AlertBefore, AlertAfter, AlertCloseButton };
export default Alert;
