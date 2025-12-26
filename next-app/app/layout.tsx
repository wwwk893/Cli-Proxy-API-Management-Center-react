import type { Metadata } from "next";
import "./globals.css";
import "react-day-picker/dist/style.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CLIProxy Management Center",
  description: "CLIProxy API Management UI (Next.js rewrite)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex bg-page text-foreground theme-night">
        <Providers>
          <Sidebar />
          <main className="flex-1">
            <div className="max-w-7xl mx-auto w-full px-4 py-6 lg:px-8">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
