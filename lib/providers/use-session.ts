"use client";

import { useUser } from "./user-provider";

/**
 * Stand-in for next-auth's `useSession`.
 *
 * Only one ported component reads the session (the notification settings sheet,
 * to label who alerts are sent to). Pulling in next-auth for that would mean
 * wiring a whole auth provider into a repo that has no accounts, so this returns
 * the mock user in the same shape instead.
 */
export function useSession() {
  const { extendedUser } = useUser();
  return {
    data: extendedUser
      ? { user: { name: extendedUser.name, email: extendedUser.email, image: extendedUser.image } }
      : null,
    status: "authenticated" as const,
  };
}
