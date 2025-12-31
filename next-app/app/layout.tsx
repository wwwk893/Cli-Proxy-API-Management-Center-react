import type { Metadata } from "next";
import "./globals.css";
import "react-day-picker/dist/style.css";
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
      <body className="min-h-screen bg-page text-foreground theme-night">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
