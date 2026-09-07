import { Contract, JsonRpcProvider, formatUnits, type InterfaceAbi } from "ethers";
import { erc20Abi } from "viem";
import { rewardVaultAbi } from "@/lib/abi";
import { getAddresses, type ContractAddresses } from "@/lib/contracts";

/*
  Live stats data layer.

  The UI only ever talks to a `StatsProvider`. Today that is the mock
  provider; flipping NEXT_PUBLIC_STATS_SOURCE=onchain swaps in RPC reads with
  no UI change. Anything a contract cannot answer (holder count, USD price)
  is left `null` and rendered as an em dash rather than invented.
*/

export type StatsSource = "mock" | "onchain";

export interface LiveStats {
  /** NVDA Stock Token ever distributed to holders (claimed or not). */
  nvdaAccumulated: number | null;
  totalHolders: number | null;
  treasuryValueUsd: number | null;
  /** NVDA actually claimed by holders. */
  totalRewardsPaid: number | null;
  source: StatsSource;
  updatedAt: number;
}

export interface StatsProvider {
  readonly source: StatsSource;
  getStats(): Promise<LiveStats>;
}

// ─── Mock ────────────────────────────────────────────────────────────────────

/**
 * Deterministic preview numbers that grow slowly with wall-clock time, so the
 * page feels alive but two visitors see the same figures. Clearly labelled
 * "Preview" in the UI.
 */
const MOCK_EPOCH = Date.UTC(2026, 0, 1);

export const mockStatsProvider: StatsProvider = {
  source: "mock",
  async getStats() {
    const seconds = Math.max(0, (Date.now() - MOCK_EPOCH) / 1000);
    const nvdaAccumulated = 1180 + seconds * 0.0000062;
    return {
      nvdaAccumulated,
      totalHolders: 8412 + Math.floor(seconds / 3600 / 6),
      treasuryValueUsd: 412_930 + seconds * 0.0021,
      totalRewardsPaid: nvdaAccumulated * 0.74,
      source: "mock",
      updatedAt: Date.now(),
    };
  },
};

// ─── On-chain (ethers v6) ────────────────────────────────────────────────────

export interface OnchainStatsOptions {
  rpcUrl: string;
  addresses: ContractAddresses;
  /** USD price of one NVID, used to value the treasury's balance. */
  nvidPriceUsd?: number | null;
  /** Optional indexer returning `{ "count": number }`. */
  holdersEndpoint?: string | null;
}

export function createOnchainStatsProvider(options: OnchainStatsOptions): StatsProvider {
  const provider = new JsonRpcProvider(options.rpcUrl, undefined, { staticNetwork: true });
  const vault = new Contract(options.addresses.vault, rewardVaultAbi as unknown as InterfaceAbi, provider);
  const nvda = new Contract(options.addresses.nvda, erc20Abi as unknown as InterfaceAbi, provider);
  const nvid = new Contract(options.addresses.token, erc20Abi as unknown as InterfaceAbi, provider);

  let decimalsCache: { nvda: number; nvid: number } | null = null;

  async function decimals() {
    if (!decimalsCache) {
      const [nvdaDecimals, nvidDecimals] = await Promise.all([nvda.decimals(), nvid.decimals()]);
      decimalsCache = { nvda: Number(nvdaDecimals), nvid: Number(nvidDecimals) };
    }
    return decimalsCache;
  }

  async function holders(): Promise<number | null> {
    if (!options.holdersEndpoint) return null;
    try {
      const res = await fetch(options.holdersEndpoint, { cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as { count?: number };
      return typeof body.count === "number" ? body.count : null;
    } catch {
      return null;
    }
  }

  return {
    source: "onchain",
    async getStats() {
      const [{ nvda: nvdaDecimals, nvid: nvidDecimals }, distributed, claimed, treasuryBalance, holderCount] =
        await Promise.all([
          decimals(),
          vault.totalDistributed() as Promise<bigint>,
          vault.totalClaimed() as Promise<bigint>,
          nvid.balanceOf(options.addresses.treasury) as Promise<bigint>,
          holders(),
        ]);

      const treasuryNvid = Number(formatUnits(treasuryBalance, nvidDecimals));
      const price = options.nvidPriceUsd ?? null;

      return {
        nvdaAccumulated: Number(formatUnits(distributed, nvdaDecimals)),
        totalRewardsPaid: Number(formatUnits(claimed, nvdaDecimals)),
        treasuryValueUsd: price !== null ? treasuryNvid * price : null,
        totalHolders: holderCount,
        source: "onchain",
        updatedAt: Date.now(),
      };
    },
  };
}

// ─── Resolution ──────────────────────────────────────────────────────────────

function parsePrice(value: string | undefined): number | null {
  const n = Number.parseFloat(value ?? "");
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Picks the provider from env. Falls back to mock if on-chain is requested but nothing is deployed. */
export function resolveStatsProvider(): StatsProvider {
  const wanted = (process.env.NEXT_PUBLIC_STATS_SOURCE ?? "mock").trim() as StatsSource;
  if (wanted !== "onchain") return mockStatsProvider;

  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 4663);
  const addresses = getAddresses(chainId);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com";
  if (!addresses) return mockStatsProvider;

  return createOnchainStatsProvider({
    rpcUrl,
    addresses,
    nvidPriceUsd: parsePrice(process.env.NEXT_PUBLIC_NVID_PRICE_USD),
    holdersEndpoint: process.env.NEXT_PUBLIC_HOLDERS_ENDPOINT?.trim() || null,
  });
}

export const statsProvider: StatsProvider = resolveStatsProvider();
