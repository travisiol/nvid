import { Card } from "@/components/ui/card";
import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { SPLIT_COLORS } from "@/components/FeeDonut";
import { TokenomicsRing } from "@/components/three/TokenomicsRing";
import { formatInt } from "@/lib/format";
import { tokenomics } from "@/lib/site";

export function Tokenomics() {
  return (
    <section id="tokenomics" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 lg:px-10">
      <FadeUp>
        <span className="eyebrow">Tokenomics</span>
        <h2 className="display mt-3 max-w-2xl text-3xl md:text-5xl">A 2% fee. Half of it becomes NVIDIA.</h2>
      </FadeUp>

      <div className="mt-14 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Stagger className="grid gap-4">
          <StaggerItem>
            <Card className="gap-8">
              <span className="eyebrow">Supply</span>
              <div>
                <div className="tabular text-[2.4rem] font-medium leading-none tracking-[-0.03em] md:text-5xl">
                  {formatInt(tokenomics.supply)}
                </div>
                <p className="mt-4 text-[13px] text-muted-foreground">
                  NVID. Fixed at deployment — there is no mint function.
                </p>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="gap-8">
              <span className="eyebrow">Fees</span>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="tabular text-[2.4rem] font-medium leading-none tracking-[-0.03em]">
                    {tokenomics.fees.buyBps / 100}%
                  </div>
                  <p className="mt-3 text-[13px] text-muted-foreground">On every buy</p>
                </div>
                <div>
                  <div className="tabular text-[2.4rem] font-medium leading-none tracking-[-0.03em]">
                    {tokenomics.fees.sellBps / 100}%
                  </div>
                  <p className="mt-3 text-[13px] text-muted-foreground">On every sell</p>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground">
                Wallet-to-wallet transfers are free. Fees are capped at 5% in the contract.
              </p>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="gap-6">
              <span className="eyebrow">Where each fee goes</span>
              <ul className="flex flex-col divide-y divide-border">
                {tokenomics.split.map((item) => (
                  <li key={item.key} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    <span
                      aria-hidden
                      className="mt-1.5 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: SPLIT_COLORS[item.tone] }}
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[15px] font-medium">{item.label}</span>
                        <span className="tabular text-[15px]">
                          {item.pctOfVolume}%{" "}
                          <span className="text-muted-foreground">of volume</span>
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </StaggerItem>
        </Stagger>

        <FadeUp delay={0.15} className="h-full">
          <Card className="h-full items-center justify-center p-10 lg:p-14">
            <TokenomicsRing />
          </Card>
        </FadeUp>
      </div>
    </section>
  );
}
