import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Skillora - Learn, Teach, Grow",
    template: "%s - Skillora",
  },
  description:
    "Skillora is a modern learning marketplace where learners discover courses, instructors build and publish content, and admins manage the platform.",
  keywords: ["learning", "courses", "education", "marketplace", "online learning", "Skillora"],
  openGraph: {
    type: "website",
    siteName: "Skillora",
    title: "Skillora - Learn, Teach, Grow",
    description: "A modern learning marketplace for learners, instructors, and admins.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
