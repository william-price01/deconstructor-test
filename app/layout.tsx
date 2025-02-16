import type { Metadata } from "next";
import { Noto_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import PlausibleProvider from "next-plausible";

const notoSerif = Noto_Serif({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "deconstructor.",
  description: "truly understand language.",
  openGraph: {
    title: "deconstructor.",
    siteName: "deconstructor.",
    description: "truly understand language.",
    images: "/og.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <PlausibleProvider
          domain="deconstructor.ayush.digital"
          customDomain="https://a.ayush.digital"
          trackOutboundLinks
          selfHosted
          taggedEvents
        />
      </head>
      <body className={`${notoSerif.className} antialiased dark`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
