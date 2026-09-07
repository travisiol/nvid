# NVID — Buy the token. Earn NVIDIA.

A premium memecoin on **Robinhood Chain** whose holders earn **NVDA Stock Token** (tokenized NVIDIA).
Every trade pays a 2% fee. Half of it is swapped into NVDA and dropped into a vault that pays holders
pro rata — no staking, no lock-up, no loop over holders.

```
/frontend   Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion · three.js · wagmi + RainbowKit · ethers v6
/contracts  Solidity 0.8.28 · Hardhat 2 · OpenZeppelin 5 · 26 passing tests · ABI export into the frontend
```

---

## How it works

```
        buy / sell on the DEX
                │  2% fee
                ▼
        ┌──────────────┐  collect()   ┌──────────────────────┐
        │  NVIDToken   │ ───────────▶ │     FeeCollector     │
        │  (ERC20)     │              │  50% → rewards bucket│──swapToNVDA()──▶ DEX (Uniswap V3 router)
        └──────┬───────┘              │  25% → liquidity     │                      │ NVDA
               │ onBalanceChange()    │  25% → Treasury      │◀─────────────────────┘
               ▼                      └──────────┬───────────┘
        ┌──────────────┐   sendToVault()         │
        │ RewardVault  │◀────────────────────────┘
        │ rewardPerToken accounting · pendingRewards(addr) · claim()
        └──────────────┘
```

| Fee on every trade | 2% buy · 2% sell (capped at 5% in the contract)         |
| ------------------ | ------------------------------------------------------- |
| NVDA rewards       | 1% of volume — 50% of the fee, swapped to NVDA          |
| Liquidity          | 0.5% of volume — 25% of the fee, to the LP manager      |
| Treasury           | 0.5% of volume — 25% of the fee, to the Treasury vault  |
| Supply             | 1,000,000,000 NVID, fixed, minted once at deployment    |

Wallet-to-wallet transfers are free. Only transfers that touch a registered AMM pair are taxed.

---

## Smart contracts (`/contracts`)

| Contract           | Role                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NVIDToken.sol`    | ERC20, 1B supply. Buy/sell fee in bps, fee exclusions, AMM pair registry, `updateFeeReceiver()`. Reports every balance change to the vault.                |
| `FeeCollector.sol` | Receives fees. `collect()` splits 50/25/25, `swapToNVDA()` through a replaceable `IUniswapV3SwapRouter`, `sendToVault()` pushes NVDA and notifies the vault. |
| `RewardVault.sol`  | Holds NVDA. `depositRewards()`, `notifyRewardAmount()`, `pendingRewards(addr)`, `claim()`. O(1) reward-per-token accounting, packed storage.                |
| `Treasury.sol`     | Owner vault for the treasury share. `withdraw()`, `withdrawETH()`, `emergencyPause()`, `unpause()`. `Ownable` + `Pausable`.                                 |

### Reward accounting

The vault never iterates holders. It keeps one global `rewardPerTokenStored` and, per account,
the value it was last settled at plus an `owed` balance:

```
pending(a) = owed[a] + tracked[a] × (rewardPerTokenStored − paidPerToken[a]) / 1e18
```

`NVIDToken._update()` calls `vault.onBalanceChange()` for both sides of every transfer, so the
settlement happens exactly when a balance moves. Accounts flagged **excluded** (deployer, the AMM
pool, the FeeCollector, the Treasury, the burn address) hold NVID without earning. `sync(addr)` is
permissionless and re-reads a balance the vault never heard about.

`notifyRewardAmount()` is permissionless but bounded by `unaccountedRewards()`: nobody can promise
holders NVDA the vault does not actually hold.

### Quick start

```bash
cd contracts
npm install
npx hardhat test          # 26 tests — includes the Alice 1000 / Bob 500 / 150 NVDA → 100 / 50 scenario
```

Every `hardhat compile` (and therefore every `test`) re-exports the ABIs to `frontend/lib/abi/`.
Set `SKIP_ABI_EXPORT=true` to disable.

### Deploy

```bash
cd contracts
cp .env.example .env      # fill DEPLOYER_PRIVATE_KEY, NVDA_TOKEN_ADDRESS, optionally SWAP_ROUTER_ADDRESS / SWAP_PATH / OWNER_ADDRESS
npm run deploy:robinhood
```

The script deploys Treasury → NVIDToken → RewardVault → FeeCollector, wires them, excludes the
usual suspects from rewards, hands ownership to `OWNER_ADDRESS` if set, writes
`contracts/deployments/robinhood.json` and regenerates `frontend/lib/abi/deployments.ts`.
The frontend picks the addresses up by chain id with no further config.

`npm run deploy:local` does the same on the in-process Hardhat network with a `MockERC20` standing
in for NVDA.

**After deploying:**

1. Create the NVID pool and register it: `token.setAmmPair(pool, true)` and `vault.setExcluded(pool, true)`.
2. If not set at deploy: `collector.setSwapRouter(router)` and `collector.setSwapPath(path)` — `path` is a
   Uniswap V3 encoded path `NVID | fee | … | NVDA`.
3. Run `collector.process(minOut)` from the owner or a keeper. It collects, swaps the whole bucket and
   notifies the vault in one transaction.

### Network

| Name           | Chain id | RPC                                            |
| -------------- | -------- | ---------------------------------------------- |
| Robinhood Chain | 4663     | `https://rpc.mainnet.chain.robinhood.com`       |

Explorer URLs for `hardhat verify` go in `.env` (`ROBINHOOD_EXPLORER_API_URL`, `ROBINHOOD_EXPLORER_URL`).
Hardhat compiles for `paris` by default; set `SOLIDITY_EVM_VERSION=cancun` once the chain confirms
PUSH0 / MCOPY support.

---

## Frontend (`/frontend`)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev               # http://localhost:3000
```

| Route      | Content                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `/`        | Hero · Live stats (4 cards) · How it works (3 steps) · Rewards dashboard · Tokenomics with SVG ring · CTA |
| `/rewards` | Focused rewards dashboard + compact stats                                                           |

### Rewards dashboard states

`not connected` → `wrong network` → `contracts not deployed on this chain` → `loading` → data, with a
claim state machine `idle → signing → confirming → success | error`. Everything is derived from
`hooks/useRewards.ts` (wagmi `useReadContracts`, `useWriteContract`, `useWaitForTransactionReceipt`).

### Live stats provider

`lib/data/stats.ts` exposes a `StatsProvider` interface. `NEXT_PUBLIC_STATS_SOURCE=mock` (default)
serves deterministic preview numbers, labelled **Preview data** in the UI. `onchain` reads
`RewardVault.totalDistributed()` / `totalClaimed()` and the Treasury's NVID balance through ethers v6;
holder count and USD price come from an optional indexer endpoint and `NEXT_PUBLIC_NVID_PRICE_USD`,
and render as an em dash when absent rather than being invented.

### Wallets

Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for RainbowKit's full wallet list. Without it the app boots
with injected (browser) wallets only instead of failing.

### Design system

| Token       | Value     |
| ----------- | --------- |
| Background  | `#050505` |
| Card        | `#0D0D0D` |
| Border      | `#1A1A1A` |
| Text        | `#F5F5F5` |
| Muted       | `#7A7A7A` |
| Accent      | `#76B900` (NVIDIA green) |
| Radius      | `24px`    |
| Font        | Inter     |

Motion vocabulary is limited to fade-up, opacity, scale 0.98 → 1 and a soft glow, all in
`components/motion.tsx`, and everything respects `prefers-reduced-motion`. The accent is used for
meaning only: the emblem, live state, the claim action.

### 3D

Two three.js scenes, both lit by a studio environment painted at runtime (no texture, model or HDR
file is shipped):

- **Hero** — `components/three/EyeHero.tsx`: a black clearcoat slab carrying the green emblem, floating
  and tilting toward the pointer, with light spill on the floor and a halo behind.
- **Tokenomics** — `components/three/SplitRing.tsx`: the 2% fee as a three-segment torus (green / chrome /
  graphite), slowly turning.

Both load client-side only via `next/dynamic`, pause when off-screen or in a hidden tab, render a
single static frame under `prefers-reduced-motion`, and fall back to the CSS ring and the SVG donut
when WebGL is unavailable. Cards get physical depth from `components/TiltCard.tsx` (a few degrees of
tilt and a green sheen that follows the cursor).

**The emblem is not NVIDIA's logo.** `lib/emblem.ts` generates an original spiral-into-an-eye ribbon
that feeds both the extrusion and the 2D glyph (`components/EyeMark.tsx`, the favicon). It is
evocative by shape and colour only. If you hold a licence to the real mark, set `CUSTOM_EMBLEM_PATH`
to its SVG path data and every renderer switches to it.

---

## Project structure

```
nvdia/
├── contracts/
│   ├── contracts/
│   │   ├── NVIDToken.sol
│   │   ├── FeeCollector.sol
│   │   ├── RewardVault.sol
│   │   ├── Treasury.sol
│   │   ├── interfaces/   IRewardVault.sol · IUniswapV3SwapRouter.sol
│   │   └── mocks/        MockERC20.sol · MockSwapRouter.sol
│   ├── scripts/          deploy.ts · export-abi.ts · lib/exportAbi.ts
│   ├── test/             NVID.test.ts
│   ├── hardhat.config.ts
│   └── .env.example
└── frontend/
    ├── app/              layout · page · rewards/page · providers · globals.css · icon.svg
    ├── components/       Hero · VaultRing · LiveStats · HowItWorks · RewardsDashboard · Tokenomics · FeeDonut · Navbar · Footer · WalletButton · motion · ui/*
    ├── hooks/            useRewards · useStats · useMounted
    ├── lib/              site · chains · wagmi · contracts · format · data/stats · abi/* (generated)
    └── .env.example
```

---

## Deploy

The repository deploys **from its root** on Vercel with no project settings: `vercel.json` installs
and builds `frontend/` and serves the static export in `frontend/out`. Import the repository,
leave Root Directory empty, deploy.

The frontend uses `output: "export"` because nothing in it needs a server — every route is
prerendered and wallet / chain reads happen in the browser. If you later add API routes or server
actions, remove that line from `frontend/next.config.ts`, delete `vercel.json`, and set the Vercel
project’s **Root Directory** to `frontend`.

Environment variables for production go in the Vercel project (Settings → Environment Variables);
the list is in `frontend/.env.example`.

## Before mainnet

- **NVDA Stock Token address** on Robinhood Chain must be confirmed from the issuer; a wrong address routes
  real fees to the wrong contract.
- **DEX router**: `IUniswapV3SwapRouter` matches the original SwapRouter (with `deadline`). For a
  SwapRouter02-only deployment, put a thin adapter in front or override `FeeCollector._swap()`.
- **Regulatory read**: paying holders in tokenized equities distributes securities exposure. Get a
  compliance opinion before launch.
- **Ownership**: hand all four contracts to a multisig (`OWNER_ADDRESS`). The owner can change fees
  (≤ 5%), fee receiver, exclusions and the swap router; it cannot mint or take holder rewards.
- **Trademarks**: NVID is not affiliated with NVIDIA Corporation or Robinhood Markets, Inc. The footer
  says so; keep it.

## License

MIT
