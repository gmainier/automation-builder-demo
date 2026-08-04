"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Board {
  id: number;
  name: string;
  parentId: number | null;
  _count?: { assets: number };
}

interface BoardSelectorProps {
  value: string;
  onChange(boardId: string, boardName: string): void;
}

export function BoardSelector({ value, onChange }: BoardSelectorProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBoards();
  }, []);

  async function fetchBoards() {
    try {
      const response = await fetch("/api/library/boards");
      if (response.ok) {
        const data = await response.json();
        // API returns array directly or { boards: [] }
        setBoards(Array.isArray(data) ? data : data.boards || []);
      }
    } catch (error) {
      console.error("Failed to fetch boards:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (boardId: string) => {
    const board = boards.find((b) => b.id.toString() === boardId);
    onChange(boardId, board?.name || "");
  };

  if (loading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading boards...
      </div>
    );
  }

  return (
    <Select value={value || "all"} onValueChange={(v) => handleChange(v === "all" ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder="All boards (any upload triggers)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All boards</SelectItem>
        {boards.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No boards found</div>
        ) : (
          boards.map((board) => (
            <SelectItem key={board.id} value={board.id.toString()}>
              {board.name}
              {board._count?.assets !== undefined && (
                <span className="ml-2 text-muted-foreground">({board._count.assets} assets)</span>
              )}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

// Export hook for use in other components
export function useBoardSelector() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBoards();
  }, []);

  async function fetchBoards() {
    try {
      const response = await fetch("/api/library/boards");
      if (response.ok) {
        const data = await response.json();
        // API returns array directly or { boards: [] }
        setBoards(Array.isArray(data) ? data : data.boards || []);
      }
    } catch (error) {
      console.error("Failed to fetch boards:", error);
    } finally {
      setLoading(false);
    }
  }

  return { boards, loading, refetch: fetchBoards };
}
