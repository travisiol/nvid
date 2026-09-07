import { formatUnits } from "viem";

const number = (options: Intl.NumberFormatOptions) => new Intl.NumberFormat("en-US", options);

const fmtInt = number({ maximumFractionDigits: 0 });
const fmtCompact = number({ notation: "compact", maximumFractionDigits: 1 });
const fmtUsd = number({ style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatInt(value: number): string {
  return fmtInt.format(value);
}

export function formatCompact(value: number): string {
  return fmtCompact.format(value);
}

export function formatUsd(value: number): string {
  return fmtUsd.format(value);
}

/** Fixed decimals with thousands separators, e.g. 1,284.52 */
export function formatDecimal(value: number, decimals = 2): string {
  return number({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

/**
 * Token amount from base units. Shows more precision for small amounts so a
 * pending reward of 0.0042 NVDA never rounds to zero.
 */
export function formatTokenAmount(value: bigint | undefined, decimals = 18, maxFractionDigits?: number): string {
  if (value === undefined) return "—";
  const asNumber = Number(formatUnits(value, decimals));
  if (asNumber === 0) return "0";
  const digits =
    maxFractionDigits ?? (asNumber >= 1000 ? 0 : asNumber >= 1 ? 2 : asNumber >= 0.01 ? 4 : 6);
  return number({ maximumFractionDigits: digits }).format(asNumber);
}

export function shortAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
