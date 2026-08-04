import { USER_ROLES_ENUM } from "@/lib/auth/constants";

export const PERMISSION_ACTIONS = [
  "organizations.read",
  "organizations.write",
  "workspaces.read",
  "workspaces.create",
  "workspaces.write",
  "adaccounts.read",
  "adaccounts.write",
  "integrations.read",
  "integrations.write",
  "comments.read",
  "comments.write",
  "reports.read",
  "reports.write",
  "media.read",
  "media.write",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ROLE_PERMISSIONS: {
  action: PermissionAction;
  description: string;
  roles: (typeof USER_ROLES_ENUM)[number][];
}[] = [
  {
    action: "organizations.read",
    description: "access organizations",
    roles: ["admin", "editor", "launcher", "analyst", "commenter", "uploader", "drafter"],
  },
  {
    action: "organizations.write",
    description: "update or delete the current organization & billing information",
    roles: ["admin"],
  },
  //workspaces
  {
    action: "workspaces.read",
    description: "read workspaces / team page",
    roles: ["admin", "editor", "launcher", "commenter", "analyst"],
  },
  {
    action: "workspaces.create",
    description: "create workspaces",
    roles: ["admin", "editor"],
  },
  {
    action: "workspaces.write",
    description: "create, update, or delete workspaces",
    roles: ["admin"],
  },

  {
    action: "adaccounts.read",
    description: "view launch page and launch templates",
    roles: ["admin", "editor", "launcher", "drafter"],
  },
  {
    action: "adaccounts.write",
    description: "use launch page and launch templates to launch ads",
    roles: ["admin", "editor", "launcher", "drafter"],
  },
  {
    action: "integrations.read",
    description: "view authorized OAuth apps",
    roles: ["admin", "editor", "launcher", "drafter"],
  },
  {
    action: "integrations.write",
    description: "create, update, or delete authorized OAuth apps and integrations",
    roles: ["admin", "editor"],
  },
  {
    action: "reports.read",
    description: "access reports and statistics",
    roles: ["admin", "editor", "launcher", "analyst", "commenter", "drafter"],
  },
  {
    action: "reports.write",
    description: "create, update, or delete reports",
    roles: ["admin", "editor", "launcher", "analyst"],
  },
  {
    action: "comments.read",
    description: "view comments",
    roles: ["admin", "editor", "launcher", "commenter", "drafter"],
  },
  {
    action: "comments.write",
    description: "update or delete comments",
    roles: ["admin", "editor", "launcher", "commenter", "drafter"],
  },
  {
    action: "media.read",
    description: "view media files",
    roles: ["admin", "editor", "launcher", "uploader", "drafter"],
  },
  {
    action: "media.write",
    description: "upload or delete media files",
    roles: ["admin", "editor", "launcher", "uploader", "drafter"],
  },
];

// Get permissions for a role
export const getPermissionsByRole = (role: (typeof USER_ROLES_ENUM)[number]) => {
  return ROLE_PERMISSIONS.filter(({ roles }) => roles.includes(role)).map(({ action }) => action);
};
