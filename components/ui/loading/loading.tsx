import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Line } from "./line";
import { Spinner } from "./spinner";
import { Dots } from "./dots";

/* ---------------------------------- Types --------------------------------- */
export type LoadingElement = HTMLDivElement;
export type LoadingProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof loadingVariants>;

/* -------------------------------- Variants -------------------------------- */
export const loadingVariants = cva("relative inline-flex items-center justify-center border-0", {
  variants: {
    color: {
      primary: "stroke-border text-primary",
      secondary: "stroke-border text-secondary",
    },
    size: {
      xxs: "size-4",
      xs: "size-6",
      sm: "size-8",
      md: "size-12 [--wg-loading-stroke-width:6px]",
      lg: "size-14",
      xl: "size-16",
      xxl: "size-[88px]",
    },
    type: {
      line: "",
      spinner: "-rotate-45",
      dots: "",
    },
  },
  defaultVariants: {
    color: "primary",
    size: "md",
    type: "line",
  },
});

/* ------------------------------- Components ------------------------------- */
const Loading = React.forwardRef<LoadingElement, LoadingProps>((props, ref) => {
  const {
    "aria-label": ariaLabel = "Loading",
    className,
    color = "primary",
    size = "md",
    type = "spinner",
    ...otherProps
  } = props;

  let element = null;

  switch (type) {
    case "line":
      element = <Line className="animate-spin size-full will-change-transform" size={size} />;
      break;

    case "spinner":
      element = (
        <Spinner className="size-full animate-[spin_.6s_ease-in-out_infinite] will-change-transform" size={size} />
      );
      break;

    case "dots":
      element = <Dots className="size-full animate-[spin_1.25s_linear_infinite] will-change-transform" size={size} />;
      break;
  }

  return (
    <div
      ref={ref}
      aria-label={ariaLabel}
      className={cn(loadingVariants({ color, size, type }), className)}
      {...otherProps}
    >
      {element}
    </div>
  );
});

Loading.displayName = "Loading";
export default Loading;
