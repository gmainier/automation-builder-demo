"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/providers/use-session";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, MessageSquare, Plus, X, AlertTriangle, CheckCircle2, XCircle, Hash, Loader2 } from "lucide-react";
import { useAutomation } from "../contexts/automation-context";
import { useUser } from "@/lib/providers/user-provider";

export interface NotificationSettings {
  enabled: boolean;
  emailRecipients: string[];
  slackEnabled: boolean;
  slackChannelOverride?: { id: string; name: string } | null;
  notifyOn: {
    approvalRequired: boolean;
    executionCompleted: boolean;
    executionFailed: boolean;
  };
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  emailRecipients: [],
  slackEnabled: false,
  notifyOn: {
    approvalRequired: true,
    executionCompleted: false,
    executionFailed: true,
  },
};

interface NotificationSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationSettingsSheet({ open, onOpenChange }: NotificationSettingsSheetProps) {
  const { flow, updateNotificationSettings } = useAutomation();

  const settings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(flow.notificationSettings as NotificationSettings | undefined),
    notifyOn: {
      ...DEFAULT_NOTIFICATION_SETTINGS.notifyOn,
      ...((flow.notificationSettings as NotificationSettings | undefined)?.notifyOn || {}),
    },
  };

  const { data: session } = useSession();
  const { extendedUser } = useUser();
  const isStaffUser = session?.user?.email?.endsWith("@example.internal") ?? false;
  const orgSlackChannelFromProvider = extendedUser?.organizations?.[0]?.organization?.slackChannel;

  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [slackChannels, setSlackChannels] = useState<{ id: string; name: string; is_private: boolean }[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [orgDefaultChannel, setOrgDefaultChannel] = useState<{ id: string; name: string } | null>(null);

  // Fetch Slack channels + org default when Slack is enabled
  useEffect(() => {
    if (settings.slackEnabled && slackChannels.length === 0 && !loadingChannels) {
      setLoadingChannels(true);
      fetch("/api/slacktest")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSlackChannels(data.channels.sort((a: any, b: any) => a.name.localeCompare(b.name)));
          }
          if (data.orgDefaultChannel) {
            setOrgDefaultChannel(data.orgDefaultChannel);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingChannels(false));
    }
  }, [settings.slackEnabled]);

  const orgSlackChannel = orgDefaultChannel || orgSlackChannelFromProvider;

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    updateNotificationSettings({ ...settings, ...updates });
  };

  const updateNotifyOn = (key: keyof NotificationSettings["notifyOn"], value: boolean) => {
    updateSettings({
      notifyOn: { ...settings.notifyOn, [key]: value },
    });
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (settings.emailRecipients.includes(email)) {
      setEmailError("Email already added");
      return;
    }

    setEmailError("");
    updateSettings({
      emailRecipients: [...settings.emailRecipients, email],
    });
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    updateSettings({
      emailRecipients: settings.emailRecipients.filter((e) => e !== email),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </SheetTitle>
          <SheetDescription>Get notified when this automation needs attention.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Master toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Send notifications for this automation</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(checked) => updateSettings({ enabled: checked })} />
          </div>

          {settings.enabled && (
            <>
              <Separator />

              {/* Email Recipients */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Email Recipients</Label>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailError("");
                    }}
                    onKeyDown={handleKeyDown}
                    className="flex-1"
                  />
                  <Button onClick={addEmail} size="icon" variant="outline" className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {emailError && <p className="text-xs text-destructive">{emailError}</p>}

                {settings.emailRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {settings.emailRecipients.map((email) => (
                      <Badge key={email} variant="secondary" className="gap-1 pr-1">
                        {email}
                        <button
                          onClick={() => removeEmail(email)}
                          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {settings.emailRecipients.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No recipients added. Add emails to receive notifications.
                  </p>
                )}
              </div>

              <Separator />

              {/* Slack toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Slack notifications</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {orgSlackChannel?.name ? (
                        <>
                          Send to <span className="font-medium">#{orgSlackChannel.name}</span>
                        </>
                      ) : settings.slackChannelOverride?.name ? (
                        <>
                          Send to <span className="font-medium">#{settings.slackChannelOverride.name}</span>
                        </>
                      ) : (
                        "No default Slack channel configured for this org"
                      )}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.slackEnabled}
                  onCheckedChange={(checked) => updateSettings({ slackEnabled: checked })}
                />
              </div>

              {settings.slackEnabled && isStaffUser && (
                <div className="space-y-2 pl-6">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-medium">Channel override</Label>
                  </div>
                  {loadingChannels ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading channels...
                    </div>
                  ) : (
                    <Select
                      value={settings.slackChannelOverride?.id || "__default__"}
                      onValueChange={(value) => {
                        if (value === "__default__") {
                          updateSettings({ slackChannelOverride: null });
                        } else {
                          const ch = slackChannels.find((c) => c.id === value);
                          if (ch) {
                            updateSettings({ slackChannelOverride: { id: ch.id, name: ch.name } });
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Use org default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">
                          {orgSlackChannel?.name
                            ? `Org default (#${orgSlackChannel.name})`
                            : "Org default (not configured)"}
                        </SelectItem>
                        {slackChannels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            {ch.is_private ? "🔒 " : "#"} {ch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {orgSlackChannel?.name ? (
                      <>
                        Org default is <span className="font-medium">#{orgSlackChannel.name}</span>. Override it for
                        this automation.
                      </>
                    ) : (
                      "No org default configured. Select a channel to enable Slack notifications."
                    )}
                  </p>
                </div>
              )}

              <Separator />

              {/* Notify On section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Notify when</Label>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Approval required</span>
                    </div>
                    <Switch
                      checked={settings.notifyOn.approvalRequired}
                      onCheckedChange={(checked) => updateNotifyOn("approvalRequired", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm">Execution failed</span>
                    </div>
                    <Switch
                      checked={settings.notifyOn.executionFailed}
                      onCheckedChange={(checked) => updateNotifyOn("executionFailed", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Execution completed</span>
                    </div>
                    <Switch
                      checked={settings.notifyOn.executionCompleted}
                      onCheckedChange={(checked) => updateNotifyOn("executionCompleted", checked)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
