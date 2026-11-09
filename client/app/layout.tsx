import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blog — stories worth sharing",
  description: "A thoughtful home for stories, ideas, and conversations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
