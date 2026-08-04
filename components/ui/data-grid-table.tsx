import { Checkbox } from "@/components/ui/checkbox";
import { useDataGrid } from "@/components/ui/data-grid";
import { getFixedColumnSizeStyle } from "@/components/ui/data-grid-fixed-column-size";
import { cn } from "@/lib/utils";
import { Cell, Column, Header, HeaderGroup, Row, Table, flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cva } from "class-variance-authority";
import * as React from "react";
import { CSSProperties, Fragment, ReactNode, useCallback } from "react";

/** Initial per-row height guess for virtualization; real heights are measured once rendered. */
const VIRTUAL_ROW_ESTIMATE_PX = 52;

/**
 * Handles shift-select functionality for data grid rows
 * Uses row IDs to track selections across pagination
 */
function handleShiftSelect<TData>({
  currentRow,
  isShiftPressed,
  lastSelectedRowId,
  table,
  setLastSelectedRowId,
}: {
  currentRow: Row<TData>;
  isShiftPressed: boolean;
  lastSelectedRowId: string | null;
  table: Table<TData>;
  setLastSelectedRowId: (rowId: string | null) => void;
}) {
  // Always update the last selected row
  const currentRowId = currentRow.id;

  if (!isShiftPressed || !lastSelectedRowId) {
    // No shift key or no previous selection - just update anchor
    setLastSelectedRowId(currentRowId);
    return;
  }

  // Find both rows in the current page's row model
  const rows = table.getRowModel().rows;
  const lastRowIndex = rows.findIndex((r) => r.id === lastSelectedRowId);
  const currentRowIndex = rows.findIndex((r) => r.id === currentRowId);

  // If either row is not found in current page, just update anchor
  if (lastRowIndex === -1 || currentRowIndex === -1) {
    setLastSelectedRowId(currentRowId);
    return;
  }

  // Determine the range
  const start = Math.min(lastRowIndex, currentRowIndex);
  const end = Math.max(lastRowIndex, currentRowIndex);

  // Get the target state - toggle to match current row's NEW state
  const targetState = !currentRow.getIsSelected();

  // Select/deselect all rows in the range
  for (let i = start; i <= end; i++) {
    rows[i].toggleSelected(targetState);
  }
}

const headerCellSpacingVariants = cva("", {
  variants: {
    size: {
      dense: "px-2.5 h-8",
      default: "px-4",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const bodyCellSpacingVariants = cva("", {
  variants: {
    size: {
      dense: "px-2.5 py-1.5",
      default: "px-4 py-1.5",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

function getPinningStyles<TData>(column: Column<TData>, isHeader: boolean = false): CSSProperties {
  const isPinned = column.getIsPinned();

  const columnSize = column.getSize();
  const styles: CSSProperties = {
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    position: isPinned ? "sticky" : "relative",
    ...getFixedColumnSizeStyle(columnSize),
  };

  // Z-index hierarchy: Pinned headers (100) > Unpinned headers (50) > Pinned body (10) > Scrollable body (1)
  // Pinned headers MUST have higher z-index AND top: 0 to stick above pinned body cells
  if (isHeader) {
    styles.zIndex = isPinned ? 100 : 50;
    if (isPinned) {
      // Headers stick to top: 0 so they stay at the top when scrolling vertically
      // This prevents body cells (which don't have top) from overlapping them
      styles.top = 0;
    }
  } else {
    // Body cells: lower z-index and NO top value, so they only stick horizontally
    styles.zIndex = isPinned ? 10 : 1;
  }

  if (isPinned === "right") {
    styles.boxShadow = "-2px 0 4px rgba(0,0,0,0.1)";
  }

  // Right-edge elevation so scrollable columns read as passing behind the pinned block (Meta Ads Manager style).
  if (isPinned === "left" && column.getIsLastColumn("left")) {
    styles.boxShadow = "4px 0 8px -2px rgba(0,0,0,0.1)";
  }

  return styles;
}

function DataGridTableBase({ children }: { children: ReactNode }) {
  const { props, table } = useDataGrid();
  const isFixedWidth = props.tableLayout?.width === "fixed";

  return (
    <table
      data-slot="data-grid-table"
      style={isFixedWidth ? { minWidth: `${table.getTotalSize()}px` } : undefined}
      className={cn(
        "w-full align-middle caption-bottom text-left rtl:text-right text-foreground font-normal text-sm",
        !props.tableLayout?.columnsDraggable && "border-separate border-spacing-0",
        isFixedWidth ? "table-fixed" : "table-auto",
        props.tableClassNames?.base,
      )}
    >
      {children}
    </table>
  );
}

function DataGridTableHead({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();

  return (
    <thead
      className={cn(
        props.tableClassNames?.header,
        props.tableLayout?.headerSticky && props.tableClassNames?.headerSticky,
      )}
      style={props.tableLayout?.columnsPinnable ? { zIndex: 102 } : undefined}
    >
      {children}
    </thead>
  );
}

function DataGridTableHeadRow<TData>({
  children,
  headerGroup,
}: {
  children: ReactNode;
  headerGroup: HeaderGroup<TData>;
}) {
  const { props } = useDataGrid();

  return (
    <tr
      key={headerGroup.id}
      className={cn(
        "bg-muted/40",
        props.tableLayout?.cellBorder && "[&_>:last-child]:border-e-0",
        props.tableLayout?.stripped && "bg-transparent",
        props.tableLayout?.headerBackground === false && "bg-transparent",
        props.tableClassNames?.headerRow,
      )}
    >
      {children}
    </tr>
  );
}

function DataGridTableHeadRowCell<TData>({
  children,
  header,
  dndRef,
  dndStyle,
}: {
  children: ReactNode;
  header: Header<TData, unknown>;
  dndRef?: React.Ref<HTMLTableCellElement>;
  dndStyle?: CSSProperties;
}) {
  const { props } = useDataGrid();

  const { column } = header;
  const isPinned = column.getIsPinned();
  const isLastLeftPinned = isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned = isPinned === "right" && column.getIsFirstColumn("right");
  const headerCellSpacing = headerCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });
  const hideEndBorder = Boolean(header.column.columnDef.meta?.hideEndCellBorder);
  const pinnedEdgeOnly = props.tableLayout?.cellBorderMode === "pinned-edge-only";
  const showEndVerticalBorder =
    props.tableLayout?.cellBorder &&
    (pinnedEdgeOnly ? Boolean(header.column.columnDef.meta?.pinnedSectionEdge) : !hideEndBorder);

  return (
    <th
      key={header.id}
      ref={dndRef}
      data-pinned-section-edge={header.column.columnDef.meta?.pinnedSectionEdge ? "" : undefined}
      style={{
        ...(props.tableLayout?.width === "fixed" && getFixedColumnSizeStyle(header.getSize())),
        ...(props.tableLayout?.columnsPinnable && column.getCanPin() && getPinningStyles(column, true)),
        ...(dndStyle ? dndStyle : null),
      }}
      data-column-id={column.id}
      data-pinned={isPinned || undefined}
      data-last-col={isLastLeftPinned ? "left" : isFirstRightPinned ? "right" : undefined}
      className={cn(
        "h-10 text-left rtl:text-right align-middle font-semibold text-secondary-foreground/80 [&:has([role=checkbox])]:pe-0",
        headerCellSpacing,
        showEndVerticalBorder && "border-e",
        // Vertical rule above the z-10 header content (inset box-shadow/border-e sit below it and only peek through on hover).
        showEndVerticalBorder &&
          "relative after:pointer-events-none after:absolute after:end-0 after:top-0 after:z-[15] after:h-full after:w-px after:content-[''] after:bg-[#D8DADF]",
        showEndVerticalBorder && !pinnedEdgeOnly && "last:after:hidden",
        props.tableLayout?.cellBorder && pinnedEdgeOnly && "last:[&:not([data-pinned-section-edge])]:after:hidden",
        props.tableLayout?.headerBorder && "border-b border-border",
        props.tableLayout?.columnsResizable && "relative",
        props.tableLayout?.columnsResizable && !column.getCanResize() && "truncate",
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          "[&:not([data-pinned]):has(+[data-pinned])_div.cursor-col-resize:last-child]:opacity-0 [&[data-last-col=left]_div.cursor-col-resize:last-child]:opacity-0 [&[data-pinned=left][data-last-col=left]]:border-e! [&[data-pinned=right]:last-child_div.cursor-col-resize:last-child]:opacity-0 [&[data-pinned=right][data-last-col=right]]:border-s! [&[data-pinned][data-last-col]]:border-border",
        // Add solid background for pinned columns
        isPinned && "bg-muted",
        header.column.columnDef.meta?.headerClassName,
        column.getIndex() === 0 || column.getIndex() === header.headerGroup.headers.length - 1
          ? props.tableClassNames?.edgeCell
          : "",
      )}
    >
      {props.tableLayout?.columnsPinnable ? (
        <>
          <div
            className={cn("absolute inset-0 flex items-center px-4 -z-10", isPinned ? "bg-muted" : "bg-muted/50")}
          ></div>
          <div className="relative z-10">{children}</div>
        </>
      ) : (
        children
      )}
      {/* Keep resize handle a direct child of <th> so `absolute right-0` aligns to the cell border, not the
          inner relative wrapper (which ends at the content edge inside th padding — ~16px left of the border). */}
      {props.tableLayout?.columnsResizable && column.getCanResize() && (
        <DataGridTableHeadRowCellResize header={header} />
      )}
    </th>
  );
}

function DataGridTableHeadRowCellResize<TData>({ header }: { header: Header<TData, unknown> }) {
  const { column } = header;
  const isResizing = column.getIsResizing();

  return (
    <div
      {...{
        onDoubleClick: () => column.resetSize(),
        onMouseDown: header.getResizeHandler(),
        onTouchStart: header.getResizeHandler(),
        className: cn(
          // Positioned against <th> padding edge (direct child); inner `relative z-10` wrapper would offset this.
          // Nudge +0.5px so the indicator sits on the center of a 1px border-e.
          "absolute top-0 right-0 z-20 flex h-full w-3 translate-x-[calc(50%+0.5px)] cursor-col-resize touch-none select-none justify-center rounded-sm",
          "transition-colors duration-150 hover:bg-[#1877F2]/14",
          "before:absolute before:inset-y-[4px] before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:bg-[#1877F2] before:opacity-0 before:transition-[opacity,width] before:duration-150",
          "hover:before:opacity-100 hover:before:w-[2px]",
          isResizing && "bg-[#1877F2]/20 before:w-[2px] before:bg-[#1877F2] before:opacity-100",
        ),
      }}
    />
  );
}

function DataGridTableRowSpacer() {
  return <tbody aria-hidden="true" className="h-2"></tbody>;
}

function DataGridTableBody({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();

  return (
    <tbody
      className={cn(
        "[&_tr:last-child]:border-0",
        props.tableLayout?.rowRounded && "[&_td:first-child]:rounded-s-lg [&_td:last-child]:rounded-e-lg",
        props.tableClassNames?.body,
      )}
      style={props.tableLayout?.columnsPinnable ? { position: "relative", zIndex: 101 } : undefined}
    >
      {children}
    </tbody>
  );
}

function DataGridTableFoot({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();

  return (
    <tfoot
      className={cn(
        "bg-white",
        props.tableLayout?.footerSticky &&
          "sticky bottom-0 z-[103] shadow-[0_-1px_0_0_#CBD2D9,0_-4px_12px_rgba(0,0,0,0.06)]",
        props.tableClassNames?.footer,
      )}
    >
      {children}
    </tfoot>
  );
}

function DataGridTableFootRow<TData>({
  children,
  footerGroup,
}: {
  children: ReactNode;
  footerGroup: HeaderGroup<TData>;
}) {
  return <tr key={footerGroup.id}>{children}</tr>;
}

function DataGridTableFootRowCell<TData>({ header }: { header: Header<TData, unknown> }) {
  const { props, table } = useDataGrid();
  const { column } = header;
  const hideEndBorder = Boolean(header.column.columnDef.meta?.hideEndCellBorder);
  const pinnedEdgeOnly = props.tableLayout?.cellBorderMode === "pinned-edge-only";
  const showEndVerticalBorder =
    props.tableLayout?.cellBorder &&
    (pinnedEdgeOnly ? Boolean(header.column.columnDef.meta?.pinnedSectionEdge) : !hideEndBorder);
  const isPinned = column.getIsPinned();
  const isLastLeftPinned = isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned = isPinned === "right" && column.getIsFirstColumn("right");
  const bodyCellSpacing = bodyCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });

  return (
    <td
      key={header.id}
      data-column-id={column.id}
      data-pinned-section-edge={header.column.columnDef.meta?.pinnedSectionEdge ? "" : undefined}
      style={{
        ...(props.tableLayout?.width === "fixed" && getFixedColumnSizeStyle(header.getSize())),
        ...(props.tableLayout?.columnsPinnable && column.getCanPin() && getPinningStyles(column, false)),
      }}
      data-pinned={isPinned || undefined}
      data-last-col={isLastLeftPinned ? "left" : isFirstRightPinned ? "right" : undefined}
      className={cn(
        "align-top bg-white text-[#606770]",
        bodyCellSpacing,
        "border-t border-[#E4E6EB]",
        showEndVerticalBorder && "border-e",
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          "[&[data-pinned=left][data-last-col=left]]:border-e! [&[data-pinned=right][data-last-col=right]]:border-s! [&[data-pinned][data-last-col]]:border-border data-pinned:bg-white",
        column.getIndex() === 0 || column.getIndex() === table.getVisibleFlatColumns().length - 1
          ? props.tableClassNames?.edgeCell
          : "",
      )}
    >
      {props.tableLayout?.columnsPinnable ? (
        <>
          <div className={cn("absolute inset-0 flex items-center px-4 -z-10", isPinned && "bg-white")}></div>
          <div className="relative z-10">
            {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
          </div>
        </>
      ) : header.isPlaceholder ? null : (
        flexRender(header.column.columnDef.footer, header.getContext())
      )}
    </td>
  );
}

function DataGridTableBodyRowSkeleton({ children }: { children: ReactNode }) {
  const { table, props } = useDataGrid();

  return (
    <tr
      className={cn(
        "hover:bg-muted/40 data-[state=selected]:bg-muted/50",
        props.onRowClick && "cursor-pointer",
        props.tableLayout?.rowBorder && "relative [box-shadow:0_1px_0_0_hsl(var(--border))]",
        props.tableLayout?.cellBorder && "[&_>:last-child]:border-e-0",
        props.tableLayout?.stripped && "odd:bg-muted/90 hover:bg-transparent odd:hover:bg-muted",
        table.options.enableRowSelection && "[&_>:first-child]:relative",
        props.tableClassNames?.bodyRow,
      )}
    >
      {children}
    </tr>
  );
}

function DataGridTableBodyRowSkeletonCell<TData>({ children, column }: { children: ReactNode; column: Column<TData> }) {
  const { props, table } = useDataGrid();
  const bodyCellSpacing = bodyCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });
  const hideEndBorder = Boolean(column.columnDef.meta?.hideEndCellBorder);
  const pinnedEdgeOnly = props.tableLayout?.cellBorderMode === "pinned-edge-only";
  const showEndVerticalBorder =
    props.tableLayout?.cellBorder &&
    (pinnedEdgeOnly ? Boolean(column.columnDef.meta?.pinnedSectionEdge) : !hideEndBorder);

  return (
    <td
      data-column-id={column.id}
      className={cn(
        "align-middle",
        bodyCellSpacing,
        showEndVerticalBorder && "border-e",
        props.tableLayout?.columnsResizable && column.getCanResize() && "truncate",
        column.columnDef.meta?.cellClassName,
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          "[&[data-pinned=left][data-last-col=left]]:border-e! [&[data-pinned=right][data-last-col=right]]:border-s! [&[data-pinned][data-last-col]]:border-border data-pinned:bg-background",
        column.getIndex() === 0 || column.getIndex() === table.getVisibleFlatColumns().length - 1
          ? props.tableClassNames?.edgeCell
          : "",
      )}
    >
      {children}
    </td>
  );
}

function DataGridTableBodyRow<TData>({
  children,
  row,
  dndRef,
  dndStyle,
  dataIndex,
}: {
  children: ReactNode;
  row: Row<TData>;
  dndRef?: React.Ref<HTMLTableRowElement>;
  dndStyle?: CSSProperties;
  /** Absolute row index — set when virtualized so the virtualizer can measure this <tr>. */
  dataIndex?: number;
}) {
  const { props, table, lastSelectedRowId, setLastSelectedRowId } = useDataGrid();
  const enableShiftSelect = props.tableLayout?.enableShiftSelect && table.options.enableRowSelection;

  // Memoize click handler to prevent recreation on each render
  const handleRowClick = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>) => {
      // Handle shift-select on row click
      if (enableShiftSelect && event.shiftKey && lastSelectedRowId) {
        event.preventDefault();

        const targetState = !row.getIsSelected();
        const rows = table.getRowModel().rows;
        const lastRowIndex = rows.findIndex((r) => r.id === lastSelectedRowId);
        const currentRowIndex = rows.findIndex((r) => r.id === row.id);

        if (lastRowIndex !== -1 && currentRowIndex !== -1) {
          const start = Math.min(lastRowIndex, currentRowIndex);
          const end = Math.max(lastRowIndex, currentRowIndex);

          const currentSelection = table.getState().rowSelection;
          const newSelection = { ...currentSelection };

          for (let i = start; i <= end; i++) {
            newSelection[rows[i].id] = targetState;
          }

          table.setRowSelection(newSelection);
          setLastSelectedRowId(row.id);
        }
        return;
      }

      // Update anchor and toggle selection on regular click if shift-select is enabled
      if (enableShiftSelect && table.options.enableRowSelection) {
        row.toggleSelected(!row.getIsSelected());
        setLastSelectedRowId(row.id);
      }

      // Call the original onRowClick handler
      if (props.onRowClick) {
        props.onRowClick(row.original);
      }
    },
    [enableShiftSelect, lastSelectedRowId, row, table, setLastSelectedRowId, props],
  );

  return (
    <tr
      ref={dndRef}
      data-index={dataIndex}
      style={{ ...(dndStyle ? dndStyle : null) }}
      data-state={table.options.enableRowSelection && row.getIsSelected() ? "selected" : undefined}
      onClick={handleRowClick}
      className={cn(
        "group/row",
        props.onRowClick && "cursor-pointer",
        props.tableLayout?.rowBorder && "relative [box-shadow:0_-1px_0_0_hsl(var(--border))]",
        props.tableLayout?.cellBorder && "[&_>:last-child]:border-e-0",
        // Striped rows: use theme backgrounds
        "[&_td]:transition-colors [&_td]:duration-75",
        "odd:[&_td]:bg-muted/30 even:[&_td]:bg-background",
        // Pinned cells need opaque backgrounds so scrolling content doesn't bleed through
        "odd:[&_td[data-is-pinned]]:bg-muted even:[&_td[data-is-pinned]]:bg-background",
        // Hover effect (applies to all cells including pinned)
        "hover:[&_td]:bg-muted/50",
        // Pinned cells need opaque background on hover
        "hover:[&_td[data-is-pinned]]:bg-muted hover:[&_td[data-is-pinned]>div:first-child]:bg-muted",
        // Active state for immediate click feedback (before React state updates)
        "active:[&_td]:bg-muted active:[&_td[data-is-pinned]>div:first-child]:bg-muted",
        props.tableLayout?.stripped && "odd:bg-muted/90 hover:bg-transparent odd:hover:bg-muted",
        table.options.enableRowSelection && "[&_>:first-child]:relative",
        // Selected state for all cells
        "data-[state=selected]:[&_td]:bg-accent",
        // Hover on selected state for all cells
        "data-[state=selected]:hover:[&_td]:bg-accent/90",
        // For pinned columns, use opaque backgrounds so scrolling content doesn't bleed through
        "data-[state=selected]:[&_td[data-is-pinned]]:bg-accent data-[state=selected]:[&_td[data-is-pinned]>div:first-child]:bg-accent",
        "data-[state=selected]:hover:[&_td[data-is-pinned]]:bg-accent data-[state=selected]:hover:[&_td[data-is-pinned]>div:first-child]:bg-accent",
        props.tableClassNames?.bodyRow,
      )}
    >
      {children}
    </tr>
  );
}

function DataGridTableBodyRowExpandded<TData>({ row }: { row: Row<TData> }) {
  const { props, table } = useDataGrid();

  return (
    <tr
      className={cn(
        props.tableLayout?.rowBorder && "[&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-border",
      )}
    >
      <td colSpan={row.getVisibleCells().length}>
        {table
          .getAllColumns()
          .find((column) => column.columnDef.meta?.expandedContent)
          ?.columnDef.meta?.expandedContent?.(row.original)}
      </td>
    </tr>
  );
}

function DataGridTableBodyRowCell<TData>({
  children,
  cell,
  dndRef,
  dndStyle,
}: {
  children: ReactNode;
  cell: Cell<TData, unknown>;
  dndRef?: React.Ref<HTMLTableCellElement>;
  dndStyle?: CSSProperties;
}) {
  const { props } = useDataGrid();

  const { column, row } = cell;
  const isPinned = column.getIsPinned();
  const isLastLeftPinned = isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned = isPinned === "right" && column.getIsFirstColumn("right");
  const bodyCellSpacing = bodyCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });
  const hideEndBorder = Boolean(cell.column.columnDef.meta?.hideEndCellBorder);
  const pinnedEdgeOnly = props.tableLayout?.cellBorderMode === "pinned-edge-only";
  const showEndVerticalBorder =
    props.tableLayout?.cellBorder &&
    (pinnedEdgeOnly ? Boolean(cell.column.columnDef.meta?.pinnedSectionEdge) : !hideEndBorder);

  return (
    <td
      key={cell.id}
      ref={dndRef}
      data-column-id={column.id}
      data-pinned-section-edge={cell.column.columnDef.meta?.pinnedSectionEdge ? "" : undefined}
      {...(props.tableLayout?.columnsDraggable && !isPinned ? { cell } : {})}
      style={{
        ...(props.tableLayout?.width === "fixed" &&
          !(props.tableLayout?.columnsPinnable && column.getCanPin()) &&
          getFixedColumnSizeStyle(column.getSize())),
        ...(props.tableLayout?.columnsPinnable && column.getCanPin() && getPinningStyles(column, false)),
        ...(dndStyle ? dndStyle : null),
      }}
      data-pinned={isPinned || undefined}
      data-last-col={isLastLeftPinned ? "left" : isFirstRightPinned ? "right" : undefined}
      className={cn(
        "align-middle",
        props.tableLayout?.columnsPinnable && "relative",
        bodyCellSpacing,
        showEndVerticalBorder && "border-e",
        props.tableLayout?.columnsResizable && column.getCanResize() && "truncate",
        cell.column.columnDef.meta?.cellClassName,
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          "[&[data-pinned=left][data-last-col=left]]:border-e! [&[data-pinned=right][data-last-col=right]]:border-s! [&[data-pinned][data-last-col]]:border-border data-pinned:group-data-[state=selected]/row:bg-accent",
        // Ensure seamless border across sticky and non-sticky columns with !important to override global styles
        "!border-b !border-border",
        column.getIndex() === 0 || column.getIndex() === row.getVisibleCells().length - 1
          ? props.tableClassNames?.edgeCell
          : "",
      )}
      data-row-index={row.index}
      data-is-pinned={isPinned || undefined}
    >
      {props.tableLayout?.columnsPinnable ? (
        <>
          <div
            className={cn(
              "absolute inset-0 flex items-center px-4 -z-10",
              // Pinned cells need solid opaque background so scrolling content doesn't show through
              isPinned && (row.index % 2 === 0 ? "bg-muted" : "bg-background"),
            )}
          ></div>
          <div className="relative z-10">{children}</div>
        </>
      ) : (
        children
      )}
    </td>
  );
}

function DataGridTableEmpty() {
  const { table, props } = useDataGrid();
  const totalColumns = table.getAllColumns().length;

  return (
    <tr>
      <td colSpan={totalColumns} className="py-6 text-center text-muted-foreground">
        {props.emptyMessage || "No data available"}
      </td>
    </tr>
  );
}

function DataGridTableLoader() {
  const { props } = useDataGrid();

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className="flex gap-2 items-center px-4 py-2 text-sm font-medium leading-none rounded-md border text-muted-foreground bg-card shadow-xs">
        <svg
          className="-ml-1 w-5 h-5 animate-spin text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        {props.loadingMessage || "Loading..."}
      </div>
    </div>
  );
}

const DataGridTableRowSelect = React.memo(function DataGridTableRowSelect<TData>({
  row,
  size,
  isSelected,
  className,
}: {
  row: Row<TData>;
  size?: "sm" | "md" | "lg";
  isSelected?: boolean;
  className?: string;
}) {
  const { props, table, lastSelectedRowId, setLastSelectedRowId } = useDataGrid();
  const enableShiftSelect = props.tableLayout?.enableShiftSelect && table.options.enableRowSelection;
  const shiftSelectRef = React.useRef(false);

  // Use passed isSelected prop or fallback to row method
  const checked = isSelected ?? row.getIsSelected();
  const canSelect = row.getCanSelect();

  return (
    <>
      <Checkbox
        checked={checked}
        disabled={!canSelect}
        onCheckedChange={(value) => {
          if (!canSelect) return;
          // Skip if we just did a shift-select (it already handled the selection)
          if (shiftSelectRef.current) {
            shiftSelectRef.current = false;
            setLastSelectedRowId(row.id);
            return;
          }
          row.toggleSelected(!!value);
          if (enableShiftSelect) {
            setLastSelectedRowId(row.id);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!canSelect) return;
          if (enableShiftSelect && e.shiftKey && lastSelectedRowId) {
            shiftSelectRef.current = true;
            // Get target state BEFORE any toggles happen
            const targetState = !checked;
            const rows = table.getRowModel().rows;
            const lastRowIndex = rows.findIndex((r) => r.id === lastSelectedRowId);
            const currentRowIndex = rows.findIndex((r) => r.id === row.id);

            if (lastRowIndex !== -1 && currentRowIndex !== -1) {
              const start = Math.min(lastRowIndex, currentRowIndex);
              const end = Math.max(lastRowIndex, currentRowIndex);

              // Build new selection state and apply it all at once
              const currentSelection = table.getState().rowSelection;
              const newSelection = { ...currentSelection };

              for (let i = start; i <= end; i++) {
                if (!rows[i].getCanSelect()) continue;
                newSelection[rows[i].id] = targetState;
              }

              // Use table's setRowSelection to update all at once
              table.setRowSelection(newSelection);
            }
          }
        }}
        aria-label="Select row"
        size={size ?? "sm"}
        className={cn("align-[inherit]", !canSelect && "pointer-events-none opacity-0", className)}
      />
    </>
  );
}) as <TData>(props: {
  row: Row<TData>;
  size?: "sm" | "md" | "lg";
  isSelected?: boolean;
  className?: string;
}) => React.ReactElement;

function DataGridTableRowSelectAll({ size }: { size?: "sm" | "md" | "lg" }) {
  const { table, recordCount, isLoading } = useDataGrid();
  const hasSelectableRows = table.getRowModel().rows.some((row) => row.getCanSelect());

  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
      disabled={isLoading || recordCount === 0 || !hasSelectableRows}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
      size={size}
      className="align-[inherit]"
    />
  );
}

function DataGridTable<TData>() {
  const { table, isLoading, props } = useDataGrid();
  const pagination = table.getState().pagination;
  const footerGroups = table.getFooterGroups();
  const hasFooter = footerGroups.some((group) =>
    group.headers.some((header) => !header.isPlaceholder && header.column.columnDef.footer),
  );

  const rows = table.getRowModel().rows;
  const visibleColumnCount = table.getVisibleFlatColumns().length;
  const isVirtualized = Boolean(props.tableLayout?.virtualized);

  // Hook runs for every consumer, but stays inert unless `virtualized` is on
  // and a scroll element is supplied (getScrollElement -> null otherwise).
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => (isVirtualized ? (props.scrollRef?.current ?? null) : null),
    estimateSize: () => VIRTUAL_ROW_ESTIMATE_PX,
    overscan: 10,
  });

  const renderDataRow = (row: Row<TData>, index: number, measureRef?: React.Ref<HTMLTableRowElement>) => (
    <Fragment key={row.id}>
      <DataGridTableBodyRow row={row} dndRef={measureRef} dataIndex={index}>
        {row.getVisibleCells().map((cell: Cell<TData, unknown>, colIndex) => {
          return (
            <DataGridTableBodyRowCell cell={cell} key={colIndex}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </DataGridTableBodyRowCell>
          );
        })}
      </DataGridTableBodyRow>
      {row.getIsExpanded() && <DataGridTableBodyRowExpandded row={row} />}
    </Fragment>
  );

  const virtualItems = rowVirtualizer.getVirtualItems();
  const virtualPaddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const virtualPaddingBottom =
    virtualItems.length > 0 ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;

  const renderBodyRows = () => {
    if (props.loadingMode === "skeleton" && isLoading && pagination?.pageSize) {
      return Array.from({ length: pagination.pageSize }).map((_, rowIndex) => (
        <DataGridTableBodyRowSkeleton key={rowIndex}>
          {table.getVisibleFlatColumns().map((column, colIndex) => {
            return (
              <DataGridTableBodyRowSkeletonCell column={column} key={colIndex}>
                {column.columnDef.meta?.skeleton}
              </DataGridTableBodyRowSkeletonCell>
            );
          })}
        </DataGridTableBodyRowSkeleton>
      ));
    }

    if (!rows.length) {
      return <DataGridTableEmpty />;
    }

    if (isVirtualized) {
      return (
        <>
          {virtualPaddingTop > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={visibleColumnCount} style={{ height: virtualPaddingTop, padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {virtualItems.map((virtualRow) =>
            renderDataRow(rows[virtualRow.index], virtualRow.index, rowVirtualizer.measureElement),
          )}
          {virtualPaddingBottom > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={visibleColumnCount} style={{ height: virtualPaddingBottom, padding: 0, border: 0 }} />
            </tr>
          ) : null}
        </>
      );
    }

    return rows.map((row: Row<TData>, index) => renderDataRow(row, index));
  };

  return (
    <DataGridTableBase>
      <DataGridTableHead>
        {table.getHeaderGroups().map((headerGroup: HeaderGroup<TData>, index) => {
          return (
            <DataGridTableHeadRow headerGroup={headerGroup} key={index}>
              {headerGroup.headers.map((header, index) => {
                return (
                  <DataGridTableHeadRowCell header={header} key={index}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </DataGridTableHeadRowCell>
                );
              })}
            </DataGridTableHeadRow>
          );
        })}
      </DataGridTableHead>

      {!props.tableLayout?.rowBorder && <DataGridTableRowSpacer />}

      <DataGridTableBody>{renderBodyRows()}</DataGridTableBody>

      {hasFooter && (
        <DataGridTableFoot>
          {footerGroups.map((footerGroup, index) => (
            <DataGridTableFootRow footerGroup={footerGroup} key={index}>
              {footerGroup.headers.map((header, headerIndex) => (
                <DataGridTableFootRowCell header={header} key={headerIndex} />
              ))}
            </DataGridTableFootRow>
          ))}
        </DataGridTableFoot>
      )}
    </DataGridTableBase>
  );
}

export {
  DataGridTable,
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableBodyRow,
  DataGridTableBodyRowCell,
  DataGridTableBodyRowExpandded,
  DataGridTableBodyRowSkeleton,
  DataGridTableBodyRowSkeletonCell,
  DataGridTableEmpty,
  DataGridTableFoot,
  DataGridTableFootRow,
  DataGridTableFootRowCell,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableLoader,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
  DataGridTableRowSpacer,
};
