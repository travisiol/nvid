import Link from "next/link";
import { Wordmark } from "@/components/Navbar";
import { navLinks, siteConfig } from "@/lib/site";

export function Footer() {
  const social = [
    siteConfig.x ? { href: siteConfig.x, label: "X" } : null,
    siteConfig.telegram ? { href: siteConfig.telegram, label: "Telegram" } : null,
  ].filter((s): s is { href: string; label: string } => s !== null);

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-14 md:flex-row md:items-end md:justify-between lg:px-10">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{siteConfig.tagline}</p>
        </div>

        <div className="flex flex-col gap-4 md:items-end">
          <nav aria-label="Footer" className="flex flex-wrap gap-6 text-[13px] text-muted-foreground">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors duration-300 hover:text-foreground">
                {link.label}
              </Link>
            ))}
            {social.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors duration-300 hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </nav>
          <p className="text-[13px] text-muted-foreground">
            {siteConfig.name} © {siteConfig.year}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-10 lg:px-10">
        <p className="max-w-3xl text-[12px] leading-relaxed text-muted-foreground/70">
          {siteConfig.name} is an independent community token. It is not affiliated with, endorsed by, or connected
          to NVIDIA Corporation or Robinhood Markets, Inc. NVDA Stock Token is issued by third parties on Robinhood
          Chain; rewards depend on trading volume and are not guaranteed. Nothing on this site is financial advice.
        </p>
      </div>
    </footer>
  );
}
