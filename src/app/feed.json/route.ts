import { NextResponse } from "next/server";
import { guides } from "@/data/catalog";

export function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cybertools-hub.com";
  return NextResponse.json({
    title: "CyberTools Hub Guides",
    home_page_url: siteUrl,
    feed_url: `${siteUrl}/feed.json`,
    items: guides.map((guide) => ({
      id: guide.slug,
      url: `${siteUrl}/guides/${guide.slug}`,
      title: guide.title,
      summary: guide.summary,
      language: guide.language,
    })),
  });
}
