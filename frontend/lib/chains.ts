import { defineChain, type Chain } from "viem";
import { hardhat } from "viem/chains";

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL?.trim();

/**
 * Robinhood Chain — Arbitrum Orbit L2. Chain id 4663 (0x1237).
 * RPC and explorer are env-driven so a testnet or a private node can be
 * swapped in without touching code.
 */
export const robinhoodChain: Chain = defineChain({
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 4663),
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com"],
    },
  },
  ...(explorerUrl
    ? { blockExplorers: { default: { name: "Robinhood Chain Explorer", url: explorerUrl } } }
    : {}),
});

export const enableLocalChain = process.env.NEXT_PUBLIC_ENABLE_LOCAL_CHAIN === "true";

export const supportedChains = (enableLocalChain ? [robinhoodChain, hardhat] : [robinhoodChain]) as [Chain, ...Chain[]];

export function explorerTxUrl(chain: Chain | undefined, hash: string): string | null {
  const base = chain?.blockExplorers?.default?.url;
  return base ? `${base.replace(/\/$/, "")}/tx/${hash}` : null;
}

export function explorerAddressUrl(chain: Chain | undefined, address: string): string | null {
  const base = chain?.blockExplorers?.default?.url;
  return base ? `${base.replace(/\/$/, "")}/address/${address}` : null;
}
