"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";

interface UseHorizontalResizeOptions {
  readonly initialWidthPx: number;
  readonly minWidthPx: number;
  readonly maxWidthPx: number;
  /** Panel sits on the right; dragging the left edge leftward grows width. */
  readonly growOnDragLeft?: boolean;
}

/**
 * Pointer-driven horizontal resize for a right-docked panel shell.
 */
export function useHorizontalResize({
  initialWidthPx,
  minWidthPx,
  maxWidthPx,
  growOnDragLeft = true,
}: UseHorizontalResizeOptions): {
  readonly widthPx: number;
  readonly setWidthPx: (nextWidth: number) => void;
  readonly handleResizeStart: (event: ReactMouseEvent | ReactTouchEvent) => void;
} {
  const [widthPx, setWidthPx] = useState(initialWidthPx);
  const resizeRef = useRef<{ active: boolean; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent | ReactTouchEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
      resizeRef.current = { active: true, startX: clientX, startWidth: widthPx };
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [widthPx],
  );

  useEffect(() => {
    const onMove = (event: MouseEvent | TouchEvent): void => {
      const activeResize = resizeRef.current;
      if (!activeResize?.active) return;
      event.preventDefault();
      const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
      const delta = clientX - activeResize.startX;
      const signedDelta = growOnDragLeft ? -delta : delta;
      const nextWidth = Math.min(maxWidthPx, Math.max(minWidthPx, activeResize.startWidth + signedDelta));
      setWidthPx(nextWidth);
    };

    const onUp = (): void => {
      if (!resizeRef.current?.active) return;
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [growOnDragLeft, maxWidthPx, minWidthPx]);

  useEffect(() => {
    setWidthPx((currentWidth) => Math.min(maxWidthPx, Math.max(minWidthPx, currentWidth)));
  }, [maxWidthPx, minWidthPx]);

  return { widthPx, setWidthPx, handleResizeStart };
}
