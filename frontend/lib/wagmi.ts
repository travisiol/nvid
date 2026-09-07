import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import { supportedChains } from "./chains";
import { siteConfig } from "./site";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

const transports = Object.fromEntries(supportedChains.map((chain) => [chain.id, http()]));

/**
 * With a WalletConnect project id: RainbowKit's full default wallet list.
 * Without one: injected wallets only, so the app still works out of the box
 * instead of throwing at boot.
 */
export const wagmiConfig: Config = projectId
  ? getDefaultConfig({
      appName: siteConfig.name,
      appDescription: siteConfig.description,
      appUrl: siteConfig.url,
      projectId,
      chains: supportedChains,
      transports,
      ssr: true,
    })
  : createConfig({
      chains: supportedChains,
      connectors: connectorsForWallets(
        [{ groupName: "Browser wallets", wallets: [injectedWallet] }],
        { appName: siteConfig.name, projectId: "injected-only" },
      ),
      transports,
      ssr: true,
    });

export const hasWalletConnect = Boolean(projectId);
