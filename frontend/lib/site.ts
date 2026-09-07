function envOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export const siteConfig = {
  name: "NVID",
  ticker: "$NVID",
  tagline: "Buy the token. Earn NVIDIA.",
  headline: ["BUY THE TOKEN.", "EARN NVIDIA."] as const,
  subline: "Every trade contributes to a vault that accumulates tokenized NVIDIA rewards for holders.",
  description:
    "NVID is a premium memecoin on Robinhood Chain. A 2% fee on every trade buys NVDA Stock Token into a vault that pays holders, pro rata, with no staking and no lock-up.",
  url: envOrNull(process.env.NEXT_PUBLIC_SITE_URL) ?? "https://nvid.example",
  buyUrl: envOrNull(process.env.NEXT_PUBLIC_BUY_URL),
  x: envOrNull(process.env.NEXT_PUBLIC_X_URL),
  telegram: envOrNull(process.env.NEXT_PUBLIC_TELEGRAM_URL),
  chainName: "Robinhood Chain",
  rewardAsset: {
    symbol: "NVDA",
    name: "NVDA Stock Token",
    /** How the asset is described to users. */
    label: "tokenized NVIDIA",
  },
  year: 2026,
} as const;

export const tokenomics = {
  supply: 1_000_000_000,
  fees: { buyBps: 200, sellBps: 200 },
  /** Where each 2% fee goes, expressed as % of trade volume and share of the fee. */
  split: [
    {
      key: "rewards",
      label: "NVDA Rewards",
      pctOfVolume: 1,
      shareOfFee: 50,
      description: "Swapped into NVDA Stock Token and sent to the reward vault.",
      tone: "accent",
    },
    {
      key: "liquidity",
      label: "Liquidity",
      pctOfVolume: 0.5,
      shareOfFee: 25,
      description: "Deepens the NVID pool so the price moves less per trade.",
      tone: "foreground",
    },
    {
      key: "treasury",
      label: "Treasury",
      pctOfVolume: 0.5,
      shareOfFee: 25,
      description: "Funds listings, market making and the team. Pausable, owner-controlled.",
      tone: "muted",
    },
  ],
} as const;

export type SplitTone = (typeof tokenomics.split)[number]["tone"];

export const navLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#tokenomics", label: "Tokenomics" },
  { href: "/rewards", label: "Rewards" },
] as const;
