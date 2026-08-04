import type { CSSProperties } from "react";

/**
 * Fixed-layout DataGrid columns must keep both width and minWidth.
 * Without minWidth, `table-fixed` + `w-full` proportionally shrinks columns
 * below their declared sizes and truncates sortable headers.
 */
export function getFixedColumnSizeStyle(sizePx: number): CSSProperties {
  return {
    width: `${sizePx}px`,
    minWidth: `${sizePx}px`,
  };
}
