import type { Metadata } from "next";
import { auth } from "@/auth";
import { DevCacheReset } from "@/components/DevCacheReset";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "نظام عقود الفنادق وتخصيص الغرف",
  description: "Hotel Contract & Room Allocation System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="ar">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DevCacheReset />
        <AppShell user={session?.user}>{children}</AppShell>
      </body>
    </html>
  );
}
