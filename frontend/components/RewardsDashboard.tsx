"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletButton } from "@/components/WalletButton";
import { EASE } from "@/components/motion";
import { useMounted } from "@/hooks/useMounted";
import { useRewards, type ClaimStatus } from "@/hooks/useRewards";
import { explorerTxUrl } from "@/lib/chains";
import { formatTokenAmount, shortAddress } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

// ─── Building blocks ─────────────────────────────────────────────────────────

function Field({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow">{label}</span>
      <div className={cn("tabular text-2xl font-medium tracking-[-0.02em] md:text-[1.75rem]", accent && "text-accent")}>
        {children}
      </div>
    </div>
  );
}

function Centered({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center gap-6 px-8 py-16 text-center">
      <span className="eyebrow">Rewards</span>
      <h3 className="display max-w-md text-2xl md:text-3xl">{title}</h3>
      <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

function Fade({ id, children }: { id: string; children: ReactNode }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function StatusLine({
  status,
  error,
  txUrl,
  hasPending,
  onReset,
}: {
  status: ClaimStatus;
  error: string | null;
  txUrl: string | null;
  hasPending: boolean;
  onReset: () => void;
}) {
  const base = "flex items-start gap-2.5 text-[13px] leading-relaxed";

  if (status === "signing") {
    return (
      <p className={cn(base, "text-muted-foreground")}>
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden />
        Confirm the transaction in your wallet.
      </p>
    );
  }
  if (status === "confirming") {
    return (
      <p className={cn(base, "text-muted-foreground")}>
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden />
        <span>
          Confirming on {siteConfig.chainName}…
          {txUrl && (
            <>
              {" "}
              <a href={txUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                View transaction
              </a>
            </>
          )}
        </span>
      </p>
    );
  }
  if (status === "success") {
    return (
      <div className={cn(base, "text-foreground")} role="status">
        <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
        <span>
          Rewards claimed. NVDA Stock Token is in your wallet.
          {txUrl && (
            <>
              {" "}
              <a href={txUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                View transaction <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          )}{" "}
          <button type="button" onClick={onReset} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Dismiss
          </button>
        </span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className={cn(base, "text-destructive")} role="alert">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          {error}{" "}
          <button type="button" onClick={onReset} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Try again
          </button>
        </span>
      </div>
    );
  }
  return (
    <p className={cn(base, "text-muted-foreground")}>
      {hasPending
        ? "Claiming sends NVDA Stock Token straight to this wallet. Gas is paid in ETH."
        : "Nothing to claim yet. Rewards accrue as trades happen."}
    </p>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function RewardsDashboard() {
  const mounted = useMounted();
  const r = useRewards();
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!r.address) return;
    try {
      await navigator.clipboard.writeText(r.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  const txUrl = r.txHash ? explorerTxUrl(r.chain, r.txHash) : null;

  let view: ReactNode;
  let key: string;

  if (!mounted) {
    key = "boot";
    view = <LoadingView />;
  } else if (!r.isConnected) {
    key = "disconnected";
    view = (
      <Centered
        title="Connect a wallet to see your rewards."
        body="Your NVID balance, pending NVDA and claim history live here. Nothing is stored — the page only reads the chain."
      >
        <WalletButton size="lg" />
      </Centered>
    );
  } else if (r.wrongNetwork) {
    key = "network";
    view = (
      <Centered
        title={`Switch to ${siteConfig.chainName}.`}
        body="Your wallet is connected to a network NVID does not live on."
      >
        <WalletButton size="lg" />
      </Centered>
    );
  } else if (!r.isDeployed) {
    key = "undeployed";
    view = (
      <Centered
        title="Contracts are not deployed on this network yet."
        body={`Connected as ${r.address ? shortAddress(r.address) : "—"}. The rewards dashboard activates the moment the vault address is published.`}
      />
    );
  } else if (r.isLoading) {
    key = "loading";
    view = <LoadingView />;
  } else {
    key = "ready";
    const buttonLabel =
      r.status === "signing" ? "Waiting for wallet…" : r.status === "confirming" ? "Confirming…" : "Claim NVDA";
    const hasPending = (r.pending ?? 0n) > 0n;

    view = (
      <div className="grid lg:grid-cols-[1fr_400px]">
        <div className="grid gap-10 p-8 sm:grid-cols-2 lg:p-10">
          <Field label="Wallet address">
            <button
              type="button"
              onClick={copyAddress}
              className="inline-flex items-center gap-2.5 rounded-md text-left transition-colors hover:text-muted-foreground"
              aria-label="Copy wallet address"
            >
              {r.address ? shortAddress(r.address, 5) : "—"}
              {copied ? (
                <Check className="size-4 text-accent" aria-hidden />
              ) : (
                <Copy className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              )}
            </button>
          </Field>
          <Field label="NVID balance">
            {formatTokenAmount(r.balance, r.nvidDecimals)} <span className="text-base text-muted-foreground">NVID</span>
          </Field>
          <Field label="Pending NVDA" accent={hasPending}>
            {formatTokenAmount(r.pending, r.nvdaDecimals)} <span className="text-base text-muted-foreground">NVDA</span>
          </Field>
          <Field label="Total claimed">
            {formatTokenAmount(r.claimed, r.nvdaDecimals)} <span className="text-base text-muted-foreground">NVDA</span>
          </Field>
        </div>

        <div className="flex flex-col justify-between gap-10 border-t border-border bg-[#090909] p-8 lg:border-l lg:border-t-0 lg:p-10">
          <div>
            <span className="eyebrow">Claimable now</span>
            <div className="tabular mt-3 flex items-baseline gap-2">
              <span className={cn("text-4xl font-medium tracking-[-0.03em]", hasPending && "text-accent")}>
                {formatTokenAmount(r.pending, r.nvdaDecimals)}
              </span>
              <span className="text-sm text-muted-foreground">NVDA</span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Button
              variant={hasPending ? "accent" : "outline"}
              size="lg"
              className="w-full"
              onClick={() => void r.claim()}
              disabled={!r.canClaim}
            >
              {(r.status === "signing" || r.status === "confirming") && (
                <Loader2 className="animate-spin" aria-hidden />
              )}
              {buttonLabel}
            </Button>
            <StatusLine status={r.status} error={r.error} txUrl={txUrl} hasPending={hasPending} onReset={r.reset} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <AnimatePresence mode="wait" initial={false}>
        <Fade id={key}>{view}</Fade>
      </AnimatePresence>
    </Card>
  );
}

function LoadingView() {
  return (
    <div className="grid lg:grid-cols-[1fr_400px]" aria-busy="true" aria-label="Loading rewards">
      <div className="grid gap-10 p-8 sm:grid-cols-2 lg:p-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-40" />
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-between gap-10 border-t border-border bg-[#090909] p-8 lg:border-l lg:border-t-0 lg:p-10">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-13 w-full rounded-full" />
      </div>
    </div>
  );
}
