import Link from "next/link";
import { BrainCircuit, LogIn, TerminalSquare, UserCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

const navItems = [
  { href: "/tools", label: "Tools" },
  { href: "/assistant/cyber-ai", label: "Cyber AI" },
  { href: "/store", label: "Store" },
  { href: "/guides/how-to-write-a-bug-bounty-report", label: "Guides" },
];

export async function SiteShell({
  children,
  hideFooter = false,
  wide = false,
}: {
  children: React.ReactNode;
  hideFooter?: boolean;
  wide?: boolean;
}) {
  const user = await getCurrentUser();

  return (
    <div className="page-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className={`container topbar-inner ${wide ? "container-wide" : ""}`}>
          <Link className="brand" href="/" aria-label="CyberTools Hub home">
            <span className="brand-mark">
              <TerminalSquare size={20} />
            </span>
            <span>CyberTools Hub</span>
          </Link>
          <nav className="nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.href.includes("cyber-ai") ? <BrainCircuit size={15} /> : null}
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link className="nav-pill" href="/account">
                  <UserCircle size={15} />
                  Account
                </Link>
                <Link className="nav-pill" href="/logout">
                  Logout
                </Link>
              </>
            ) : (
              <Link className="nav-pill" href="/login">
                <LogIn size={15} />
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      {!hideFooter ? (
        <footer className="footer">
          <div className="container footer-grid">
            <p>
              CyberTools Hub is built for authorized security research. Do not use these workflows against systems where
              you do not have permission.
            </p>
            <div className="footer-links">
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
