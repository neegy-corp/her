import Link from "next/link";
export function AcpNav({ active }: { active?: "create" | "tokens" | "developer" }) {
  return (
    <header className="lp-header">
      <Link className="lp-logo" href="/" aria-label="ACP home">
        acp<span>®</span>
        <small>ARTIFICIAL CHARACTER PROTOCOL</small>
      </Link>
      <nav aria-label="Main navigation">
        <Link
          href="/create"
          aria-current={active === "create" ? "page" : undefined}
        >
          Create
        </Link>
        <Link
          href="/tokens"
          aria-current={active === "tokens" ? "page" : undefined}
        >
          Tokens
        </Link>
        <Link href="/collective">HER collective ↗</Link>
        <Link href="/developer" aria-current={active === "developer" ? "page" : undefined}>Developer</Link>
      </nav>
      <Link className="lp-primary acp-nav-cta" href="/create">
        Open studio ↗
      </Link>
    </header>
  );
}
export function AcpFooter() {
  return (
    <footer className="lp-footer">
      <Link className="lp-logo" href="/">
        acp<span>®</span>
      </Link>
      <p>Artificial character. Real creative control.</p>
      <Link href="/tokens">Explore tokens ↗</Link>
      <span>ARTIFICIAL CHARACTER PROTOCOL</span>
    </footer>
  );
}
