"use client";

import * as React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser } from "@/lib/providers/user-provider";
import { cn } from "@/lib/utils";

/**
 * The 64px icon rail, trimmed to the one category this repo ships.
 *
 * The app's rail carries eight categories (Launch, Assets, Insights, Automate,
 * Integrations, Inspiration, Chat, Settings) plus global search, invite, What's
 * New and a workspace switcher. Only Automate leads anywhere here, so the rest
 * are dropped rather than rendered as dead links.
 *
 * Markup, sizing and the `bg-sidebar` / `sidebar-accent` token usage are carried
 * over unchanged, so the rail reads exactly as it does in the product.
 */

/** Single rail entry. Mirrors `RailButton` in the app's `icon-rail.tsx`. */
function RailButton({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(
            "relative flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg py-2 no-underline transition-colors",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Icon className="size-5" />
          <span className="text-[10px] font-semibold leading-tight">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Workspace badge at the top of the rail. */
function WorkspaceAvatar() {
  const { currentWorkspace } = useUser();
  const initial = (currentWorkspace?.name ?? "W").charAt(0).toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
          {initial}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{currentWorkspace?.name ?? "Workspace"}</TooltipContent>
    </Tooltip>
  );
}

/** User avatar pinned to the bottom of the rail. */
function RailUserAvatar() {
  const { extendedUser } = useUser();
  const initials = (extendedUser?.name ?? "U")
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className="size-8">
          <AvatarFallback className="bg-sidebar-accent text-[11px] font-semibold text-sidebar-accent-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent side="right">{extendedUser?.email ?? "Demo user"}</TooltipContent>
    </Tooltip>
  );
}

export function IconRail() {
  return (
    <TooltipProvider delayDuration={0}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-white/5 bg-sidebar md:flex">
        <div className="flex h-16 shrink-0 flex-col items-center justify-start gap-1 px-1.5 pt-3">
          <WorkspaceAvatar />
          <span className="text-[9px] font-medium leading-none text-sidebar-foreground/50">Workspace</span>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-2 px-1.5 pt-4">
          <RailButton href="/automation" icon={Zap} label="Automate" isActive />
        </nav>

        <div className="flex flex-col items-center gap-1 border-t border-white/10 px-1.5 pb-3 pt-2">
          <RailUserAvatar />
        </div>
      </aside>
    </TooltipProvider>
  );
}
