"use client";

import { cn } from "@/lib/utils";
import { ColumnFiltersState, RowData, SortingState, Table } from "@tanstack/react-table";
import { ComponentPropsWithoutRef, MouseEvent, ReactNode, RefObject, createContext, useContext, useState } from "react";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerTitle?: string;
    headerClassName?: string;
    cellClassName?: string;
    /** Suppresses the right edge border (and header ::after divider) so this column reads as grouped with the next. Ignored when `cellBorderMode` is `pinned-edge-only`. */
    hideEndCellBorder?: boolean;
    /** With `cellBorderMode: pinned-edge-only`, this column is the only one that draws the vertical rule on its right (pinned block vs scroll). */
    pinnedSectionEdge?: boolean;
    skeleton?: ReactNode;
    expandedContent?: (row: TData) => ReactNode;
  }
}

export type DataGridApiFetchParams = {
  pageIndex: number;
  pageSize: number;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  searchQuery?: string;
};

export type DataGridApiResponse<T> = {
  data: T[];
  empty: boolean;
  pagination: {
    total: number;
    page: number;
  };
};

export interface DataGridContextProps<TData extends object> {
  props: DataGridProps<TData>;
  table: Table<TData>;
  recordCount: number;
  isLoading: boolean;
  lastSelectedRowId: string | null;
  setLastSelectedRowId: (rowId: string | null) => void;
}

export type DataGridRequestParams = {
  pageIndex: number;
  pageSize: number;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
};

export interface DataGridProps<TData extends object> {
  className?: string;
  table?: Table<TData>;
  recordCount: number;
  children?: ReactNode;
  /**
   * Scrollable ancestor used as the viewport for row virtualization. Required
   * (together with `tableLayout.virtualized`) for the body to virtualize; the
   * same element should be the `overflow-auto` container wrapping the table.
   */
  scrollRef?: RefObject<HTMLElement | null>;
  onRowClick?: (row: TData, e?: MouseEvent<HTMLTableRowElement>) => void;
  onRowDoubleClick?: (row: TData, e?: MouseEvent<HTMLTableRowElement>) => void;
  isLoading?: boolean;
  loadingMode?: "skeleton" | "spinner";
  loadingMessage?: ReactNode | string;
  emptyMessage?: ReactNode | string;
  tableLayout?: {
    dense?: boolean;
    cellBorder?: boolean;
    /** When `pinned-edge-only`, only columns with `meta.pinnedSectionEdge` get a right vertical rule (e.g. pinned name column). */
    cellBorderMode?: "all" | "pinned-edge-only";
    rowBorder?: boolean;
    rowRounded?: boolean;
    stripped?: boolean;
    headerBackground?: boolean;
    headerBorder?: boolean;
    headerSticky?: boolean;
    width?: "auto" | "fixed";
    columnsVisibility?: boolean;
    columnsResizable?: boolean;
    columnsPinnable?: boolean;
    columnsMovable?: boolean;
    columnsDraggable?: boolean;
    rowsDraggable?: boolean;
    enableShiftSelect?: boolean;
    /** Pin <tfoot> to the bottom of the scroll viewport (needs a scrollable ancestor, e.g. ScrollArea). */
    footerSticky?: boolean;
    /**
     * Render only the visible body rows (windowing) for large page sizes.
     * Requires `scrollRef` to point at the scroll viewport. Off by default so
     * existing consumers are unaffected.
     */
    virtualized?: boolean;
  };
  tableClassNames?: {
    base?: string;
    header?: string;
    headerRow?: string;
    headerSticky?: string;
    body?: string;
    bodyRow?: string;
    footer?: string;
    edgeCell?: string;
  };
}

const DataGridContext = createContext<DataGridContextProps<any> | undefined>(undefined);

function useDataGrid() {
  const context = useContext(DataGridContext);
  if (!context) {
    throw new Error("useDataGrid must be used within a DataGridProvider");
  }
  return context;
}

function DataGridProvider<TData extends object>({
  children,
  table,
  ...props
}: DataGridProps<TData> & { table: Table<TData> }) {
  const [lastSelectedRowId, setLastSelectedRowId] = useState<string | null>(null);

  return (
    <DataGridContext.Provider
      value={{
        props,
        table,
        recordCount: props.recordCount,
        isLoading: props.isLoading || false,
        lastSelectedRowId,
        setLastSelectedRowId,
      }}
    >
      {children}
    </DataGridContext.Provider>
  );
}

function DataGrid<TData extends object>({ children, table, ...props }: DataGridProps<TData>) {
  const defaultProps: Partial<DataGridProps<TData>> = {
    loadingMode: "skeleton",
    tableLayout: {
      dense: false,
      cellBorder: false,
      cellBorderMode: "all",
      rowBorder: true,
      rowRounded: false,
      stripped: false,
      headerSticky: false,
      headerBackground: true,
      headerBorder: true,
      width: "fixed",
      columnsVisibility: false,
      columnsResizable: false,
      columnsPinnable: false,
      columnsMovable: false,
      columnsDraggable: false,
      rowsDraggable: false,
      enableShiftSelect: false,
      footerSticky: false,
      virtualized: false,
    },
    tableClassNames: {
      base: "",
      header: "",
      headerRow: "",
      headerSticky: "sticky top-0 z-10 bg-background/90 backdrop-blur-xs",
      body: "",
      bodyRow: "",
      footer: "",
      edgeCell: "",
    },
  };

  const mergedProps: DataGridProps<TData> = {
    ...defaultProps,
    ...props,
    tableLayout: {
      ...defaultProps.tableLayout,
      ...(props.tableLayout || {}),
    },
    tableClassNames: {
      ...defaultProps.tableClassNames,
      ...(props.tableClassNames || {}),
    },
  };

  // Ensure table is provided
  if (!table) {
    throw new Error('DataGrid requires a "table" prop');
  }

  return (
    <DataGridProvider table={table} {...mergedProps}>
      {children}
    </DataGridProvider>
  );
}

function DataGridContainer({
  children,
  className,
  border = true,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
  border?: boolean;
}) {
  return (
    <div
      data-slot="data-grid"
      className={cn("grid min-h-0 min-w-0 w-full", border && "border border-border rounded-lg", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { DataGrid, DataGridContainer, DataGridProvider, useDataGrid };
