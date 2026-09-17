import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Naturallyaspiratedlearn", template: "%s · Naturallyaspiratedlearn" },
  description: "Why have a turbochargee when you are naturally aspirated",
  applicationName: "Naturallyaspiratedlearn",
  keywords: ["open source study app", "AI notes", "flashcards", "OpenRouter", "quiz generator"],
  authors: [{ name: "Naturallyaspiratedlearn contributors" }],
  openGraph: {
    title: "Naturallyaspiratedlearn",
    description: "Why have a turbochargee when you are naturally aspirated",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Naturallyaspiratedlearn", description: "Why have a turbochargee when you are naturally aspirated" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className={`${sans.variable} ${mono.variable}`}><body>{children}</body></html>;
}
