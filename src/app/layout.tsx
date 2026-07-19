import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cybertools-hub.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CyberTools Hub - Cyber AI and Security Research Tools",
    template: "%s | CyberTools Hub",
  },
  description:
    "A dark security research workspace with free cyber tools, multi-provider Cyber AI Analyst, account-based USDT TRC20 checkout, and downloadable bug bounty kits.",
  applicationName: "CyberTools Hub",
  keywords: [
    "bug bounty tools",
    "security headers analyzer",
    "JWT decoder",
    "CSP analyzer",
    "CVSS calculator",
    "cyber security AI assistant",
    "OpenAPI security analyzer",
    "USDT security templates",
  ],
  authors: [{ name: "CyberTools Hub" }],
  openGraph: {
    title: "CyberTools Hub",
    description:
      "Free security tools, defensive multi-provider Cyber AI, and paid bug bounty templates delivered after verified USDT TRC20 payment.",
    url: siteUrl,
    siteName: "CyberTools Hub",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberTools Hub",
    description:
      "Security tools, Cyber AI, report builders, and bug bounty digital kits in one focused workspace.",
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
