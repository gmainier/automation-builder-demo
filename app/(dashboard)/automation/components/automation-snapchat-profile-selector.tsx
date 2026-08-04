"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2, User } from "lucide-react";

interface SnapchatProfile {
  id: string;
  displayName: string;
  snapUserName?: string;
  profilePictureUrl?: string;
}

interface AutomationSnapchatProfileSelectorProps {
  accountId: string;
  value: string;
  onChange: (profileId: string, profileName: string) => void;
}

export function AutomationSnapchatProfileSelector({
  accountId,
  value,
  onChange,
}: AutomationSnapchatProfileSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<SnapchatProfile[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchProfiles = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/snapchat/profiles?adAccountId=${accountId}`);
      const data = await res.json();
      if (data.profiles && data.profiles.length > 0) {
        setProfiles(data.profiles);
      }
    } catch (err) {
      console.error("Failed to fetch Snapchat profiles:", err);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId && !hasFetched) {
      fetchProfiles();
    }
  }, [accountId, hasFetched, fetchProfiles]);

  // Reset when account changes
  useEffect(() => {
    setProfiles([]);
    setHasFetched(false);
  }, [accountId]);

  const selectedProfile = profiles.find((p) => p.id === value);

  if (!accountId) {
    return (
      <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">Select an ad account first</div>
    );
  }

  if (loading) {
    return (
      <Button variant="outline" className="w-full justify-between h-10" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2">Loading profiles...</span>
      </Button>
    );
  }

  if (hasFetched && profiles.length === 0) {
    return (
      <div className="text-sm text-amber-600 p-2 border rounded-md bg-amber-50">
        No public profiles found for this account. Make sure a Public Profile is linked in Snapchat.
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-10">
          <span className="truncate flex items-center gap-2">
            {selectedProfile ? (
              <>
                {selectedProfile.profilePictureUrl ? (
                  <img src={selectedProfile.profilePictureUrl} alt="" className="h-5 w-5 rounded-full shrink-0" />
                ) : (
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                {selectedProfile.displayName}
                {selectedProfile.snapUserName && (
                  <span className="text-muted-foreground">(@{selectedProfile.snapUserName})</span>
                )}
              </>
            ) : (
              "Select public profile..."
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 min-w-[300px]" align="start">
        <Command>
          <CommandInput placeholder="Search profiles..." />
          <CommandEmpty>No profiles found.</CommandEmpty>
          <CommandGroup className="max-h-[200px] overflow-y-auto">
            {profiles.map((profile) => (
              <CommandItem
                key={profile.id}
                value={profile.displayName || profile.id}
                onSelect={() => {
                  const displayLabel = profile.snapUserName
                    ? `${profile.displayName} (@${profile.snapUserName})`
                    : profile.displayName;
                  onChange(profile.id, displayLabel);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check className={cn("mr-2 h-4 w-4", value === profile.id ? "opacity-100" : "opacity-0")} />
                <div className="flex items-center gap-2">
                  {profile.profilePictureUrl ? (
                    <img src={profile.profilePictureUrl} alt="" className="h-5 w-5 rounded-full shrink-0" />
                  ) : (
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex flex-col">
                    <span className="truncate">{profile.displayName}</span>
                    {profile.snapUserName && (
                      <span className="text-xs text-muted-foreground">@{profile.snapUserName}</span>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
