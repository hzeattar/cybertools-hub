import Link from "next/link";
import { featuredTools, guides, products, tools } from "@/data/catalog";
import { SiteShell } from "@/components/SiteShell";

export default function Home() {
  return (
    <SiteShell>
      <section className="hero-band">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Authorized security research workspace</p>
            <h1 className="hero-title">Free security tools with USDT-ready digital kits.</h1>
            <p className="hero-copy">
              Decode tokens, analyze browser security controls, plan bug bounty scope safely, and buy report templates
              through a TRON USDT checkout that verifies payments server-side.
            </p>
            <div className="metric-strip" aria-label="Platform metrics">
              <div className="metric">
                <strong>{tools.length}</strong>
                <span>free tools</span>
              </div>
              <div className="metric">
                <strong>{products.length}</strong>
                <span>paid kits</span>
              </div>
              <div className="metric">
                <strong>45m</strong>
                <span>payment window</span>
              </div>
            </div>
            <div className="button-row" style={{ marginTop: 24 }}>
              <Link className="btn primary" href="/tools">
                Open tools
              </Link>
              <Link className="btn secondary" href="/store">
                View store
              </Link>
            </div>
          </div>
          <div className="terminal-panel" aria-label="Live workflow preview">
            <div className="terminal-row">
              <strong>Scope Guard</strong>
              <span>policy to checklist</span>
            </div>
            <div className="terminal-row">
              <strong>Header Analyzer</strong>
              <span>risk-ranked output</span>
            </div>
            <div className="terminal-row">
              <strong>Report Builder</strong>
              <span>redacted evidence</span>
            </div>
            <div className="terminal-row">
              <strong>USDT Checkout</strong>
              <span>unique amount match</span>
            </div>
            <div className="terminal-row">
              <strong>Downloads</strong>
              <span>signed token delivery</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Tool console</h2>
              <p>Every tool is scoped for authorized testing and fast reporting workflows.</p>
            </div>
            <Link className="btn secondary" href="/tools">
              All tools
            </Link>
          </div>
          <div className="grid grid-4">
            {featuredTools().map((tool) => (
              <Link className="card tool-card" href={`/tools/${tool.slug}`} key={tool.slug}>
                <div className="tag-row">
                  <span className="tag">{tool.category}</span>
                </div>
                <h3>{tool.name}</h3>
                <p className="muted">{tool.summary}</p>
                <span className="btn secondary">Open tool</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "#eef4f8" }}>
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Digital kits</h2>
              <p>Downloadable templates and worksheets delivered after verified USDT TRC20 payment.</p>
            </div>
            <Link className="btn secondary" href="/store">
              Store
            </Link>
          </div>
          <div className="grid grid-4">
            {products.map((product) => (
              <Link className="card product-card" href={`/store/${product.slug}`} key={product.slug}>
                <span className="price">{product.priceUsdt.toFixed(2)} USDT</span>
                <h3>{product.name}</h3>
                <p className="muted">{product.summary}</p>
                <span className="btn secondary">See product</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Research guides</h2>
              <p>SEO-ready guidance pages that connect free tools to paid workflow packs.</p>
            </div>
          </div>
          <div className="grid grid-3">
            {guides.slice(0, 3).map((guide) => (
              <Link className="card guide-card" href={`/guides/${guide.slug}`} key={guide.slug}>
                <span className={`tag ${guide.language === "ar" ? "teal" : "coral"}`}>{guide.language}</span>
                <h3>{guide.title}</h3>
                <p className="muted">{guide.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
