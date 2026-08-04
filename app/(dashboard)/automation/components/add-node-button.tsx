"use client";

import { useState } from "react";
import { useAutomation } from "../contexts/automation-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Play, Clock, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddNodeButtonProps {
  position: number;
  isLast?: boolean;
}

export function AddNodeButton({ position, isLast = false }: AddNodeButtonProps) {
  const { addNode, flow } = useAutomation();
  const [isHovered, setIsHovered] = useState(false);

  // Check if a scheduled trigger already exists
  const hasScheduledTrigger = flow.nodes.some((node) => node.type === "trigger" && node.service === "scheduled");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "rounded-full p-0 h-7 w-7 transition-all duration-200 focus-visible:ring-violet-500",
            isLast
              ? // Terminal button — looks like a soft "add optional step", not a required next node
                "border border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground hover:border-violet-400 hover:bg-violet-50 hover:text-violet-600"
              : // Mid-flow button — primary violet fill since there's clearly a next step
                "border-0 bg-violet-500 text-white hover:bg-violet-600 hover:scale-110 hover:shadow-md",
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Plus className={cn("h-4 w-4 transition-transform duration-200", isHovered && "rotate-90")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-44">
        <DropdownMenuItem onClick={() => addNode("trigger", position)} className="gap-3 cursor-pointer">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100">
            <Zap className="h-3.5 w-3.5 text-red-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">Trigger</span>
            <span className="text-xs text-muted-foreground">Add another trigger</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addNode("action", position)} className="gap-3 cursor-pointer">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
            <Play className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">Action</span>
            <span className="text-xs text-muted-foreground">Do something</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addNode("delay", position)} className="gap-3 cursor-pointer">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
            <Clock className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">Delay</span>
            <span className="text-xs text-muted-foreground">Wait before next step</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addNode("approval", position)} className="gap-3 cursor-pointer">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100">
            <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">Approval</span>
            <span className="text-xs text-muted-foreground">Require manual approval</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
