import Link from "next/link";
import { EyeMark } from "@/components/EyeMark";
import { WalletButton } from "@/components/WalletButton";
import { navLinks, siteConfig } from "@/lib/site";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.035em] text-foreground ${className}`}>
      <EyeMark className="size-[18px] text-accent" />
      {siteConfig.name}
    </span>
  );
}

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.04] bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-20 lg:px-10">
        <Link href="/" aria-label={`${siteConfig.name} home`} className="flex items-center">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <WalletButton size="sm" />
      </div>
    </header>
  );
}
