import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cybertools-hub.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CyberTools Hub - Free Security Tools and Bug Bounty Kits",
    template: "%s | CyberTools Hub",
  },
  description:
    "A focused toolkit for authorized security testing, bug bounty reporting, and downloadable security research templates with USDT TRC20 checkout.",
  applicationName: "CyberTools Hub",
  keywords: [
    "bug bounty tools",
    "security headers analyzer",
    "JWT decoder",
    "CSP analyzer",
    "CVSS calculator",
    "USDT security templates",
  ],
  authors: [{ name: "CyberTools Hub" }],
  openGraph: {
    title: "CyberTools Hub",
    description:
      "Free browser-first security tools plus paid bug bounty templates delivered after verified USDT TRC20 payment.",
    url: siteUrl,
    siteName: "CyberTools Hub",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberTools Hub",
    description:
      "Security tools, report builders, and bug bounty digital kits in one focused workspace.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
