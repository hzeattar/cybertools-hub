import Link from "next/link";

const navItems = [
  { href: "/tools", label: "Tools" },
  { href: "/store", label: "Store" },
  { href: "/assistant/report-builder", label: "Report Builder" },
  { href: "/assistant/scope-guard", label: "Scope Guard" },
  { href: "/guides/how-to-write-a-bug-bounty-report", label: "Guides" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link className="brand" href="/" aria-label="CyberTools Hub home">
            <span className="brand-mark">CH</span>
            <span>CyberTools Hub</span>
          </Link>
          <nav className="nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="nav-pill" href="/admin">
              Admin
            </Link>
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="footer">
        <div className="container">
          <p>
            CyberTools Hub is built for authorized security research. Do not use these workflows against systems where
            you do not have permission.
          </p>
        </div>
      </footer>
    </div>
  );
}
