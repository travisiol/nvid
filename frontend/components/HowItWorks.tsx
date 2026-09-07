import type { ReactNode } from "react";
import { HandCoins, Wallet } from "lucide-react";
import { EyeMark } from "@/components/EyeMark";
import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { TiltCard } from "@/components/TiltCard";

interface Step {
  n: string;
  title: string;
  body: string;
  icon: ReactNode;
}

const steps: Step[] = [
  {
    n: "01",
    title: "Buy NVID",
    body: "Swap into NVID on Robinhood Chain. A 2% fee applies to every buy and every sell. That fee is the engine.",
    icon: <Wallet className="size-5 text-muted-foreground" strokeWidth={1.25} aria-hidden />,
  },
  {
    n: "02",
    title: "Fees buy NVDA",
    body: "Half of each fee is swapped into NVDA Stock Token and deposited in the reward vault. The rest deepens liquidity and funds the treasury.",
    icon: <EyeMark className="size-5 text-accent" />,
  },
  {
    n: "03",
    title: "Claim rewards",
    body: "Your share accrues automatically, in proportion to your balance. No staking, no lock-up. Claim NVDA whenever you like.",
    icon: <HandCoins className="size-5 text-muted-foreground" strokeWidth={1.25} aria-hidden />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 lg:px-10">
      <FadeUp>
        <span className="eyebrow">How it works</span>
        <h2 className="display mt-3 max-w-2xl text-3xl md:text-5xl">Three steps between a trade and a share of NVIDIA.</h2>
      </FadeUp>

      <Stagger className="mt-14 grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <StaggerItem key={step.n} className="h-full">
            <TiltCard>
              <article className="surface flex h-full min-h-[320px] flex-col gap-12 p-8 lg:p-10">
                <div className="flex items-center justify-between">
                  <span className="tabular text-sm text-muted-foreground">{step.n}</span>
                  {step.icon}
                </div>
                <div className="mt-auto">
                  <h3 className="text-xl font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </article>
            </TiltCard>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
