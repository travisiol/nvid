"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, type Theme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { siteConfig } from "@/lib/site";
import { wagmiConfig } from "@/lib/wagmi";

const base = darkTheme({
  accentColor: "#76B900",
  accentColorForeground: "#050505",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

/** RainbowKit re-skinned to the site palette so the modal never looks foreign. */
const theme: Theme = {
  ...base,
  colors: {
    ...base.colors,
    modalBackground: "#0D0D0D",
    modalBackdrop: "rgba(5, 5, 5, 0.72)",
    modalBorder: "#1A1A1A",
    modalText: "#F5F5F5",
    modalTextSecondary: "#7A7A7A",
    modalTextDim: "#5A5A5A",
    generalBorder: "#1A1A1A",
    generalBorderDim: "#141414",
    profileForeground: "#0D0D0D",
    profileAction: "#141414",
    profileActionHover: "#1C1C1C",
    connectButtonBackground: "#0D0D0D",
    connectButtonInnerBackground: "#141414",
    connectButtonText: "#F5F5F5",
    menuItemBackground: "#141414",
    closeButtonBackground: "#141414",
    closeButton: "#7A7A7A",
    actionButtonBorder: "#1A1A1A",
    actionButtonBorderMobile: "#1A1A1A",
    actionButtonSecondaryBackground: "#141414",
    selectedOptionBorder: "rgba(118, 185, 0, 0.45)",
    connectionIndicator: "#76B900",
    downloadBottomCardBackground: "#0D0D0D",
    downloadTopCardBackground: "#141414",
  },
  fonts: {
    body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  radii: {
    ...base.radii,
    modal: "24px",
    modalMobile: "24px",
    menuButton: "16px",
    actionButton: "9999px",
    connectButton: "9999px",
  },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} appInfo={{ appName: siteConfig.name }} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
