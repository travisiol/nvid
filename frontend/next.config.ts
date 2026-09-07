import type { NextConfig } from "next";

/**
 * wagmi's Base Account connector dynamically imports `@base-org/account`,
 * whose Node build reaches for optional `@x402/*` payment packages that are
 * not installed and never executed in this app. The bundler still tries to
 * resolve them at build time, so they are aliased to an empty module.
 */
const OPTIONAL_MODULES = [
  "@x402/core",
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm",
  "@x402/svm/exact/client",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Static export: every route is prerendered into `frontend/out`, so the site
   * deploys from the repository root on Vercel (see ../vercel.json) or on any
   * static host. Nothing here needs a server — wallet and chain reads happen
   * in the browser. Remove this line if you add API routes or server actions,
   * and point Vercel's Root Directory at `frontend` instead.
   */
  output: "export",
  images: { unoptimized: true },
  webpack: (config) => {
    // WalletConnect / RainbowKit pull in optional Node-only modules.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(OPTIONAL_MODULES.map((name) => [name, false])),
    };
    return config;
  },
  turbopack: {
    resolveAlias: Object.fromEntries(OPTIONAL_MODULES.map((name) => [name, "./lib/empty.ts"])),
  },
};

export default nextConfig;
