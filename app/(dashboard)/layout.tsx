import type { ReactNode } from "react";
import { Suspense } from "react";
import { IconRail } from "@/components/sidebar/icon-rail";
import { DetailSidebar } from "@/components/sidebar/detail-sidebar";

/**
 * Dashboard shell: icon rail, detail panel, page.
 *
 * Mirrors the app's `app/(dashboard)/layout.tsx` structure — a fixed 64px rail, a
 * fixed detail panel beside it, and the page filling the rest — without the parts
 * that need a server session: auth, the workspace query, impersonation, billing
 * banners and the global search index.
 *
 * The Suspense boundary is load-bearing: the detail panel reads `useSearchParams`
 * to work out which nav entry is active, which opts the subtree out of static
 * prerendering unless it sits inside one.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <IconRail />
      <Suspense fallback={<div className="hidden w-48 shrink-0 bg-sidebar md:block" />}>
        <DetailSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pl-16">{children}</div>
    </div>
  );
}
