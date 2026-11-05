import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Plumbline · brand checks before you publish", template: "%s · Plumbline" },
  description:
    "Plumbline checks content against your brand guidelines and approved facts before it ships. Every finding cites its source and suggests a fix that keeps your message.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
