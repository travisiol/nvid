"use client";

import { EyeMark } from "@/components/EyeMark";
import { useStats } from "@/hooks/useStats";
import { formatDecimal } from "@/lib/format";
import { siteConfig } from "@/lib/site";

/** One line under the hero object: what the vault holds right now. */
export function VaultCaption() {
  const { data } = useStats();
  const value = data?.nvdaAccumulated ?? null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
      <EyeMark className="size-3.5 text-accent" />
      <span className="eyebrow">Vault</span>
      <span className="tabular text-foreground">
        {value === null ? "—" : formatDecimal(value, 2)} {siteConfig.rewardAsset.symbol}
      </span>
      <span>{siteConfig.rewardAsset.name}</span>
      {data?.source === "mock" && <span className="eyebrow text-muted-foreground/60">Preview</span>}
    </div>
  );
}
