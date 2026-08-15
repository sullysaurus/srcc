import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://southernrevelry.vercel.app"),
  title: {
    default: "Southern Revelry Command Center",
    template: "%s · Southern Revelry",
  },
  description:
    "Sales pipeline, paid media, and organic search in one honest operating view.",
  openGraph: {
    title: "Southern Revelry Command Center",
    description:
      "Sales pipeline, paid media, and organic search in one honest operating view.",
    siteName: "Southern Revelry",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Southern Revelry Command Center",
    description:
      "Sales pipeline, paid media, and organic search in one honest operating view.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
