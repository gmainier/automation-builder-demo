import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { UserProvider } from "@/lib/providers/user-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automation builder",
  description: "Standalone copy of the Automation Builder automation builder, running on mock data.",
};

/**
 * Root layout.
 *
 * Provides the three things the automation page assumes exist in the app shell:
 * the nuqs adapter (the page keeps all its view state in the URL), the toast
 * host, and a user context. Everything else the real dashboard layout supplies
 * (sidebar, auth gate, workspace switcher) is out of scope here.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>
          <UserProvider>{children}</UserProvider>
          <Toaster position="top-center" richColors />
        </NuqsAdapter>
      </body>
    </html>
  );
}
