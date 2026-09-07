import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeUp, ScaleIn } from "@/components/motion";
import { HeroObject } from "@/components/three/HeroObject";
import { VaultCaption } from "@/components/VaultCaption";
import { siteConfig } from "@/lib/site";

export function Hero() {
  const buyHref = siteConfig.buyUrl ?? "#how-it-works";
  const external = siteConfig.buyUrl !== null;

  return (
    <section className="relative isolate flex min-h-svh items-center overflow-hidden">
      {/* Ambient glow — the only decorative use of the accent, kept far below 20% opacity. */}
      <div
        aria-hidden
        className="ambient animate-drift pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[min(120vw,1100px)] -translate-x-1/2 -translate-y-1/2 lg:left-[70%]"
      />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-24 pt-32 lg:grid-cols-[1fr_1fr] lg:gap-6 lg:px-10 lg:pb-28 lg:pt-36">
        <div className="max-w-2xl">
          <FadeUp>
            <Badge variant="outline">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              {siteConfig.chainName} · RWA rewards
            </Badge>
          </FadeUp>

          <FadeUp delay={0.08}>
            <h1 className="display mt-8 text-[clamp(2.5rem,5.4vw,4.6rem)]">
              {siteConfig.headline[0]}
              <br />
              {siteConfig.headline[1].replace(/\.$/, "")}
              <span className="text-accent">.</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.16}>
            <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-muted-foreground md:text-lg">
              {siteConfig.subline}
            </p>
          </FadeUp>

          <FadeUp delay={0.24}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a href={buyHref} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                  Buy NVID
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/rewards">
                  View Rewards
                  <ArrowRight strokeWidth={1.5} />
                </Link>
              </Button>
            </div>
          </FadeUp>

          <FadeUp delay={0.32}>
            <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
              <div>
                <dt className="eyebrow">Fee</dt>
                <dd className="mt-2 text-sm">2% per trade</dd>
              </div>
              <div>
                <dt className="eyebrow">Rewards</dt>
                <dd className="mt-2 text-sm">1% buys NVDA</dd>
              </div>
              <div>
                <dt className="eyebrow">Lock-up</dt>
                <dd className="mt-2 text-sm">None</dd>
              </div>
            </dl>
          </FadeUp>
        </div>

        <ScaleIn delay={0.2} className="relative flex flex-col gap-2">
          <HeroObject />
          <VaultCaption />
        </ScaleIn>
      </div>
    </section>
  );
}
