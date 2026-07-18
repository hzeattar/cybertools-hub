import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getGuide, guides } from "@/data/catalog";
import { SiteShell } from "@/components/SiteShell";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `/guides/${guide.slug}` },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    inLanguage: guide.language,
  };

  return (
    <SiteShell>
      <article className="section" dir={guide.language === "ar" ? "rtl" : "ltr"}>
        <div className="container" style={{ maxWidth: 820 }}>
          <p className="eyebrow">{guide.language === "ar" ? "دليل عربي" : "Guide"}</p>
          <h1 className="hero-title" style={{ fontSize: 48 }}>
            {guide.title}
          </h1>
          <p className="hero-copy">{guide.summary}</p>
          <div className="panel" style={{ marginTop: 24 }}>
            {guide.body.map((paragraph) => (
              <p key={paragraph} style={{ lineHeight: 1.85, marginBottom: 16 }}>
                {paragraph}
              </p>
            ))}
          </div>
          <div className="button-row" style={{ marginTop: 18 }}>
            <Link className="btn primary" href="/tools">
              Open tools
            </Link>
            <Link className="btn secondary" href="/store">
              View kits
            </Link>
          </div>
        </div>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </SiteShell>
  );
}
