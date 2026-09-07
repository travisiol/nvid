import { isAddress, type Address } from "viem";
import { deployments } from "./abi";

export interface ContractAddresses {
  token: Address;
  vault: Address;
  collector: Address;
  treasury: Address;
  nvda: Address;
}

function envAddress(name: string): Address | null {
  const value = process.env[name]?.trim();
  return value && isAddress(value) ? (value as Address) : null;
}

/**
 * Resolution order: NEXT_PUBLIC_* overrides → lib/abi/deployments.ts (written
 * by the deploy script) → null. Null means "not deployed on this chain" and
 * every contract-dependent surface falls back to its preview state.
 */
export function getAddresses(chainId: number | undefined): ContractAddresses | null {
  const env = {
    token: envAddress("NEXT_PUBLIC_NVID_TOKEN_ADDRESS"),
    vault: envAddress("NEXT_PUBLIC_REWARD_VAULT_ADDRESS"),
    collector: envAddress("NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS"),
    treasury: envAddress("NEXT_PUBLIC_TREASURY_ADDRESS"),
    nvda: envAddress("NEXT_PUBLIC_NVDA_TOKEN_ADDRESS"),
  };

  const deployment = chainId !== undefined ? deployments[String(chainId)] : undefined;

  const resolved = {
    token: env.token ?? deployment?.contracts.NVIDToken ?? null,
    vault: env.vault ?? deployment?.contracts.RewardVault ?? null,
    collector: env.collector ?? deployment?.contracts.FeeCollector ?? null,
    treasury: env.treasury ?? deployment?.contracts.Treasury ?? null,
    nvda: env.nvda ?? deployment?.nvdaToken ?? null,
  };

  if (!resolved.token || !resolved.vault || !resolved.collector || !resolved.treasury || !resolved.nvda) {
    return null;
  }
  return resolved as ContractAddresses;
}

export function isDeployed(chainId: number | undefined): boolean {
  return getAddresses(chainId) !== null;
}
