import type { Metadata } from "next";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

// The reading face: a screen serif with an optical-size axis, for the landing page's running text.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Plumbline · brand checks before you publish", template: "%s · Plumbline" },
  description:
    "Plumbline checks content against your brand guidelines and approved facts before it ships. Every finding cites its source and suggests a fix that keeps your message.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${newsreader.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
