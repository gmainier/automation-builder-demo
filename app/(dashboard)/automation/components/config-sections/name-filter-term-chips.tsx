"use client";

import { Fragment, type ReactElement } from "react";
import { X } from "lucide-react";

import { getNameFilterJoinLabel, parseNameFilterTerms, removeNameFilterTerm } from "./name-filter-terms";

interface NameFilterTermChipsProps {
  value: string;
  matchType: string | undefined;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export function NameFilterTermChips({
  value,
  matchType,
  onChange,
  ariaLabel,
}: NameFilterTermChipsProps): ReactElement | null {
  const terms = parseNameFilterTerms(value);
  if (terms.length === 0) return null;

  const joinLabel = getNameFilterJoinLabel(matchType);

  return (
    <div aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5">
      {terms.map((term, position) => (
        <Fragment key={`${term.index}-${term.label}`}>
          {position > 0 && joinLabel && (
            <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
              {joinLabel}
            </span>
          )}
          <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-foreground">
            <span className="max-w-[220px] truncate">{term.label}</span>
            <button
              type="button"
              aria-label={`Remove ${term.label}`}
              className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onChange(removeNameFilterTerm(value, term.index))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </Fragment>
      ))}
    </div>
  );
}
