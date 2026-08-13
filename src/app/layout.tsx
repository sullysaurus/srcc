import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Southern Revelry Command Center",
  description: "Operations, sales, advertising, and SEO command center",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
