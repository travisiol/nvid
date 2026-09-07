"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

interface WalletButtonProps {
  size?: "default" | "sm" | "lg";
  className?: string;
  fullWidth?: boolean;
}

/** RainbowKit's connect flow, rendered with the site's own button. */
export function WalletButton({ size = "default", className, fullWidth }: WalletButtonProps) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted, authenticationStatus }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            className={cn(!ready && "pointer-events-none opacity-0", fullWidth && "w-full", className)}
            aria-hidden={!ready}
          >
            {!connected ? (
              <Button size={size} onClick={openConnectModal} className={cn(fullWidth && "w-full")}>
                Connect wallet
              </Button>
            ) : chain.unsupported ? (
              <Button
                size={size}
                variant="outline"
                onClick={openChainModal}
                className={cn("border-destructive/30 text-destructive hover:border-destructive/50", fullWidth && "w-full")}
              >
                Wrong network
              </Button>
            ) : (
              <Button
                size={size}
                variant="outline"
                onClick={openAccountModal}
                className={cn("tabular gap-2.5", fullWidth && "w-full")}
              >
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                {account.displayName ?? shortAddress(account.address)}
              </Button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
