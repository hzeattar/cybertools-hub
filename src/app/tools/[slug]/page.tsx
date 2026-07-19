import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTool, tools } from "@/data/catalog";
import { SiteShell } from "@/components/SiteShell";
import { ToolConsole } from "@/components/ToolConsole";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: tool.name,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: `${tool.name} - CyberTools Hub`,
      description: tool.summary,
      url: `/tools/${tool.slug}`,
    },
  };
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: tool.description,
  };

  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <p className="eyebrow">{tool.category} tool</p>
          <h1 className="hero-title" style={{ fontSize: 48 }}>
            {tool.name}
          </h1>
          <p className="hero-copy">{tool.description}</p>
          <div className="button-row" style={{ marginBottom: 22, marginTop: 18 }}>
            <Link className="btn secondary" href="/store/professional-vulnerability-report-templates">
              Pair with report templates
            </Link>
            <Link className="btn secondary" href="/assistant/scope-guard">
              Check scope first
            </Link>
          </div>
          <ToolConsole slug={tool.slug} name={tool.name} />
        </div>
      </section>
      <section className="section alt-band">
        <div className="container">
          <div className="grid grid-3">
            {tool.faq.map((item) => (
              <article className="card guide-card" key={item.question}>
                <h3>{item.question}</h3>
                <p className="muted">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </SiteShell>
  );
}
