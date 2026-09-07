"use client";

import { useQuery } from "@tanstack/react-query";
import { statsProvider, type LiveStats } from "@/lib/data/stats";

/** Live stats, polled every 15s. Swap the provider in lib/data/stats.ts; nothing here changes. */
export function useStats() {
  return useQuery<LiveStats>({
    queryKey: ["live-stats", statsProvider.source],
    queryFn: () => statsProvider.getStats(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
