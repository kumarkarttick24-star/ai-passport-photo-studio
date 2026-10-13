import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pi7 Passport Studio | AI Passport Photo Editor",
  description: "Generate and prepare passport-style photos with AI and manual export controls."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
