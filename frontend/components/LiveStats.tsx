"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { TiltCard } from "@/components/TiltCard";
import { useStats } from "@/hooks/useStats";
import { formatDecimal, formatInt, formatUsd } from "@/lib/format";

interface StatCardProps {
  label: string;
  value: string | null;
  unit?: string;
  note: string;
  loading: boolean;
}

function StatCard({ label, value, unit, note, loading }: StatCardProps) {
  return (
    <TiltCard>
      <Card className="h-full gap-10 p-7 transition-colors duration-500 hover:border-[#242424]">
        <span className="eyebrow">{label}</span>
        <div>
          {loading ? (
            <Skeleton className="h-10 w-36" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="tabular text-[2rem] font-medium leading-none tracking-[-0.03em] md:text-[2.4rem]">
                {value ?? "—"}
              </span>
              {unit && value !== null && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
          )}
          <p className="mt-3 text-[13px] text-muted-foreground">{note}</p>
        </div>
      </Card>
    </TiltCard>
  );
}

export function LiveStats({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useStats();
  const loading = isLoading || !data;

  const cards: Omit<StatCardProps, "loading">[] = [
    {
      label: "NVDA Accumulated",
      value: data?.nvdaAccumulated != null ? formatDecimal(data.nvdaAccumulated) : null,
      unit: "NVDA",
      note: "Bought by fees, sent to the vault",
    },
    {
      label: "Total Holders",
      value: data?.totalHolders != null ? formatInt(data.totalHolders) : null,
      note: "Wallets holding NVID",
    },
    {
      label: "Treasury Value",
      value: data?.treasuryValueUsd != null ? formatUsd(data.treasuryValueUsd) : null,
      note: "0.5% of every trade",
    },
    {
      label: "Total Rewards Paid",
      value: data?.totalRewardsPaid != null ? formatDecimal(data.totalRewardsPaid) : null,
      unit: "NVDA",
      note: "Claimed by holders so far",
    },
  ];

  const sourceBadge =
    data?.source === "onchain" ? (
      <Badge variant="accent">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-accent" />
        On-chain
      </Badge>
    ) : (
      <Badge>Preview data</Badge>
    );

  return (
    <section id="stats" className={compact ? "" : "mx-auto max-w-7xl px-6 py-24 lg:px-10"}>
      {!compact && (
        <FadeUp className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="eyebrow">Live</span>
            <h2 className="display mt-3 text-3xl md:text-5xl">The vault, in numbers.</h2>
          </div>
          {!loading && sourceBadge}
        </FadeUp>
      )}

      <Stagger className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${compact ? "" : "mt-12"}`}>
        {cards.map((card) => (
          <StaggerItem key={card.label} className="h-full">
            <StatCard {...card} loading={loading} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
