"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/hooks/useStats";
import { formatDecimal } from "@/lib/format";
import { siteConfig } from "@/lib/site";

/**
 * The vault, drawn: a thin rotating arc over a hairline ring, with the NVDA
 * balance it holds in the middle. No imagery, no gradients beyond the arc.
 */
export function VaultRing() {
  const { data } = useStats();
  const value = data?.nvdaAccumulated ?? null;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px] select-none">
      <div
        aria-hidden
        className="animate-pulse-soft absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(118,185,0,0.2),transparent_64%)]"
      />
      <div aria-hidden className="absolute inset-[4%] rounded-full border border-border" />
      <div aria-hidden className="vault-arc animate-spin-slow absolute inset-[4%]" />
      <div
        aria-hidden
        className="absolute inset-[17%] rounded-full border border-border/70 bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      />
      <div aria-hidden className="absolute inset-[30%] rounded-full border border-border/40" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-10 text-center">
        <span className="eyebrow">Vault · NVDA accumulated</span>
        {value === null ? (
          <Skeleton className="mt-1 h-12 w-44 rounded-lg" />
        ) : (
          <span className="tabular display text-[clamp(2.25rem,5vw,3.5rem)]">{formatDecimal(value, 2)}</span>
        )}
        <span className="text-[13px] text-muted-foreground">{siteConfig.rewardAsset.name}</span>
        {data?.source === "mock" && (
          <span className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">Preview data</span>
        )}
      </div>
    </div>
  );
}
