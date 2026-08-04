import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDataGrid } from "@/components/ui/data-grid";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

interface DataGridColumnHeaderProps<TData, TValue> extends HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title?: string;
  icon?: ReactNode;
  pinnable?: boolean;
  filter?: ReactNode;
  visibility?: boolean;
}

function DataGridColumnHeader<TData, TValue>({
  column,
  title = "",
  icon,
  className,
}: DataGridColumnHeaderProps<TData, TValue>) {
  const { isLoading, props, recordCount } = useDataGrid();
  const canResize = Boolean(props.tableLayout?.columnsResizable && column.getCanResize());
  const rightInsetClass = canResize ? "pe-4" : "";

  const headerLabel = () => {
    return (
      <div
        className={cn(
          "text-secondary-foreground/80 inline-flex h-full w-full min-w-0 items-center gap-1.5 overflow-hidden text-[0.8125rem] font-bold leading-[calc(1.125/0.8125)] [&_svg]:size-3.5 [&_svg]:opacity-60",
          rightInsetClass,
          className,
        )}
      >
        {icon && icon}
        <span className="truncate">{title}</span>
      </div>
    );
  };

  // Sortable header button - click to cycle through: unsorted -> asc -> desc -> unsorted
  const headerButton = () => {
    const isSorted = column.getIsSorted();
    const sortIcon =
      isSorted === "desc" ? (
        <ArrowDown className="size-[0.7rem]! shrink-0 opacity-85" />
      ) : isSorted === "asc" ? (
        <ArrowUp className="size-[0.7rem]! shrink-0 opacity-85" />
      ) : (
        <ChevronsUpDown className="size-[0.7rem]! shrink-0 opacity-50" />
      );

    return (
      <Button
        variant="ghost"
        className={cn(
          "text-secondary-foreground/80 h-full w-full min-w-0 justify-between gap-2 overflow-hidden rounded-none bg-transparent px-0 py-0 text-[0.8125rem] font-bold shadow-none hover:bg-transparent hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
          rightInsetClass,
          className,
        )}
        disabled={isLoading || recordCount === 0}
        onClick={() => {
          if (isSorted === "asc") {
            column.toggleSorting(true); // asc -> desc
          } else if (isSorted === "desc") {
            column.clearSorting(); // desc -> unsorted
          } else {
            column.toggleSorting(false); // unsorted -> asc
          }
        }}
      >
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {icon && icon}
          <span className="truncate">{title}</span>
        </span>
        {sortIcon}
      </Button>
    );
  };

  const withTooltip = (trigger: ReactNode) => {
    if (!title) return trigger;
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="top" align="start">
          {title}
        </TooltipContent>
      </Tooltip>
    );
  };

  // Always use sortable button if column can be sorted
  // This works with server-side sorting (manualSorting: true)
  if (column.getCanSort()) {
    return withTooltip(headerButton());
  }

  // For non-sortable but resizable columns, show label
  if (props.tableLayout?.columnsResizable && column.getCanResize()) {
    return withTooltip(headerLabel());
  }

  // Fallback to plain label
  return withTooltip(headerLabel());
}

export { DataGridColumnHeader, type DataGridColumnHeaderProps };
