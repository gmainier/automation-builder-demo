import { ArrowRight } from "lucide-react";
import type { FollowUpSuggestion } from "./types";

interface FollowUpSuggestionsProps {
	readonly suggestions: readonly FollowUpSuggestion[];
	readonly onSelect?: (text: string) => void;
}

export function FollowUpSuggestions({
	suggestions,
	onSelect,
}: FollowUpSuggestionsProps) {
	return (
		<div className="mt-2 space-y-2">
			{suggestions.map((suggestion) => (
				<button
					type="button"
					key={suggestion.id}
					onClick={() => onSelect?.(suggestion.title)}
					className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/50"
				>
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-foreground">
							{suggestion.title}
						</p>
						{suggestion.description && (
							<p className="mt-0.5 text-xs text-muted-foreground truncate">
								{suggestion.description}
							</p>
						)}
					</div>
					<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
				</button>
			))}
		</div>
	);
}
