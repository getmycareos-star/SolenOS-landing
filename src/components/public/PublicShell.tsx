import Link from "next/link";
import { SolenosWordmark } from "@/components/brand";
import { TRUST_NAV, TRUST_FOOTER_LINKS } from "@/lib/trust-content";
import { BRAND_TAGLINE } from "@/lib/brand";
import { EMERGENCY_BOUNDARY } from "@/lib/early-access-trust";

export function PublicNav({ activeHref }: { activeHref?: string }) {
  return (
    <header className="public-nav">
      <div className="public-nav-inner">
        <Link href="/" className="public-nav-brand" aria-label="solenos home">
          <SolenosWordmark size="md" as="span" />
        </Link>
        <nav className="public-nav-links" aria-label="Primary">
          {TRUST_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                activeHref === item.href ? "public-nav-link is-active" : "public-nav-link"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/workspace?enter=1" className="public-nav-product">
          Living Care Record
        </Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-brand">
          <SolenosWordmark size="sm" as="span" />
          <p>{BRAND_TAGLINE}</p>
          <p className="public-footer-copy">© SolenOS</p>
        </div>
        <nav className="public-footer-links" aria-label="Footer">
          {TRUST_FOOTER_LINKS.map((item) => (
            <Link key={item.href + item.label} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/workspace?enter=1">Living Care Record</Link>
        </nav>
        <p className="public-footer-emergency" role="note">
          {EMERGENCY_BOUNDARY}
        </p>
      </div>
    </footer>
  );
}

export function PublicShell({
  children,
  activeHref,
}: {
  children: React.ReactNode;
  activeHref?: string;
}) {
  return (
    <div className="public-shell">
      <PublicNav activeHref={activeHref} />
      <main className="public-main">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function PublicCtaGroup({
  primaryHref = "/workspace?enter=1",
  primaryLabel = "Start Adding Care Information",
  secondaryHref = "/why-solenos",
  secondaryLabel = "Why solenos exists",
}: {
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="public-cta-group">
      <Link href={primaryHref} className="public-cta-primary">
        {primaryLabel}
      </Link>
      <Link href={secondaryHref} className="public-cta-secondary">
        {secondaryLabel}
      </Link>
    </div>
  );
}
