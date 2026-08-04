import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Automations",
  description: "Build powerful automations with Meta Ads, Google Sheets, and Google Drive",
};

/**
 * In the app this layout is wrapped in `withPaidPlan`, which redirects a
 * non-subscribed user to billing. There is no billing here, so that is dropped.
 *
 * The Suspense boundary is required rather than cosmetic: the page keeps all of
 * its view state in the URL via nuqs, so it calls `useSearchParams()` during
 * render, and without a boundary the prerender bails out. In the app the
 * surrounding dashboard layout already provides one.
 */
export default function AutomationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Suspense fallback={<AutomationLayoutFallback />}>{children}</Suspense>;
}

function AutomationLayoutFallback() {
  return (
    <div className="flex h-[calc(100vh-1rem)] items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
