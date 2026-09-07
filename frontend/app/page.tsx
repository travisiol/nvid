import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/motion";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { LiveStats } from "@/components/LiveStats";
import { RewardsDashboard } from "@/components/RewardsDashboard";
import { Tokenomics } from "@/components/Tokenomics";
import { siteConfig } from "@/lib/site";

export default function HomePage() {
  const buyHref = siteConfig.buyUrl ?? "#how-it-works";
  const external = siteConfig.buyUrl !== null;

  return (
    <>
      <Hero />

      <div aria-hidden className="hairline mx-auto max-w-7xl" />

      <LiveStats />

      <HowItWorks />

      <section id="rewards" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 lg:px-10">
        <FadeUp>
          <span className="eyebrow">Rewards</span>
          <h2 className="display mt-3 max-w-2xl text-3xl md:text-5xl">Your share of the vault.</h2>
        </FadeUp>
        <FadeUp delay={0.1} className="mt-12">
          <RewardsDashboard />
        </FadeUp>
      </section>

      <Tokenomics />

      <section className="mx-auto max-w-7xl px-6 pb-32 pt-8 lg:px-10">
        <FadeUp className="surface relative isolate overflow-hidden px-8 py-20 text-center lg:py-28">
          <div
            aria-hidden
            className="ambient pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[720px] -translate-x-1/2 -translate-y-1/2 opacity-80"
          />
          <h2 className="display text-4xl md:text-6xl">
            Buy the token.
            <br />
            Earn NVIDIA<span className="text-accent">.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground md:text-base">
            Every trade contributes to the vault. Hold NVID and claim your share of NVDA Stock Token whenever you like.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href={buyHref} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                Buy NVID
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/rewards">View Rewards</Link>
            </Button>
          </div>
        </FadeUp>
      </section>
    </>
  );
}
