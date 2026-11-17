import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CorporateBuddy — Your Corporate Life. Simplified.",
  description:
    "Workplace utility suite for Indian corporate employees: CTC calculator, state holidays & leave planner, email assistant, meeting minutes, sticky notes, document summarizer, and tax deadlines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-canvas text-ink font-sans antialiased selection:bg-blue-700/15 selection:text-blue-900">
        {children}
      </body>
    </html>
  );
}
