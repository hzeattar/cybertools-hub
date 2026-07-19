import type { MetadataRoute } from "next";
import { guides, products, tools } from "@/data/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cybertools-hub.com";
  const routes = [
    "",
    "/tools",
    "/store",
    "/assistant/cyber-ai",
    "/assistant/report-builder",
    "/assistant/scope-guard",
    "/legal/privacy",
    "/legal/terms",
    "/contact",
    ...tools.map((tool) => `/tools/${tool.slug}`),
    ...products.map((product) => `/store/${product.slug}`),
    ...guides.map((guide) => `/guides/${guide.slug}`),
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route.includes("/guides/") ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.startsWith("/tools") ? 0.9 : 0.7,
  }));
}
