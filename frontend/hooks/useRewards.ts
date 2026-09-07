"use client";

import { useCallback, useEffect, useMemo } from "react";
import { erc20Abi, type BaseError } from "viem";
import { useAccount, useChainId, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { nvidTokenAbi, rewardVaultAbi } from "@/lib/abi";
import { getAddresses } from "@/lib/contracts";

export type ClaimStatus = "idle" | "signing" | "confirming" | "success" | "error";

type ReadResult = { status: "success"; result: unknown } | { status: "failure"; error: Error } | undefined;

function value<T>(entry: ReadResult): T | undefined {
  return entry?.status === "success" ? (entry.result as T) : undefined;
}

function describeError(error: unknown): string {
  if (!error) return "Something went wrong.";
  const base = error as Partial<BaseError> & { message?: string };
  const message = base.shortMessage ?? base.message ?? "Something went wrong.";
  if (/user rejected|denied/i.test(message)) return "Transaction rejected in your wallet.";
  if (/NothingToClaim/.test(message)) return "Nothing to claim yet.";
  return message.split("\n")[0];
}

/**
 * Everything the rewards dashboard needs: balances, pending NVDA, claim
 * history and a `claim()` action with a small state machine on top.
 *
 *   idle → signing → confirming → success
 *                 ↘ error   ↙
 */
export function useRewards() {
  const { address, isConnected, chain } = useAccount();
  const configuredChainId = useChainId();
  const activeChainId = chain?.id ?? configuredChainId;

  const addresses = useMemo(() => getAddresses(activeChainId), [activeChainId]);
  const wrongNetwork = isConnected && chain === undefined;
  const enabled = Boolean(address && addresses && !wrongNetwork);

  const reads = useReadContracts({
    allowFailure: true,
    contracts:
      addresses && address
        ? [
            { address: addresses.token, abi: nvidTokenAbi, functionName: "balanceOf", args: [address] },
            { address: addresses.vault, abi: rewardVaultAbi, functionName: "pendingRewards", args: [address] },
            { address: addresses.vault, abi: rewardVaultAbi, functionName: "claimedBy", args: [address] },
            { address: addresses.nvda, abi: erc20Abi, functionName: "decimals" },
            { address: addresses.token, abi: nvidTokenAbi, functionName: "decimals" },
          ]
        : [],
    query: { enabled, refetchInterval: 12_000 },
  });

  const data = (reads.data ?? []) as ReadResult[];
  const balance = value<bigint>(data[0]);
  const pending = value<bigint>(data[1]);
  const claimed = value<bigint>(data[2]);
  const nvdaDecimals = value<number>(data[3]) ?? 18;
  const nvidDecimals = value<number>(data[4]) ?? 18;

  const {
    writeContractAsync,
    data: txHash,
    error: writeError,
    isPending: isSigning,
    reset: resetWrite,
  } = useWriteContract();

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  const reverted = receipt.data?.status === "reverted";

  const status: ClaimStatus = isSigning
    ? "signing"
    : txHash && receipt.isLoading
      ? "confirming"
      : txHash && receipt.isSuccess && !reverted
        ? "success"
        : writeError || receipt.isError || reverted
          ? "error"
          : "idle";

  const error = status === "error" ? describeError(writeError ?? receipt.error ?? (reverted ? new Error("Transaction reverted.") : null)) : null;

  const refetch = reads.refetch;
  useEffect(() => {
    if (status === "success") void refetch();
  }, [status, refetch]);

  const claim = useCallback(async () => {
    if (!addresses || !address) return;
    try {
      await writeContractAsync({
        address: addresses.vault,
        abi: rewardVaultAbi,
        functionName: "claim",
        chainId: activeChainId,
      });
    } catch {
      // Surfaced through `status === "error"`; nothing to rethrow.
    }
  }, [addresses, address, activeChainId, writeContractAsync]);

  return {
    address,
    isConnected,
    chain,
    wrongNetwork,
    isDeployed: addresses !== null,
    addresses,
    isLoading: enabled && reads.isLoading,
    isRefetching: reads.isRefetching,
    balance,
    pending,
    claimed,
    nvdaDecimals,
    nvidDecimals,
    canClaim: enabled && pending !== undefined && pending > 0n && status !== "signing" && status !== "confirming",
    claim,
    status,
    error,
    txHash,
    reset: resetWrite,
    refetch,
  };
}
