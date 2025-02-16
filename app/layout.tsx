import type { Metadata } from "next";
import { Noto_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

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
      <body className={`${notoSerif.className} antialiased dark`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
