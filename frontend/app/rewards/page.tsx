import type { Metadata } from "next";
import { FadeUp } from "@/components/motion";
import { LiveStats } from "@/components/LiveStats";
import { RewardsDashboard } from "@/components/RewardsDashboard";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Rewards",
  description: "Your NVID balance, pending NVDA Stock Token and claim history.",
};

const notes = [
  {
    title: "Accrues on every block",
    body: "Your share is computed from your NVID balance the moment rewards land in the vault. No staking, no snapshot, no lock-up.",
  },
  {
    title: "Paid in NVDA Stock Token",
    body: "Claiming transfers tokenized NVIDIA straight to your wallet on Robinhood Chain. Gas is paid in ETH.",
  },
  {
    title: "Nothing is custodied",
    body: "The vault holds NVDA until you claim. This page only reads the chain and never asks for approvals.",
  },
];

export default function RewardsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-32 lg:px-10 lg:pt-40">
      <FadeUp>
        <span className="eyebrow">Rewards</span>
        <h1 className="display mt-3 text-4xl md:text-6xl">Your share of the vault.</h1>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground md:text-base">
          Connect the wallet that holds NVID to see what it has earned in {siteConfig.rewardAsset.name} and claim it.
        </p>
      </FadeUp>

      <FadeUp delay={0.1} className="mt-12">
        <RewardsDashboard />
      </FadeUp>

      <div className="mt-6">
        <LiveStats compact />
      </div>

      <FadeUp className="mt-24 grid gap-10 border-t border-border pt-12 md:grid-cols-3">
        {notes.map((note) => (
          <div key={note.title}>
            <h2 className="text-[15px] font-medium">{note.title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{note.body}</p>
          </div>
        ))}
      </FadeUp>
    </div>
  );
}
